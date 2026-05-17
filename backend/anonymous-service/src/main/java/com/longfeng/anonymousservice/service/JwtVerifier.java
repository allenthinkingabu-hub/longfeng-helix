package com.longfeng.anonymousservice.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import javax.crypto.SecretKey;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * SC-00-T02 · HS256 JWT verifier — secret/issuer/audience must mirror auth-service.
 *
 * <p>Returns {@code Optional.empty()} for any decode/exp/iss/aud failure. The caller
 * (DecisionTreeService) treats that as "JWT not present" and falls through to nodes 2/3.
 */
@Service
public class JwtVerifier {

    private static final Logger LOG = LoggerFactory.getLogger(JwtVerifier.class);

    private final SecretKey key;
    private final String expectedIssuer;
    private final String expectedAudience;

    public JwtVerifier(
            @Value("${anon.jwt.secret}") String secret,
            @Value("${anon.jwt.issuer}") String issuer,
            @Value("${anon.jwt.audience}") String audience) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expectedIssuer = issuer;
        this.expectedAudience = audience;
    }

    /**
     * Extract subject (student_id) when the token verifies and claims match.
     * Empty → caller treats it as anonymous (decision-tree node 2/3).
     */
    public Optional<Long> verifyAndGetStudentId(String authorizationHeader) {
        if (authorizationHeader == null) return Optional.empty();
        String header = authorizationHeader.trim();
        if (!header.toLowerCase().startsWith("bearer ")) return Optional.empty();
        String token = header.substring("bearer ".length()).trim();
        if (token.isEmpty()) return Optional.empty();
        try {
            Jws<Claims> jws = Jwts.parser()
                    .verifyWith(key)
                    .requireIssuer(expectedIssuer)
                    .requireAudience(expectedAudience)
                    .build()
                    .parseSignedClaims(token);
            String sub = jws.getPayload().getSubject();
            if (sub == null || sub.isBlank()) return Optional.empty();
            return Optional.of(Long.parseLong(sub));
        } catch (Exception e) {
            LOG.debug("jwt_verify_failed reason={}", e.getClass().getSimpleName());
            return Optional.empty();
        }
    }
}
