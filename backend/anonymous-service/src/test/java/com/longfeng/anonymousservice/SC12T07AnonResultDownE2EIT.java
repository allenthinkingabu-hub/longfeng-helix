package com.longfeng.anonymousservice;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * SC-12-T07 · 502 {@code AI_SERVICE_FAILURE} path · companion IT to
 * {@link SC12T07AnonResultE2EIT}.
 *
 * <p>Why a separate class · same reason as
 * {@link SC12T06AnonAnalyzeDownE2EIT}: switching
 * {@code anon.ai-analysis.base-url} mid-suite is awkward because Spring caches
 * the application context per {@code @DynamicPropertySource} fingerprint;
 * dropping the down-case into its own {@code @SpringBootTest} class is the
 * cleanest fix.
 *
 * <p>NO MOCK iron rule · this IT does NOT stub the RestTemplate, does NOT use
 * WireMock / MockWebServer / spring-cloud-contract. It points
 * {@code anon.ai-analysis.base-url} at {@code http://127.0.0.1:65535} — a port
 * the kernel will refuse — so the RestTemplate gets a real
 * {@code RestClientException} (connection refused). The service then surfaces
 * {@code AI_SERVICE_FAILURE} → controller maps to 502. End-to-end real
 * networking; the only "alteration" is what address it targets.
 *
 * <p>Verifies that {@code guest_session.status} stays unchanged on an upstream
 * failure: an FE retry must still see the original state machine value.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SC12T07AnonResultDownE2EIT extends IntegrationTestBase {

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        // Real connection-refused — port 65535 has no listener.
        r.add("anon.ai-analysis.base-url", () -> "http://127.0.0.1:65535");
        // Tighten timeouts so the case finishes inside a few seconds even
        // when the kernel takes its time issuing the RST.
        r.add("anon.ai-analysis.connect-timeout-ms", () -> "1000");
        r.add("anon.ai-analysis.read-timeout-ms", () -> "1000");
    }

    @LocalServerPort int port;
    @Autowired DataSource dataSource;
    @Autowired ObjectMapper objectMapper;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    private JdbcTemplate jdbc;

    @BeforeEach
    void setUp() {
        jdbc = new JdbcTemplate(dataSource);
        jdbc.update("DELETE FROM guest_session WHERE device_fp LIKE 'fpT07d-%'");
    }

    @Test
    void result_when_ai_service_down_returns_502_and_status_not_advanced()
            throws Exception {
        MintResult m = mint("fpT07d-001");

        HttpResponse<String> resp = getResult(m.anonToken, m.anonSessionId);
        assertThat(resp.statusCode())
                .as("ai-analysis-service unreachable must 502 BAD_GATEWAY")
                .isEqualTo(502);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("code").asText()).isEqualTo("AI_SERVICE_FAILURE");

        // Critical · status NOT advanced. T07 must not flip status on
        // connection failure: an FE retry must still be able to re-poll and
        // get an honest answer when upstream comes back.
        Map<String, Object> row = jdbc.queryForMap(
                "SELECT status FROM guest_session WHERE id = ?", m.anonSessionId);
        assertThat(((Number) row.get("status")).shortValue())
                .as("status must remain 0 CREATED on AI failure (no spurious 0→2/3 transition)")
                .isEqualTo((short) 0);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Helpers · trimmed copy
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

    private HttpResponse<String> getResult(String anonToken, long anonQid) throws Exception {
        HttpRequest.Builder b = HttpRequest.newBuilder()
                .uri(URI.create("http://127.0.0.1:" + port + "/api/anon/result/" + anonQid))
                .timeout(Duration.ofSeconds(10))
                .GET();
        if (anonToken != null) b.header("X-Anon-Token", anonToken);
        return httpClient.send(b.build(), HttpResponse.BodyHandlers.ofString());
    }

    private record MintResult(String anonToken, long anonSessionId) {}
}
