package com.longfeng.anonymousservice;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.longfeng.anonymousservice.entity.GuestSession;
import com.longfeng.anonymousservice.repo.GuestSessionRepository;
import com.longfeng.anonymousservice.service.AnonQuotaService;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * SC-12-T07 · {@code GET /api/anon/result/{anonQid}} end-to-end IT — biz §2B.13 F05.
 *
 * <p>Closes the SC-12 backend read loop: T06 fired analyze and advanced
 * {@code guest_session.status} 0→1; this IT verifies that the polling endpoint
 * forwards each tick to {@code ai-analysis-service:8083 GET /api/ai/result/{taskId}}
 * and (a) reports {@code ANALYZING} while inference is in flight, (b) flips the
 * row to status=2 + persists the upstream JSON when upstream returns
 * {@code DONE}, and (c) flips to status=3 on {@code FAILED}.
 *
 * <p><b>NO MOCK iron rule (user · 2026-05-18 · same as T06)</b>. This suite
 * forwards to the <b>real</b> {@code ai-analysis-service:8083} sandbox; no
 * WireMock, no MockWebServer, no {@code @MockBean RestTemplate}. The 502 path
 * lives in {@link SC12T07AnonResultDownE2EIT} which boots a separate context
 * against an unreachable port (real connection-refused, still no mock layer).
 *
 * <p>Testcase inventory (7 here · 502 path in companion class):
 * <ol>
 *   <li>{@code result_when_session_not_exists_returns_404} — mint, SQL-delete
 *       the row, GET → 404 ANON_SESSION_NOT_FOUND.</li>
 *   <li>{@code result_without_x_anon_token_returns_401} — filter rejection.</li>
 *   <li>{@code result_with_foreign_anonQid_returns_403} — token A but path
 *       claims session B.id → 403 ANON_SESSION_MISMATCH.</li>
 *   <li>{@code result_when_upstream_task_not_found_returns_404} — mint without
 *       analyze; upstream has no row → 404 UPSTREAM_TASK_NOT_FOUND.</li>
 *   <li>{@code result_after_analyze_returns_analyzing_or_terminal} — mint +
 *       consent + questions + analyze, then poll immediately; upstream is
 *       still racing so {@code ANALYZING} is the common case, {@code READY}
 *       / {@code FAILED} accepted if Qianwen happens to finish first.</li>
 *   <li>{@code result_end_to_end_polls_until_terminal} — full chain + Awaitility
 *       60 s loop until the status leaves {@code ANALYZING}. On {@code READY}
 *       this asserts {@code guest_session.status=2} + {@code analysis_result_json}
 *       NON-null (proves the T07 JSONB fix). On {@code FAILED} asserts
 *       {@code status=3}. Either terminal counts as PASS — Qianwen is real and
 *       can fail too.</li>
 *   <li>{@code jsonb_write_via_repository_succeeds_after_fix} — direct
 *       {@code repo.save(g)} with {@code analysisResultJson="{\"foo\":\"bar\"}"};
 *       {@code repo.findById} returns the same string. Closes T01's punted
 *       {@code insertable=false} workaround.</li>
 * </ol>
 *
 * <p>Probe at @BeforeAll: real HTTP probe of {@code GET :8083/api/ai/result/<sentinel>}
 * with an unknown task id — must return 200 + body
 * {@code {"status":"NOT_FOUND"}}. Fail-fast if the upstream is not reachable so
 * a missing sandbox surfaces as one error rather than 7 cascading failures.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SC12T07AnonResultE2EIT extends IntegrationTestBase {

    /**
     * Dedicated bucket / shared with T06; the GET-side IT only reads, but we
     * still PUT bytes for the end-to-end case so the Qianwen upstream can fetch.
     */
    @DynamicPropertySource
    static void minioProps(DynamicPropertyRegistry r) {
        r.add("anon.storage.endpoint", () -> "http://127.0.0.1:9000");
        r.add("anon.storage.access-key", () -> "minioadmin");
        r.add("anon.storage.secret-key", () -> "minioadmin");
        r.add("anon.storage.bucket", () -> "guest-tmp-it");
        r.add("anon.storage.presign-ttl-seconds", () -> "300");
        r.add("anon.storage.max-upload-size", () -> "10485760");
        // ai-analysis-service default → :8083, no override for the happy path.
    }

    @LocalServerPort int port;
    @Autowired DataSource dataSource;
    @Autowired ObjectMapper objectMapper;
    @Autowired @Qualifier("anonMinioClient") MinioClient minio;
    @Autowired GuestSessionRepository sessionRepo;
    // SC-12-T09 (2026-05-18) added Redis quota keys; scrub between runs so
    // repeated executions don't trip the 1/device cap.
    @Autowired StringRedisTemplate redis;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    private JdbcTemplate jdbc;

    /**
     * NO MOCK iron rule · real probe. If 8083 is not up the whole suite
     * must fail-fast on the first test rather than burn 7 cascading errors.
     */
    @BeforeAll
    static void probeUpstream() throws Exception {
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create("http://127.0.0.1:8083/api/ai/result/sentinel-not-exists-task-id"))
                .timeout(Duration.ofSeconds(5))
                .GET()
                .build();
        HttpResponse<String> resp;
        try {
            resp = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(5))
                    .build()
                    .send(req, HttpResponse.BodyHandlers.ofString());
        } catch (Exception e) {
            throw new IllegalStateException(
                    "ai-analysis-service:8083 must be up · start the sandbox before running SC-12-T07 ITs · NO MOCK iron rule",
                    e);
        }
        assertThat(resp.statusCode())
                .as("upstream probe must 200 even for unknown task id")
                .isEqualTo(200);
        assertThat(resp.body())
                .as("upstream protocol contract · unknown task id → status:NOT_FOUND")
                .contains("\"status\":\"NOT_FOUND\"");
    }

    @BeforeEach
    void setUp() {
        jdbc = new JdbcTemplate(dataSource);
        // Clean rows this suite owns (device_fp prefix "fpT07-") so concurrent
        // attempts do not leak state across runs.
        jdbc.update("DELETE FROM guest_session WHERE device_fp LIKE 'fpT07-%'");
        // Also clean upstream analysis_task rows for our task ids so the
        // race-window assertions (case 4) are deterministic.
        jdbc.update("DELETE FROM analysis_task WHERE task_id LIKE 'anon-%'");
        // T09 · scrub quota keys this suite seeds (fpT07-* device + 127.0.0.1 IP).
        LocalDate today = LocalDate.now(AnonQuotaService.TZ);
        Set<String> deviceKeys = redis.keys(
                AnonQuotaService.KEY_DEVICE_PREFIX + "fpT07-*:" + today);
        if (deviceKeys != null && !deviceKeys.isEmpty()) {
            redis.delete(deviceKeys);
        }
        redis.delete(AnonQuotaService.KEY_IP_PREFIX
                + AnonQuotaService.hashIp("127.0.0.1") + ":" + today);
    }

    // ──────────────────────────────────────────────────────────────────────
    // (1) Session row gone · SQL delete · 404 ANON_SESSION_NOT_FOUND
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void result_when_session_not_exists_returns_404() throws Exception {
        MintResult m = mint("fpT07-001");
        // Delete the row directly · simulates expires_at sweep
        jdbc.update("DELETE FROM guest_session WHERE id = ?", m.anonSessionId);

        HttpResponse<String> resp = getResult(m.anonToken, m.anonSessionId);
        assertThat(resp.statusCode())
                .as("missing row must 404 ANON_SESSION_NOT_FOUND")
                .isEqualTo(404);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("code").asText()).isEqualTo("ANON_SESSION_NOT_FOUND");
    }

    // ──────────────────────────────────────────────────────────────────────
    // (2) Missing X-Anon-Token · AnonFilter rejection · 401
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void result_without_x_anon_token_returns_401() throws Exception {
        HttpResponse<String> resp = getResultRaw(null, 1L);
        assertThat(resp.statusCode()).isEqualTo(401);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("code").asText()).isEqualTo("ANON_TOKEN_INVALID");
    }

    // ──────────────────────────────────────────────────────────────────────
    // (3) Foreign anonQid · cross-tenant defence · 403
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void result_with_foreign_anonQid_returns_403() throws Exception {
        MintResult a = mint("fpT07-003-a");
        MintResult b = mint("fpT07-003-b");

        // Use A's token but path claims B's id → must 403.
        HttpResponse<String> resp = getResult(a.anonToken, b.anonSessionId);
        assertThat(resp.statusCode())
                .as("foreign anonQid must 403 — cross-tenant defence")
                .isEqualTo(403);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("code").asText()).isEqualTo("ANON_SESSION_MISMATCH");
    }

    // ──────────────────────────────────────────────────────────────────────
    // (4) Upstream NOT_FOUND · session exists but T06 was never called · 404
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void result_when_upstream_task_not_found_returns_404() throws Exception {
        MintResult m = mint("fpT07-004");
        // Intentionally skip consent + questions + analyze. The local session
        // row exists but the upstream `analysis_task` row never got created,
        // so {@code GET :8083/api/ai/result/anon-<id>} returns status=NOT_FOUND.

        HttpResponse<String> resp = getResult(m.anonToken, m.anonSessionId);
        assertThat(resp.statusCode())
                .as("upstream NOT_FOUND must 404 UPSTREAM_TASK_NOT_FOUND")
                .isEqualTo(404);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("code").asText()).isEqualTo("UPSTREAM_TASK_NOT_FOUND");

        // DB · local status stays 0 CREATED (no state machine change on NOT_FOUND)
        Map<String, Object> row = jdbc.queryForMap(
                "SELECT status FROM guest_session WHERE id = ?", m.anonSessionId);
        assertThat(((Number) row.get("status")).shortValue())
                .as("status must NOT advance on upstream NOT_FOUND (no spurious 0→2/3 transition)")
                .isEqualTo((short) 0);
    }

    // ──────────────────────────────────────────────────────────────────────
    // (5) Immediate post-analyze poll · ANALYZING common · terminal accepted
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void result_after_analyze_returns_analyzing_or_terminal() throws Exception {
        MintResult m = mint("fpT07-005");
        runFullPipeline(m, "math", "imm.jpg");

        HttpResponse<String> resp = getResult(m.anonToken, m.anonSessionId);
        assertThat(resp.statusCode()).as("happy poll must 200").isEqualTo(200);
        JsonNode body = objectMapper.readTree(resp.body());
        String status = body.path("status").asText();
        // ANALYZING expected · READY/FAILED accepted if Qianwen happens to be
        // fast or fails immediately. Both are legitimate end-to-end outputs;
        // case 6 is the one that explicitly waits for terminal.
        assertThat(status)
                .as("immediate poll must be one of ANALYZING/READY/FAILED")
                .isIn("ANALYZING", "READY", "FAILED");
    }

    // ──────────────────────────────────────────────────────────────────────
    // (6) End-to-end · poll until terminal · verify JSONB fix on READY
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void result_end_to_end_polls_until_terminal() throws Exception {
        MintResult m = mint("fpT07-006");
        runFullPipeline(m, "chemistry", "e2e.jpg");

        // Awaitility · upstream Qianwen real-time inference is 5-45s. 60s
        // gives a comfortable buffer; the polling cadence (2s) mirrors what
        // the FE will do at 1Hz (we run slower here to avoid wasted RPC).
        String[] terminalStatus = new String[1];
        await().atMost(Duration.ofSeconds(60))
                .pollDelay(Duration.ofSeconds(2))
                .pollInterval(Duration.ofSeconds(2))
                .until(() -> {
                    HttpResponse<String> r = getResult(m.anonToken, m.anonSessionId);
                    if (r.statusCode() != 200) return false;
                    String s = objectMapper.readTree(r.body()).path("status").asText();
                    if ("READY".equals(s) || "FAILED".equals(s)) {
                        terminalStatus[0] = s;
                        return true;
                    }
                    return false;
                });

        assertThat(terminalStatus[0])
                .as("upstream must reach a terminal state inside the SLA window")
                .isIn("READY", "FAILED");

        // DB · status flipped to 2 (READY) or 3 (FAILED) · JSONB column written on READY
        Map<String, Object> row = jdbc.queryForMap(
                "SELECT status, analysis_result_json FROM guest_session WHERE id = ?",
                m.anonSessionId);
        short status = ((Number) row.get("status")).shortValue();

        if ("READY".equals(terminalStatus[0])) {
            assertThat(status)
                    .as("READY must flip guest_session.status 1→2 (RESULT_READY · biz §4.10)")
                    .isEqualTo((short) 2);
            // T01 JSONB-fix verification · the column must contain the
            // serialised upstream body. If T07 forgot to apply
            // @JdbcTypeCode(SqlTypes.JSON) the SQL bind would 500 with
            // SQLState 42804, which would have surfaced as RestClientException
            // → AI_SERVICE_FAILURE → 502 instead of READY · so reaching this
            // branch already proves the fix works at the write layer. The
            // assertion below additionally checks the read side.
            Object jsonCol = row.get("analysis_result_json");
            assertThat(jsonCol)
                    .as("analysis_result_json must be populated on READY · T07 JSONB fix")
                    .isNotNull();
            // PG canonicalises JSONB whitespace · parse the column and assert
            // structural equality on keys, not byte-for-byte equality.
            JsonNode persisted = objectMapper.readTree(jsonCol.toString());
            assertThat(persisted.path("status").asText())
                    .as("persisted JSONB · upstream status must be DONE")
                    .isEqualTo("DONE");
            assertThat(persisted.has("subject"))
                    .as("persisted JSONB · subject key must be present").isTrue();
            assertThat(persisted.has("chat_model"))
                    .as("persisted JSONB · chat_model key must be present").isTrue();

            // Re-fetch via JPA to round-trip the @JdbcTypeCode mapping (a Jackson
            // serialisation issue on the read side would show here, not in raw SQL).
            GuestSession refetched = sessionRepo.findById(m.anonSessionId).orElseThrow();
            assertThat(refetched.getAnalysisResultJson())
                    .as("JPA round-trip · @JdbcTypeCode(SqlTypes.JSON) must read back populated string")
                    .isNotNull();
            JsonNode roundTripped = objectMapper.readTree(refetched.getAnalysisResultJson());
            assertThat(roundTripped.path("status").asText())
                    .as("JPA round-trip · semantic equality must hold")
                    .isEqualTo("DONE");
            assertThat(refetched.getStatus())
                    .as("JPA round-trip · status must be 2 RESULT_READY")
                    .isEqualTo((short) 2);
        } else {
            assertThat(status)
                    .as("FAILED must flip guest_session.status 1→3 (biz §4.10)")
                    .isEqualTo((short) 3);
            JsonNode body = objectMapper.readTree(getResult(m.anonToken, m.anonSessionId).body());
            assertThat(body.path("error_code").asText())
                    .as("FAILED response must carry an error_code")
                    .isEqualTo("AI_INFERENCE_FAILED");
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    // (7) JSONB write via JPA · T01 punt closure
    // ──────────────────────────────────────────────────────────────────────
    // Direct repo.save bypasses the HTTP forward · exercises only the
    // @JdbcTypeCode(SqlTypes.JSON) write/read path. Was the T01 bug: any
    // attempt to assign analysisResultJson before T07's fix raised SQLState
    // 42804 (jsonb expected, character varying given).
    @Test
    void jsonb_write_via_repository_succeeds_after_fix() throws Exception {
        GuestSession g = new GuestSession();
        // PK is client-assigned in this entity · pick a value low enough to
        // avoid the snowflake range used elsewhere (anon mint emits values in
        // the 6e9-7e9 range, see AnonSessionService).
        long pk = 770_000_001L + System.currentTimeMillis() % 1000;
        g.setId(pk);
        g.setDeviceFp("fpT07-007-direct");
        g.setStatus((short) 2);
        g.setCreatedAt(OffsetDateTime.now());
        g.setExpiresAt(OffsetDateTime.now().plusHours(1));
        String originalJson = "{\"foo\":\"bar\",\"steps\":[1,2,3]}";
        g.setAnalysisResultJson(originalJson);

        sessionRepo.save(g);
        GuestSession refetched = sessionRepo.findById(pk).orElseThrow();
        String persisted = refetched.getAnalysisResultJson();
        // PG normalises JSONB on storage (adds whitespace around : and ,) so a
        // byte-for-byte equality check would be wrong — semantic equality is
        // what the contract guarantees. Compare via Jackson tree to assert the
        // JSON structure round-trips, not the exact bytes.
        assertThat(persisted)
                .as("JSONB column must round-trip · T01 punt closed by T07")
                .isNotNull();
        assertThat(objectMapper.readTree(persisted))
                .as("JSONB column must semantically equal the original payload (PG canonicalises whitespace)")
                .isEqualTo(objectMapper.readTree(originalJson));

        // Clean up since this row is outside the fpT07-% delete sweep
        jdbc.update("DELETE FROM guest_session WHERE id = ?", pk);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Helpers · adapted from SC12T06AnonAnalyzeE2EIT
    // ──────────────────────────────────────────────────────────────────────

    /**
     * Mint + consent + register objectKey + PUT real bytes + POST analyze ·
     * the full T01..T06 pipeline so a result poll exercises the real upstream.
     */
    private void runFullPipeline(MintResult m, String subject, String objectName) throws Exception {
        HttpResponse<String> cResp = patchConsent(m.anonSessionId, m.anonToken, 1);
        assertThat(cResp.statusCode()).as("consent must succeed for fixture").isEqualTo(200);

        String objectKey = "guest-tmp/" + m.anonSessionId + "/" + objectName;
        HttpResponse<String> qResp = postQuestion(m.anonToken, "idem-t07-" + m.anonSessionId,
                Map.of("objectKey", objectKey, "subject", subject));
        assertThat(qResp.statusCode()).as("T05 questions step must 201").isEqualTo(201);

        // Real PUT bytes so the Qianwen GET URL is dereferenceable
        byte[] payload = new byte[1024];
        for (int i = 0; i < payload.length; i++) payload[i] = (byte) (i & 0xff);
        minio.putObject(PutObjectArgs.builder()
                .bucket("guest-tmp-it")
                .object(objectKey)
                .stream(new ByteArrayInputStream(payload), payload.length, -1)
                .contentType("image/jpeg")
                .build());

        HttpResponse<String> aResp = postAnalyze(m.anonToken,
                Map.of("anonQid", m.anonSessionId, "subject", subject));
        assertThat(aResp.statusCode()).as("T06 analyze must 202").isEqualTo(202);
    }

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
        String json = objectMapper.writeValueAsString(body);
        HttpRequest.Builder b = HttpRequest.newBuilder()
                .uri(URI.create("http://127.0.0.1:" + port + "/api/anon/analyze-by-url"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8))
                .timeout(Duration.ofSeconds(15));
        if (anonToken != null) b.header("X-Anon-Token", anonToken);
        return httpClient.send(b.build(), HttpResponse.BodyHandlers.ofString());
    }

    private HttpResponse<String> getResult(String anonToken, long anonQid) throws Exception {
        return getResultRaw(anonToken, anonQid);
    }

    private HttpResponse<String> getResultRaw(String anonToken, long anonQid) throws Exception {
        HttpRequest.Builder b = HttpRequest.newBuilder()
                .uri(URI.create("http://127.0.0.1:" + port + "/api/anon/result/" + anonQid))
                .timeout(Duration.ofSeconds(10))
                .GET();
        if (anonToken != null) b.header("X-Anon-Token", anonToken);
        return httpClient.send(b.build(), HttpResponse.BodyHandlers.ofString());
    }

    private record MintResult(String anonToken, long anonSessionId) {}
}
