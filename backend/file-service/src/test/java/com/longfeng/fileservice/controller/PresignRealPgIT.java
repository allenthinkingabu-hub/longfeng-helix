package com.longfeng.fileservice.controller;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.springframework.test.context.TestPropertySource;

/**
 * Real-PG integration test for {@link PresignController} — proves the @MapsId fix
 * (saveAndFlush + drop setFileId) actually persists to {@code file.wb_file} and
 * {@code file.wb_file_lifecycle} on the resident s3-it-pg PostgreSQL @ 15432.
 *
 * <p>Why this exists: the unit + WebMvc tests mock the repos, so they cannot catch
 * the original bug ({@code AssertionFailure: null identifier (WbFileLifecycle)}). This
 * IT boots the full Spring context against a live PG so JPA / Hibernate actually
 * resolves the OneToOneType + @MapsId chain end-to-end.
 *
 * <p>Schema is assumed already migrated by Flyway/manual setup; we run with
 * {@code spring.jpa.hibernate.ddl-auto=none} + {@code spring.flyway.enabled=false}
 * to avoid touching the existing data and to side-step the
 * {@code sha256_hash bpchar vs varchar} drift the orchestrator already triaged.
 *
 * <p>MinIO + storage props point at the s6-it-minio resident container (9000).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:postgresql://localhost:15432/longfeng_file",
        "spring.datasource.username=postgres",
        "spring.datasource.password=wb",
        "spring.jpa.hibernate.ddl-auto=none",
        "spring.flyway.enabled=false",
        // distinct snowflake worker so this IT cannot collide with the running file-service
        // process (which is on worker-id 6 — the application.yml default).
        "snowflake.worker-id=17",
        "file-service.storage.endpoint=http://localhost:9000",
        "file-service.storage.bucket=wrongbook-dev",
        "file-service.storage.access-key=minio",
        "file-service.storage.secret-key=minio12345",
        "app.storage.minio.endpoint=http://localhost:9000",
        "app.storage.minio.bucket=wrongbook-dev",
        "app.storage.minio.access-key=minio",
        "app.storage.minio.secret-key=minio12345"
})
class PresignRealPgIT {

    @LocalServerPort int port;
    @Autowired DataSource dataSource;

    private final TestRestTemplate rest = new TestRestTemplate();
    private final ObjectMapper json = new ObjectMapper();

    @Test
    @DisplayName("POST /api/file/presign · real PG · wb_file + wb_file_lifecycle both INSERT-ed · @MapsId fix verified")
    void presign_realPg_writesBothRows() throws Exception {
        // ── Given: snapshot pre-row count so concurrent runs cannot false-pass ──
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        Long beforeFileCount = jdbc.queryForObject("SELECT count(*) FROM file.wb_file", Long.class);
        Long beforeLifecycleCount =
                jdbc.queryForObject("SELECT count(*) FROM file.wb_file_lifecycle", Long.class);
        assertThat(beforeFileCount).isNotNull();
        assertThat(beforeLifecycleCount).isNotNull();

        // ── When: POST /api/file/presign with FE-shape payload ──
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("filename", "wt7-real-pg.jpg");
        body.put("content_type", "image/jpeg");
        body.put("bytes", 4096);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        // SC-01-T01 AC6 · X-Idempotency-Key is REQUIRED by PresignController (commit de7c220):
        // missing header now maps to HTTP 400 ERR_IDEMPOTENCY_KEY_REQUIRED via the
        // BusinessException guard at PresignController.java:152. Supplying a random UUID
        // here keeps the @MapsId invariant under test (wb_file + wb_file_lifecycle both
        // INSERT-ed) without coupling to the idempotency cache HIT short-circuit.
        headers.set("X-Idempotency-Key", UUID.randomUUID().toString());

        ResponseEntity<String> resp = rest.exchange(
                "http://localhost:" + port + "/api/file/presign",
                HttpMethod.POST,
                new HttpEntity<>(json.writeValueAsString(body), headers),
                String.class);

        // ── Then: HTTP 200 + envelope code 0 + url + image_url present ──
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

        // ── And: wb_file row really landed in PG with matching object_key + status PENDING ──
        Long afterFileCount = jdbc.queryForObject("SELECT count(*) FROM file.wb_file", Long.class);
        assertThat(afterFileCount).isNotNull();
        assertThat(afterFileCount - beforeFileCount).isEqualTo(1L);

        List<Map<String, Object>> fileRows = jdbc.queryForList(
                "SELECT id, object_key, mime_type, status FROM file.wb_file WHERE object_key = ?",
                objectKey);
        assertThat(fileRows).hasSize(1);
        Map<String, Object> fileRow = fileRows.get(0);
        Long fileId = ((Number) fileRow.get("id")).longValue();
        assertThat(fileRow.get("mime_type")).isEqualTo("image/jpeg");
        // status is smallint → may come back as Short or Integer
        assertThat(((Number) fileRow.get("status")).intValue()).isEqualTo(0); // STATUS_PENDING

        // ── And: wb_file_lifecycle row exists with matching file_id (proves @MapsId resolved) ──
        Long afterLifecycleCount =
                jdbc.queryForObject("SELECT count(*) FROM file.wb_file_lifecycle", Long.class);
        assertThat(afterLifecycleCount).isNotNull();
        assertThat(afterLifecycleCount - beforeLifecycleCount).isEqualTo(1L);

        List<Map<String, Object>> lifecycleRows = jdbc.queryForList(
                "SELECT file_id, promote_at, archive_at FROM file.wb_file_lifecycle WHERE file_id = ?",
                fileId);
        assertThat(lifecycleRows).hasSize(1);
        Map<String, Object> lcRow = lifecycleRows.get(0);
        assertThat(((Number) lcRow.get("file_id")).longValue()).isEqualTo(fileId);
        assertThat(lcRow.get("promote_at")).isNotNull();
        assertThat(lcRow.get("archive_at")).isNotNull();
    }
}
