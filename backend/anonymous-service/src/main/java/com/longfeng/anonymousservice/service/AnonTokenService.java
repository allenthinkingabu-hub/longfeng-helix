package com.longfeng.anonymousservice.service;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * SC-12 · Anonymous (guest) HS256 JWT mint service — T01 scope.
 *
 * <p>The {@code anonToken} is the bearer credential the guest-mode frontend
 * (P-GUEST-CAPTURE, future T03) attaches to all anonymous-tier API calls as
 * {@code X-Anon-Token}. Its claim payload pins exactly one entity: the
 * {@code guest_session.id} the token was minted for.
 *
 * <p><b>Claim shape (T01 fixed):</b>
 * <ul>
 *   <li>{@code sub = "anon:" + guestSessionId} — the {@code "anon:"} prefix is
 *       a hard discriminator vs student JWTs (which carry a bare numeric sub).
 *       T02's {@code AnonFilter} will reject tokens whose sub does not start
 *       with {@code "anon:"}.
 *   <li>{@code iss / aud / secret} — all three reuse {@code anon.jwt.*} so this
 *       service signs with the same key auth-service / SC-13 verify with;
 *       single-secret parity is intentional.
 *   <li>{@code jti} — UUID v4 sans hyphens (32 chars), random per mint.
 *   <li>{@code iat / exp} — exp = now + {@code anon.guest-session-ttl-sec}
 *       (default 86400 = 24h per biz §4.10).
 * </ul>
 *
 * <p><b>Out of T01 scope:</b> verifyAnonToken is intentionally NOT implemented
 * here. T02 adds it when it lands {@code AnonFilter} (the first endpoint that
 * actually consumes {@code X-Anon-Token}). T01's single endpoint
 * ({@code POST /api/anon/session}) does not check incoming anon tokens.
 */
@Service
public class AnonTokenService {

    /** {@code "anon:"} subject prefix — guards against student/anon JWT confusion. */
    public static final String SUB_PREFIX = "anon:";

    private final SecretKey signingKey;
    private final String issuer;
    private final String audience;
    private final long ttlSeconds;

    public AnonTokenService(
            @Value("${anon.jwt.secret}") String secret,
            @Value("${anon.jwt.issuer}") String issuer,
            @Value("${anon.jwt.audience}") String audience,
            @Value("${anon.guest-session-ttl-sec:86400}") long ttlSeconds) {
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.issuer = issuer;
        this.audience = audience;
        this.ttlSeconds = ttlSeconds;
    }

    /**
     * Mint an HS256 JWT bound to the given {@code guest_session.id}.
     *
     * <p>The caller (typically {@code AnonSessionService.mint}) MUST have
     * already inserted the corresponding {@code guest_session} row — the
     * token is meaningless without its backing row. Returns the compact
     * (3-part Base64URL) JWT string.
     */
    public String mintAnonToken(long guestSessionId) {
        Instant now = Instant.now();
        Instant exp = now.plusSeconds(ttlSeconds);
        String jti = UUID.randomUUID().toString().replace("-", "");
        return Jwts.builder()
                .id(jti)
                .subject(SUB_PREFIX + guestSessionId)
                .issuer(issuer)
                .audience().add(audience).and()
                .issuedAt(Date.from(now))
                .expiration(Date.from(exp))
                .signWith(signingKey, Jwts.SIG.HS256)
                .compact();
    }

    /** TTL injected from {@code anon.guest-session-ttl-sec} (default 86400 = 24h). */
    public long getGuestSessionTtlSeconds() {
        return ttlSeconds;
    }
}
