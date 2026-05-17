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
import java.time.OffsetDateTime;
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

/**
 * SC-12-T02 · {@code PATCH /api/anon/session/{id}/consent} + AnonFilter E2E IT.
 *
 * <p>12 testcases pinning biz §2B.13 SC-12 F02 + AnonFilter contract
 * (9 happy/edge + 3 Tester adversarial-fix · last-writer-wins / case-insensitive
 * header / oversized-garbage-token probe):
 * <ol>
 *   <li>{@code consent_with_valid_token_returns_200_and_db_updated} — happy
 *       path: mint → PATCH → 200 + DB row's {@code consent_at} non-null,
 *       {@code consent_type} = 1. Pins F02 write contract.</li>
 *   <li>{@code consent_without_header_returns_401_anon_token_invalid} — no
 *       {@code X-Anon-Token} → 401 {@code ANON_TOKEN_INVALID}.</li>
 *   <li>{@code consent_with_garbage_token_returns_401} — garbage string → 401.</li>
 *   <li>{@code consent_with_student_jwt_returns_401_wrong_prefix} — JWT
 *       signed with same secret but sub="42" (no "anon:" prefix, mimicking
 *       a student JWT cross-use attempt) → 401 (sub prefix check fires).</li>
 *   <li>{@code consent_with_token_for_different_session_returns_403} — mint
 *       sessions A + B, PATCH B with A's token → 403
 *       {@code ANON_SESSION_MISMATCH}.</li>
 *   <li>{@code consent_for_nonexistent_session_returns_404} — hand-sign token
 *       with {@code sub="anon:99999999"} (no DB row) → 404
 *       {@code ANON_SESSION_NOT_FOUND}.</li>
 *   <li>{@code consent_invalid_consent_type_returns_400} — {@code consentType:0}
 *       → 400 {@code VALIDATION_FAILED}.</li>
 *   <li>{@code filter_lets_session_mint_pass} — POST /api/anon/session
 *       without {@code X-Anon-Token} still returns 200 (whitelist verified).</li>
 *   <li>{@code consent_invalid_consent_type_upper_bound_returns_400} —
 *       {@code consentType:4} (above {@code @Max(3)}) → 400 (bonus
 *       upper-bound case to lock both jakarta-validation edges).</li>
 * </ol>
 *
 * <p>Reuses {@link IntegrationTestBase} (PG 15432 + Redis 16379). Mirrors
 * {@link SC12T01AnonSessionE2EIT} HTTP-client / JdbcTemplate setup verbatim
 * — no extra fixtures needed.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SC12T02AnonConsentE2EIT extends IntegrationTestBase {

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
        // Clean rows from prior runs — only ones this suite owns (device_fp prefix "fpT02-").
        jdbc.update("DELETE FROM guest_session WHERE device_fp LIKE 'fpT02-%'");
    }

    // ──────────────────────────────────────────────────────────────────────
    // (a) Happy path · 200 + DB updated · F02 write contract
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void consent_with_valid_token_returns_200_and_db_updated() throws Exception {
        MintResult m = mint("fpT02-001");
        OffsetDateTime before = OffsetDateTime.now();
        HttpResponse<String> resp = patchConsent(m.anonSessionId, m.anonToken, 1);
        OffsetDateTime after = OffsetDateTime.now();
        assertThat(resp.statusCode()).isEqualTo(200);

        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("consentAt").asText()).isNotBlank();
        assertThat(body.path("consentType").asInt()).isEqualTo(1);

        Map<String, Object> row = jdbc.queryForMap(
                "SELECT consent_at, consent_type, status FROM guest_session WHERE id = ?",
                m.anonSessionId);
        assertThat(row.get("consent_at")).as("consent_at must be persisted").isNotNull();
        assertThat(((Number) row.get("consent_type")).intValue()).isEqualTo(1);
        // Status MUST remain CREATED (0) — T02 spec says we do not advance state machine.
        assertThat(((Number) row.get("status")).intValue())
                .as("status must remain 0 CREATED — T02 does not advance state machine")
                .isEqualTo(0);

        // Tester REJECT Round 1 fix · 2026-05-18 · pin consent_at to a real wall-clock
        // window. A regression that constantly sets consent_at = epoch-0 / null /
        // hard-coded would otherwise pass the "non-null" check above. The window is
        // [before-1s, after+1s] to absorb DB clock skew.
        java.sql.Timestamp dbConsentAt = (java.sql.Timestamp) row.get("consent_at");
        long consentEpochSec = dbConsentAt.toInstant().getEpochSecond();
        long beforeSec = before.minusSeconds(1).toEpochSecond();
        long afterSec = after.plusSeconds(1).toEpochSecond();
        assertThat(consentEpochSec)
                .as("consent_at must be in [request-start-1s, request-end+1s] window")
                .isBetween(beforeSec, afterSec);
    }

    // ──────────────────────────────────────────────────────────────────────
    // (b) Missing X-Anon-Token → 401 ANON_TOKEN_INVALID
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void consent_without_header_returns_401_anon_token_invalid() throws Exception {
        MintResult m = mint("fpT02-002");
        HttpResponse<String> resp = patchConsentNoHeader(m.anonSessionId, 1);
        assertThat(resp.statusCode()).isEqualTo(401);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("code").asText()).isEqualTo("ANON_TOKEN_INVALID");
    }

    // ──────────────────────────────────────────────────────────────────────
    // (c) Garbage token → 401
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void consent_with_garbage_token_returns_401() throws Exception {
        MintResult m = mint("fpT02-003");
        HttpResponse<String> resp = patchConsent(m.anonSessionId, "garbage.invalid.jwt", 1);
        assertThat(resp.statusCode()).isEqualTo(401);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("code").asText()).isEqualTo("ANON_TOKEN_INVALID");
    }

    // ──────────────────────────────────────────────────────────────────────
    // (d) Student JWT (no "anon:" sub prefix) → 401 — sub prefix check
    // ──────────────────────────────────────────────────────────────────────
    // This pins the discriminator the AnonFilter uses to keep student JWTs
    // out — auth-service shares the HS256 secret, so a valid student token
    // would otherwise verify here. The "anon:" sub prefix is what stops it.
    @Test
    void consent_with_student_jwt_returns_401_wrong_prefix() throws Exception {
        MintResult m = mint("fpT02-004");
        // Sign a JWT with sub="42" (a bare numeric studentId, like auth-service mints).
        String studentJwt = signRawSubJwt("42", 3600);
        HttpResponse<String> resp = patchConsent(m.anonSessionId, studentJwt, 1);
        assertThat(resp.statusCode()).isEqualTo(401);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("code").asText()).isEqualTo("ANON_TOKEN_INVALID");
    }

    // ──────────────────────────────────────────────────────────────────────
    // (e) Token for session A, PATCH session B → 403 ANON_SESSION_MISMATCH
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void consent_with_token_for_different_session_returns_403() throws Exception {
        MintResult a = mint("fpT02-005a");
        MintResult b = mint("fpT02-005b");
        // Use A's token but path B's id.
        HttpResponse<String> resp = patchConsent(b.anonSessionId, a.anonToken, 1);
        assertThat(resp.statusCode()).isEqualTo(403);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("code").asText()).isEqualTo("ANON_SESSION_MISMATCH");
    }

    // ──────────────────────────────────────────────────────────────────────
    // (f) Token sub="anon:99999999" but no DB row → 404 ANON_SESSION_NOT_FOUND
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void consent_for_nonexistent_session_returns_404() throws Exception {
        long fakeId = 99_999_999L;
        // Make sure the fake id really doesn't exist (defensive — collision astronomical).
        jdbc.update("DELETE FROM guest_session WHERE id = ?", fakeId);
        String fakeAnonToken = signRawSubJwt("anon:" + fakeId, 3600);
        HttpResponse<String> resp = patchConsent(fakeId, fakeAnonToken, 1);
        assertThat(resp.statusCode()).isEqualTo(404);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("code").asText()).isEqualTo("ANON_SESSION_NOT_FOUND");
    }

    // ──────────────────────────────────────────────────────────────────────
    // (g) consentType:0 → 400 VALIDATION_FAILED (jakarta @Min(1))
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void consent_invalid_consent_type_returns_400() throws Exception {
        MintResult m = mint("fpT02-006");
        HttpResponse<String> resp = patchConsent(m.anonSessionId, m.anonToken, 0);
        assertThat(resp.statusCode()).isEqualTo(400);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("code").asText()).isEqualTo("VALIDATION_FAILED");
        assertThat(body.path("message").asText()).contains("consentType");
    }

    // ──────────────────────────────────────────────────────────────────────
    // (h) Whitelist · POST /api/anon/session passes through without token
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void filter_lets_session_mint_pass() throws Exception {
        // Plain mint with no X-Anon-Token — must still 200 (whitelist).
        String body = objectMapper.writeValueAsString(Map.of("deviceFp", "fpT02-007"));
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create("http://127.0.0.1:" + port + "/api/anon/session"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                .timeout(Duration.ofSeconds(10))
                .build();
        HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
        assertThat(resp.statusCode())
                .as("POST /api/anon/session must NOT require X-Anon-Token (whitelist)")
                .isEqualTo(200);
    }

    // ──────────────────────────────────────────────────────────────────────
    // (i) consentType:4 → 400 (upper-bound · @Max(3))
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void consent_invalid_consent_type_upper_bound_returns_400() throws Exception {
        MintResult m = mint("fpT02-008");
        HttpResponse<String> resp = patchConsent(m.anonSessionId, m.anonToken, 4);
        assertThat(resp.statusCode()).isEqualTo(400);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("code").asText()).isEqualTo("VALIDATION_FAILED");
    }

    // ──────────────────────────────────────────────────────────────────────
    // (j) Double consent · last-writer-wins · pins service javadoc claim
    // ──────────────────────────────────────────────────────────────────────
    // Tester REJECT Round 1 fix · 2026-05-18 · `AnonSessionConsentService` javadoc
    // documents "last writer wins" for concurrent / repeated consent writes. If a
    // future refactor adds e.g. an idempotency guard that rejects the second call,
    // this test catches the silent contract drift. Two-call sequence: consent_type
    // 1 → 2 · final DB row must reflect 2 + a later consent_at.
    @Test
    void consent_called_twice_keeps_last_writer_wins() throws Exception {
        MintResult m = mint("fpT02-009");
        HttpResponse<String> r1 = patchConsent(m.anonSessionId, m.anonToken, 1);
        assertThat(r1.statusCode()).isEqualTo(200);
        OffsetDateTime after1 = OffsetDateTime.now();
        // Sleep ≥ 1 second so the second consent_at is strictly later than the first
        // even on coarse-grained TIMESTAMPTZ precision.
        Thread.sleep(1100);
        HttpResponse<String> r2 = patchConsent(m.anonSessionId, m.anonToken, 2);
        assertThat(r2.statusCode()).isEqualTo(200);

        Map<String, Object> row = jdbc.queryForMap(
                "SELECT consent_at, consent_type FROM guest_session WHERE id = ?",
                m.anonSessionId);
        // consent_type must reflect the LAST call (=2), not the first (=1)
        assertThat(((Number) row.get("consent_type")).intValue())
                .as("consent_type must reflect last writer (2), not first (1)")
                .isEqualTo(2);
        // consent_at must be after the first response completed (proves overwrite)
        java.sql.Timestamp dbConsentAt = (java.sql.Timestamp) row.get("consent_at");
        assertThat(dbConsentAt.toInstant().isAfter(after1.toInstant()))
                .as("consent_at must advance past the first call's wall clock")
                .isTrue();
    }

    // ──────────────────────────────────────────────────────────────────────
    // (k) Header name case-insensitive · RFC 7230 §3.2 invariant
    // ──────────────────────────────────────────────────────────────────────
    // Tester REJECT Round 1 fix · 2026-05-18 · HTTP header names are
    // case-insensitive per RFC. If a future filter ever switches to a
    // case-sensitive map lookup (e.g. a custom request wrapper), this test
    // catches the regression — real-world clients send "x-anon-token" lowercase.
    @Test
    void consent_with_lowercase_header_name_returns_200() throws Exception {
        MintResult m = mint("fpT02-010");
        Map<String, Object> body = new HashMap<>();
        body.put("consentType", 1);
        String json = objectMapper.writeValueAsString(body);
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create("http://127.0.0.1:" + port
                        + "/api/anon/session/" + m.anonSessionId + "/consent"))
                .header("Content-Type", "application/json")
                .header("x-anon-token", m.anonToken)  // lowercase!
                .method("PATCH", HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8))
                .timeout(Duration.ofSeconds(10))
                .build();
        HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
        assertThat(resp.statusCode())
                .as("X-Anon-Token header lookup must be case-insensitive (RFC 7230)")
                .isEqualTo(200);
    }

    // ──────────────────────────────────────────────────────────────────────
    // (l) Long header value · DoS / parser overflow probe (exploratory)
    // ──────────────────────────────────────────────────────────────────────
    // Tester exploratory · 2026-05-18 · feed AnonFilter a 4 KB garbage X-Anon-Token.
    // JJWT must not OOM / hang; expected behavior is a clean 401.
    @Test
    void consent_with_oversized_garbage_token_returns_401() throws Exception {
        MintResult m = mint("fpT02-011");
        String oversized = "a".repeat(4096);
        HttpResponse<String> resp = patchConsent(m.anonSessionId, oversized, 1);
        assertThat(resp.statusCode())
                .as("4KB garbage token must cleanly 401, not 5xx / hang")
                .isEqualTo(401);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("code").asText()).isEqualTo("ANON_TOKEN_INVALID");
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

    /** PATCH consent with the given header value. */
    private HttpResponse<String> patchConsent(long id, String tokenValue, int consentType)
            throws Exception {
        Map<String, Object> body = new HashMap<>();
        body.put("consentType", consentType);
        String json = objectMapper.writeValueAsString(body);
        HttpRequest.Builder b = HttpRequest.newBuilder()
                .uri(URI.create("http://127.0.0.1:" + port + "/api/anon/session/" + id + "/consent"))
                .header("Content-Type", "application/json")
                .method("PATCH", HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8))
                .timeout(Duration.ofSeconds(10));
        if (tokenValue != null) b.header("X-Anon-Token", tokenValue);
        return httpClient.send(b.build(), HttpResponse.BodyHandlers.ofString());
    }

    /** PATCH consent with NO X-Anon-Token header at all. */
    private HttpResponse<String> patchConsentNoHeader(long id, int consentType) throws Exception {
        return patchConsent(id, null, consentType);
    }

    /**
     * Sign an HS256 JWT with arbitrary {@code sub} under this service's
     * configured secret/iss/aud. Used to fabricate two attack scenarios:
     * <ul>
     *   <li>student-style JWT (sub="42" no "anon:" prefix · case d)</li>
     *   <li>anon JWT for non-existent session (sub="anon:99999999" · case f)</li>
     * </ul>
     */
    private String signRawSubJwt(String sub, long ttlSeconds) {
        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
        Instant now = Instant.now();
        Instant exp = now.plusSeconds(ttlSeconds);
        return Jwts.builder()
                .subject(sub)
                .issuer(jwtIssuer)
                .audience().add(jwtAudience).and()
                .issuedAt(Date.from(now))
                .expiration(Date.from(exp))
                .signWith(key, Jwts.SIG.HS256)
                .compact();
    }

    private record MintResult(String anonToken, long anonSessionId) {}
}
