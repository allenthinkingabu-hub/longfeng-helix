package com.longfeng.anonymousservice;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.minio.GetObjectArgs;
import io.minio.MinioClient;
import io.minio.RemoveObjectArgs;
import io.minio.StatObjectArgs;
import io.minio.StatObjectResponse;
import java.io.InputStream;
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
 * SC-12-T04 · {@code POST /api/anon/file/presign} + Minio round-trip E2E IT.
 *
 * <p>Covers biz §2B.13 SC-12 F03 + P-GUEST-CAPTURE spec §5 #1: pre-signed PUT
 * URL minting against a temporary {@code guest-tmp-it} bucket, with one case
 * exercising the full PUT round-trip (real bytes lands in real Minio) to
 * prove the URL is not synthetic.
 *
 * <p>Testcases (≥ 6 required by DoD; 8 here · happy + 4 security/edge + 2
 * adversarial-fix added in Round 1):
 * <ol>
 *   <li>{@code presign_with_valid_token_returns_200_and_url} — happy: 200 +
 *       uploadUrl host=Minio + fileKey shape + ttlSeconds=300 + bucket pinned.</li>
 *   <li>{@code presign_then_put_to_url_succeeds_end_to_end} — round-trip:
 *       mint → PUT 1KB → StatObject confirms real bytes landed.</li>
 *   <li>{@code presign_without_x_anon_token_returns_401} — filter rejection.</li>
 *   <li>{@code presign_with_unsupported_mime_returns_400} — {@code @Pattern}
 *       trips on application/pdf.</li>
 *   <li>{@code presign_with_file_too_large_returns_400} — {@code @Max} trips
 *       on 10MiB+1.</li>
 *   <li>{@code presign_object_key_uses_anon_session_id_prefix} — cross-tenant
 *       write defence: prefix is guest-tmp/{sessionId}/{uuid}.{ext}.</li>
 *   <li>{@code presign_ttl_is_300_seconds_strict} — TTL pinned both in
 *       response body AND in the URL's X-Amz-Expires query param.</li>
 *   <li>{@code presign_filename_with_path_traversal_sanitized} —
 *       "../../etc/passwd" sanitises to .bin · no traversal artefacts in key.</li>
 * </ol>
 *
 * <p>Bucket overridden to {@code guest-tmp-it} via {@code @DynamicPropertySource}
 * so the test data doesn't pollute the prod bucket name. Uses the sandbox
 * Minio at localhost:9000 (same instance file-service uses).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SC12T04AnonPresignE2EIT extends IntegrationTestBase {

    @DynamicPropertySource
    static void minioProps(DynamicPropertyRegistry r) {
        // Point this IT at the sandbox Minio @ 9000 (already running for
        // file-service ITs) but use a dedicated bucket so we don't trample
        // file-service' fixtures.
        r.add("anon.storage.endpoint", () -> "http://127.0.0.1:9000");
        r.add("anon.storage.access-key", () -> "minioadmin");
        r.add("anon.storage.secret-key", () -> "minioadmin");
        r.add("anon.storage.bucket", () -> "guest-tmp-it");
        r.add("anon.storage.presign-ttl-seconds", () -> "300");
        r.add("anon.storage.max-upload-size", () -> "10485760");
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
        // Clean rows from prior runs — only ones this suite owns (device_fp prefix "fpT04-").
        jdbc.update("DELETE FROM guest_session WHERE device_fp LIKE 'fpT04-%'");
    }

    // ──────────────────────────────────────────────────────────────────────
    // (a) Happy path · 200 + uploadUrl shape · pins F03 wire contract
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void presign_with_valid_token_returns_200_and_url() throws Exception {
        MintResult m = mint("fpT04-001");
        HttpResponse<String> resp = presign(m.anonToken, "photo.jpg", "image/jpeg",
                1024L, "GUEST_CAPTURE");
        assertThat(resp.statusCode()).isEqualTo(200);

        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("upload_url").asText())
                .as("upload_url must point at the sandbox Minio instance")
                .contains("127.0.0.1:9000");
        assertThat(body.path("file_key").asText())
                .as("file_key must follow guest-tmp/{sessionId}/{uuid}.{ext} layout")
                .startsWith("guest-tmp/" + m.anonSessionId + "/")
                .endsWith(".jpg");
        assertThat(body.path("ttl_seconds").asLong())
                .as("ttl_seconds must be the spec-pinned 300s window")
                .isEqualTo(300);
        assertThat(body.path("bucket").asText()).isEqualTo("guest-tmp-it");
    }

    // ──────────────────────────────────────────────────────────────────────
    // (b) Full PUT round-trip · proves the URL is real, not synthetic
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void presign_then_put_to_url_succeeds_end_to_end() throws Exception {
        MintResult m = mint("fpT04-002");
        HttpResponse<String> resp = presign(m.anonToken, "round-trip.png", "image/png",
                1024L, "GUEST_CAPTURE");
        assertThat(resp.statusCode()).isEqualTo(200);
        JsonNode body = objectMapper.readTree(resp.body());
        String uploadUrl = body.path("upload_url").asText();
        String fileKey = body.path("file_key").asText();

        // PUT 1 KB of deterministic bytes through the pre-signed URL.
        byte[] payload = new byte[1024];
        for (int i = 0; i < payload.length; i++) payload[i] = (byte) (i % 256);

        HttpRequest put = HttpRequest.newBuilder()
                .uri(URI.create(uploadUrl))
                .header("Content-Type", "image/png")
                .PUT(HttpRequest.BodyPublishers.ofByteArray(payload))
                .timeout(Duration.ofSeconds(10))
                .build();
        HttpResponse<String> putResp = httpClient.send(put, HttpResponse.BodyHandlers.ofString());
        assertThat(putResp.statusCode())
                .as("Minio must accept the PUT to the signed URL (real round-trip)")
                .isEqualTo(200);

        // StatObject — proves the object really exists in Minio with the right size.
        StatObjectResponse stat = minio.statObject(
                StatObjectArgs.builder().bucket("guest-tmp-it").object(fileKey).build());
        assertThat(stat.size())
                .as("Object size on Minio must match the PUT payload byte length")
                .isEqualTo(1024L);

        // GetObject — pull bytes back and verify they round-trip exactly.
        try (InputStream is = minio.getObject(
                GetObjectArgs.builder().bucket("guest-tmp-it").object(fileKey).build())) {
            byte[] got = is.readAllBytes();
            assertThat(got).as("Round-tripped bytes must equal what we PUT").isEqualTo(payload);
        }

        // Best-effort cleanup so the IT bucket doesn't accumulate over time.
        minio.removeObject(RemoveObjectArgs.builder()
                .bucket("guest-tmp-it").object(fileKey).build());
    }

    // ──────────────────────────────────────────────────────────────────────
    // (c) No X-Anon-Token → 401 ANON_TOKEN_INVALID · AnonFilter contract
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void presign_without_x_anon_token_returns_401() throws Exception {
        HttpResponse<String> resp = presignRaw(null,
                Map.of("filename", "no-token.jpg",
                        "mime", "image/jpeg",
                        "size", 1024,
                        "purpose", "GUEST_CAPTURE"));
        assertThat(resp.statusCode()).isEqualTo(401);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("code").asText()).isEqualTo("ANON_TOKEN_INVALID");
    }

    // ──────────────────────────────────────────────────────────────────────
    // (d) mime not in whitelist → 400 VALIDATION_FAILED (@Pattern fires)
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void presign_with_unsupported_mime_returns_400() throws Exception {
        MintResult m = mint("fpT04-003");
        HttpResponse<String> resp = presign(m.anonToken, "doc.pdf", "application/pdf",
                1024L, "GUEST_CAPTURE");
        assertThat(resp.statusCode()).isEqualTo(400);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("code").asText()).isEqualTo("VALIDATION_FAILED");
        assertThat(body.path("message").asText()).contains("mime");
    }

    // ──────────────────────────────────────────────────────────────────────
    // (e) size > 10 MiB → 400 VALIDATION_FAILED (@Max fires)
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void presign_with_file_too_large_returns_400() throws Exception {
        MintResult m = mint("fpT04-004");
        HttpResponse<String> resp = presign(m.anonToken, "huge.jpg", "image/jpeg",
                10_485_761L, "GUEST_CAPTURE");
        assertThat(resp.statusCode()).isEqualTo(400);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("code").asText()).isEqualTo("VALIDATION_FAILED");
        assertThat(body.path("message").asText()).contains("size");
    }

    // ──────────────────────────────────────────────────────────────────────
    // (f) objectKey prefix = anonSessionId · cross-tenant write defence
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void presign_object_key_uses_anon_session_id_prefix() throws Exception {
        MintResult a = mint("fpT04-005a");
        MintResult b = mint("fpT04-005b");
        HttpResponse<String> ra = presign(a.anonToken, "a.jpg", "image/jpeg",
                1024L, "GUEST_CAPTURE");
        HttpResponse<String> rb = presign(b.anonToken, "b.jpg", "image/jpeg",
                1024L, "GUEST_CAPTURE");
        assertThat(ra.statusCode()).isEqualTo(200);
        assertThat(rb.statusCode()).isEqualTo(200);
        String keyA = objectMapper.readTree(ra.body()).path("file_key").asText();
        String keyB = objectMapper.readTree(rb.body()).path("file_key").asText();
        assertThat(keyA)
                .as("session A's key must be prefixed with its own sessionId")
                .startsWith("guest-tmp/" + a.anonSessionId + "/");
        assertThat(keyB).startsWith("guest-tmp/" + b.anonSessionId + "/");
        // Symmetric exclusion: A's key MUST NOT live under B's prefix and vice versa.
        assertThat(keyA).doesNotContain("guest-tmp/" + b.anonSessionId + "/");
        assertThat(keyB).doesNotContain("guest-tmp/" + a.anonSessionId + "/");
    }

    // ──────────────────────────────────────────────────────────────────────
    // (g) TTL pinned strictly to 300s · both in body AND in URL signature
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void presign_ttl_is_300_seconds_strict() throws Exception {
        MintResult m = mint("fpT04-006");
        HttpResponse<String> resp = presign(m.anonToken, "ttl.jpg", "image/jpeg",
                1024L, "GUEST_CAPTURE");
        assertThat(resp.statusCode()).isEqualTo(200);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("ttl_seconds").asLong()).isEqualTo(300L);
        // The Minio pre-signed URL carries X-Amz-Expires in its query string —
        // that's the actual S3-side expiry, what the body says is only narrative.
        // Pin BOTH so a future bug that desyncs them gets caught.
        String url = body.path("upload_url").asText();
        assertThat(url)
                .as("URL signature must include X-Amz-Expires=300 (matches body ttl)")
                .contains("X-Amz-Expires=300");
    }

    // ──────────────────────────────────────────────────────────────────────
    // (h) Path-traversal filename · ext sanitisation collapses to .bin
    // ──────────────────────────────────────────────────────────────────────
    // Tester REJECT Round 1 fix · 2026-05-18 · earlier draft only verified
    // the .jpg / .png happy paths · didn't pin that "../../etc/passwd" can
    // never produce an objectKey with ".." in it. The sanitiseExt regex
    // [a-z0-9]{1,4} is the load-bearing defence — this case locks it.
    @Test
    void presign_filename_with_path_traversal_sanitized() throws Exception {
        MintResult m = mint("fpT04-007");
        HttpResponse<String> resp = presign(m.anonToken, "../../etc/passwd", "image/jpeg",
                1024L, "GUEST_CAPTURE");
        assertThat(resp.statusCode()).isEqualTo(200);
        JsonNode body = objectMapper.readTree(resp.body());
        String fileKey = body.path("file_key").asText();
        // Object key must contain NO ".." segment AND NO additional "/" beyond
        // the fixed "guest-tmp/{id}/{uuid}.{ext}" shape (exactly 2 forward slashes).
        assertThat(fileKey).doesNotContain("..");
        assertThat(fileKey.chars().filter(c -> c == '/').count())
                .as("Sanitised key must have exactly 2 forward slashes (guest-tmp/{id}/{uuid}.ext)")
                .isEqualTo(2L);
        // The "passwd" suffix-portion (no leading dot) is not a valid ext per the
        // [a-z0-9]{1,4} sanitiser (length 6) — must fall back to "bin".
        assertThat(fileKey)
                .as("Path-traversal filename must collapse to .bin extension")
                .endsWith(".bin");
    }

    // ──────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────

    /** Mint a fresh anon session, returning the token + id. */
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

    /** POST /api/anon/file/presign with X-Anon-Token + typed fields. */
    private HttpResponse<String> presign(
            String anonToken, String filename, String mime, long size, String purpose)
            throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("filename", filename);
        body.put("mime", mime);
        body.put("size", size);
        body.put("purpose", purpose);
        return presignRaw(anonToken, body);
    }

    /** POST /api/anon/file/presign with raw body (allows omitting X-Anon-Token). */
    private HttpResponse<String> presignRaw(String anonToken, Map<String, Object> body)
            throws Exception {
        String json = objectMapper.writeValueAsString(body);
        HttpRequest.Builder b = HttpRequest.newBuilder()
                .uri(URI.create("http://127.0.0.1:" + port + "/api/anon/file/presign"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8))
                .timeout(Duration.ofSeconds(10));
        if (anonToken != null) b.header("X-Anon-Token", anonToken);
        return httpClient.send(b.build(), HttpResponse.BodyHandlers.ofString());
    }

    private record MintResult(String anonToken, long anonSessionId) {}
}
