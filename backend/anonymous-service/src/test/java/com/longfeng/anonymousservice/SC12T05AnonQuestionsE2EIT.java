package com.longfeng.anonymousservice;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * SC-12-T05 · {@code POST /api/anon/questions} end-to-end IT.
 *
 * <p>Closes the upload→backend hand-off loop (biz §2B.13 F04). Verifies the
 * controller + service + DB write path against the real PG container running
 * on the dev box. 9 testcases pin all error paths plus the SUCCESS happy
 * path + exploratory boundary cases surfaced during Tester adversarial round:
 * <ol>
 *   <li>{@code questions_with_valid_consent_returns_201_and_db_updated} —
 *       happy: mint + PATCH consent + POST → 201 + JSON shape + DB
 *       {@code image_tmp_url} written + status unchanged.</li>
 *   <li>{@code questions_without_consent_returns_412} — consent gate (biz §13
 *       minor protection).</li>
 *   <li>{@code questions_without_x_anon_token_returns_401} — AnonFilter
 *       rejection.</li>
 *   <li>{@code questions_without_idempotency_key_returns_400} — header
 *       missing → IDEMPOTENCY_KEY_REQUIRED.</li>
 *   <li>{@code questions_with_foreign_prefix_returns_403} — cross-tenant
 *       write defence (objectKey prefix mismatch).</li>
 *   <li>{@code questions_invalid_subject_returns_400} — subject Pattern
 *       rejection.</li>
 *   <li>{@code questions_status_unchanged_at_zero} — explicit lock on T01
 *       spec drift surface (status stays 0 CREATED · NOT advanced by T05).</li>
 *   <li>{@code questions_blank_idempotency_key_returns_400} — exploratory:
 *       empty/whitespace header value must also trip the gate (not just
 *       missing header). Lock the {@code isBlank()} check, not just
 *       {@code == null}.</li>
 *   <li>{@code questions_oversized_object_key_returns_400} — exploratory:
 *       objectKey 513-char must hit {@code @Size(max=512)} ceiling, mirroring
 *       DDL {@code VARCHAR(512)} so a row that would otherwise truncate at
 *       the DB layer is rejected up-front.</li>
 * </ol>
 *
 * <p>Uses {@link IntegrationTestBase} (PG 15432 + Redis 16379, no MinIO needed
 * — T05 doesn't touch object storage, only the DB column). Reuses the mint +
 * PATCH consent helper pattern from {@link SC12T02AnonConsentE2EIT}.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SC12T05AnonQuestionsE2EIT extends IntegrationTestBase {

    @LocalServerPort int port;
    @Autowired DataSource dataSource;
    @Autowired ObjectMapper objectMapper;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    private JdbcTemplate jdbc;

    @BeforeEach
    void setUp() {
        jdbc = new JdbcTemplate(dataSource);
        // Clean rows from prior runs — only ones this suite owns (device_fp prefix "fpT05-").
        jdbc.update("DELETE FROM guest_session WHERE device_fp LIKE 'fpT05-%'");
    }

    // ──────────────────────────────────────────────────────────────────────
    // (a) Happy path · 201 + DB updated · pins F04 write contract
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void questions_with_valid_consent_returns_201_and_db_updated() throws Exception {
        MintResult m = mint("fpT05-001");
        // Consent first — service requires consent_at IS NOT NULL.
        HttpResponse<String> cResp = patchConsent(m.anonSessionId, m.anonToken, 1);
        assertThat(cResp.statusCode()).as("consent must succeed for fixture").isEqualTo(200);

        String objectKey = "guest-tmp/" + m.anonSessionId + "/abc-123.jpg";
        HttpResponse<String> resp = postQuestion(m.anonToken, "key-001",
                Map.of("objectKey", objectKey, "subject", "math"));
        assertThat(resp.statusCode()).as("happy path must 201").isEqualTo(201);

        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("anon_qid").asLong())
                .as("anon_qid must equal the verified anonSessionId")
                .isEqualTo(m.anonSessionId);
        // claim_window.expires_at is the same OffsetDateTime as DB g.expires_at.
        String expiresAtStr = body.path("claim_window").path("expires_at").asText();
        assertThat(expiresAtStr).isNotBlank();
        OffsetDateTime respExpiresAt = OffsetDateTime.parse(expiresAtStr);

        // DB verification · image_tmp_url written, status unchanged
        Map<String, Object> row = jdbc.queryForMap(
                "SELECT image_tmp_url, status, expires_at FROM guest_session WHERE id = ?",
                m.anonSessionId);
        assertThat((String) row.get("image_tmp_url"))
                .as("DB image_tmp_url must equal the posted objectKey")
                .isEqualTo(objectKey);
        assertThat(((Number) row.get("status")).intValue())
                .as("status must remain 0 CREATED — T05 does not advance state machine")
                .isEqualTo(0);

        // Response claim_window.expires_at must agree with DB row's expires_at
        // within a tight ±2s tolerance (handles TIMESTAMPTZ vs OffsetDateTime
        // serialisation rounding · biz §10 surfaces the wire value to FE for
        // countdown rendering so it must match the canonical DB column).
        java.sql.Timestamp dbExpiresAt = (java.sql.Timestamp) row.get("expires_at");
        long diffSec = Math.abs(respExpiresAt.toInstant().getEpochSecond()
                - dbExpiresAt.toInstant().getEpochSecond());
        assertThat(diffSec)
                .as("response claim_window.expires_at must agree with DB expires_at within 2s")
                .isLessThanOrEqualTo(2L);
    }

    // ──────────────────────────────────────────────────────────────────────
    // (b) No consent recorded → 412 CONSENT_REQUIRED · biz §13 gate
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void questions_without_consent_returns_412() throws Exception {
        MintResult m = mint("fpT05-002");
        // Intentionally skip PATCH consent — consent_at is NULL on the row.
        String objectKey = "guest-tmp/" + m.anonSessionId + "/no-consent.jpg";
        HttpResponse<String> resp = postQuestion(m.anonToken, "key-002",
                Map.of("objectKey", objectKey, "subject", "physics"));
        assertThat(resp.statusCode())
                .as("pre-consent POST must 412 — biz §13 minor protection gate")
                .isEqualTo(412);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("code").asText()).isEqualTo("CONSENT_REQUIRED");

        // Negative DB assertion: image_tmp_url must NOT be persisted before consent.
        Map<String, Object> row = jdbc.queryForMap(
                "SELECT image_tmp_url FROM guest_session WHERE id = ?", m.anonSessionId);
        assertThat(row.get("image_tmp_url"))
                .as("image_tmp_url must remain NULL when consent gate fails")
                .isNull();
    }

    // ──────────────────────────────────────────────────────────────────────
    // (c) No X-Anon-Token → 401 ANON_TOKEN_INVALID · AnonFilter contract
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void questions_without_x_anon_token_returns_401() throws Exception {
        // No mint needed — filter rejects before controller; body content irrelevant.
        HttpResponse<String> resp = postQuestionRaw(null, "key-003",
                Map.of("objectKey", "guest-tmp/0/x.jpg", "subject", "math"));
        assertThat(resp.statusCode()).isEqualTo(401);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("code").asText()).isEqualTo("ANON_TOKEN_INVALID");
    }

    // ──────────────────────────────────────────────────────────────────────
    // (d) No X-Idempotency-Key → 400 IDEMPOTENCY_KEY_REQUIRED · biz §10 pattern
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void questions_without_idempotency_key_returns_400() throws Exception {
        MintResult m = mint("fpT05-004");
        // Token present, body valid · idempotency header missing.
        HttpResponse<String> resp = postQuestionRaw(m.anonToken, null,
                Map.of("objectKey", "guest-tmp/" + m.anonSessionId + "/x.jpg",
                        "subject", "math"));
        assertThat(resp.statusCode())
                .as("missing X-Idempotency-Key must 400, not 201")
                .isEqualTo(400);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("code").asText()).isEqualTo("IDEMPOTENCY_KEY_REQUIRED");
    }

    // ──────────────────────────────────────────────────────────────────────
    // (e) Foreign prefix · cross-tenant write defence · 403
    // ──────────────────────────────────────────────────────────────────────
    // Pin: a leaked anonToken cannot register another session's objectKey as
    // its own image_tmp_url. The presign URL (T04) is already prefix-scoped;
    // this is the belt-and-braces second layer at the question-record step.
    @Test
    void questions_with_foreign_prefix_returns_403() throws Exception {
        MintResult m = mint("fpT05-005");
        HttpResponse<String> cResp = patchConsent(m.anonSessionId, m.anonToken, 1);
        assertThat(cResp.statusCode()).isEqualTo(200);

        // Foreign prefix: 99999999 is not the verified anonSessionId.
        String foreignKey = "guest-tmp/99999999/foo.jpg";
        HttpResponse<String> resp = postQuestion(m.anonToken, "key-005",
                Map.of("objectKey", foreignKey, "subject", "chemistry"));
        assertThat(resp.statusCode())
                .as("foreign prefix must 403 — cross-tenant write defence")
                .isEqualTo(403);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("code").asText()).isEqualTo("OBJECT_KEY_PREFIX_MISMATCH");

        // Negative DB: the row must not have been touched by the rejected call.
        Map<String, Object> row = jdbc.queryForMap(
                "SELECT image_tmp_url FROM guest_session WHERE id = ?", m.anonSessionId);
        assertThat(row.get("image_tmp_url"))
                .as("image_tmp_url must remain NULL on prefix rejection")
                .isNull();
    }

    // ──────────────────────────────────────────────────────────────────────
    // (f) Invalid subject → 400 VALIDATION_FAILED (@Pattern fires)
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void questions_invalid_subject_returns_400() throws Exception {
        MintResult m = mint("fpT05-006");
        HttpResponse<String> cResp = patchConsent(m.anonSessionId, m.anonToken, 1);
        assertThat(cResp.statusCode()).isEqualTo(200);

        // "biology-old" doesn't match the six-subject Pattern whitelist.
        HttpResponse<String> resp = postQuestion(m.anonToken, "key-006",
                Map.of("objectKey", "guest-tmp/" + m.anonSessionId + "/sub.jpg",
                        "subject", "biology-old"));
        assertThat(resp.statusCode()).isEqualTo(400);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("code").asText()).isEqualTo("VALIDATION_FAILED");
        assertThat(body.path("message").asText()).contains("subject");
    }

    // ──────────────────────────────────────────────────────────────────────
    // (g) Status stays 0 CREATED · locks T01 spec drift surface
    // ──────────────────────────────────────────────────────────────────────
    // P-GUEST-CAPTURE §6 mentions UPLOADED→ANALYZING but DDL has no UPLOADED
    // state. Decision pinned at T01: T05 does NOT advance status; T06's
    // analyze-by-url is the canonical 0→1 transition. This test catches a
    // future regression that silently bumps status here.
    @Test
    void questions_status_unchanged_at_zero() throws Exception {
        MintResult m = mint("fpT05-007");
        HttpResponse<String> cResp = patchConsent(m.anonSessionId, m.anonToken, 1);
        assertThat(cResp.statusCode()).isEqualTo(200);

        HttpResponse<String> resp = postQuestion(m.anonToken, "key-007",
                Map.of("objectKey", "guest-tmp/" + m.anonSessionId + "/s.jpg",
                        "subject", "english"));
        assertThat(resp.statusCode()).isEqualTo(201);

        Map<String, Object> row = jdbc.queryForMap(
                "SELECT status FROM guest_session WHERE id = ?", m.anonSessionId);
        assertThat(((Number) row.get("status")).shortValue())
                .as("T05 must NOT advance status — T01 spec drift decision")
                .isEqualTo((short) 0);
    }

    // ──────────────────────────────────────────────────────────────────────
    // (h) Blank idempotency-key · exploratory boundary · Tester REJECT Round 1 fix
    // ──────────────────────────────────────────────────────────────────────
    // The controller uses isBlank(), not just == null. A spaces-only value
    // ("   ") would otherwise sneak past a naive ==null check. This case
    // pins the trim-aware gate so a refactor that drops isBlank() trips here.
    @Test
    void questions_blank_idempotency_key_returns_400() throws Exception {
        MintResult m = mint("fpT05-008");
        HttpResponse<String> cResp = patchConsent(m.anonSessionId, m.anonToken, 1);
        assertThat(cResp.statusCode()).isEqualTo(200);

        // Send literal "   " (3 spaces) — header is present but blank.
        HttpResponse<String> resp = postQuestion(m.anonToken, "   ",
                Map.of("objectKey", "guest-tmp/" + m.anonSessionId + "/b.jpg",
                        "subject", "math"));
        assertThat(resp.statusCode())
                .as("blank idempotency-key must 400, not 201")
                .isEqualTo(400);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("code").asText()).isEqualTo("IDEMPOTENCY_KEY_REQUIRED");
    }

    // ──────────────────────────────────────────────────────────────────────
    // (i) Oversized objectKey · exploratory · boundary mirrors DDL VARCHAR(512)
    // ──────────────────────────────────────────────────────────────────────
    // Tester exploratory · 2026-05-18 · feed a 513-char objectKey. The
    // @Size(max=512) jakarta-validation must trip before PG would silently
    // truncate or 22001 string-data-right-truncation. This locks the DTO
    // ceiling at the DDL boundary.
    @Test
    void questions_oversized_object_key_returns_400() throws Exception {
        MintResult m = mint("fpT05-009");
        HttpResponse<String> cResp = patchConsent(m.anonSessionId, m.anonToken, 1);
        assertThat(cResp.statusCode()).isEqualTo(200);

        // Construct objectKey with a 513-char total length (prefix + padding).
        String prefix = "guest-tmp/" + m.anonSessionId + "/";
        int padLen = 513 - prefix.length() - ".jpg".length();
        String oversized = prefix + "a".repeat(padLen) + ".jpg";
        assertThat(oversized.length())
                .as("fixture sanity · oversized must be exactly 513 chars (1 past max)")
                .isEqualTo(513);

        HttpResponse<String> resp = postQuestion(m.anonToken, "key-009",
                Map.of("objectKey", oversized, "subject", "chinese"));
        assertThat(resp.statusCode())
                .as("513-char objectKey must hit @Size(max=512) and 400")
                .isEqualTo(400);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("code").asText()).isEqualTo("VALIDATION_FAILED");
        assertThat(body.path("message").asText()).contains("objectKey");
    }

    // ──────────────────────────────────────────────────────────────────────
    // (j) Consent gate runs BEFORE prefix gate · ordering lock · Tester REJECT Round 1 fix
    // ──────────────────────────────────────────────────────────────────────
    // Tester REJECT Round 1 · 2026-05-18 · the initial 9-case suite covered
    // consent-required AND prefix-mismatch independently but never pinned
    // their RELATIVE ORDER inside the service. A future refactor that swaps
    // the two checks (e.g. for "fail-fast on cheaper validation") would
    // change the error code returned for a request that violates both —
    // breaking the wire contract silently. The spec implies consent is the
    // top-priority gate (biz §13 minor protection · the row must not even
    // be probed for foreign-prefix attacks until consent is recorded). This
    // testcase locks that priority: no-consent + foreign-prefix → 412
    // (CONSENT_REQUIRED), NOT 403 (PREFIX_MISMATCH).
    @Test
    void questions_no_consent_and_foreign_prefix_returns_412_consent_takes_precedence()
            throws Exception {
        MintResult m = mint("fpT05-010");
        // Intentionally skip PATCH consent · row's consent_at IS NULL.
        // Also send a foreign-prefix objectKey · two violations at once.
        String foreignKey = "guest-tmp/88888888/double-bad.jpg";
        HttpResponse<String> resp = postQuestion(m.anonToken, "key-010",
                Map.of("objectKey", foreignKey, "subject", "biology"));
        // Service contract: consent gate runs FIRST · returns 412 even though
        // the prefix would also fail. Locks the gate order.
        assertThat(resp.statusCode())
                .as("consent gate must take precedence over prefix gate · biz §13 minor protection priority")
                .isEqualTo(412);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("code").asText())
                .as("the 412 path must surface CONSENT_REQUIRED, not OBJECT_KEY_PREFIX_MISMATCH")
                .isEqualTo("CONSENT_REQUIRED");
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

    /** PATCH /api/anon/session/{id}/consent with the given token + consentType. */
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

    /** POST /api/anon/questions with token + idempotency key + typed body. */
    private HttpResponse<String> postQuestion(
            String anonToken, String idempotencyKey, Map<String, Object> body) throws Exception {
        return postQuestionRaw(anonToken, idempotencyKey, body);
    }

    /** POST /api/anon/questions — both headers optional so the gate cases compose. */
    private HttpResponse<String> postQuestionRaw(
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

    @SuppressWarnings("unused")
    private static Instant nowUtc() { return Instant.now(); }

    private record MintResult(String anonToken, long anonSessionId) {}
}
