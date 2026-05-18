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
import javax.sql.DataSource;
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
 * SC-12-T09 · companion to {@link SC12T09AnonQuotaE2EIT} owning the cases
 * that need a different Spring context fingerprint:
 *
 * <ol>
 *   <li>{@code ai_failure_does_not_incr_device_counter} — points
 *       {@code anon.ai-analysis.base-url} at port 65535 (kernel-refused);
 *       analyze must return 502 + the device bucket must remain empty in
 *       real Redis. Pins biz §2A.7 L660 "AI failure does not consume
 *       quota" interaction with T09's INCR-after-202 ordering.</li>
 * </ol>
 *
 * <p>Why a separate class: changing {@code anon.ai-analysis.base-url} via a
 * {@code @DynamicPropertySource} mutates the Spring TestContext fingerprint;
 * Spring caches one ApplicationContext per fingerprint, so co-locating this
 * case with the happy ITs would force a context refresh between every test
 * (slow + leaky). Same pattern T06 uses for
 * {@link SC12T06AnonAnalyzeDownE2EIT}.
 *
 * <p>NO MOCK: the kernel actually rejects connections on :65535 — there's no
 * WireMock, no @MockBean RestTemplate. Real {@code RestClientException} on
 * the wire, real Redis check before/after.
 *
 * <p>For the Redis-down "fail-open" branch we go further: a single
 * service-layer call exercises {@link AnonQuotaService#check} directly
 * against a real-but-misconfigured-port Redis URL — proving the catch block
 * lets the request through. We don't co-locate this in the same Spring
 * context because Spring would fail to start at all if Redis is unreachable
 * (the auto-wired StringRedisTemplate sanity-pings at boot under some
 * configurations); the safer route is a unit-level direct construction
 * inside {@link com.longfeng.anonymousservice.service.AnonQuotaServiceUnitTest}.
 * That test sits next to this IT in the suite and uses real
 * StringRedisTemplate pointed at :65535 (NO MOCK Redis).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SC12T09AnonQuotaRedisDownE2EIT extends IntegrationTestBase {

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("anon.storage.endpoint", () -> "http://127.0.0.1:9000");
        r.add("anon.storage.access-key", () -> "minioadmin");
        r.add("anon.storage.secret-key", () -> "minioadmin");
        r.add("anon.storage.bucket", () -> "guest-tmp-it");
        r.add("anon.storage.presign-ttl-seconds", () -> "300");
        r.add("anon.storage.max-upload-size", () -> "10485760");
        // Real connection-refused — :65535 has no listener.
        r.add("anon.ai-analysis.base-url", () -> "http://127.0.0.1:65535");
        r.add("anon.ai-analysis.connect-timeout-ms", () -> "1000");
        r.add("anon.ai-analysis.read-timeout-ms", () -> "1000");
    }

    @LocalServerPort int port;
    @Autowired DataSource dataSource;
    @Autowired ObjectMapper objectMapper;
    @Autowired @Qualifier("anonMinioClient") MinioClient minio;
    @Autowired StringRedisTemplate redis;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    private JdbcTemplate jdbc;

    @BeforeEach
    void setUp() {
        jdbc = new JdbcTemplate(dataSource);
        jdbc.update("DELETE FROM guest_session WHERE device_fp LIKE 'fpT09d-%'");
        // Make sure the device counter we're about to check is genuinely
        // empty BEFORE the analyze call — otherwise a leftover from another
        // test run would make the assertion vacuous.
        LocalDate today = LocalDate.now(AnonQuotaService.TZ);
        var keys = redis.keys(AnonQuotaService.KEY_DEVICE_PREFIX + "fpT09d-*:" + today);
        if (keys != null && !keys.isEmpty()) {
            redis.delete(keys);
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    // (d) AI failure must NOT consume quota — biz §2A.7 L660 + T09 ordering
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void ai_failure_does_not_incr_device_counter() throws Exception {
        String deviceFp = "fpT09d-001";
        MintResult m = mint(deviceFp);
        HttpResponse<String> cResp = patchConsent(m.anonSessionId, m.anonToken, 1);
        assertThat(cResp.statusCode()).isEqualTo(200);

        String objectKey = "guest-tmp/" + m.anonSessionId + "/dead.jpg";
        HttpResponse<String> qResp = postQuestion(m.anonToken, "idem-t09d-1",
                Map.of("objectKey", objectKey, "subject", "chemistry"));
        assertThat(qResp.statusCode()).isEqualTo(201);
        minio.putObject(PutObjectArgs.builder().bucket("guest-tmp-it").object(objectKey)
                .stream(new ByteArrayInputStream(new byte[16]), 16, -1)
                .contentType("image/jpeg").build());

        // Analyze · upstream is :65535 · real connection-refused → 502.
        HttpResponse<String> resp = postAnalyze(m.anonToken,
                Map.of("anonQid", m.anonSessionId, "subject", "chemistry"));
        assertThat(resp.statusCode())
                .as("AI upstream down must 502 BAD_GATEWAY (T06 contract preserved)")
                .isEqualTo(502);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("code").asText()).isEqualTo("AI_SERVICE_FAILURE");

        // Critical assertion — real Redis · device counter must be null
        // (never INCR'd). biz §2A.7 L660 "AI failure does not consume quota".
        LocalDate today = LocalDate.now(AnonQuotaService.TZ);
        String deviceKey = AnonQuotaService.KEY_DEVICE_PREFIX + deviceFp + ":" + today;
        String count = redis.opsForValue().get(deviceKey);
        assertThat(count)
                .as("device counter must remain null after AI failure · NO INCR on non-202")
                .isNull();

        // Guest can retry — verify by checking guest_session.status still 0.
        Map<String, Object> row = jdbc.queryForMap(
                "SELECT status FROM guest_session WHERE id = ?", m.anonSessionId);
        assertThat(((Number) row.get("status")).shortValue())
                .as("status stays 0 CREATED — retry must be possible (biz §2A.7 L660)")
                .isEqualTo((short) 0);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Helpers
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
        assertThat(resp.statusCode()).isEqualTo(200);
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
