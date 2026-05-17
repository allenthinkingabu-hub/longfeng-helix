package com.longfeng.anonymousservice;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Date;
import java.util.UUID;
import javax.crypto.SecretKey;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * SC-13 · GET /api/share/:shareToken · 端到端 IT against real PG + real Redis.
 *
 * <p>4 testcase per inflight scope_in #8:
 * <ol>
 *   <li>{@code valid_share_token_returns_ShareDto_with_masked_fields}
 *       — 200 + ShareDto 字段白名单严格 · **反向断言不含 relation_id / student_email / original_image_url**
 *   <li>{@code expired_token_returns_410} — DB expires_at 过 → 410 TOKEN_EXPIRED
 *   <li>{@code revoked_token_in_redis_returns_403} — 真 Redis SET share:revoked SADD jti → 403 TOKEN_REVOKED
 *   <li>{@code invalid_signature_returns_404} — 错签名 JWT → 404 TOKEN_INVALID
 * </ol>
 *
 * <p>真 PG 15432 + 真 Redis 16379 · 不 mock. 关键 case (a) 用 ObjectMapper.readTree
 * 验证 wire shape 不含 PII 字段名 (脱敏铁律).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SC13ShareE2EIT extends IntegrationTestBase {

    private static final String REVOKED_SET_KEY = "share:revoked";

    @LocalServerPort int port;
    @Autowired DataSource dataSource;
    @Autowired ObjectMapper objectMapper;
    @Autowired StringRedisTemplate redis;

    @Value("${anon.jwt.secret}") String jwtSecret;
    @Value("${anon.jwt.issuer}") String jwtIssuer;
    @Value("${anon.jwt.audience}") String jwtAudience;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    private JdbcTemplate jdbc;

    @BeforeEach
    void setUp() {
        jdbc = new JdbcTemplate(dataSource);
        // Clean test rows from previous runs (jti prefix isolates SC-13 fixtures)
        jdbc.update("DELETE FROM share_token WHERE jti LIKE 'sc13-%'");
        // Drain any leftover revoked jtis from prior runs (set contains short lifetimes)
        redis.delete(REVOKED_SET_KEY);
    }

    // ──────────────────────────────────────────────────────────────────────
    // (a) TC-13.01 / 13.02 — valid token → 200 + 字段白名单严格
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void valid_share_token_returns_ShareDto_with_masked_fields() throws Exception {
        String jti = "sc13-valid-" + UUID.randomUUID();
        // DB: ACTIVE + future expires_at
        insertShareToken(jti, /*status*/(short) 1, OffsetDateTime.now().plusDays(2),
                /*sharerStudentId*/ 12345L, "QUESTION", "wb_question:42");
        String jwt = signShareJwt(jti, /*expDeltaSec*/ 60 * 60 * 24 * 2);

        HttpResponse<String> resp = getShare(jwt);
        assertThat(resp.statusCode()).isEqualTo(200);

        // Cache-Control: no-store header asserted
        assertThat(resp.headers().firstValue("Cache-Control")).hasValue("no-store");

        // ── 脱敏铁律 · 反向断言 ────────────────────────────────────────
        // 1) JSON tree 不含任何 PII 字段名 (硬卡口 audit 维度)
        String bodyText = resp.body();
        assertThat(bodyText)
                .as("response body 严禁包含 relation_id (脱敏铁律 SC-13 第一红线)")
                .doesNotContain("relation_id");
        assertThat(bodyText)
                .as("response body 严禁包含 student_email")
                .doesNotContain("student_email");
        assertThat(bodyText)
                .as("response body 严禁包含 original_image_url")
                .doesNotContain("original_image_url");
        assertThat(bodyText)
                .as("response body 严禁包含 sharer_student_id (raw PII)")
                .doesNotContain("sharer_student_id");

        // 2) 严格白名单 · 仅 5 个顶级 key
        JsonNode body = objectMapper.readTree(bodyText);
        assertThat(body.path("type").asText()).isEqualTo("QUESTION");
        assertThat(body.path("sharerNickMasked").asText())
                .as("sharer 必须是 X*** 形态 · 不下发真姓名")
                .matches("^[A-Z]\\*\\*\\*$");
        assertThat(body.path("ttlSec").asLong()).isPositive();
        assertThat(body.path("signatureValid").asBoolean()).isTrue();
        assertThat(body.has("maskedPayload")).isTrue();

        // 3) maskedPayload 也严格白名单
        JsonNode mp = body.path("maskedPayload");
        assertThat(mp.path("stemSnippet").asText()).isNotBlank();
        assertThat(mp.path("stemSnippet").asText())
                .as("stemSnippet 应为前 12 字 mask · 不含完整原题")
                .hasSizeLessThanOrEqualTo(20);
        assertThat(mp.path("kpVisible").isArray()).isTrue();
        assertThat(mp.path("kpVisible").size()).isLessThanOrEqualTo(2);
        assertThat(mp.path("kpLockedCount").asInt()).isGreaterThanOrEqualTo(0);
        assertThat(mp.has("imgThumbBlurred")).isTrue();
    }

    // ──────────────────────────────────────────────────────────────────────
    // (b) TC-13.03 — expired (DB) → 410 TOKEN_EXPIRED
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void expired_token_returns_410() throws Exception {
        String jti = "sc13-expired-" + UUID.randomUUID();
        // DB expires_at 1h ago · JWT also expired (matched signal)
        insertShareToken(jti, (short) 1, OffsetDateTime.now().minusHours(1), 12345L, "QUESTION", "wb_question:42");
        String jwt = signShareJwt(jti, -60 * 60); // signed exp 1h ago

        HttpResponse<String> resp = getShare(jwt);
        assertThat(resp.statusCode()).isEqualTo(410);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("code").asText()).isEqualTo("TOKEN_EXPIRED");
        // 挡板态也 no-store
        assertThat(resp.headers().firstValue("Cache-Control")).hasValue("no-store");
    }

    // ──────────────────────────────────────────────────────────────────────
    // (c) — Redis SET share:revoked 命中 → 403 TOKEN_REVOKED
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void revoked_token_in_redis_returns_403() throws Exception {
        String jti = "sc13-revoked-" + UUID.randomUUID();
        // DB ACTIVE + 未过 but jti 在 Redis 撤销集
        insertShareToken(jti, (short) 1, OffsetDateTime.now().plusDays(2), 12345L, "QUESTION", "wb_question:42");
        redis.opsForSet().add(REVOKED_SET_KEY, jti);
        String jwt = signShareJwt(jti, 60 * 60 * 24);

        HttpResponse<String> resp = getShare(jwt);
        assertThat(resp.statusCode()).isEqualTo(403);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("code").asText()).isEqualTo("TOKEN_REVOKED");
    }

    // ──────────────────────────────────────────────────────────────────────
    // (d) TC-13.04 边界 — 签名错 → 404 TOKEN_INVALID
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void invalid_signature_returns_404() throws Exception {
        // 用一个完全不同的 secret 签 · 验签必然失败
        SecretKey wrongKey = Keys.hmacShaKeyFor(
                "wrong-secret-bytes-for-test-but-still-at-least-256-bits-please-ignore".getBytes(StandardCharsets.UTF_8));
        Instant now = Instant.now();
        String badJwt = Jwts.builder()
                .id("sc13-invalid-" + UUID.randomUUID())
                .issuer(jwtIssuer)
                .audience().add(jwtAudience).and()
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(3600)))
                .signWith(wrongKey, Jwts.SIG.HS256)
                .compact();

        HttpResponse<String> resp = getShare(badJwt);
        assertThat(resp.statusCode()).isEqualTo(404);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("code").asText()).isEqualTo("TOKEN_INVALID");
    }

    // ──────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────
    private String signShareJwt(String jti, long expDeltaSeconds) {
        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
        Instant now = Instant.now();
        Instant exp = now.plusSeconds(expDeltaSeconds);
        return Jwts.builder()
                .id(jti)
                .issuer(jwtIssuer)
                .audience().add(jwtAudience).and()
                .issuedAt(Date.from(now))
                .expiration(Date.from(exp))
                .signWith(key, Jwts.SIG.HS256)
                .compact();
    }

    private HttpResponse<String> getShare(String jwt) throws Exception {
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create("http://127.0.0.1:" + port + "/api/share/" + jwt))
                .header("Accept", "application/json")
                .GET()
                .timeout(Duration.ofSeconds(10))
                .build();
        return httpClient.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }

    private void insertShareToken(
            String jti,
            short status,
            OffsetDateTime expiresAt,
            long sharerStudentId,
            String shareType,
            String relationId) {
        long nextId = jdbc.queryForObject("SELECT COALESCE(MAX(id),0)+1 FROM share_token", Long.class);
        jdbc.update(
                "INSERT INTO share_token(id, jti, sharer_student_id, share_type, relation_id, allow_claim, "
                        + "usage_limit, usage_count, status, created_at, expires_at) "
                        + "VALUES (?, ?, ?, ?, ?, true, 1000, 0, ?, now(), ?)",
                nextId, jti, sharerStudentId, shareType, relationId,
                status, java.sql.Timestamp.from(expiresAt.toInstant()));
    }
}
