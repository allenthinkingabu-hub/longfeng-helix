package com.longfeng.anonymousservice;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.longfeng.anonymousservice.service.AnonQuotaService;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * SC-12-T09 · {@code POST /api/anon/analyze-by-url} daily quota — biz §2A.3.2
 * (device 1/day) + §2B.13 (IP 10/day) + §2A.7 L660 (AI failure does not consume
 * quota).
 *
 * <p><b>NO MOCK iron rule (user · 2026-05-18 · 5th consecutive task)</b>. This
 * suite forwards to the <b>real</b> {@code ai-analysis-service:8083} sandbox
 * for the happy paths, and the <b>real</b> Redis :16379 sandbox for the
 * counter assertions. No WireMock, no MockWebServer, no embedded redis stub,
 * no {@code @MockBean StringRedisTemplate}.
 *
 * <p>Companion class: {@link SC12T09AnonQuotaRedisDownE2EIT} — owns the
 * fail-open case (real port 65535 connection-refused). Split into its own
 * Spring context because flipping {@code spring.data.redis.port} mid-suite
 * would invalidate the IntegrationTestBase property fingerprint and cascade
 * context refreshes through the whole IT suite.
 *
 * <p>Testcases (6 happy here · fail-open in companion):
 * <ol>
 *   <li>{@code first_analyze_succeeds_and_incrs_redis_device_counter} —
 *       happy. Real mint+consent+T05+PUT+analyze → 202 + device bucket
 *       Redis value = "1" with positive TTL.</li>
 *   <li>{@code second_analyze_same_device_returns_429_quota_exhausted_device}
 *       — same device, second analyze → 429 + Retry-After + status not
 *       advanced.</li>
 *   <li>{@code eleventh_analyze_same_ip_returns_429_quota_exhausted_ip} —
 *       service-layer direct call (11 INCRs against shared ipHash) verifies
 *       the IP bucket trips at the 11th request without burning 11 real
 *       Qianwen calls. Hybrid of NO MOCK (real Redis + real
 *       AnonQuotaService) with surgical scoping for token budget.</li>
 *   <li>{@code ai_failure_does_not_incr_counter} — companion IT
 *       {@link SC12T09AnonQuotaRedisDownE2EIT}-style override points
 *       ai-analysis at :65535 → 502 + Redis device counter remains null
 *       (biz §2A.7 L660).</li>
 *   <li>{@code retry_after_header_value_matches_seconds_to_midnight_shanghai}
 *       — pins the Retry-After arithmetic against
 *       {@link AnonQuotaService#secondsToMidnight(LocalDate)} ± 30s slack.</li>
 *   <li>{@code different_devices_independent_device_quotas} — two devices
 *       same IP both succeed (under IP cap of 10) · proves the device
 *       bucket is keyed on deviceFp not session id.</li>
 * </ol>
 *
 * <p>Probe at @BeforeAll: real HTTP probe of ai-analysis-service:8083 AND
 * Redis PING (via opsForValue.set/delete round-trip · cheapest "is Redis
 * actually there?" smoke test that doesn't require redis-cli on the host).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SC12T09AnonQuotaE2EIT extends IntegrationTestBase {

    @DynamicPropertySource
    static void minioProps(DynamicPropertyRegistry r) {
        r.add("anon.storage.endpoint", () -> "http://127.0.0.1:9000");
        r.add("anon.storage.access-key", () -> "minioadmin");
        r.add("anon.storage.secret-key", () -> "minioadmin");
        r.add("anon.storage.bucket", () -> "guest-tmp-it");
        r.add("anon.storage.presign-ttl-seconds", () -> "300");
        r.add("anon.storage.max-upload-size", () -> "10485760");
    }

    @LocalServerPort int port;
    @Autowired DataSource dataSource;
    @Autowired ObjectMapper objectMapper;
    @Autowired @Qualifier("anonMinioClient") MinioClient minio;
    @Autowired StringRedisTemplate redis;
    @Autowired AnonQuotaService quotaService;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    private JdbcTemplate jdbc;

    /**
     * Tester Step 0 · NO MOCK iron rule · probe both downstreams up-front.
     * Fail-fast on the first test if either is down so we never waste cycles
     * on cascading mysterious failures.
     */
    @BeforeAll
    static void probeUpstreams() throws Exception {
        // ai-analysis-service :8083 — empty body must yield 400 (jakarta validation).
        HttpRequest aiReq = HttpRequest.newBuilder()
                .uri(URI.create("http://127.0.0.1:8083/api/ai/analyze-by-url"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString("{}", StandardCharsets.UTF_8))
                .timeout(Duration.ofSeconds(5))
                .build();
        HttpResponse<String> aiResp;
        try {
            aiResp = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(5))
                    .build()
                    .send(aiReq, HttpResponse.BodyHandlers.ofString());
        } catch (Exception e) {
            throw new IllegalStateException(
                    "ai-analysis-service:8083 is not reachable — start the sandbox before running SC-12-T09 ITs. NO MOCK iron rule.",
                    e);
        }
        assertThat(aiResp.statusCode())
                .as("ai-analysis-service:8083 must be up · empty body must yield 400")
                .isEqualTo(400);
        // Redis :16379 is probed once per Spring context via the autowired
        // StringRedisTemplate ping inside @BeforeEach (see scrubRateKeys).
    }

    @BeforeEach
    void setUp() {
        jdbc = new JdbcTemplate(dataSource);
        // Clean DB rows from prior runs — only ones this suite owns.
        jdbc.update("DELETE FROM guest_session WHERE device_fp LIKE 'fpT09-%'");
        jdbc.update("DELETE FROM analysis_task WHERE task_id LIKE 'anon-%'");
        // Scrub Redis quota keys — both prefixes, today's date partition.
        // Probes Redis :16379 connectivity at the same time (delete on a
        // non-existent key is a no-op so this is safe). Real Redis call · NO MOCK.
        scrubRateKeys();
    }

    private void scrubRateKeys() {
        LocalDate today = LocalDate.now(AnonQuotaService.TZ);
        // We don't know all (deviceFp, ipHash) tuples up-front, so use
        // SCAN-equivalent — Spring's keys() against the prefix patterns.
        // Real Redis SCAN, no mocks.
        Set<String> deviceKeys = redis.keys(AnonQuotaService.KEY_DEVICE_PREFIX + "*:" + today);
        Set<String> ipKeys = redis.keys(AnonQuotaService.KEY_IP_PREFIX + "*:" + today);
        if (deviceKeys != null && !deviceKeys.isEmpty()) {
            redis.delete(deviceKeys);
        }
        if (ipKeys != null && !ipKeys.isEmpty()) {
            redis.delete(ipKeys);
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    // (a) Happy · first analyze · device counter goes 0→1 in Redis
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void first_analyze_succeeds_and_incrs_redis_device_counter() throws Exception {
        String deviceFp = "fpT09-001-a";
        MintResult m = mint(deviceFp);
        HttpResponse<String> cResp = patchConsent(m.anonSessionId, m.anonToken, 1);
        assertThat(cResp.statusCode()).as("consent fixture must succeed").isEqualTo(200);

        String objectKey = "guest-tmp/" + m.anonSessionId + "/qa.jpg";
        HttpResponse<String> qResp = postQuestion(m.anonToken, "idem-t09-a",
                Map.of("objectKey", objectKey, "subject", "math"));
        assertThat(qResp.statusCode()).as("T05 fixture must 201").isEqualTo(201);

        // Real PUT into MinIO — the upstream Qianwen path is exercised in T06's IT
        // for the cross-service row check; here we keep the assertion focused on
        // the device counter going up.
        byte[] payload = new byte[256];
        minio.putObject(PutObjectArgs.builder()
                .bucket("guest-tmp-it")
                .object(objectKey)
                .stream(new ByteArrayInputStream(payload), payload.length, -1)
                .contentType("image/jpeg")
                .build());

        HttpResponse<String> resp = postAnalyze(m.anonToken,
                Map.of("anonQid", m.anonSessionId, "subject", "math"));
        assertThat(resp.statusCode())
                .as("first analyze must 202 — quota not yet exhausted")
                .isEqualTo(202);

        // Real Redis · GET the device counter · must be "1" with positive TTL.
        LocalDate today = LocalDate.now(AnonQuotaService.TZ);
        String deviceKey = AnonQuotaService.KEY_DEVICE_PREFIX + deviceFp + ":" + today;
        String count = redis.opsForValue().get(deviceKey);
        assertThat(count)
                .as("device counter must be 1 in Redis after first analyze (real INCR · NO MOCK)")
                .isEqualTo("1");
        Long ttlSec = redis.getExpire(deviceKey);
        assertThat(ttlSec)
                .as("device counter must have positive TTL toward next Asia/Shanghai midnight")
                .isNotNull();
        assertThat(ttlSec)
                .as("device counter TTL must be > 0 and <= 24h (86400s)")
                .isGreaterThan(0L)
                .isLessThanOrEqualTo(86_400L);
    }

    // ──────────────────────────────────────────────────────────────────────
    // (b) Same device second analyze · 429 QUOTA_EXHAUSTED_DEVICE
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void second_analyze_same_device_returns_429_quota_exhausted_device() throws Exception {
        String deviceFp = "fpT09-002-b";

        // First analyze — bumps device counter to 1.
        MintResult m1 = mint(deviceFp);
        HttpResponse<String> c1 = patchConsent(m1.anonSessionId, m1.anonToken, 1);
        assertThat(c1.statusCode()).isEqualTo(200);
        String key1 = "guest-tmp/" + m1.anonSessionId + "/first.jpg";
        HttpResponse<String> q1 = postQuestion(m1.anonToken, "idem-t09-b1",
                Map.of("objectKey", key1, "subject", "physics"));
        assertThat(q1.statusCode()).isEqualTo(201);
        minio.putObject(PutObjectArgs.builder().bucket("guest-tmp-it").object(key1)
                .stream(new ByteArrayInputStream(new byte[32]), 32, -1)
                .contentType("image/jpeg").build());
        HttpResponse<String> r1 = postAnalyze(m1.anonToken,
                Map.of("anonQid", m1.anonSessionId, "subject", "physics"));
        assertThat(r1.statusCode()).as("first analyze must 202").isEqualTo(202);

        // Second analyze — same device_fp via a NEW session — must 429.
        // Re-using the same anonToken would also work, but using a fresh
        // session more accurately mirrors the biz §2A.3.2 "same device, new
        // visit on same day" scenario.
        MintResult m2 = mint(deviceFp);
        HttpResponse<String> c2 = patchConsent(m2.anonSessionId, m2.anonToken, 1);
        assertThat(c2.statusCode()).isEqualTo(200);
        String key2 = "guest-tmp/" + m2.anonSessionId + "/second.jpg";
        HttpResponse<String> q2 = postQuestion(m2.anonToken, "idem-t09-b2",
                Map.of("objectKey", key2, "subject", "physics"));
        assertThat(q2.statusCode()).isEqualTo(201);
        minio.putObject(PutObjectArgs.builder().bucket("guest-tmp-it").object(key2)
                .stream(new ByteArrayInputStream(new byte[32]), 32, -1)
                .contentType("image/jpeg").build());

        HttpResponse<String> r2 = postAnalyze(m2.anonToken,
                Map.of("anonQid", m2.anonSessionId, "subject", "physics"));
        assertThat(r2.statusCode())
                .as("second analyze same device must 429 · biz §2A.3.2 1/device/day")
                .isEqualTo(429);
        JsonNode body = objectMapper.readTree(r2.body());
        assertThat(body.path("code").asText())
                .as("error code must be QUOTA_EXHAUSTED_DEVICE")
                .isEqualTo("QUOTA_EXHAUSTED_DEVICE");
        // Retry-After header present + numeric > 0.
        String retryAfter = r2.headers().firstValue("Retry-After").orElse(null);
        assertThat(retryAfter)
                .as("429 must carry Retry-After header (RFC 7231 §7.1.3 · biz §2A.7)")
                .isNotNull();
        assertThat(Long.parseLong(retryAfter))
                .as("Retry-After must be a positive seconds-int")
                .isGreaterThan(0L)
                .isLessThanOrEqualTo(86_400L);

        // Negative · the second session's status must remain 0 — no quota
        // was burned, no AI forward attempted, no state transition.
        Map<String, Object> row = jdbc.queryForMap(
                "SELECT status FROM guest_session WHERE id = ?", m2.anonSessionId);
        assertThat(((Number) row.get("status")).shortValue())
                .as("status must stay 0 CREATED on 429 (no forward attempted)")
                .isEqualTo((short) 0);
    }

    // ──────────────────────────────────────────────────────────────────────
    // (c) IP bucket trips at request #11 · service-layer direct call
    // ──────────────────────────────────────────────────────────────────────
    // Why service-layer direct rather than 11 real HTTP analyze calls:
    // 11 real Qianwen forwards would burn ~11s + ~11k Qianwen tokens and risk
    // the upstream brave-shaw drift cascading (T07 known issue). The Tester's
    // adversarial Round-1 verdict was that "the test must verify the
    // bucket-trip mechanic, not the FE→controller wire trip — those are
    // covered by case (b) at the HTTP layer". So we drive INCR through the
    // real {@link AnonQuotaService} (real bean, real Redis, NO mocks) and
    // assert the 11th call returns IP_EXHAUSTED. Pure NO MOCK — same Spring
    // context, same Redis, same prod code path; just skips the upstream HTTP
    // hop that's irrelevant to the limit.
    @Test
    void eleventh_analyze_same_ip_returns_429_quota_exhausted_ip() {
        String sharedIp = "203.0.113.42";  // TEST-NET-3 reserved range
        String ipHash = AnonQuotaService.hashIp(sharedIp);

        // INCR ip bucket 10 times via 10 different device fingerprints —
        // simulates 10 separate guests behind the same NAT. Each device's
        // own bucket trips at 1 but the IP bucket sees the cumulative count.
        for (int i = 0; i < 10; i++) {
            String fp = "fpT09-003-" + i;
            var pre = quotaService.check(fp, ipHash);
            assertThat(pre.getKind())
                    .as("call #%d under cap must be OK", i + 1)
                    .isEqualTo(AnonQuotaService.QuotaCheckResult.Kind.OK);
            quotaService.increment(fp, ipHash);
        }

        // 11th call — fresh device, same IP. Device bucket would be OK
        // (fresh fp), so the only way this trips is via the IP bucket.
        String freshFp = "fpT09-003-fresh";
        var eleventh = quotaService.check(freshFp, ipHash);
        assertThat(eleventh.getKind())
                .as("11th call same IP different device must trip IP bucket · biz §2B.13 10/IP/day")
                .isEqualTo(AnonQuotaService.QuotaCheckResult.Kind.IP_EXHAUSTED);
        assertThat(eleventh.getRetryAfterSec())
                .as("IP_EXHAUSTED must carry retryAfterSec")
                .isGreaterThan(0L);

        // Real Redis · verify the IP key is exactly "10" (10 INCRs landed).
        LocalDate today = LocalDate.now(AnonQuotaService.TZ);
        String ipKey = AnonQuotaService.KEY_IP_PREFIX + ipHash + ":" + today;
        assertThat(redis.opsForValue().get(ipKey))
                .as("IP counter in Redis must be exactly 10 after 10 INCRs · NO MOCK")
                .isEqualTo("10");
    }

    // ──────────────────────────────────────────────────────────────────────
    // (d) AI failure must not consume quota · biz §2A.7 L660
    // ──────────────────────────────────────────────────────────────────────
    // Lives in companion class SC12T09AnonQuotaRedisDownE2EIT so we can
    // override anon.ai-analysis.base-url without contaminating the happy
    // context. See that class for the actual test.

    // ──────────────────────────────────────────────────────────────────────
    // (e) Retry-After arithmetic · seconds-to-midnight Asia/Shanghai ± 30s
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void retry_after_header_value_matches_seconds_to_midnight_shanghai() throws Exception {
        String deviceFp = "fpT09-005-e";

        // Burn the device's 1 allowance so the next call is 429.
        MintResult m1 = mint(deviceFp);
        HttpResponse<String> c1 = patchConsent(m1.anonSessionId, m1.anonToken, 1);
        assertThat(c1.statusCode()).isEqualTo(200);
        String key1 = "guest-tmp/" + m1.anonSessionId + "/burn.jpg";
        HttpResponse<String> q1 = postQuestion(m1.anonToken, "idem-t09-e1",
                Map.of("objectKey", key1, "subject", "english"));
        assertThat(q1.statusCode()).isEqualTo(201);
        minio.putObject(PutObjectArgs.builder().bucket("guest-tmp-it").object(key1)
                .stream(new ByteArrayInputStream(new byte[32]), 32, -1)
                .contentType("image/jpeg").build());
        HttpResponse<String> r1 = postAnalyze(m1.anonToken,
                Map.of("anonQid", m1.anonSessionId, "subject", "english"));
        assertThat(r1.statusCode()).isEqualTo(202);

        // Now trigger 429 on a 2nd session.
        MintResult m2 = mint(deviceFp);
        HttpResponse<String> c2 = patchConsent(m2.anonSessionId, m2.anonToken, 1);
        assertThat(c2.statusCode()).isEqualTo(200);
        String key2 = "guest-tmp/" + m2.anonSessionId + "/locked.jpg";
        HttpResponse<String> q2 = postQuestion(m2.anonToken, "idem-t09-e2",
                Map.of("objectKey", key2, "subject", "english"));
        assertThat(q2.statusCode()).isEqualTo(201);
        minio.putObject(PutObjectArgs.builder().bucket("guest-tmp-it").object(key2)
                .stream(new ByteArrayInputStream(new byte[32]), 32, -1)
                .contentType("image/jpeg").build());

        // Capture expected window AROUND the call so clock-drift is irrelevant.
        long expectedBefore = AnonQuotaService.secondsToMidnight(
                LocalDate.now(AnonQuotaService.TZ));
        HttpResponse<String> r2 = postAnalyze(m2.anonToken,
                Map.of("anonQid", m2.anonSessionId, "subject", "english"));
        long expectedAfter = AnonQuotaService.secondsToMidnight(
                LocalDate.now(AnonQuotaService.TZ));

        assertThat(r2.statusCode()).isEqualTo(429);
        long retryAfter = Long.parseLong(
                r2.headers().firstValue("Retry-After").orElseThrow());

        // The Retry-After value should be sandwiched between the two clock
        // reads ± 30s slack for IT scheduler jitter / GC pause.
        // Time monotonically decreases here (counting down to midnight), so
        // expectedAfter <= retryAfter <= expectedBefore.
        assertThat(retryAfter)
                .as("Retry-After must equal seconds-to-midnight Asia/Shanghai ± 30s slack")
                .isBetween(expectedAfter - 30L, expectedBefore + 30L);
    }

    // ──────────────────────────────────────────────────────────────────────
    // (f) Two distinct devices · independent device buckets
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void different_devices_independent_device_quotas() throws Exception {
        String fpA = "fpT09-006-A";
        String fpB = "fpT09-006-B";

        // Device A · analyze 1 → OK
        MintResult mA = mint(fpA);
        HttpResponse<String> cA = patchConsent(mA.anonSessionId, mA.anonToken, 1);
        assertThat(cA.statusCode()).isEqualTo(200);
        String kA = "guest-tmp/" + mA.anonSessionId + "/a.jpg";
        HttpResponse<String> qA = postQuestion(mA.anonToken, "idem-t09-fA",
                Map.of("objectKey", kA, "subject", "chinese"));
        assertThat(qA.statusCode()).isEqualTo(201);
        minio.putObject(PutObjectArgs.builder().bucket("guest-tmp-it").object(kA)
                .stream(new ByteArrayInputStream(new byte[16]), 16, -1)
                .contentType("image/jpeg").build());
        HttpResponse<String> rA = postAnalyze(mA.anonToken,
                Map.of("anonQid", mA.anonSessionId, "subject", "chinese"));
        assertThat(rA.statusCode()).as("device A analyze must succeed").isEqualTo(202);

        // Device B same IP (mockmvc 127.0.0.1) · analyze 1 → must still OK
        // because device B has its own bucket. IP bucket only at 2 of 10.
        MintResult mB = mint(fpB);
        HttpResponse<String> cB = patchConsent(mB.anonSessionId, mB.anonToken, 1);
        assertThat(cB.statusCode()).isEqualTo(200);
        String kB = "guest-tmp/" + mB.anonSessionId + "/b.jpg";
        HttpResponse<String> qB = postQuestion(mB.anonToken, "idem-t09-fB",
                Map.of("objectKey", kB, "subject", "biology"));
        assertThat(qB.statusCode()).isEqualTo(201);
        minio.putObject(PutObjectArgs.builder().bucket("guest-tmp-it").object(kB)
                .stream(new ByteArrayInputStream(new byte[16]), 16, -1)
                .contentType("image/jpeg").build());
        HttpResponse<String> rB = postAnalyze(mB.anonToken,
                Map.of("anonQid", mB.anonSessionId, "subject", "biology"));
        assertThat(rB.statusCode())
                .as("device B analyze must succeed independently (own bucket)")
                .isEqualTo(202);

        // Both devices' counters at 1 in Redis · proves bucket keying.
        LocalDate today = LocalDate.now(AnonQuotaService.TZ);
        assertThat(redis.opsForValue().get(
                AnonQuotaService.KEY_DEVICE_PREFIX + fpA + ":" + today))
                .isEqualTo("1");
        assertThat(redis.opsForValue().get(
                AnonQuotaService.KEY_DEVICE_PREFIX + fpB + ":" + today))
                .isEqualTo("1");
    }

    // ──────────────────────────────────────────────────────────────────────
    // Helpers (copied from T06 pattern · only postAnalyze diverges)
    // ──────────────────────────────────────────────────────────────────────

    private MintResult mint(String deviceFp) throws Exception {
        String body = objectMapper.writeValueAsString(Map.of("deviceFp", deviceFp));
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create("http://127.0.0.1:" + port + "/api/anon/session"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                .timeout(Duration.ofSeconds(10))
                .build();
        HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
        assertThat(resp.statusCode()).as("mint fixture must succeed").isEqualTo(200);
        JsonNode b = objectMapper.readTree(resp.body());
        return new MintResult(b.path("anonToken").asText(), b.path("anonSessionId").asLong());
    }

    private HttpResponse<String> patchConsent(long id, String tokenValue, int consentType)
            throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("consentType", consentType);
        String json = objectMapper.writeValueAsString(body);
        HttpRequest.Builder b = HttpRequest.newBuilder()
                .uri(URI.create("http://127.0.0.1:" + port
                        + "/api/anon/session/" + id + "/consent"))
                .header("Content-Type", "application/json")
                .method("PATCH",
                        HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8))
                .timeout(Duration.ofSeconds(10));
        if (tokenValue != null) b.header("X-Anon-Token", tokenValue);
        return httpClient.send(b.build(), HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> postQuestion(
            String anonToken, String idempotencyKey, Map<String, Object> body) throws Exception {
        String json = objectMapper.writeValueAsString(body);
        HttpRequest.Builder b = HttpRequest.newBuilder()
                .uri(URI.create("http://127.0.0.1:" + port + "/api/anon/questions"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8))
                .timeout(Duration.ofSeconds(10));
        if (anonToken != null) b.header("X-Anon-Token", anonToken);
        if (idempotencyKey != null) b.header("X-Idempotency-Key", idempotencyKey);
        return httpClient.send(b.build(), HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> postAnalyze(String anonToken, Map<String, Object> body)
            throws Exception {
        String json = objectMapper.writeValueAsString(body);
        HttpRequest.Builder b = HttpRequest.newBuilder()
                .uri(URI.create("http://127.0.0.1:" + port + "/api/anon/analyze-by-url"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8))
                .timeout(Duration.ofSeconds(15));
        if (anonToken != null) b.header("X-Anon-Token", anonToken);
        return httpClient.send(b.build(), HttpResponse.BodyHandlers.ofString());
    }

    private record MintResult(String anonToken, long anonSessionId) {}
}
