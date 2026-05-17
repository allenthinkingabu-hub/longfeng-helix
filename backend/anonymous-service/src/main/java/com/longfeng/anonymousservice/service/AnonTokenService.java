package com.longfeng.anonymousservice.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * SC-12 · Anonymous (guest) HS256 JWT mint + verify service.
 *
 * <p>The {@code anonToken} is the bearer credential the guest-mode frontend
 * (P-GUEST-CAPTURE) attaches to all anonymous-tier API calls as
 * {@code X-Anon-Token}. Its claim payload pins exactly one entity: the
 * {@code guest_session.id} the token was minted for.
 *
 * <p><b>Claim shape (T01 fixed):</b>
 * <ul>
 *   <li>{@code sub = "anon:" + guestSessionId} — the {@code "anon:"} prefix is
 *       a hard discriminator vs student JWTs (which carry a bare numeric sub).
 *       {@link #verifyAnonToken(String)} rejects tokens whose sub does not
 *       start with {@code "anon:"} — T02's {@code AnonFilter} relies on this.
 *   <li>{@code iss / aud / secret} — all three reuse {@code anon.jwt.*} so this
 *       service signs with the same key auth-service / SC-13 verify with;
 *       single-secret parity is intentional.
 *   <li>{@code jti} — UUID v4 sans hyphens (32 chars), random per mint.
 *   <li>{@code iat / exp} — exp = now + {@code anon.guest-session-ttl-sec}
 *       (default 86400 = 24h per biz §4.10).
 * </ul>
 *
 * <p><b>T02 scope (this slice):</b> added {@link #verifyAnonToken(String)} —
 * the first task that actually consumes {@code X-Anon-Token} via
 * {@code AnonFilter} interceptor.
 */
@Service
public class AnonTokenService {

    private static final Logger LOG = LoggerFactory.getLogger(AnonTokenService.class);

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

    /**
     * SC-12-T02 · Verify an incoming {@code X-Anon-Token} header value.
     *
     * <p>Steps (mirror {@link ShareTokenService#lookup} verification mode —
     * non-throwing, debug-logged, {@link Optional} discriminator):
     * <ol>
     *   <li>Reject {@code null} / blank input.
     *   <li>HS256 verify under {@link #signingKey} + require {@code iss} +
     *       require {@code aud}.
     *   <li>{@code sub} must start with {@link #SUB_PREFIX} ({@code "anon:"})
     *       — defense vs accidental cross-use of a student JWT signed with
     *       the same secret (auth-service shares the secret per biz §10.9).
     *   <li>Suffix after {@code "anon:"} must parse as {@code long} — that's
     *       the {@code guest_session.id} the token was minted for.
     * </ol>
     *
     * <p>Any failure returns {@link Optional#empty()} with a debug log; the
     * filter then writes 401 {@code ANON_TOKEN_INVALID}. We never propagate
     * the JJWT exception class beyond this method — that would leak which
     * verification step tripped (timing-side-channel posture: same 401 for
     * all failure modes).
     *
     * @param tokenValue raw header value (no {@code Bearer} prefix —
     *     {@code X-Anon-Token} is sent verbatim per P-GUEST-CAPTURE spec §5)
     * @return the {@code guest_session.id} encoded in the token sub, or
     *     {@code Optional.empty()} on any failure
     */
    public Optional<Long> verifyAnonToken(String tokenValue) {
        if (tokenValue == null || tokenValue.isBlank()) {
            return Optional.empty();
        }
        try {
            Jws<Claims> jws = Jwts.parser()
                    .verifyWith(signingKey)
                    .requireIssuer(issuer)
                    .requireAudience(audience)
                    .build()
                    .parseSignedClaims(tokenValue.trim());
            String sub = jws.getPayload().getSubject();
            if (sub == null || !sub.startsWith(SUB_PREFIX)) {
                LOG.debug("anon_token_verify_failed reason=sub_prefix_missing");
                return Optional.empty();
            }
            String suffix = sub.substring(SUB_PREFIX.length());
            if (suffix.isBlank()) {
                LOG.debug("anon_token_verify_failed reason=sub_suffix_blank");
                return Optional.empty();
            }
            return Optional.of(Long.parseLong(suffix));
        } catch (NumberFormatException e) {
            LOG.debug("anon_token_verify_failed reason=sub_suffix_not_numeric");
            return Optional.empty();
        } catch (Exception e) {
            // Includes ExpiredJwtException / SignatureException / MalformedJwtException /
            // MissingClaimException / IncorrectClaimException — all collapse to 401.
            LOG.debug("anon_token_verify_failed reason={}", e.getClass().getSimpleName());
            return Optional.empty();
        }
    }

    /** TTL injected from {@code anon.guest-session-ttl-sec} (default 86400 = 24h). */
    public long getGuestSessionTtlSeconds() {
        return ttlSeconds;
    }
}
