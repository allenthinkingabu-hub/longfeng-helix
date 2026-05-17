package com.longfeng.anonymousservice.service;

import com.longfeng.anonymousservice.dto.ObserverContextDto;
import com.longfeng.anonymousservice.dto.ResolveRequest;
import com.longfeng.anonymousservice.dto.ResolveResponse;
import com.longfeng.anonymousservice.dto.ShareContextDto;
import java.sql.ResultSet;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Optional;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Service;

/**
 * SC-00-T02 · biz §2A.3.1 决策树 3 节点服务.
 *
 * <p>Three nodes, in priority order:
 * <ol>
 *   <li><b>Node 1</b> — Authorization Bearer JWT (HS256, verified by {@link JwtVerifier})
 *       and URL path does NOT contain /s/:token nor /observer/:code → {@code HOME}
 *   <li><b>Node 2</b> — share_token present → look up {@code share_token} table;
 *       row + status=ACTIVE + not expired → {@code SHARED + shareContext};
 *       node 2 failure (expired/revoked/missing) → graceful {@code LANDING}
 *       (NOT LOGIN — biz patch "expired share must not push user to a wall")
 *   <li><b>Node 2'</b> — observerCode present → look up {@code observer_invite};
 *       PENDING + not expired → {@code OBSERVER + observerContext}; else {@code LANDING}
 *   <li><b>Node 3</b> — P0 short-circuit. Even if {@code account_device} has a soft
 *       binding, we always return {@code LANDING}. SC-14 (P1) flips the switch.
 * </ol>
 */
@Service
public class DecisionTreeService {

    private static final Logger LOG = LoggerFactory.getLogger(DecisionTreeService.class);

    private final JdbcTemplate jdbc;
    private final JwtVerifier jwtVerifier;

    public DecisionTreeService(DataSource dataSource, JwtVerifier jwtVerifier) {
        this.jdbc = new JdbcTemplate(dataSource);
        this.jwtVerifier = jwtVerifier;
    }

    /** Path is /s/:token or /observer/:code — backend must honour the deeplink even if JWT is present. */
    private boolean isDeeplinkPath(ResolveRequest req) {
        return (req.getShareToken() != null && !req.getShareToken().isBlank())
                || (req.getObserverCode() != null && !req.getObserverCode().isBlank());
    }

    public ResolveResponse decide(String authorizationHeader, ResolveRequest req) {
        // ── Node 1 — JWT verified + non-deeplink → HOME ──
        if (!isDeeplinkPath(req)) {
            Optional<Long> sid = jwtVerifier.verifyAndGetStudentId(authorizationHeader);
            if (sid.isPresent()) {
                LOG.debug("decide node1 HOME sid={}", sid.get());
                return ResolveResponse.of("HOME");
            }
        }

        // ── Node 2 — shareToken present ──
        if (req.getShareToken() != null && !req.getShareToken().isBlank()) {
            Optional<ShareContextDto> ctx = lookupShareToken(req.getShareToken());
            if (ctx.isPresent()) {
                ResolveResponse r = ResolveResponse.of("SHARED");
                r.setShareContext(ctx.get());
                return r;
            }
            LOG.debug("decide node2 graceful LANDING (share invalid/expired)");
            return ResolveResponse.of("LANDING");
        }

        // ── Node 2' — observerCode present ──
        if (req.getObserverCode() != null && !req.getObserverCode().isBlank()) {
            Optional<ObserverContextDto> obs = lookupObserverInvite(req.getObserverCode());
            if (obs.isPresent()) {
                ResolveResponse r = ResolveResponse.of("OBSERVER");
                r.setObserverContext(obs.get());
                return r;
            }
            LOG.debug("decide node2' graceful LANDING (observer invalid)");
            return ResolveResponse.of("LANDING");
        }

        // ── Node 3 — P0 short-circuit · never returns WELCOME_BACK ──
        // P1 (SC-14) will query account_device by deviceFp and return WELCOME_BACK
        // when binding count >= 1. Today we hard-code LANDING to keep the door open.
        LOG.debug("decide node3 P0 LANDING (fp short-circuit)");
        return ResolveResponse.of("LANDING");
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private Optional<ShareContextDto> lookupShareToken(String jti) {
        try {
            return Optional.ofNullable(jdbc.query(
                    "SELECT share_type, status, allow_claim, expires_at, sharer_student_id "
                            + "FROM share_token WHERE jti = ? LIMIT 1",
                    SHARE_TOKEN_MAPPER,
                    jti
            ).stream().findFirst().orElse(null));
        } catch (Exception e) {
            LOG.warn("share_token_lookup_failed jti={} reason={}", maskJti(jti), e.toString());
            return Optional.empty();
        }
    }

    private static final RowMapper<ShareContextDto> SHARE_TOKEN_MAPPER = (ResultSet rs, int rowNum) -> {
        String shareType = rs.getString("share_type");
        short status = rs.getShort("status");
        boolean allowClaim = rs.getBoolean("allow_claim");
        OffsetDateTime expiresAt = rs.getObject("expires_at", OffsetDateTime.class);
        long sharerId = rs.getLong("sharer_student_id");
        // Only status=1 ACTIVE + future expires_at counts as valid
        if (status != 1) return null;
        if (expiresAt == null || expiresAt.isBefore(OffsetDateTime.now())) return null;
        String masked = "X***"; // P0 fixed masking — P1 derives from auth_user.email
        return new ShareContextDto(
                shareType,
                masked,
                allowClaim,
                expiresAt.format(DateTimeFormatter.ISO_OFFSET_DATE_TIME));
    };

    private Optional<ObserverContextDto> lookupObserverInvite(String code) {
        try {
            return Optional.ofNullable(jdbc.query(
                    "SELECT role, status, expires_at, student_id "
                            + "FROM observer_invite WHERE invite_code = ? LIMIT 1",
                    OBSERVER_INVITE_MAPPER,
                    code
            ).stream().findFirst().orElse(null));
        } catch (Exception e) {
            LOG.warn("observer_invite_lookup_failed reason={}", e.toString());
            return Optional.empty();
        }
    }

    private static final RowMapper<ObserverContextDto> OBSERVER_INVITE_MAPPER = (ResultSet rs, int rowNum) -> {
        String role = rs.getString("role");
        short status = rs.getShort("status");
        OffsetDateTime expiresAt = rs.getObject("expires_at", OffsetDateTime.class);
        if (status != 1) return null;
        if (expiresAt == null || expiresAt.isBefore(OffsetDateTime.now())) return null;
        return new ObserverContextDto(
                role,
                "Y***",
                expiresAt.format(DateTimeFormatter.ISO_OFFSET_DATE_TIME));
    };

    private static String maskJti(String jti) {
        if (jti == null || jti.length() < 8) return "***";
        return jti.substring(0, 4) + "***" + jti.substring(jti.length() - 4);
    }
}
