package com.longfeng.wrongbook;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
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
 * wrongbook-service 6-endpoint IT · 真 PG (team-2-pg:15433/wrongbook) · Flyway 迁移
 * 对齐 A02-wrongbook-api.md §2 SC-01 6 触点
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class WrongbookServiceIT extends IntegrationTestBase {

    @LocalServerPort int port;
    @Autowired DataSource dataSource;

    private final TestRestTemplate rest = new TestRestTemplate();
    private final ObjectMapper json = new ObjectMapper();

    private static String createdQid;

    private String base() { return "http://localhost:" + port; }

    // ── #1 POST /api/wb/questions · create PENDING ──
    @Test
    @Order(1)
    @DisplayName("#1 POST /api/wb/questions · create PENDING · HTTP 201 + qid returned")
    void createQuestion() throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("student_id", 100001L);
        body.put("subject", "math");
        body.put("source_type", 1);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-Idempotency-Key", UUID.randomUUID().toString());

        ResponseEntity<String> resp = rest.exchange(
                base() + "/api/wb/questions",
                HttpMethod.POST,
                new HttpEntity<>(json.writeValueAsString(body), headers),
                String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        JsonNode root = json.readTree(resp.getBody());
        assertThat(root.path("code").asInt()).isEqualTo(0);
        String qid = root.path("data").path("qid").asText();
        assertThat(qid).isNotBlank();
        createdQid = qid;

        // verify in DB
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        Long count = jdbc.queryForObject(
                "SELECT count(*) FROM wrong_item WHERE id = ?",
                Long.class, Long.parseLong(qid));
        assertThat(count).isEqualTo(1L);
    }

    // ── #2 GET /api/wb/questions/{qid} · detail (plain JSON) ──
    @Test
    @Order(2)
    @DisplayName("#2 GET /api/wb/questions/{qid} · detail · plain JSON")
    void getDetail() throws Exception {
        assertThat(createdQid).isNotNull();

        ResponseEntity<String> resp = rest.getForEntity(
                base() + "/api/wb/questions/" + createdQid, String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode root = json.readTree(resp.getBody());
        // plain JSON: top-level has "question" + "planned_nodes"
        assertThat(root.has("question")).isTrue();
        assertThat(root.path("question").path("qid").asText()).isEqualTo(createdQid);
        assertThat(root.path("question").path("subject").asText()).isEqualTo("math");
        assertThat(root.path("question").path("status").asInt()).isEqualTo(0); // PENDING
    }

    // ── #3 PATCH /api/wb/questions/{qid} · edit ──
    @Test
    @Order(3)
    @DisplayName("#3 PATCH /api/wb/questions/{qid} · patch stem_text + difficulty")
    void patchQuestion() throws Exception {
        assertThat(createdQid).isNotNull();

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("stem_text", "x^2 + 2x + 1 = 0, 求 x");
        body.put("difficulty", 2);

        // Use java.net.http.HttpClient for PATCH (TestRestTemplate default factory doesn't support PATCH)
        HttpClient client = HttpClient.newHttpClient();
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(base() + "/api/wb/questions/" + createdQid))
                .method("PATCH", HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)))
                .header("Content-Type", "application/json")
                .header("X-Request-Id", UUID.randomUUID().toString())
                .build();
        HttpResponse<String> httpResp = client.send(request, HttpResponse.BodyHandlers.ofString());

        assertThat(httpResp.statusCode()).isEqualTo(200);
        JsonNode root = json.readTree(httpResp.body());
        assertThat(root.path("question").path("stem_text").asText()).contains("x^2");
        assertThat(root.path("question").path("difficulty").asInt()).isEqualTo(2);
    }

    // ── #4 POST /api/wb/questions/{qid}/save · confirm + plan ──
    @Test
    @Order(4)
    @DisplayName("#4 POST /api/wb/questions/{qid}/save · confirm question")
    void saveQuestion() throws Exception {
        assertThat(createdQid).isNotNull();

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-Request-Id", UUID.randomUUID().toString());

        ResponseEntity<String> resp = rest.exchange(
                base() + "/api/wb/questions/" + createdQid + "/save",
                HttpMethod.POST,
                new HttpEntity<>("{}", headers),
                String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode root = json.readTree(resp.getBody());
        assertThat(root.path("data").path("status").asInt()).isEqualTo(3); // CONFIRMED

        // verify in DB
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        Short status = jdbc.queryForObject(
                "SELECT status FROM wrong_item WHERE id = ?",
                Short.class, Long.parseLong(createdQid));
        assertThat(status).isEqualTo((short) 3);
    }

    // ── #5 GET /api/wb/questions · list ──
    @Test
    @Order(5)
    @DisplayName("#5 GET /api/wb/questions · list by student_id")
    void listQuestions() throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Student-Id", "100001");

        ResponseEntity<String> resp = rest.exchange(
                base() + "/api/wb/questions?subject=math&page=1&size=20",
                HttpMethod.GET,
                new HttpEntity<>(headers),
                String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode root = json.readTree(resp.getBody());
        assertThat(root.path("data").path("total").asLong()).isGreaterThanOrEqualTo(1);
        assertThat(root.path("data").path("items").isArray()).isTrue();
    }

    // ── #6 POST /api/wb/questions/{qid}/archive · archive ──
    @Test
    @Order(6)
    @DisplayName("#6 POST /api/wb/questions/{qid}/archive · archive question · idempotent")
    void archiveQuestion() throws Exception {
        assertThat(createdQid).isNotNull();

        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Request-Id", UUID.randomUUID().toString());

        ResponseEntity<String> resp = rest.exchange(
                base() + "/api/wb/questions/" + createdQid + "/archive",
                HttpMethod.POST,
                new HttpEntity<>(headers),
                String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode root = json.readTree(resp.getBody());
        assertThat(root.path("data").path("status").asInt()).isEqualTo(8); // ARCHIVED

        // idempotent: second call returns same result
        ResponseEntity<String> resp2 = rest.exchange(
                base() + "/api/wb/questions/" + createdQid + "/archive",
                HttpMethod.POST,
                new HttpEntity<>(headers),
                String.class);
        assertThat(resp2.getStatusCode()).isEqualTo(HttpStatus.OK);

        // verify in DB
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        Short status = jdbc.queryForObject(
                "SELECT status FROM wrong_item WHERE id = ?",
                Short.class, Long.parseLong(createdQid));
        assertThat(status).isEqualTo((short) 8);
    }

    // ── Health probes ──
    @Test
    @Order(7)
    @DisplayName("GET /ready + /live · health probes UP")
    void healthProbes() {
        assertThat(rest.getForEntity(base() + "/ready", String.class).getStatusCode())
                .isEqualTo(HttpStatus.OK);
        assertThat(rest.getForEntity(base() + "/live", String.class).getStatusCode())
                .isEqualTo(HttpStatus.OK);
    }
}
