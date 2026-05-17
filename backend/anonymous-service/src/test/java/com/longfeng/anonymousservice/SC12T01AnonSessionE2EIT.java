package com.longfeng.anonymousservice;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.OffsetDateTime;
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
 * SC-12-T01 · {@code POST /api/anon/session} E2E IT against real PG (15432).
 *
 * <p>6 testcases pinning biz §2B.13 SC-12 F01 + §4.10 contract:
 * <ol>
 *   <li>{@code mint_returns_200_with_anonToken_and_sessionId_and_db_row} — happy
 *       path: HTTP 200 · response fields complete · JWT verifies under same
 *       secret/iss/aud · sub = "anon:" + anonSessionId · expiresAt within ±5s
 *       of now+24h · DB row inserted with status=0 CREATED.
 *   <li>{@code mint_without_device_fp_returns_400} — body lacks deviceFp →
 *       jakarta {@code @NotBlank} → 400 VALIDATION_FAILED.
 *   <li>{@code mint_long_device_fp_returns_400} — deviceFp 200 chars (>128
 *       cap) → jakarta {@code @Size(max=128)} → 400.
 *   <li>{@code mint_invalid_entry_source_sanitized_to_unknown} — XSS-style
 *       entrySource collapses to {@code "unknown"} in DB.
 *   <li>{@code mint_persists_optional_fields_correctly} — ipHash + ua +
 *       experimentBucket all round-trip to DB.
 *   <li>{@code mint_token_sub_prefix_is_anon} — explicit invariant: JWT sub
 *       starts with {@code "anon:"} and the suffix equals anonSessionId
 *       (T02 AnonFilter relies on this prefix vs student JWT's bare sub).
 * </ol>
 *
 * <p>Mirrors {@link SC13SharerE2EIT} HTTP-client + JWT helpers verbatim — the
 * sandbox PG (15432) + Redis (16379) are reused from {@link IntegrationTestBase}.
 * No mocks: real Spring Boot port + real Flyway-migrated schema.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SC12T01AnonSessionE2EIT extends IntegrationTestBase {

    @LocalServerPort int port;
    @Autowired DataSource dataSource;
    @Autowired ObjectMapper objectMapper;

    @Value("${anon.jwt.secret}") String jwtSecret;
    @Value("${anon.jwt.issuer}") String jwtIssuer;
    @Value("${anon.jwt.audience}") String jwtAudience;
    @Value("${anon.guest-session-ttl-sec:86400}") long ttlSeconds;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    private JdbcTemplate jdbc;

    @BeforeEach
    void setUp() {
        jdbc = new JdbcTemplate(dataSource);
        // Drop rows from prior runs of this suite — we identify by device_fp
        // prefix "fp-" which only this suite uses, so we don't trample other ITs.
        jdbc.update("DELETE FROM guest_session WHERE device_fp LIKE 'fp-%' OR device_fp LIKE 'xxxxxxxxx%'");
    }

    // ──────────────────────────────────────────────────────────────────────
    // (a) Happy path — 200 + JWT verifies + DB row + status=0 + expiresAt window
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void mint_returns_200_with_anonToken_and_sessionId_and_db_row() throws Exception {
        OffsetDateTime before = OffsetDateTime.now();
        HttpResponse<String> resp = postMint(requestBody("fp-001", null, null, null, null));
        OffsetDateTime after = OffsetDateTime.now();
        assertThat(resp.statusCode()).isEqualTo(200);

        JsonNode body = objectMapper.readTree(resp.body());
        String anonToken = body.path("anonToken").asText();
        long anonSessionId = body.path("anonSessionId").asLong();
        String expiresAtStr = body.path("expiresAt").asText();
        assertThat(anonToken).isNotBlank();
        assertThat(anonSessionId).isGreaterThan(0L);
        assertThat(expiresAtStr).isNotBlank();

        // expiresAt = now+ttl (±5s tolerance for client/server clock drift + test overhead)
        OffsetDateTime expiresAt = OffsetDateTime.parse(expiresAtStr);
        OffsetDateTime expectedLow = before.plusSeconds(ttlSeconds).minusSeconds(5);
        OffsetDateTime expectedHigh = after.plusSeconds(ttlSeconds).plusSeconds(5);
        assertThat(expiresAt)
                .as("expiresAt must be within ±5s of now+" + ttlSeconds + "s")
                .isBetween(expectedLow, expectedHigh);

        // JWT verifies under the SAME secret/iss/aud used by auth-service + SC-13
        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
        Jws<Claims> parsed = Jwts.parser()
                .verifyWith(key)
                .requireIssuer(jwtIssuer)
                .requireAudience(jwtAudience)
                .build()
                .parseSignedClaims(anonToken);
        Claims claims = parsed.getPayload();
        assertThat(claims.getSubject()).isEqualTo("anon:" + anonSessionId);
        assertThat(claims.getId()).hasSize(32);  // UUID v4 sans hyphens

        // Tester REJECT Round 1 fix · 2026-05-18 · the JWT exp claim and the
        // response.expiresAt are computed in two different code paths
        // (AnonTokenService for the JWT, AnonSessionService for the response).
        // If a future refactor accidentally lets them drift, the frontend
        // countdown would lie. Pin them within ±2s here so the regression
        // surfaces immediately.
        long jwtExpEpochSec = claims.getExpiration().toInstant().getEpochSecond();
        long responseExpEpochSec = expiresAt.toEpochSecond();
        assertThat(Math.abs(jwtExpEpochSec - responseExpEpochSec))
                .as("JWT exp claim must match response.expiresAt within ±2s")
                .isLessThanOrEqualTo(2L);

        // DB row inserted with status=0 CREATED
        Map<String, Object> row = jdbc.queryForMap(
                "SELECT device_fp, status, entry_source, created_at, expires_at "
                        + "FROM guest_session WHERE id = ?", anonSessionId);
        assertThat(row.get("device_fp")).isEqualTo("fp-001");
        assertThat(((Number) row.get("status")).intValue()).isEqualTo(0);
        assertThat(row.get("entry_source")).isNull();  // not provided in request

        // Tester REJECT Round 1 fix continued · DB expires_at must also align
        // with the JWT exp · within ±2s tolerance. If DB drift vs JWT exp
        // ever happens (e.g. ttl reduced for one but not the other), the
        // claim phase (T05) would break silently.
        java.sql.Timestamp dbExp = (java.sql.Timestamp) row.get("expires_at");
        long dbExpEpochSec = dbExp.toInstant().getEpochSecond();
        assertThat(Math.abs(dbExpEpochSec - jwtExpEpochSec))
                .as("DB expires_at must match JWT exp within ±2s")
                .isLessThanOrEqualTo(2L);
    }

    // ──────────────────────────────────────────────────────────────────────
    // (b) Missing deviceFp → @NotBlank → 400 VALIDATION_FAILED
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void mint_without_device_fp_returns_400() throws Exception {
        HttpResponse<String> resp = postMintRaw("{}");
        assertThat(resp.statusCode()).isEqualTo(400);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("code").asText()).isEqualTo("VALIDATION_FAILED");
        assertThat(body.path("message").asText()).contains("deviceFp");
    }

    // ──────────────────────────────────────────────────────────────────────
    // (c) deviceFp too long (>128) → @Size → 400 VALIDATION_FAILED
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void mint_long_device_fp_returns_400() throws Exception {
        String oversized = "x".repeat(200);
        HttpResponse<String> resp = postMint(requestBody(oversized, null, null, null, null));
        assertThat(resp.statusCode()).isEqualTo(400);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("code").asText()).isEqualTo("VALIDATION_FAILED");
        assertThat(body.path("message").asText()).contains("deviceFp");
    }

    // ──────────────────────────────────────────────────────────────────────
    // (d) entrySource XSS sanitized to "unknown"
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void mint_invalid_entry_source_sanitized_to_unknown() throws Exception {
        // 32-char limit on entry_source column — keep the malicious value within bounds
        // so we are testing the sanitize path, not Jackson/JPA truncation.
        HttpResponse<String> resp = postMint(requestBody("fp-002", null, null, "<script>x</script>", null));
        assertThat(resp.statusCode()).isEqualTo(200);
        long id = objectMapper.readTree(resp.body()).path("anonSessionId").asLong();

        String entrySource = jdbc.queryForObject(
                "SELECT entry_source FROM guest_session WHERE id = ?", String.class, id);
        assertThat(entrySource)
                .as("non-whitelist entrySource must collapse to 'unknown' (XSS defense)")
                .isEqualTo("unknown");
    }

    // ──────────────────────────────────────────────────────────────────────
    // (e) All optional fields round-trip to DB
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void mint_persists_optional_fields_correctly() throws Exception {
        HttpResponse<String> resp = postMint(
                requestBody("fp-003", "hash-abc", "Mozilla/test", "ad", "bucket-A"));
        assertThat(resp.statusCode()).isEqualTo(200);
        long id = objectMapper.readTree(resp.body()).path("anonSessionId").asLong();

        Map<String, Object> row = jdbc.queryForMap(
                "SELECT device_fp, ip_hash, ua, entry_source, experiment_bucket "
                        + "FROM guest_session WHERE id = ?", id);
        assertThat(row.get("device_fp")).isEqualTo("fp-003");
        assertThat(row.get("ip_hash")).isEqualTo("hash-abc");
        assertThat(row.get("ua")).isEqualTo("Mozilla/test");
        assertThat(row.get("entry_source")).isEqualTo("ad");  // whitelist hit
        assertThat(row.get("experiment_bucket")).isEqualTo("bucket-A");
    }

    // ──────────────────────────────────────────────────────────────────────
    // (f) JWT sub prefix invariant — must start with "anon:" + anonSessionId
    // ──────────────────────────────────────────────────────────────────────
    // This pins the discriminator T02's AnonFilter will use to tell anon JWTs
    // apart from student JWTs (whose sub is a bare numeric string). A future
    // refactor that drops the prefix would silently break the AnonFilter; this
    // testcase catches that regression at the source.
    @Test
    void mint_token_sub_prefix_is_anon() throws Exception {
        HttpResponse<String> resp = postMint(requestBody("fp-004", null, null, null, null));
        assertThat(resp.statusCode()).isEqualTo(200);
        JsonNode body = objectMapper.readTree(resp.body());
        String anonToken = body.path("anonToken").asText();
        long anonSessionId = body.path("anonSessionId").asLong();

        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
        String sub = Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(anonToken)
                .getPayload()
                .getSubject();
        assertThat(sub).startsWith("anon:");
        assertThat(sub.substring("anon:".length()))
                .as("sub suffix must equal anonSessionId verbatim")
                .isEqualTo(String.valueOf(anonSessionId));
    }

    // ──────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────
    private String requestBody(String deviceFp, String ipHash, String ua,
                               String entrySource, String experimentBucket) throws Exception {
        Map<String, Object> m = new HashMap<>();
        if (deviceFp != null) m.put("deviceFp", deviceFp);
        if (ipHash != null) m.put("ipHash", ipHash);
        if (ua != null) m.put("ua", ua);
        if (entrySource != null) m.put("entrySource", entrySource);
        if (experimentBucket != null) m.put("experimentBucket", experimentBucket);
        return objectMapper.writeValueAsString(m);
    }

    private HttpResponse<String> postMint(String body) throws Exception {
        return postMintRaw(body);
    }

    private HttpResponse<String> postMintRaw(String body) throws Exception {
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create("http://127.0.0.1:" + port + "/api/anon/session"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                .timeout(Duration.ofSeconds(10))
                .build();
        return httpClient.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }
}
