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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * SC-12-T08 · companion IT for the 502 path — biz §2B.13 F08.
 *
 * <p>This sits in its own class so {@code @DynamicPropertySource} can point
 * {@code anon.wrongbook.base-url} at an unreachable port without polluting the
 * happy-path Spring context. Same isolation pattern T06 uses for
 * {@link SC12T06AnonAnalyzeDownE2EIT} — proven during T06 to keep regression
 * IT-suite well behaved.
 *
 * <p><b>NO MOCK</b>: the RestTemplate bean is the real production bean; the
 * 65535 port simply yields a kernel ECONNREFUSED — real networking, not a
 * mock layer.
 *
 * <p>Testcase:
 * <ul>
 *   <li>{@code claim_when_wrongbook_down_returns_502} — mint → consent →
 *       force RESULT_READY → POST claim → 502 WRONGBOOK_SERVICE_FAILURE · DB
 *       g.status remains 2 RESULT_READY (no premature flip · proves the 502
 *       branch does NOT mutate guest_session so the FE can retry cleanly).</li>
 * </ul>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SC12T08AnonClaimDownE2EIT extends IntegrationTestBase {

    @DynamicPropertySource
    static void downstreamUnreachable(DynamicPropertyRegistry r) {
        // RFC-6335 / IANA ephemeral end: localhost:65535 reliably ECONNREFUSEDs
        // because nobody binds to it. Real connection-refused, not a mock.
        r.add("anon.wrongbook.base-url", () -> "http://localhost:65535");
    }

    private static final long STUDENT_A = 8803L;

    @LocalServerPort int port;
    @Autowired DataSource dataSource;
    @Autowired ObjectMapper objectMapper;

    @Value("${anon.jwt.secret}") String jwtSecret;
    @Value("${anon.jwt.issuer}") String jwtIssuer;
    @Value("${anon.jwt.audience}") String jwtAudience;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    private JdbcTemplate jdbc;

    @BeforeEach
    void setUp() {
        jdbc = new JdbcTemplate(dataSource);
        jdbc.update("DELETE FROM guest_session WHERE device_fp LIKE 'fpT08D-%'");
        // wrongbook persists as `wrong_item` (see SC12T08AnonClaimE2EIT comment).
        jdbc.update("DELETE FROM wrong_item WHERE student_id = ?", STUDENT_A);
        jdbc.update("DELETE FROM idem_key WHERE scope = 'wb:create' AND idem_key LIKE 'anon-claim-%'");
    }

    @Test
    void claim_when_wrongbook_down_returns_502() throws Exception {
        MintResult m = mint("fpT08D-001");
        assertThat(patchConsent(m.anonSessionId, m.anonToken, 1).statusCode()).isEqualTo(200);
        forceResultReady(m.anonSessionId,
                "guest-tmp/" + m.anonSessionId + "/down.jpg");

        String studentJwt = signStudentJwt(STUDENT_A, 3600);
        HttpResponse<String> resp = postClaim(m.anonToken, studentJwt,
                Map.of("subject", "math"));

        assertThat(resp.statusCode())
                .as("wrongbook-service unreachable must 502")
                .isEqualTo(502);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("code").asText()).isEqualTo("WRONGBOOK_SERVICE_FAILURE");

        // The critical invariant: 502 must NOT have flipped the session into
        // CLAIMED · status stays at 2 RESULT_READY so the FE can retry.
        Map<String, Object> row = jdbc.queryForMap(
                "SELECT status, claimed_by_student_id, claimed_question_id "
                        + "FROM guest_session WHERE id = ?", m.anonSessionId);
        assertThat(((Number) row.get("status")).shortValue())
                .as("status must remain 2 RESULT_READY · 502 must not consume the quota")
                .isEqualTo((short) 2);
        assertThat(row.get("claimed_by_student_id"))
                .as("claimed_by_student_id must remain null · 502 must not partially-mutate")
                .isNull();
        assertThat(row.get("claimed_question_id"))
                .as("claimed_question_id must remain null · 502 must not partially-mutate")
                .isNull();

        // And no wrong_item row created for STUDENT_A in this IT's scope ·
        // proves the 502 short-circuit happened BEFORE any upstream write.
        Integer wbCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM wrong_item WHERE student_id = ?",
                Integer.class, STUDENT_A);
        assertThat(wbCount)
                .as("no wrong_item row may be created when wrongbook is down")
                .isEqualTo(0);
    }

    /**
     * Tester adversarial Round 1 · 2026-05-18 REJECT-1 fix:
     *
     * <p>The original happy IT's idempotent case verifies "second claim returns
     * same qid + wrong_item count stays at 1" — but if the service-side
     * IDEMPOTENT branch were silently broken (e.g. someone removed the
     * "g.claimedByStudentId != null → return IDEMPOTENT" short-circuit) the
     * test could STILL pass because the upstream wrongbook-service does its own
     * idempotency-key dedup. We'd never know the service-side fast-path was
     * dead.
     *
     * <p>This case proves the IDEMPOTENT branch <b>does not</b> reach the
     * RestTemplate: pre-seed guest_session as already-claimed by STUDENT_A,
     * then re-claim with wrongbook pointed at :65535 (unreachable). If the
     * IDEMPOTENT branch is taken, the RestTemplate is never called and the
     * response is 200 with the cached qid. If the branch is broken, the
     * RestTemplate would try to dial :65535 and fail with 502 — that's the
     * silent regression we want to catch.
     *
     * <p>NO MOCK: the RestTemplate bean is still the real production bean; the
     * test simply pre-seeds DB state to take the in-process short-circuit.
     */
    @Test
    void claim_idempotent_short_circuits_before_rpc_so_wrongbook_down_does_not_matter()
            throws Exception {
        MintResult m = mint("fpT08D-002");
        assertThat(patchConsent(m.anonSessionId, m.anonToken, 1).statusCode()).isEqualTo(200);

        // Pre-seed the session as already-claimed by STUDENT_A with a cached
        // qid. This is JDBC fixture prep, not a mock — the row exists in the
        // real PG table just like a prior successful claim would have left it.
        long cachedQid = 999999999999L;
        java.time.OffsetDateTime claimedAt = java.time.OffsetDateTime.now().minusMinutes(1);
        jdbc.update(
                "UPDATE guest_session SET status = ?, image_tmp_url = ?, "
                        + "analysis_result_json = CAST(? AS jsonb), "
                        + "claimed_by_student_id = ?, claimed_question_id = ?, "
                        + "claimed_at = ?, consent_at = COALESCE(consent_at, now()) "
                        + "WHERE id = ?",
                (short) 4, "guest-tmp/" + m.anonSessionId + "/idem.jpg",
                "{\"steps\":[]}", STUDENT_A, cachedQid, claimedAt, m.anonSessionId);

        // Now claim with same anon + same STUDENT_A. Wrongbook is unreachable
        // (:65535). If IDEMPOTENT short-circuits BEFORE the RPC, the result is
        // 200 with the cached qid (the RestTemplate is never invoked, so the
        // ECONNREFUSED never happens).
        String studentJwt = signStudentJwt(STUDENT_A, 3600);
        HttpResponse<String> resp = postClaim(m.anonToken, studentJwt,
                Map.of("subject", "math"));
        assertThat(resp.statusCode())
                .as("IDEMPOTENT branch must short-circuit before the RestTemplate · "
                        + "wrongbook down must NOT cause 502 for an already-claimed session")
                .isEqualTo(200);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("claimed_question_id").asText())
                .as("idempotent must return the cached qid · not a fresh RPC result")
                .isEqualTo(String.valueOf(cachedQid));
        assertThat(body.path("student_id").asLong()).isEqualTo(STUDENT_A);
        assertThat(body.path("anon_session_id").asLong()).isEqualTo(m.anonSessionId);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Helpers · mirror SC12T08AnonClaimE2EIT
    // ──────────────────────────────────────────────────────────────────────

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
