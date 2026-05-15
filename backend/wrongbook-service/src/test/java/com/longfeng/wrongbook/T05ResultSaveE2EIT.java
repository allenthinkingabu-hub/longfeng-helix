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
 * // trace: biz/业务与技术解決方案_AI错题本.md §2B.2 步 9 + design/system/pages/P04-result.spec.md §5/§9
 *
 * SC01-T05 · POST /api/wb/questions/{qid}/save
 * AC1: save button → 200 response
 * AC2: strategyCode=EBBINGHAUS_STD + X-Request-Id header
 * AC3: DB status → CONFIRMED(3) + question.created.topic outbox event (same TX)
 * AC4: idempotent save (2nd call returns snapshot, no duplicate outbox)
 * TI1: outbox payload {itemId, userId, subject, occurredAt}
 * TI2: idempotency based on qid unique
 *
 * 真 PG (team-2-pg:15433/wrongbook) · Flyway 迁移 · 禁 Mock
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class T05ResultSaveE2EIT extends IntegrationTestBase {

    @LocalServerPort int port;
    @Autowired DataSource dataSource;

    private final TestRestTemplate rest = new TestRestTemplate();
    private final ObjectMapper json = new ObjectMapper();

    private static String createdQid;

    private String base() { return "http://localhost:" + port; }

    @Test
    @Order(1)
    @DisplayName("Setup: create PENDING question for T05 save test")
    void setup_createPendingQuestion() throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("student_id", 200005L);
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
        createdQid = root.path("data").path("qid").asText();
        assertThat(createdQid).isNotBlank();
    }

    @Test
    @Order(2)
    @DisplayName("AC2+AC3: POST /save with strategyCode + X-Request-Id → 200 + status=CONFIRMED + outbox written")
    void save_happyPath_confirmsAndWritesOutbox() throws Exception {
        assertThat(createdQid).isNotNull();

        // AC2: body{strategyCode=EBBINGHAUS_STD} + X-Request-Id header
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("qid", createdQid);
        body.put("strategyCode", "EBBINGHAUS_STD");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-Request-Id", UUID.randomUUID().toString());

        ResponseEntity<String> resp = rest.exchange(
                base() + "/api/wb/questions/" + createdQid + "/save",
                HttpMethod.POST,
                new HttpEntity<>(json.writeValueAsString(body), headers),
                String.class);

        // AC2: 200 response
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode root = json.readTree(resp.getBody());
        assertThat(root.path("data").path("qid").asText()).isEqualTo(createdQid);
        // AC3: status = CONFIRMED(3)
        assertThat(root.path("data").path("status").asInt()).isEqualTo(3);

        // AC3: verify DB status transition
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        Short status = jdbc.queryForObject(
                "SELECT status FROM wrong_item WHERE id = ?",
                Short.class, Long.parseLong(createdQid));
        assertThat(status).isEqualTo((short) 3);

        // AC3 + TI1: outbox event written in same TX
        Long outboxCount = jdbc.queryForObject(
                "SELECT count(*) FROM wrong_item_outbox WHERE wrong_item_id = ? AND event_type = 'question.created.topic'",
                Long.class, Long.parseLong(createdQid));
        assertThat(outboxCount).isEqualTo(1L);

        // TI1: outbox payload contains {itemId, userId, subject, occurredAt}
        String payload = jdbc.queryForObject(
                "SELECT payload FROM wrong_item_outbox WHERE wrong_item_id = ? AND event_type = 'question.created.topic'",
                String.class, Long.parseLong(createdQid));
        JsonNode payloadNode = json.readTree(payload);
        assertThat(payloadNode.path("itemId").asLong()).isEqualTo(Long.parseLong(createdQid));
        assertThat(payloadNode.path("userId").asLong()).isEqualTo(200005L);
        assertThat(payloadNode.path("subject").asText()).isEqualTo("math");
        assertThat(payloadNode.has("occurredAt")).isTrue();
    }

    @Test
    @Order(3)
    @DisplayName("AC4+TI2: idempotent save — 2nd call returns snapshot, no duplicate outbox")
    void save_idempotent_noDuplicateOutbox() throws Exception {
        assertThat(createdQid).isNotNull();

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("qid", createdQid);
        body.put("strategyCode", "EBBINGHAUS_STD");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-Request-Id", UUID.randomUUID().toString());

        // 2nd save call
        ResponseEntity<String> resp = rest.exchange(
                base() + "/api/wb/questions/" + createdQid + "/save",
                HttpMethod.POST,
                new HttpEntity<>(json.writeValueAsString(body), headers),
                String.class);

        // AC4: 200 response (idempotent)
        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode root = json.readTree(resp.getBody());
        assertThat(root.path("data").path("status").asInt()).isEqualTo(3);

        // TI2: still only 1 outbox record (no duplicate)
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        Long outboxCount = jdbc.queryForObject(
                "SELECT count(*) FROM wrong_item_outbox WHERE wrong_item_id = ? AND event_type = 'question.created.topic'",
                Long.class, Long.parseLong(createdQid));
        assertThat(outboxCount).isEqualTo(1L);
    }

    @Test
    @Order(4)
    @DisplayName("AC5: save non-existent qid → 404/500 error")
    void save_nonExistentQid_returnsError() throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-Request-Id", UUID.randomUUID().toString());

        ResponseEntity<String> resp = rest.exchange(
                base() + "/api/wb/questions/999999999999/save",
                HttpMethod.POST,
                new HttpEntity<>("{}", headers),
                String.class);

        // non-existent qid should not return 200
        assertThat(resp.getStatusCode().value()).isGreaterThanOrEqualTo(400);
    }
}
