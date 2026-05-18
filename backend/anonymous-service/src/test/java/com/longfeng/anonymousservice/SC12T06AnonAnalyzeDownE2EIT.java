package com.longfeng.anonymousservice;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * SC-12-T06 · 502 AI_SERVICE_FAILURE path · companion IT to
 * {@link SC12T06AnonAnalyzeE2EIT}.
 *
 * <p>Why a separate class: switching {@code anon.ai-analysis.base-url} mid-suite
 * is awkward — Spring caches the application context per {@code @DynamicPropertySource}
 * fingerprint, so a property override on a {@code @Nested} class can't reach
 * the RestTemplate bean built at boot. Putting the down-case in its own
 * {@code @SpringBootTest} class with a different override is the cleanest fix.
 *
 * <p>NO MOCK: this IT does NOT stub the RestTemplate, does NOT use WireMock /
 * MockWebServer / spring-cloud-contract. It points the
 * {@code anon.ai-analysis.base-url} at {@code http://127.0.0.1:65535} — a port
 * the kernel will refuse — so the RestTemplate gets a real
 * {@code RestClientException} (connection refused). The service then surfaces
 * {@code AI_SERVICE_FAILURE} → controller maps to 502. End-to-end real
 * networking; the only "alteration" is what address it targets.
 *
 * <p>Verifies the biz §2A.7 L660 contract: AI failure does NOT consume the
 * guest's quota → {@code guest_session.status} stays at 0 CREATED so a retry
 * against the same session can still flip 0→1.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SC12T06AnonAnalyzeDownE2EIT extends IntegrationTestBase {

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("anon.storage.endpoint", () -> "http://127.0.0.1:9000");
        r.add("anon.storage.access-key", () -> "minioadmin");
        r.add("anon.storage.secret-key", () -> "minioadmin");
        r.add("anon.storage.bucket", () -> "guest-tmp-it");
        r.add("anon.storage.presign-ttl-seconds", () -> "300");
        r.add("anon.storage.max-upload-size", () -> "10485760");
        // Real connection-refused — port 65535 has no listener.
        r.add("anon.ai-analysis.base-url", () -> "http://127.0.0.1:65535");
        // Tighten the timeouts so the case finishes inside a few seconds even
        // when the kernel takes its time issuing the RST.
        r.add("anon.ai-analysis.connect-timeout-ms", () -> "1000");
        r.add("anon.ai-analysis.read-timeout-ms", () -> "1000");
    }

    @LocalServerPort int port;
    @Autowired DataSource dataSource;
    @Autowired ObjectMapper objectMapper;
    @Autowired @Qualifier("anonMinioClient") MinioClient minio;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    private JdbcTemplate jdbc;

    @BeforeEach
    void setUp() {
        jdbc = new JdbcTemplate(dataSource);
        jdbc.update("DELETE FROM guest_session WHERE device_fp LIKE 'fpT06d-%'");
    }

    @Test
    void analyze_when_ai_service_down_returns_502_and_status_not_advanced()
            throws Exception {
        MintResult m = mint("fpT06d-001");
        HttpResponse<String> cResp = patchConsent(m.anonSessionId, m.anonToken, 1);
        assertThat(cResp.statusCode()).isEqualTo(200);

        String objectKey = "guest-tmp/" + m.anonSessionId + "/down.jpg";
        HttpResponse<String> qResp = postQuestion(m.anonToken, "idem-t06d",
                Map.of("objectKey", objectKey, "subject", "english"));
        assertThat(qResp.statusCode()).as("T05 questions must succeed for fixture").isEqualTo(201);

        // PUT real bytes · ensures the GET URL would be dereferenceable IF
        // forward attempt landed somewhere. Here it can't because 65535 is
        // closed, but keeping the fixture clean isolates the variable.
        byte[] payload = "x".getBytes(StandardCharsets.UTF_8);
        minio.putObject(PutObjectArgs.builder()
                .bucket("guest-tmp-it")
                .object(objectKey)
                .stream(new ByteArrayInputStream(payload), payload.length, -1)
                .contentType("image/jpeg")
                .build());

        HttpResponse<String> resp = postAnalyze(m.anonToken,
                Map.of("anonQid", m.anonSessionId, "subject", "english"));
        assertThat(resp.statusCode())
                .as("ai-analysis-service unreachable must 502 BAD_GATEWAY · biz §2A.7 L660")
                .isEqualTo(502);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("code").asText()).isEqualTo("AI_SERVICE_FAILURE");

        // Critical · status NOT advanced.  biz §2A.7 L660 mandates "AI failure
        // does NOT consume quota" so retry must be possible. If a future
        // refactor flips status BEFORE awaiting the upstream 202 ack, this
        // test traps the regression.
        Map<String, Object> row = jdbc.queryForMap(
                "SELECT status FROM guest_session WHERE id = ?", m.anonSessionId);
        assertThat(((Number) row.get("status")).shortValue())
                .as("status must remain 0 CREATED on AI failure (no quota consumed · retry OK)")
                .isEqualTo((short) 0);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Helpers · trimmed copy of SC12T06AnonAnalyzeE2EIT helpers
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
        assertThat(resp.statusCode()).as("mint must succeed for fixture").isEqualTo(200);
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
