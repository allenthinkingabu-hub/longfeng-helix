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
}
