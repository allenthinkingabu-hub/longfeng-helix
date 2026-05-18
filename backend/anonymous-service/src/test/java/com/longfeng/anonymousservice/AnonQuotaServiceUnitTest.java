package com.longfeng.anonymousservice;

import static org.assertj.core.api.Assertions.assertThat;

import com.longfeng.anonymousservice.service.AnonQuotaService;
import com.longfeng.anonymousservice.service.AnonQuotaService.QuotaCheckResult;
import io.lettuce.core.RedisURI;
import java.time.Duration;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceClientConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;

/**
 * SC-12-T09 · Redis-down fail-open coverage.
 *
 * <p>This is a JUnit unit test (not a {@code @SpringBootTest} IT) because the
 * fail-open scenario requires a deliberately broken Redis pointer — a
 * {@code @DynamicPropertySource} pointing at :65535 would prevent the
 * application context from finishing startup under some Spring Data Redis
 * versions (the auto-wiring sanity-pings Redis on first use). Constructing
 * the dependency tree directly with a real-but-misconfigured
 * {@link LettuceConnectionFactory} sidesteps that fragility while still
 * staying NO MOCK (real Lettuce client, real TCP, real connection-refused).
 *
 * <p>Cases:
 * <ol>
 *   <li>{@code check_returns_ok_when_redis_unreachable} — fail-open contract.</li>
 *   <li>{@code increment_swallows_redis_error_without_throwing} — caller must
 *       never see an exception when Redis blips post-202.</li>
 *   <li>{@code hashIp_returns_no_ip_sentinel_for_blank_input} — pure-Java
 *       branch, locks the blank/null normalization.</li>
 *   <li>{@code hashIp_returns_stable_16_hex_for_non_blank_ip} — pure-Java
 *       branch, verifies the SHA-256 truncation length + determinism.</li>
 * </ol>
 */
class AnonQuotaServiceUnitTest {

    /** Closed port — kernel will RST on connect. */
    private static final int DEAD_PORT = 65535;

    private static LettuceConnectionFactory deadFactory;
    private static StringRedisTemplate deadRedis;

    @BeforeAll
    static void buildDeadRedis() {
        // Real Lettuce client targeting an unreachable port. Tight timeouts
        // so the cases finish in seconds. NO MOCK — Lettuce is live, just
        // pointed at a port nobody is listening on.
        RedisStandaloneConfiguration cfg = new RedisStandaloneConfiguration("127.0.0.1", DEAD_PORT);
        LettuceClientConfiguration client = LettuceClientConfiguration.builder()
                .commandTimeout(Duration.ofSeconds(1))
                .shutdownTimeout(Duration.ofMillis(100))
                .clientOptions(io.lettuce.core.ClientOptions.builder()
                        .socketOptions(io.lettuce.core.SocketOptions.builder()
                                .connectTimeout(Duration.ofSeconds(1))
                                .build())
                        .build())
                .build();
        deadFactory = new LettuceConnectionFactory(cfg, client);
        // Disable Spring's auto-validation that would otherwise PING on start.
        deadFactory.setValidateConnection(false);
        deadFactory.setEagerInitialization(false);
        // Useful for picking up the new properties.
        deadFactory.afterPropertiesSet();
        // Build the template against the broken factory — operations will
        // throw RedisConnectionFailureException at call time.
        deadRedis = new StringRedisTemplate(deadFactory);
        deadRedis.afterPropertiesSet();
        // Also disable the Redis URI just so the static URI form gets used.
        RedisURI.create("127.0.0.1", DEAD_PORT);
    }

    @AfterAll
    static void teardown() {
        if (deadFactory != null) {
            deadFactory.destroy();
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    // (g) Fail-open · check returns OK when Redis throws
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void check_returns_ok_when_redis_unreachable() {
        AnonQuotaService svc = new AnonQuotaService(deadRedis);
        QuotaCheckResult r = svc.check("fp-fail-open", AnonQuotaService.hashIp("8.8.8.8"));
        assertThat(r.getKind())
                .as("Redis unreachable must fail-open OK (biz P0 · §4.10 DB fallback is P1)")
                .isEqualTo(QuotaCheckResult.Kind.OK);
        assertThat(r.getRetryAfterSec())
                .as("OK fail-open must carry retryAfterSec=0")
                .isZero();
    }

    @Test
    void increment_swallows_redis_error_without_throwing() {
        AnonQuotaService svc = new AnonQuotaService(deadRedis);
        // Must not throw — the caller in AnonAnalyzeService runs this AFTER
        // a successful 202 from upstream, so an exception here would let a
        // burned Qianwen call return 500 to the guest instead of SUCCESS.
        svc.increment("fp-fail-open", AnonQuotaService.hashIp("8.8.8.8"));
        // No throw == pass. Mirrors the explicit no-throw contract documented
        // in AnonQuotaService.increment javadoc.
    }

    // ──────────────────────────────────────────────────────────────────────
    // hashIp pure-Java contract
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void hashIp_returns_no_ip_sentinel_for_blank_input() {
        assertThat(AnonQuotaService.hashIp(null)).isEqualTo("_no_ip_");
        assertThat(AnonQuotaService.hashIp("")).isEqualTo("_no_ip_");
        assertThat(AnonQuotaService.hashIp("   ")).isEqualTo("_no_ip_");
    }

    @Test
    void hashIp_returns_stable_16_hex_for_non_blank_ip() {
        String h1 = AnonQuotaService.hashIp("203.0.113.42");
        String h2 = AnonQuotaService.hashIp("203.0.113.42");
        assertThat(h1).hasSize(16).matches("[0-9a-f]{16}");
        assertThat(h2).as("same input must yield same hash · pure SHA-256").isEqualTo(h1);
        // Different input → different hash with overwhelming probability.
        String h3 = AnonQuotaService.hashIp("203.0.113.43");
        assertThat(h3).isNotEqualTo(h1);
    }
}
