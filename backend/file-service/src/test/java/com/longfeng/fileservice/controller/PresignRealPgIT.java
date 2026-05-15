package com.longfeng.fileservice.controller;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.longfeng.fileservice.IntegrationTestBase;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.sql.DataSource;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
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
 * Real-PG integration test for {@link PresignController} — proves the @MapsId fix
 * (saveAndFlush + drop setFileId) actually persists to wb_file and wb_file_lifecycle
 * on the sandbox PostgreSQL @ 15432.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class PresignRealPgIT extends IntegrationTestBase {

    @LocalServerPort int port;
    @Autowired DataSource dataSource;

    private final TestRestTemplate rest = new TestRestTemplate();
    private final ObjectMapper json = new ObjectMapper();

    @Test
    @DisplayName("POST /api/file/presign · real PG · wb_file + wb_file_lifecycle both INSERT-ed · @MapsId fix verified")
    void presign_realPg_writesBothRows() throws Exception {
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        Long beforeFileCount = jdbc.queryForObject("SELECT count(*) FROM wb_file", Long.class);
        Long beforeLifecycleCount =
                jdbc.queryForObject("SELECT count(*) FROM wb_file_lifecycle", Long.class);
        assertThat(beforeFileCount).isNotNull();
        assertThat(beforeLifecycleCount).isNotNull();

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("filename", "wt7-real-pg.jpg");
        body.put("content_type", "image/jpeg");
        body.put("bytes", 4096);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-Idempotency-Key", UUID.randomUUID().toString());

        ResponseEntity<String> resp = rest.exchange(
                "http://localhost:" + port + "/api/file/presign",
                HttpMethod.POST,
                new HttpEntity<>(json.writeValueAsString(body), headers),
                String.class);

        assertThat(resp.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode root = json.readTree(resp.getBody());
        assertThat(root.path("code").asInt()).isEqualTo(0);
        JsonNode data = root.path("data");
        assertThat(data.path("url").asText()).isNotBlank();
        assertThat(data.path("image_url").asText()).isNotBlank();
        assertThat(data.path("method").asText()).isEqualTo("PUT");
        String objectKey = data.path("object_key").asText();
        assertThat(objectKey).startsWith("wrongbook/");
        assertThat(data.path("expires_in_sec").asLong()).isPositive();

        Long afterFileCount = jdbc.queryForObject("SELECT count(*) FROM wb_file", Long.class);
        assertThat(afterFileCount).isNotNull();
        assertThat(afterFileCount - beforeFileCount).isEqualTo(1L);

        List<Map<String, Object>> fileRows = jdbc.queryForList(
                "SELECT id, object_key, mime_type, status FROM wb_file WHERE object_key = ?",
                objectKey);
        assertThat(fileRows).hasSize(1);
        Map<String, Object> fileRow = fileRows.get(0);
        Long fileId = ((Number) fileRow.get("id")).longValue();
        assertThat(fileRow.get("mime_type")).isEqualTo("image/jpeg");
        assertThat(((Number) fileRow.get("status")).intValue()).isEqualTo(0);

        Long afterLifecycleCount =
                jdbc.queryForObject("SELECT count(*) FROM wb_file_lifecycle", Long.class);
        assertThat(afterLifecycleCount).isNotNull();
        assertThat(afterLifecycleCount - beforeLifecycleCount).isEqualTo(1L);

        List<Map<String, Object>> lifecycleRows = jdbc.queryForList(
                "SELECT id, promote_at, archive_at FROM wb_file_lifecycle WHERE id = ?",
                fileId);
        assertThat(lifecycleRows).hasSize(1);
        Map<String, Object> lcRow = lifecycleRows.get(0);
        assertThat(((Number) lcRow.get("id")).longValue()).isEqualTo(fileId);
        assertThat(lcRow.get("promote_at")).isNotNull();
        assertThat(lcRow.get("archive_at")).isNotNull();
    }
}
