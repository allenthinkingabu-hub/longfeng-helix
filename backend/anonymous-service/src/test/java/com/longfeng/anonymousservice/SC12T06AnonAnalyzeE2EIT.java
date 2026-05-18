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
import org.junit.jupiter.api.BeforeAll;
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
 * SC-12-T06 · {@code POST /api/anon/analyze-by-url} end-to-end IT — biz §2B.13 F04.
 *
 * <p>Closes the SC-12 backend write loop: T05 has persisted
 * {@code image_tmp_url}, T06 now forwards the captured image (via a MinIO
 * presigned GET URL) to {@code ai-analysis-service:8083 POST
 * /api/ai/analyze-by-url} and advances {@code guest_session.status} from 0
 * CREATED to 1 ANALYZING on a successful 202.
 *
 * <p><b>NO MOCK iron rule (user · 2026-05-18)</b>. This suite forwards to the
 * <b>real</b> {@code ai-analysis-service:8083} sandbox; no WireMock, no
 * MockWebServer, no {@code @MockBean RestTemplate}. The 502 path (case e)
 * lives in {@link SC12T06AnonAnalyzeDownE2EIT} which boots a separate Spring
 * context against an unreachable port (real connection-refused, still no
 * mock layer).
 *
 * <p>Testcases (6 here · 502 path in companion class):
 * <ol>
 *   <li>{@code analyze_with_uploaded_image_returns_202_and_status_advances_with_real_forward}
 *       — happy. Mint → consent → questions (records {@code image_tmp_url})
 *       → real PUT 1KB to MinIO so the presigned GET URL is dereferenceable
 *       by Qianwen → POST analyze → 202 + task_id="anon-{id}" + poll_every=1000
 *       + status="ANALYZING" + DB g.status flipped 0→1 + cross-service
 *       assertion: {@code analysis_task} row exists in the AI service DB with
 *       the same task_id.</li>
 *   <li>{@code analyze_without_image_returns_412_image_not_uploaded} —
 *       skip T05 (no image_tmp_url) → 412 + code=IMAGE_NOT_UPLOADED.</li>
 *   <li>{@code analyze_with_foreign_anonQid_returns_403} — body anonQid
 *       points at session B but X-Anon-Token belongs to session A → 403 +
 *       code=ANON_SESSION_MISMATCH.</li>
 *   <li>{@code analyze_without_x_anon_token_returns_401} — AnonFilter
 *       rejection before controller.</li>
 *   <li>{@code analyze_invalid_subject_returns_400} — @Pattern rejection
 *       on "biology-x".</li>
 *   <li>{@code analyze_after_success_status_remains_one_idempotent_forward}
 *       — exploratory boundary: posting analyze twice for the same session
 *       does not regress status (still 1 ANALYZING). Locks the
 *       re-postability claim documented in the controller javadoc
 *       (X-Idempotency-Key is intentionally NOT required because the
 *       upstream-side {@code task_id} naturally dedupes — verify here.</li>
 * </ol>
 *
 * <p>Probe at @BeforeAll: real HTTP probe of {@code POST :8083/api/ai/analyze-by-url}
 * with an empty body — expect 400. Fail-fast if upstream is not reachable so
 * a missing sandbox surfaces as a single assertion error rather than 6
 * mysterious failures.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SC12T06AnonAnalyzeE2EIT extends IntegrationTestBase {

    /** Dedicated bucket so this IT's PUT bytes don't pollute T04's fixtures. */
    @DynamicPropertySource
    static void minioProps(DynamicPropertyRegistry r) {
        r.add("anon.storage.endpoint", () -> "http://127.0.0.1:9000");
        r.add("anon.storage.access-key", () -> "minioadmin");
        r.add("anon.storage.secret-key", () -> "minioadmin");
        r.add("anon.storage.bucket", () -> "guest-tmp-it");
        r.add("anon.storage.presign-ttl-seconds", () -> "300");
        r.add("anon.storage.max-upload-size", () -> "10485760");
        // ai-analysis-service is the same shared sandbox; default base-url
        // already points at :8083, so no override needed for the happy path.
    }

    @LocalServerPort int port;
    @Autowired DataSource dataSource;
    @Autowired ObjectMapper objectMapper;
    @Autowired @Qualifier("anonMinioClient") MinioClient minio;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    private JdbcTemplate jdbc;

    /**
     * Tester Step 0 · NO MOCK iron rule · real probe of the upstream sandbox.
     * If 8083 is not up the entire suite must fail-fast on the FIRST test so
     * we don't waste time on 5 cascading failures. The probe runs once per
     * JVM (BeforeAll) so it's effectively free.
     */
    @BeforeAll
    static void probeUpstream() throws Exception {
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create("http://127.0.0.1:8083/api/ai/analyze-by-url"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString("{}", StandardCharsets.UTF_8))
                .timeout(Duration.ofSeconds(5))
                .build();
        HttpResponse<String> resp;
        try {
            resp = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(5))
                    .build()
                    .send(req, HttpResponse.BodyHandlers.ofString());
        } catch (Exception e) {
            throw new IllegalStateException(
                    "ai-analysis-service:8083 is not reachable — start the sandbox before running SC-12-T06 ITs. NO MOCK iron rule.",
                    e);
        }
        assertThat(resp.statusCode())
                .as("ai-analysis-service:8083 must be up · empty body must yield 400 (jakarta-validation)")
                .isEqualTo(400);
    }

    @BeforeEach
    void setUp() {
        jdbc = new JdbcTemplate(dataSource);
        // Clean rows from prior runs — only ones this suite owns (device_fp prefix "fpT06-").
        jdbc.update("DELETE FROM guest_session WHERE device_fp LIKE 'fpT06-%'");
        // Also clean upstream analysis_task rows for our task ids so the
        // cross-service assertion in case (a) is deterministic.
        jdbc.update("DELETE FROM analysis_task WHERE task_id LIKE 'anon-%'");
    }

    // ──────────────────────────────────────────────────────────────────────
    // (a) Happy path · 202 + status advances + real forward + cross-service DB
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void analyze_with_uploaded_image_returns_202_and_status_advances_with_real_forward()
            throws Exception {
        MintResult m = mint("fpT06-001");
        // T02 consent
        HttpResponse<String> cResp = patchConsent(m.anonSessionId, m.anonToken, 1);
        assertThat(cResp.statusCode()).as("consent must succeed for fixture").isEqualTo(200);

        // T05 register objectKey · we'll PUT real bytes for this key so the
        // presigned GET URL handed to Qianwen is actually dereferenceable.
        String objectKey = "guest-tmp/" + m.anonSessionId + "/probe-" + m.anonSessionId + ".jpg";
        HttpResponse<String> qResp = postQuestion(m.anonToken, "idem-t06-a",
                Map.of("objectKey", objectKey, "subject", "math"));
        assertThat(qResp.statusCode()).as("T05 questions step must 201").isEqualTo(201);

        // Real PUT 1KB into MinIO so the GET URL is real
        byte[] payload = new byte[1024];
        for (int i = 0; i < payload.length; i++) payload[i] = (byte) (i & 0xff);
        minio.putObject(PutObjectArgs.builder()
                .bucket("guest-tmp-it")
                .object(objectKey)
                .stream(new ByteArrayInputStream(payload), payload.length, -1)
                .contentType("image/jpeg")
                .build());

        // T06 analyze · real HTTP forward to ai-analysis-service:8083
        HttpResponse<String> resp = postAnalyze(m.anonToken,
                Map.of("anonQid", m.anonSessionId, "subject", "math"));
        assertThat(resp.statusCode())
                .as("happy forward must 202 ACCEPTED")
                .isEqualTo(202);

        JsonNode body = objectMapper.readTree(resp.body());
        String taskId = body.path("task_id").asText();
        assertThat(taskId)
                .as("task_id must follow the anon-{id} convention pinned by biz §2B.13 F04")
                .isEqualTo("anon-" + m.anonSessionId);
        assertThat(body.path("poll_every").asInt())
                .as("poll_every must equal the biz §2B.13 F04 prescribed 1s cadence")
                .isEqualTo(1000);
        assertThat(body.path("status").asText())
                .as("initial status must always be ANALYZING")
                .isEqualTo("ANALYZING");

        // DB · status advanced 0 CREATED → 1 ANALYZING (canonical 0→1 transition)
        Map<String, Object> row = jdbc.queryForMap(
                "SELECT status FROM guest_session WHERE id = ?", m.anonSessionId);
        assertThat(((Number) row.get("status")).shortValue())
                .as("guest_session.status must flip 0→1 on a successful forward (biz §4.10 ANALYZING)")
                .isEqualTo((short) 1);

        // Cross-service · upstream ai-analysis-service.analysis_task row exists.
        // We point the JdbcTemplate at the same wrongbook DB (both services
        // share the dev DB · ai-analysis-service writes its analysis_task there).
        Integer rowCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM analysis_task WHERE task_id = ?",
                Integer.class, taskId);
        assertThat(rowCount)
                .as("cross-service DB · analysis_task row with our task_id must exist (proves real forward)")
                .isEqualTo(1);

        // Tester adversarial Round 1 · 2026-05-18: just asserting "a row exists"
        // wasn't tight enough. A future regression where AnonAnalyzeService
        // accidentally drops the subject from the forward body (e.g. typo
        // map.put("subjct", ...)) would still create an analysis_task row
        // (upstream creates the task even when subject is null), and this case
        // would still PASS. Pin the upstream-row subject column too — proves
        // the forwarded body's subject field actually crossed the wire.
        String upstreamSubject = jdbc.queryForObject(
                "SELECT subject FROM analysis_task WHERE task_id = ?",
                String.class, taskId);
        assertThat(upstreamSubject)
                .as("upstream analysis_task.subject must equal the forwarded body's subject — proves the camelCase body actually crossed the wire (NOT a Jackson rename / stub)")
                .isEqualTo("math");
    }

    // ──────────────────────────────────────────────────────────────────────
    // (b) image_tmp_url NULL · skip T05 · 412 IMAGE_NOT_UPLOADED
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void analyze_without_image_returns_412_image_not_uploaded() throws Exception {
        MintResult m = mint("fpT06-002");
        HttpResponse<String> cResp = patchConsent(m.anonSessionId, m.anonToken, 1);
        assertThat(cResp.statusCode()).isEqualTo(200);
        // Intentionally skip T05 questions step · image_tmp_url stays NULL.

        HttpResponse<String> resp = postAnalyze(m.anonToken,
                Map.of("anonQid", m.anonSessionId, "subject", "physics"));
        assertThat(resp.statusCode())
                .as("no image_tmp_url must 412 — FE must run T05 first")
                .isEqualTo(412);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("code").asText()).isEqualTo("IMAGE_NOT_UPLOADED");

        // Negative DB: status must remain 0 · forward never happened.
        Map<String, Object> row = jdbc.queryForMap(
                "SELECT status FROM guest_session WHERE id = ?", m.anonSessionId);
        assertThat(((Number) row.get("status")).shortValue())
                .as("status must remain 0 CREATED when forward not attempted")
                .isEqualTo((short) 0);
    }

    // ──────────────────────────────────────────────────────────────────────
    // (c) Foreign anonQid · cross-tenant defence · 403
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void analyze_with_foreign_anonQid_returns_403() throws Exception {
        MintResult a = mint("fpT06-003-a");
        MintResult b = mint("fpT06-003-b");
        HttpResponse<String> cResp = patchConsent(a.anonSessionId, a.anonToken, 1);
        assertThat(cResp.statusCode()).isEqualTo(200);

        // Use A's token but body claims B's qid → must 403.
        HttpResponse<String> resp = postAnalyze(a.anonToken,
                Map.of("anonQid", b.anonSessionId, "subject", "math"));
        assertThat(resp.statusCode())
                .as("foreign anonQid must 403 — cross-tenant defence")
                .isEqualTo(403);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("code").asText()).isEqualTo("ANON_SESSION_MISMATCH");
    }

    // ──────────────────────────────────────────────────────────────────────
    // (d) Missing X-Anon-Token · AnonFilter rejection · 401
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void analyze_without_x_anon_token_returns_401() throws Exception {
        HttpResponse<String> resp = postAnalyzeRaw(null,
                Map.of("anonQid", 0L, "subject", "math"));
        assertThat(resp.statusCode()).isEqualTo(401);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("code").asText()).isEqualTo("ANON_TOKEN_INVALID");
    }

    // ──────────────────────────────────────────────────────────────────────
    // (e) Invalid subject · @Pattern rejection · 400 VALIDATION_FAILED
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void analyze_invalid_subject_returns_400() throws Exception {
        MintResult m = mint("fpT06-005");
        HttpResponse<String> cResp = patchConsent(m.anonSessionId, m.anonToken, 1);
        assertThat(cResp.statusCode()).isEqualTo(200);

        HttpResponse<String> resp = postAnalyze(m.anonToken,
                Map.of("anonQid", m.anonSessionId, "subject", "biology-x"));
        assertThat(resp.statusCode()).isEqualTo(400);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("code").asText()).isEqualTo("VALIDATION_FAILED");
        assertThat(body.path("message").asText()).contains("subject");
    }

    // ──────────────────────────────────────────────────────────────────────
    // (f) Idempotent re-post · exploratory · status stays at 1 · Tester REJECT Round 1 fix
    // ──────────────────────────────────────────────────────────────────────
    // Controller javadoc claims "X-Idempotency-Key intentionally NOT required;
    // re-posting analyze for the same session is naturally idempotent at the
    // upstream side" — this case is the test the claim is checked against.
    // If a future refactor accidentally repoints the second call's task_id to
    // a different value, the cross-service analysis_task row count would jump
    // 1→2 and silently break T07's polling. Lock the invariant.
    @Test
    void analyze_after_success_status_remains_one_idempotent_forward() throws Exception {
        MintResult m = mint("fpT06-006");
        HttpResponse<String> cResp = patchConsent(m.anonSessionId, m.anonToken, 1);
        assertThat(cResp.statusCode()).isEqualTo(200);

        String objectKey = "guest-tmp/" + m.anonSessionId + "/idem.jpg";
        HttpResponse<String> qResp = postQuestion(m.anonToken, "idem-t06-f",
                Map.of("objectKey", objectKey, "subject", "chemistry"));
        assertThat(qResp.statusCode()).isEqualTo(201);

        // PUT real bytes so the GET URL is dereferenceable.
        byte[] payload = "idempotent".getBytes(StandardCharsets.UTF_8);
        minio.putObject(PutObjectArgs.builder()
                .bucket("guest-tmp-it")
                .object(objectKey)
                .stream(new ByteArrayInputStream(payload), payload.length, -1)
                .contentType("image/jpeg")
                .build());

        // First analyze
        HttpResponse<String> r1 = postAnalyze(m.anonToken,
                Map.of("anonQid", m.anonSessionId, "subject", "chemistry"));
        assertThat(r1.statusCode()).isEqualTo(202);
        String taskId1 = objectMapper.readTree(r1.body()).path("task_id").asText();

        // Second analyze · same session, same subject · must still 202 + same task id
        HttpResponse<String> r2 = postAnalyze(m.anonToken,
                Map.of("anonQid", m.anonSessionId, "subject", "chemistry"));
        assertThat(r2.statusCode())
                .as("re-post must still 202 · no idempotency-key gate, upstream dedupes by task_id")
                .isEqualTo(202);
        String taskId2 = objectMapper.readTree(r2.body()).path("task_id").asText();
        assertThat(taskId2)
                .as("task_id must be deterministic by anonSessionId (anon-{id})")
                .isEqualTo(taskId1);

        // Status still 1 ANALYZING · second forward must not regress state.
        Map<String, Object> row = jdbc.queryForMap(
                "SELECT status FROM guest_session WHERE id = ?", m.anonSessionId);
        assertThat(((Number) row.get("status")).shortValue())
                .as("status must remain 1 ANALYZING after second forward (no regression)")
                .isEqualTo((short) 1);

        // Cross-service upstream row count · still exactly 1 row for this task_id
        // (proves upstream side dedupes; the second forward updates rather than
        // duplicates · this guards T07 polling against ambiguity).
        Integer rowCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM analysis_task WHERE task_id = ?",
                Integer.class, taskId1);
        assertThat(rowCount)
                .as("upstream analysis_task must have exactly 1 row even after re-post")
                .isEqualTo(1);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Helpers
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
        return postAnalyzeRaw(anonToken, body);
    }

    private HttpResponse<String> postAnalyzeRaw(String anonToken, Map<String, Object> body)
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
