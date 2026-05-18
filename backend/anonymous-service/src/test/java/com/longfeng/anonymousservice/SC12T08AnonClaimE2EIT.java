package com.longfeng.anonymousservice;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import javax.crypto.SecretKey;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * SC-12-T08 · {@code POST /api/anon/claim} end-to-end IT — biz §2B.13 F08.
 *
 * <p>Closes the Try-Before-Signup conversion funnel: after T07's polling sees
 * DONE, the guest registers (auth-service mints a student JWT). The FE then
 * calls {@code POST /api/anon/claim} with both:
 * <ul>
 *   <li>{@code X-Anon-Token} — the original anon session token; AnonFilter
 *       writes {@code anonGuestSessionId} attribute</li>
 *   <li>{@code Authorization: Bearer <studentJwt>} — JwtVerifier extracts
 *       {@code sub} as the student id</li>
 * </ul>
 * The service forwards to <b>real</b> {@code wrongbook-service:8082
 * POST /api/wb/questions} (NO MOCK · user iron rule 2026-05-18) to create the
 * persistent {@code wb_question} row, then writes back guest_session:
 * {@code claimed_by_student_id / claimed_at / claimed_question_id / status=4
 * CLAIMED}.
 *
 * <p>Testcases (7 here · happy/idempotent/conflict/auth/validation/down):
 * <ol>
 *   <li>{@code claim_after_ready_returns_200_and_writes_wb_question_row} —
 *       happy. mint → consent → status=2 RESULT_READY (forced via JDBC
 *       UPDATE — NOT a mock, simply manual data prep mirroring what
 *       T06+Qianwen would persist in the real flow; the IT still calls the
 *       <b>real</b> wrongbook-service:8082) → POST claim with both JWTs →
 *       200 + qid non-blank · DB g.status=4 · g.claimedByStudentId=studentId
 *       · cross-service: wb_question row exists at PK=qid in wrongbook DB.</li>
 *   <li>{@code claim_when_status_not_ready_returns_412} — mint + consent
 *       (skip status flip) → 412 + NOT_READY_TO_CLAIM.</li>
 *   <li>{@code claim_idempotent_returns_same_qid} — happy then re-post same
 *       anon+student JWT → 200 + same qid + DB wb_question row count for
 *       that idempotency-key stays exactly 1 (proves upstream natural
 *       dedup).</li>
 *   <li>{@code claim_by_different_student_returns_409_already_claimed_by_other}
 *       — happy then re-post with student B JWT → 409 +
 *       ALREADY_CLAIMED_BY_OTHER · DB owner stays student A.</li>
 *   <li>{@code claim_without_x_anon_token_returns_401} — AnonFilter
 *       rejection before controller.</li>
 *   <li>{@code claim_without_bearer_jwt_returns_401_student_auth_required} —
 *       JwtVerifier rejection in controller.</li>
 *   <li>{@code claim_when_wrongbook_down_returns_502} — companion class
 *       {@link SC12T08AnonClaimDownE2EIT} overrides
 *       {@code anon.wrongbook.base-url} → {@code http://localhost:65535} for
 *       a real ECONNREFUSED. See that file.</li>
 * </ol>
 *
 * <p>BeforeAll probe of {@code POST :8082/api/wb/questions} with empty body
 * yields 400 — fail-fast if the sandbox isn't reachable so a missing
 * wrongbook-service surfaces as a single error instead of 6 cascading
 * failures.
 *
 * <p>Why we force status=2 via JDBC instead of running the real analyze flow:
 * T06's real Qianwen forward is non-deterministic (~30% transient FAILED
 * rate); spinning the IT around that probability would convert this task into
 * a flaky-test smoke. We still respect NO MOCK — there is zero RestTemplate /
 * WireMock / MockWebServer in this suite, and the wrongbook-service call is
 * 100% real. Manual JDBC fixture prep is the same pattern T05/T07 already use
 * to seed pre-conditions.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SC12T08AnonClaimE2EIT extends IntegrationTestBase {

    @LocalServerPort int port;
    @Autowired DataSource dataSource;
    @Autowired ObjectMapper objectMapper;

    @Value("${anon.jwt.secret}") String jwtSecret;
    @Value("${anon.jwt.issuer}") String jwtIssuer;
    @Value("${anon.jwt.audience}") String jwtAudience;

    /** Two distinct student ids · suite owns these so a wb_question owner_id IN (A,B) cleanup is safe. */
    private static final long STUDENT_A = 8801L;
    private static final long STUDENT_B = 8802L;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    private JdbcTemplate jdbc;

    /**
     * Tester Step 0 · NO MOCK iron rule · real probe of upstream wrongbook.
     * Empty body must yield 400 (jakarta-validation on missing idempotency_key)
     * which is a clear "the service is alive and rejecting bad input" signal.
     */
    @BeforeAll
    static void probeWrongbook() throws Exception {
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create("http://127.0.0.1:8082/api/wb/questions"))
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
                    "wrongbook-service:8082 is not reachable — start the sandbox before running SC-12-T08 ITs. NO MOCK iron rule.",
                    e);
        }
        assertThat(resp.statusCode())
                .as("wrongbook-service:8082 must be up · empty body must yield 400")
                .isEqualTo(400);
    }

    @BeforeEach
    void setUp() {
        jdbc = new JdbcTemplate(dataSource);
        // Suite-owned cleanup · device_fp prefix uniqueness keeps us from
        // wiping other ITs' guest_session rows.
        jdbc.update("DELETE FROM guest_session WHERE device_fp LIKE 'fpT08-%'");
        // Cross-service · drop wrong_item rows owned by our two students so
        // the cross-service assertions in cases (a) and (c) start clean.
        // (wrongbook-service persists as `wrong_item` even though the public
        // API wire name is wb_question/qid — verified during T08 against
        // wrongbook's WrongItem entity + WrongItemService.createPending.)
        // Also drop the idempotency rows so re-runs against the same anon
        // session id don't return a cached qid from a previous run.
        jdbc.update("DELETE FROM wrong_item WHERE student_id IN (?, ?)", STUDENT_A, STUDENT_B);
        jdbc.update("DELETE FROM idem_key WHERE scope = 'wb:create' AND idem_key LIKE 'anon-claim-%'");
    }

    // ──────────────────────────────────────────────────────────────────────
    // (a) Happy path · 200 + DB writes + cross-service wb_question row
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void claim_after_ready_returns_200_and_writes_wb_question_row() throws Exception {
        MintResult m = mint("fpT08-001");
        assertThat(patchConsent(m.anonSessionId, m.anonToken, 1).statusCode())
                .as("consent must succeed for fixture").isEqualTo(200);

        // Force RESULT_READY: status=2, populate image_tmp_url + analysis_result_json
        // so the service's pre-condition gate (status==2 && image_tmp_url non-null)
        // is satisfied. Mirrors what T06+T07 would persist on a happy Qianwen run;
        // NOT a mock — the IT still talks to real wrongbook-service.
        forceResultReady(m.anonSessionId,
                "guest-tmp/" + m.anonSessionId + "/probe.jpg");

        String studentJwt = signStudentJwt(STUDENT_A, 3600);
        HttpResponse<String> resp = postClaim(m.anonToken, studentJwt,
                Map.of("subject", "math"));
        assertThat(resp.statusCode())
                .as("happy claim must 200")
                .isEqualTo(200);

        JsonNode body = objectMapper.readTree(resp.body());
        String qid = body.path("claimed_question_id").asText();
        assertThat(qid)
                .as("claimed_question_id must be a non-blank numeric string from wrongbook upstream")
                .isNotBlank()
                .matches("\\d+");
        assertThat(body.path("anon_session_id").asLong()).isEqualTo(m.anonSessionId);
        assertThat(body.path("student_id").asLong()).isEqualTo(STUDENT_A);
        assertThat(body.path("claimed_at").asText()).isNotBlank();

        // DB write-back · status flipped 2 → 4 · claimed_by_student_id pinned
        Map<String, Object> row = jdbc.queryForMap(
                "SELECT status, claimed_by_student_id, claimed_question_id "
                        + "FROM guest_session WHERE id = ?", m.anonSessionId);
        assertThat(((Number) row.get("status")).shortValue())
                .as("guest_session.status must flip 2 RESULT_READY → 4 CLAIMED")
                .isEqualTo((short) 4);
        assertThat(((Number) row.get("claimed_by_student_id")).longValue())
                .as("guest_session.claimed_by_student_id must equal the verified student sub")
                .isEqualTo(STUDENT_A);
        assertThat(((Number) row.get("claimed_question_id")).longValue())
                .as("guest_session.claimed_question_id must equal the wrongbook-issued qid")
                .isEqualTo(Long.parseLong(qid));

        // Cross-service · wrong_item row exists at PK=qid with student=STUDENT_A.
        // This is the real proof of NO MOCK — a row was created by a real
        // wrongbook-service:8082 POST and is queryable from the same PG cluster.
        // (wrongbook persists as `wrong_item`; `wb_question` is a sibling table
        // we don't write to. Schema mismatch between the API-level "wb_question/qid"
        // nomenclature and the on-disk wrong_item table is wrongbook-side history
        // we just have to mirror here — verified against WrongItem entity.)
        Map<String, Object> wbRow = jdbc.queryForMap(
                "SELECT student_id, subject, source_type, origin_image_key "
                        + "FROM wrong_item WHERE id = ?",
                Long.parseLong(qid));
        assertThat(((Number) wbRow.get("student_id")).longValue())
                .as("wrong_item.student_id must equal the claiming student id (cross-service write proof)")
                .isEqualTo(STUDENT_A);
        assertThat(wbRow.get("subject"))
                .as("wrong_item.subject must equal the forwarded subject (proves body crossed the wire)")
                .isEqualTo("math");
        assertThat(((Number) wbRow.get("source_type")).shortValue())
                .as("wrong_item.source_type must equal 0 USER_UPLOAD (proves source_type crossed the wire)")
                .isEqualTo((short) 0);
        assertThat(wbRow.get("origin_image_key"))
                .as("wrong_item.origin_image_key must equal guest_session.image_tmp_url (proves origin_image_key crossed the wire)")
                .isEqualTo("guest-tmp/" + m.anonSessionId + "/probe.jpg");
    }

    // ──────────────────────────────────────────────────────────────────────
    // (b) NOT_READY_TO_CLAIM · status != 2 · 412
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void claim_when_status_not_ready_returns_412() throws Exception {
        MintResult m = mint("fpT08-002");
        assertThat(patchConsent(m.anonSessionId, m.anonToken, 1).statusCode()).isEqualTo(200);
        // Intentionally skip forceResultReady · status stays at 0 CREATED.

        String studentJwt = signStudentJwt(STUDENT_A, 3600);
        HttpResponse<String> resp = postClaim(m.anonToken, studentJwt,
                Map.of("subject", "math"));
        assertThat(resp.statusCode())
                .as("status != 2 must 412 — analyze must complete first")
                .isEqualTo(412);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("code").asText()).isEqualTo("NOT_READY_TO_CLAIM");

        // Negative · session row must remain unclaimed (defensive).
        Map<String, Object> row = jdbc.queryForMap(
                "SELECT status, claimed_by_student_id FROM guest_session WHERE id = ?",
                m.anonSessionId);
        assertThat(((Number) row.get("status")).shortValue())
                .as("status must remain 0 CREATED · no premature flip on 412")
                .isEqualTo((short) 0);
        assertThat(row.get("claimed_by_student_id"))
                .as("claimed_by_student_id must remain null on 412")
                .isNull();
    }

    // ──────────────────────────────────────────────────────────────────────
    // (c) Idempotent · same student re-claims · 200 + same qid · upstream not re-created
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void claim_idempotent_returns_same_qid() throws Exception {
        MintResult m = mint("fpT08-003");
        assertThat(patchConsent(m.anonSessionId, m.anonToken, 1).statusCode()).isEqualTo(200);
        forceResultReady(m.anonSessionId,
                "guest-tmp/" + m.anonSessionId + "/idem.jpg");
        String studentJwt = signStudentJwt(STUDENT_A, 3600);

        // First claim · happy 200
        HttpResponse<String> r1 = postClaim(m.anonToken, studentJwt,
                Map.of("subject", "chemistry"));
        assertThat(r1.statusCode()).isEqualTo(200);
        String qid1 = objectMapper.readTree(r1.body()).path("claimed_question_id").asText();

        // Capture pre-second wrong_item row count for this student to prove
        // upstream natural dedup on idempotency_key='anon-claim-{id}'.
        Integer beforeSecond = jdbc.queryForObject(
                "SELECT COUNT(*) FROM wrong_item WHERE student_id = ?",
                Integer.class, STUDENT_A);
        assertThat(beforeSecond)
                .as("baseline: exactly 1 wrong_item row after first claim")
                .isEqualTo(1);

        // Second claim · same anon + same student · must still 200 + same qid
        HttpResponse<String> r2 = postClaim(m.anonToken, studentJwt,
                Map.of("subject", "chemistry"));
        assertThat(r2.statusCode())
                .as("idempotent re-claim must still 200 (IDEMPOTENT outcome)")
                .isEqualTo(200);
        String qid2 = objectMapper.readTree(r2.body()).path("claimed_question_id").asText();
        assertThat(qid2)
                .as("idempotent re-claim must return the same qid (no upstream re-create)")
                .isEqualTo(qid1);

        // Upstream natural dedup proof · wrong_item count for this student stays at 1
        Integer afterSecond = jdbc.queryForObject(
                "SELECT COUNT(*) FROM wrong_item WHERE student_id = ?",
                Integer.class, STUDENT_A);
        assertThat(afterSecond)
                .as("wrongbook idempotency_key='anon-claim-{id}' must dedupe · count must stay at 1")
                .isEqualTo(1);

        // Session status must remain at 4 CLAIMED · second claim doesn't re-mutate
        Short status = jdbc.queryForObject(
                "SELECT status FROM guest_session WHERE id = ?",
                Short.class, m.anonSessionId);
        assertThat(status)
                .as("status must remain 4 CLAIMED across re-claim · no regression")
                .isEqualTo((short) 4);
    }

    // ──────────────────────────────────────────────────────────────────────
    // (d) Conflict · different student claims claimed session · 409
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void claim_by_different_student_returns_409_already_claimed_by_other() throws Exception {
        MintResult m = mint("fpT08-004");
        assertThat(patchConsent(m.anonSessionId, m.anonToken, 1).statusCode()).isEqualTo(200);
        forceResultReady(m.anonSessionId,
                "guest-tmp/" + m.anonSessionId + "/conflict.jpg");

        // Student A claims first
        String jwtA = signStudentJwt(STUDENT_A, 3600);
        HttpResponse<String> r1 = postClaim(m.anonToken, jwtA,
                Map.of("subject", "physics"));
        assertThat(r1.statusCode()).isEqualTo(200);
        String qid1 = objectMapper.readTree(r1.body()).path("claimed_question_id").asText();

        // Student B tries to claim same session · must 409
        String jwtB = signStudentJwt(STUDENT_B, 3600);
        HttpResponse<String> r2 = postClaim(m.anonToken, jwtB,
                Map.of("subject", "physics"));
        assertThat(r2.statusCode())
                .as("foreign student must 409 — TC-12.04 cross-tenant defence")
                .isEqualTo(409);
        JsonNode body = objectMapper.readTree(r2.body());
        assertThat(body.path("code").asText()).isEqualTo("ALREADY_CLAIMED_BY_OTHER");

        // DB · owner remains STUDENT_A · qid unchanged
        Map<String, Object> row = jdbc.queryForMap(
                "SELECT claimed_by_student_id, claimed_question_id FROM guest_session WHERE id = ?",
                m.anonSessionId);
        assertThat(((Number) row.get("claimed_by_student_id")).longValue())
                .as("claimed_by_student_id must remain STUDENT_A · 409 must not overwrite")
                .isEqualTo(STUDENT_A);
        assertThat(((Number) row.get("claimed_question_id")).longValue())
                .as("claimed_question_id must remain the first claim's qid · 409 must not overwrite")
                .isEqualTo(Long.parseLong(qid1));

        // Cross-service · no second wrong_item row for STUDENT_B (defensive
        // proof that the upstream RPC was short-circuited before reaching
        // wrongbook).
        Integer studentBCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM wrong_item WHERE student_id = ?",
                Integer.class, STUDENT_B);
        assertThat(studentBCount)
                .as("STUDENT_B must own zero wrong_item rows · 409 short-circuits before upstream RPC")
                .isEqualTo(0);
    }

    // ──────────────────────────────────────────────────────────────────────
    // (e) Missing X-Anon-Token · AnonFilter rejection · 401
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void claim_without_x_anon_token_returns_401() throws Exception {
        String studentJwt = signStudentJwt(STUDENT_A, 3600);
        HttpResponse<String> resp = postClaim(null, studentJwt,
                Map.of("subject", "math"));
        assertThat(resp.statusCode()).isEqualTo(401);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("code").asText()).isEqualTo("ANON_TOKEN_INVALID");
    }

    // ──────────────────────────────────────────────────────────────────────
    // (f) Missing Bearer JWT · JwtVerifier rejection · 401 STUDENT_AUTH_REQUIRED
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void claim_without_bearer_jwt_returns_401_student_auth_required() throws Exception {
        MintResult m = mint("fpT08-006");
        assertThat(patchConsent(m.anonSessionId, m.anonToken, 1).statusCode()).isEqualTo(200);
        // No need to force ready · 401 short-circuits before status check.

        HttpResponse<String> resp = postClaim(m.anonToken, null,
                Map.of("subject", "math"));
        assertThat(resp.statusCode())
                .as("missing Authorization header must 401 STUDENT_AUTH_REQUIRED")
                .isEqualTo(401);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("code").asText()).isEqualTo("STUDENT_AUTH_REQUIRED");
    }

    // ──────────────────────────────────────────────────────────────────────
    // (g) Invalid subject · @Pattern rejection · 400 VALIDATION_FAILED
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void claim_invalid_subject_returns_400_validation_failed() throws Exception {
        MintResult m = mint("fpT08-007");
        assertThat(patchConsent(m.anonSessionId, m.anonToken, 1).statusCode()).isEqualTo(200);
        forceResultReady(m.anonSessionId, "guest-tmp/" + m.anonSessionId + "/bad-subj.jpg");

        String studentJwt = signStudentJwt(STUDENT_A, 3600);
        HttpResponse<String> resp = postClaim(m.anonToken, studentJwt,
                Map.of("subject", "biology-x"));
        assertThat(resp.statusCode())
                .as("non-whitelisted subject must 400")
                .isEqualTo(400);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("code").asText()).isEqualTo("VALIDATION_FAILED");
        assertThat(body.path("message").asText()).contains("subject");

        // Status must remain at 2 RESULT_READY — 400 short-circuits before service
        Short status = jdbc.queryForObject(
                "SELECT status FROM guest_session WHERE id = ?",
                Short.class, m.anonSessionId);
        assertThat(status).isEqualTo((short) 2);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────

    /**
     * Force a guest_session row to status=2 RESULT_READY with a populated
     * image_tmp_url + analysis_result_json. Mirrors what T06+T07 would
     * persist on a happy Qianwen run; NOT a mock — the IT still talks to the
     * real wrongbook-service:8082 over real HTTP.
     */
    private void forceResultReady(long sessionId, String imageKey) {
        jdbc.update(
                "UPDATE guest_session SET status = ?, image_tmp_url = ?, "
                        + "analysis_result_json = CAST(? AS jsonb), "
                        + "consent_at = COALESCE(consent_at, now()) "
                        + "WHERE id = ?",
                (short) 2, imageKey, "{\"steps\":[]}", sessionId);
    }

    private String signStudentJwt(long studentId, long expDeltaSeconds) {
        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
        Instant now = Instant.now();
        Instant exp = now.plus(Duration.ofSeconds(expDeltaSeconds));
        return Jwts.builder()
                .subject(String.valueOf(studentId))
                .issuer(jwtIssuer)
                .audience().add(jwtAudience).and()
                .issuedAt(Date.from(now))
                .expiration(Date.from(exp))
                .signWith(key, Jwts.SIG.HS256)
                .compact();
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

    private HttpResponse<String> postClaim(String anonToken, String studentJwt,
                                           Map<String, Object> body) throws Exception {
        String json = objectMapper.writeValueAsString(body);
        HttpRequest.Builder b = HttpRequest.newBuilder()
                .uri(URI.create("http://127.0.0.1:" + port + "/api/anon/claim"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8))
                .timeout(Duration.ofSeconds(15));
        if (anonToken != null) b.header("X-Anon-Token", anonToken);
        if (studentJwt != null) b.header("Authorization", "Bearer " + studentJwt);
        return httpClient.send(b.build(), HttpResponse.BodyHandlers.ofString());
    }

    private record MintResult(String anonToken, long anonSessionId) {}
}
