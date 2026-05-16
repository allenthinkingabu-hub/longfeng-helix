package com.longfeng.authservice.service;

import java.time.Duration;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/**
 * Refresh token issuer — UUID v4 written to Redis with TTL (default 30d).
 * Key shape: {prefix}{refreshToken} → userId (string). Allows revocation /
 * lookup by token; user_id reverse-index left as future enhancement.
 */
@Service
public class RefreshTokenService {

    private final StringRedisTemplate redis;
    private final String keyPrefix;
    private final long ttlSeconds;

    public RefreshTokenService(
            StringRedisTemplate redis,
            @Value("${auth.refresh.redis-key-prefix}") String keyPrefix,
            @Value("${auth.refresh.ttl-seconds}") long ttlSeconds) {
        this.redis = redis;
        this.keyPrefix = keyPrefix;
        this.ttlSeconds = ttlSeconds;
    }

    public String issue(long userId) {
        String token = UUID.randomUUID().toString();
        redis.opsForValue().set(keyPrefix + token, String.valueOf(userId),
                Duration.ofSeconds(ttlSeconds));
        return token;
    }

    public String lookupUserId(String refreshToken) {
        return redis.opsForValue().get(keyPrefix + refreshToken);
    }
}
