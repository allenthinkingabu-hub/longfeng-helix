package com.longfeng.authservice.service;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * JWT (HS256) signer. Keys derived from configured secret string via HMAC-SHA256.
 * Secret in application.yml must be ≥ 256 bits (32 chars).
 */
@Service
public class JwtService {

    private final SecretKey key;
    private final String issuer;
    private final String audience;
    private final long accessTokenTtlSeconds;

    public JwtService(
            @Value("${auth.jwt.secret}") String secret,
            @Value("${auth.jwt.issuer}") String issuer,
            @Value("${auth.jwt.audience}") String audience,
            @Value("${auth.jwt.access-token-ttl-seconds}") long accessTokenTtlSeconds) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.issuer = issuer;
        this.audience = audience;
        this.accessTokenTtlSeconds = accessTokenTtlSeconds;
    }

    public String signAccessToken(long userId) {
        Instant now = Instant.now();
        Instant exp = now.plus(Duration.ofSeconds(accessTokenTtlSeconds));
        return Jwts.builder()
                .subject(String.valueOf(userId))
                .issuer(issuer)
                .audience().add(audience).and()
                .issuedAt(Date.from(now))
                .expiration(Date.from(exp))
                .signWith(key, Jwts.SIG.HS256)
                .compact();
    }

    public long getAccessTokenTtlSeconds() {
        return accessTokenTtlSeconds;
    }
}
