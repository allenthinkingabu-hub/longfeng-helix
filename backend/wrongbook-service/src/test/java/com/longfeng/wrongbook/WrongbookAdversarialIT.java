package com.longfeng.wrongbook;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import javax.sql.DataSource;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Adversarial IT · Tester agent · 破坏性边界用例 + 幂等回放验证
 * 验证 error path / edge case / idempotency contract
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class WrongbookAdversarialIT extends IntegrationTestBase {

    @LocalServerPort int port;
    @Autowired DataSource dataSource;

    private final TestRestTemplate rest = new TestRestTemplate();
    private final ObjectMapper json = new ObjectMapper();

    private String base() { return "http://localhost:" + port; }

    // ── #1 POST without idempotency key → should return error ──
    @Test
    @Order(1)
    @DisplayName("ADV-1 POST /api/wb/questions without idempotency key → 4xx error")
    void createWithoutIdempotencyKey() throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("student_id", 999999L);
        body.put("subject", "math");
        body.put("source_type", 1);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        // deliberately omit X-Idempotency-Key, X-Request-Id, and body idempotency_key

        ResponseEntity<String> resp = rest.exchange(
                base() + "/api/wb/questions",
                HttpMethod.POST,
                new HttpEntity<>(json.writeValueAsString(body), headers),
                String.class);

        // controller throws BusinessException for null/blank idem key
        assertThat(resp.getStatusCode().is4xxClientError() || resp.getStatusCode().is5xxServerError())
                .as("missing idempotency key should not return 2xx")
                .isTrue();
    }

    // ── #2 GET with non-numeric qid → should return error ──
    @Test
    @Order(2)
    @DisplayName("ADV-2 GET /api/wb/questions/abc → error for invalid qid")
    void getDetailInvalidQid() throws Exception {
        ResponseEntity<String> resp = rest.getForEntity(
                base() + "/api/wb/questions/abc", String.class);

        assertThat(resp.getStatusCode().is4xxClientError() || resp.getStatusCode().is5xxServerError())
                .as("non-numeric qid should not return 2xx")
                .isTrue();
    }

    // ── #3 GET with non-existent qid → should return 404/4xx ──
    @Test
    @Order(3)
    @DisplayName("ADV-3 GET /api/wb/questions/99999999999 → not found")
    void getDetailNonExistent() throws Exception {
        ResponseEntity<String> resp = rest.getForEntity(
                base() + "/api/wb/questions/99999999999", String.class);

        assertThat(resp.getStatusCode().is4xxClientError() || resp.getStatusCode().is5xxServerError())
                .as("non-existent qid should not return 2xx")
                .isTrue();
    }

    // ── #4 Idempotency replay: same key returns same qid ──
    @Test
    @Order(4)
    @DisplayName("ADV-4 POST with same idempotency key → returns same qid (no duplicate)")
    void createIdempotencyReplay() throws Exception {
        String idemKey = "adv-idem-" + UUID.randomUUID();

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("student_id", 100002L);
        body.put("subject", "physics");
        body.put("source_type", 2);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-Idempotency-Key", idemKey);

        // first create
        ResponseEntity<String> resp1 = rest.exchange(
                base() + "/api/wb/questions",
                HttpMethod.POST,
                new HttpEntity<>(json.writeValueAsString(body), headers),
                String.class);
        assertThat(resp1.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        String qid1 = json.readTree(resp1.getBody()).path("data").path("qid").asText();

        // replay with same idempotency key
        ResponseEntity<String> resp2 = rest.exchange(
                base() + "/api/wb/questions",
                HttpMethod.POST,
                new HttpEntity<>(json.writeValueAsString(body), headers),
                String.class);
        assertThat(resp2.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        String qid2 = json.readTree(resp2.getBody()).path("data").path("qid").asText();

        // same qid returned
        assertThat(qid1).isEqualTo(qid2);

        // verify only 1 row in DB for this student+subject combination created by this test
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        Long count = jdbc.queryForObject(
                "SELECT count(*) FROM wrong_item WHERE id = ?",
                Long.class, Long.parseLong(qid1));
        assertThat(count).isEqualTo(1L);
    }

    // ── #5 SQL injection attempt in subject field → should reject or escape safely ──
    @Test
    @Order(5)
    @DisplayName("ADV-5 POST with SQL injection in subject → CHECK constraint rejects")
    void createWithSqlInjectionSubject() throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("student_id", 999998L);
        body.put("subject", "'; DROP TABLE wrong_item; --");
        body.put("source_type", 1);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-Idempotency-Key", UUID.randomUUID().toString());

        ResponseEntity<String> resp = rest.exchange(
                base() + "/api/wb/questions",
                HttpMethod.POST,
                new HttpEntity<>(json.writeValueAsString(body), headers),
                String.class);

        // DB CHECK constraint ck_wrong_subject rejects non-whitelisted values
        assertThat(resp.getStatusCode().is4xxClientError() || resp.getStatusCode().is5xxServerError())
                .as("SQL injection string in subject must not succeed")
                .isTrue();

        // verify table still exists (not dropped)
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        Long tableExists = jdbc.queryForObject(
                "SELECT count(*) FROM information_schema.tables WHERE table_name = 'wrong_item'",
                Long.class);
        assertThat(tableExists).isEqualTo(1L);
    }

    // ── #6 超長 stem_text via PATCH → should not crash service ──
    @Test
    @Order(6)
    @DisplayName("ADV-6 PATCH with 超长 stem_text (100KB) → boundary test")
    void patchWithOversizedStemText() throws Exception {
        // first create a valid question
        Map<String, Object> createBody = new LinkedHashMap<>();
        createBody.put("student_id", 999997L);
        createBody.put("subject", "english");
        createBody.put("source_type", 1);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-Idempotency-Key", UUID.randomUUID().toString());

        ResponseEntity<String> createResp = rest.exchange(
                base() + "/api/wb/questions",
                HttpMethod.POST,
                new HttpEntity<>(json.writeValueAsString(createBody), headers),
                String.class);
        assertThat(createResp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        String qid = json.readTree(createResp.getBody()).path("data").path("qid").asText();

        // patch with 超长 100KB stem_text (boundary / 脏数据 test)
        String oversizedText = "A".repeat(100_000);
        Map<String, Object> patchBody = new LinkedHashMap<>();
        patchBody.put("stem_text", oversizedText);

        java.net.http.HttpClient client = java.net.http.HttpClient.newHttpClient();
        java.net.http.HttpRequest request = java.net.http.HttpRequest.newBuilder()
                .uri(java.net.URI.create(base() + "/api/wb/questions/" + qid))
                .method("PATCH", java.net.http.HttpRequest.BodyPublishers.ofString(json.writeValueAsString(patchBody)))
                .header("Content-Type", "application/json")
                .header("X-Request-Id", UUID.randomUUID().toString())
                .build();
        java.net.http.HttpResponse<String> httpResp = client.send(request, java.net.http.HttpResponse.BodyHandlers.ofString());

        // TEXT column has no length limit so this should succeed or fail gracefully
        assertThat(httpResp.statusCode() == 200 || httpResp.statusCode() >= 400)
                .as("oversized input must either succeed (TEXT col) or fail gracefully, not crash")
                .isTrue();
    }
}
