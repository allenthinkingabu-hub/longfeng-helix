package com.longfeng.anonymousservice;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

/**
 * SC-11-T01 · LandingController E2E IT (anonymous-service /api/landing/*).
 *
 * <p>Four test cases per inflight scope_in #9 (a)-(d):
 * <ol>
 *   <li>{@code samples_default_bucket_returns_3_items} — happy path · array shape
 *       · zod field surface (subject / stemText / knowledgePoints / errorReason
 *       / correction).
 *   <li>{@code samples_variant_b_different_payload} — proof of A/B routing ·
 *       variant_b returns a payload that differs from default.
 *   <li>{@code samples_response_has_cdn_headers} — Cache-Control public,
 *       max-age=3600 + Vary: bucket on /samples.
 *   <li>{@code kpi_returns_expected_envelope} — 3 non-negative integer fields.
 * </ol>
 *
 * <p>Inherits {@link IntegrationTestBase} to keep Flyway/PG/Redis wiring
 * consistent with sibling IT (SC-00-T01-T02). The endpoints themselves don't
 * touch the DB, but the application context expects PG to come up.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class T01LandingShellApiE2EIT extends IntegrationTestBase {

    @LocalServerPort int port;
    @Autowired ObjectMapper objectMapper;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    private HttpResponse<String> get(String pathAndQuery) throws Exception {
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create("http://localhost:" + port + pathAndQuery))
                .timeout(Duration.ofSeconds(5))
                .GET()
                .build();
        return httpClient.send(req, HttpResponse.BodyHandlers.ofString());
    }

    // ──────────────────────────────────────────────────────────────────────
    // Test 1 · samples_default_bucket_returns_3_items
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void samples_default_bucket_returns_3_items() throws Exception {
        HttpResponse<String> resp = get("/api/landing/samples?bucket=default");
        assertThat(resp.statusCode()).isEqualTo(200);
        JsonNode arr = objectMapper.readTree(resp.body());
        assertThat(arr.isArray()).isTrue();
        assertThat(arr.size()).isEqualTo(3);
        for (JsonNode item : arr) {
            assertThat(item.path("subject").isTextual()).isTrue();
            assertThat(item.path("subject").asText()).isNotEmpty();
            assertThat(item.path("stemText").isTextual()).isTrue();
            assertThat(item.path("stemText").asText()).isNotEmpty();
            assertThat(item.path("knowledgePoints").isArray()).isTrue();
            assertThat(item.path("knowledgePoints").size()).isGreaterThanOrEqualTo(1);
            assertThat(item.path("errorReason").isTextual()).isTrue();
            assertThat(item.path("correction").isTextual()).isTrue();
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    // Test 2 · samples_variant_b_different_payload (A/B routing proof)
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void samples_variant_b_different_payload() throws Exception {
        HttpResponse<String> defaultResp = get("/api/landing/samples?bucket=default");
        HttpResponse<String> variantResp = get("/api/landing/samples?bucket=variant_b");
        assertThat(defaultResp.statusCode()).isEqualTo(200);
        assertThat(variantResp.statusCode()).isEqualTo(200);

        JsonNode dArr = objectMapper.readTree(defaultResp.body());
        JsonNode vArr = objectMapper.readTree(variantResp.body());
        assertThat(dArr.size()).isEqualTo(3);
        assertThat(vArr.size()).isEqualTo(3);

        // Proof of A/B: at least one stemText differs between buckets.
        String dFirstStem = dArr.get(0).path("stemText").asText();
        String vFirstStem = vArr.get(0).path("stemText").asText();
        assertThat(vFirstStem).isNotEqualTo(dFirstStem);

        // Unknown bucket falls back to default (graceful degrade · biz §10.7 P0).
        HttpResponse<String> unknownResp = get("/api/landing/samples?bucket=unknown_bucket_xyz");
        assertThat(unknownResp.statusCode()).isEqualTo(200);
        JsonNode uArr = objectMapper.readTree(unknownResp.body());
        assertThat(uArr.get(0).path("stemText").asText()).isEqualTo(dFirstStem);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Test 3 · samples_response_has_cdn_headers
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void samples_response_has_cdn_headers() throws Exception {
        HttpResponse<String> resp = get("/api/landing/samples?bucket=default");
        assertThat(resp.statusCode()).isEqualTo(200);

        String cc = resp.headers().firstValue("Cache-Control").orElse("");
        assertThat(cc).contains("public").contains("max-age=3600");

        String vary = resp.headers().firstValue("Vary").orElse("");
        assertThat(vary).contains("bucket");
    }

    // ──────────────────────────────────────────────────────────────────────
    // Test 4 · kpi_returns_expected_envelope
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void kpi_returns_expected_envelope() throws Exception {
        HttpResponse<String> resp = get("/api/landing/kpi");
        assertThat(resp.statusCode()).isEqualTo(200);
        JsonNode body = objectMapper.readTree(resp.body());

        assertThat(body.path("cumulativeQuestions").isNumber()).isTrue();
        assertThat(body.path("cumulativeQuestions").asLong()).isGreaterThan(0L);
        assertThat(body.path("dailyAnalyses").isNumber()).isTrue();
        assertThat(body.path("dailyAnalyses").asLong()).isGreaterThan(0L);
        assertThat(body.path("happyUsers").isNumber()).isTrue();
        assertThat(body.path("happyUsers").asLong()).isGreaterThan(0L);

        String cc = resp.headers().firstValue("Cache-Control").orElse("");
        assertThat(cc).contains("public").contains("max-age=3600");
    }
}
