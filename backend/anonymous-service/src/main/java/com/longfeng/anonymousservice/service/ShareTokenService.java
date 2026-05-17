package com.longfeng.anonymousservice.service;

import com.longfeng.anonymousservice.dto.MaskedPayloadDto;
import com.longfeng.anonymousservice.dto.ShareDto;
import com.longfeng.anonymousservice.entity.ShareToken;
import com.longfeng.anonymousservice.repo.ShareTokenRepository;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import javax.crypto.SecretKey;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/**
 * SC-13 · 分享令牌核心服务 — HS256 验签 + Redis 撤销集 + DB 查询.
 *
 * <p>biz §2B.14 流程:
 * <ol>
 *   <li>HS256 验签 (复用 anon.jwt.secret · 与 auth-service / SessionResolve 完全一致)
 *   <li>解 jti / exp / payload (sharer_student_id, share_type, relation_id)
 *   <li>Redis SET {@code share:revoked} SISMEMBER 命中 → 403 TOKEN_REVOKED
 *   <li>DB share_token WHERE jti AND status=1 ACTIVE AND expires_at > now() → 200 ShareDto
 *   <li>任一失败映射到 {@link ShareLookupOutcome.Kind}
 * </ol>
 *
 * <p><b>脱敏铁律</b>: 本 service 是唯一允许 touch share_token entity (含 PII 字段)
 * 的层 · 返出的 ShareDto + MaskedPayloadDto 严格字段白名单 · 严禁 entity 直接 leak.
 *
 * <p>P0: maskedPayload 通过 share_type 静态拼装 (QUESTION → hardcoded sample).
 * P1: backend RPC fetch wb_question by relation_id then derive stemSnippet
 * (relation_id stays server-side · never wire-encoded).
 */
@Service
public class ShareTokenService {

    private static final Logger LOG = LoggerFactory.getLogger(ShareTokenService.class);

    /** Redis SET key for revoked jtis · biz §4.11 + §10.9 "Redis Bloom Filter". */
    private static final String REVOKED_SET_KEY = "share:revoked";

    private final ShareTokenRepository repo;
    private final StringRedisTemplate redis;
    private final SecretKey signingKey;
    private final String expectedIssuer;
    private final String expectedAudience;

    public ShareTokenService(
            ShareTokenRepository repo,
            StringRedisTemplate redis,
            @Value("${anon.jwt.secret}") String secret,
            @Value("${anon.jwt.issuer}") String issuer,
            @Value("${anon.jwt.audience}") String audience) {
        this.repo = repo;
        this.redis = redis;
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expectedIssuer = issuer;
        this.expectedAudience = audience;
    }

    /** Decode + lookup outcome — single-pass status discriminator. */
    public ShareLookupOutcome lookup(String shareToken) {
        if (shareToken == null || shareToken.isBlank()) {
            return new ShareLookupOutcome(ShareLookupOutcome.Kind.INVALID, null);
        }
        // ── Step 1: HS256 verify + decode ─────────────────────────────────
        DecodedShare decoded;
        try {
            Jws<Claims> jws = Jwts.parser()
                    .verifyWith(signingKey)
                    .requireIssuer(expectedIssuer)
                    .requireAudience(expectedAudience)
                    .build()
                    .parseSignedClaims(shareToken);
            Claims claims = jws.getPayload();
            String jti = claims.getId();
            if (jti == null || jti.isBlank()) {
                LOG.debug("share_lookup_invalid reason=missing_jti");
                return new ShareLookupOutcome(ShareLookupOutcome.Kind.INVALID, null);
            }
            decoded = new DecodedShare(jti, claims.getExpiration());
        } catch (io.jsonwebtoken.ExpiredJwtException e) {
            // JWT exp claim already past — short circuit to EXPIRED (DB row may still
            // be ACTIVE, but the signed claim is the source of truth for time).
            return new ShareLookupOutcome(ShareLookupOutcome.Kind.EXPIRED, null);
        } catch (Exception e) {
            LOG.debug("share_lookup_invalid reason={}", e.getClass().getSimpleName());
            return new ShareLookupOutcome(ShareLookupOutcome.Kind.INVALID, null);
        }

        // ── Step 2: Redis revoked check ───────────────────────────────────
        try {
            Boolean revoked = redis.opsForSet().isMember(REVOKED_SET_KEY, decoded.jti);
            if (Boolean.TRUE.equals(revoked)) {
                return new ShareLookupOutcome(ShareLookupOutcome.Kind.REVOKED, null);
            }
        } catch (Exception e) {
            LOG.warn("redis_revoked_check_failed jti={} reason={}", maskJti(decoded.jti), e.toString());
            // 降级: Redis 不可用时 fall through to DB (biz §10.9 实际容忍 Bloom 短时不可用)
        }

        // ── Step 3: DB lookup ─────────────────────────────────────────────
        Optional<ShareToken> opt = repo.findByJti(decoded.jti);
        if (opt.isEmpty()) {
            return new ShareLookupOutcome(ShareLookupOutcome.Kind.INVALID, null);
        }
        ShareToken row = opt.get();

        if (row.getStatus() == 3) {
            return new ShareLookupOutcome(ShareLookupOutcome.Kind.REVOKED, null);
        }
        if (row.getStatus() == 2 || row.getExpiresAt() == null
                || row.getExpiresAt().isBefore(OffsetDateTime.now())) {
            return new ShareLookupOutcome(ShareLookupOutcome.Kind.EXPIRED, null);
        }
        if (row.getStatus() != 1) {
            // 4 EXHAUSTED 等其他状态 → 视为 INVALID (P0 不区分)
            return new ShareLookupOutcome(ShareLookupOutcome.Kind.INVALID, null);
        }

        // ── Step 4: 成功 — 拼装脱敏 ShareDto (字段白名单严格) ─────────────
        long ttlSec = Math.max(0, OffsetDateTime.now().until(row.getExpiresAt(), java.time.temporal.ChronoUnit.SECONDS));
        ShareDto dto = new ShareDto(
                row.getShareType(),
                maskSharerNick(row.getSharerStudentId()),
                ttlSec,
                true,
                buildMaskedPayload(row.getShareType()));
        return new ShareLookupOutcome(ShareLookupOutcome.Kind.SUCCESS, dto);
    }

    /**
     * P0 脱敏: 用 student_id 末位 hash 出固定首字母 · 后跟 ***.
     * student_id 本身永不下发.
     */
    private static String maskSharerNick(Long sharerId) {
        if (sharerId == null) return "X***";
        // pick A-Z by id mod 26 — purely cosmetic, not reversible
        char letter = (char) ('A' + Math.floorMod(sharerId.intValue(), 26));
        return letter + "***";
    }

    /**
     * P0 字段白名单 maskedPayload — 不查 wb_question, 直接构造合规结构.
     * 这避免了 relation_id / 原始题干 / original_image_url 经任何路径 leak.
     * P1 改用 wrongbook-service RPC by relation_id (内部调用 · 不上 wire).
     */
    private static MaskedPayloadDto buildMaskedPayload(String shareType) {
        // QUESTION 型 · biz §2A.3.2 P-SHARED 规格卡固定示例
        // (这些字符串安全 · 不含真用户 PII)
        if ("QUESTION".equals(shareType)) {
            return new MaskedPayloadDto(
                    "设 f(x) = 2x² − 4x",
                    List.of("二次函数", "最值问题"),
                    2,
                    true);
        }
        // EXAM_DAY / REVIEW_NODE · P0 fallback to QUESTION 视觉
        return new MaskedPayloadDto(
                "近 30 天 8 次错题",
                List.of("二次函数", "概率"),
                3,
                false);
    }

    private static String maskJti(String jti) {
        if (jti == null || jti.length() < 8) return "***";
        return jti.substring(0, 4) + "***" + jti.substring(jti.length() - 4);
    }

    /** Internal — JWT decode result · stays in-service. */
    private record DecodedShare(String jti, java.util.Date exp) {}

    /** Public — controller maps {@link Kind} to HTTP status. */
    public static final class ShareLookupOutcome {
        public enum Kind { SUCCESS, EXPIRED, INVALID, REVOKED }
        private final Kind kind;
        private final ShareDto dto;
        ShareLookupOutcome(Kind kind, ShareDto dto) { this.kind = kind; this.dto = dto; }
        public Kind getKind() { return kind; }
        public ShareDto getDto() { return dto; }
    }
}
