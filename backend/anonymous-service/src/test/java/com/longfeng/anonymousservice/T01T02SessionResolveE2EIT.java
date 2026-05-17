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
import java.util.UUID;
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
 * SC-00-T01-T02 · anonymous-service POST /api/session/resolve E2E IT.
 *
 * <p>Five test cases per inflight scope_in #14:
 * <ol>
 *   <li>{@code valid_jwt_returns_HOME}                 — node 1 happy path
 *   <li>{@code expired_jwt_returns_LANDING}            — node 1 misses (no node-2 deeplink) → node 3 P0 short-circuit
 *   <li>{@code valid_share_token_returns_SHARED}       — node 2 happy with masked context
 *   <li>{@code expired_share_token_falls_back_LANDING} — node 2 graceful degrade (NOT LOGIN)
 *   <li>{@code p0_fingerprint_short_circuit_LANDING}   — node 3 anti-cheat (P0 never returns WELCOME_BACK)
 * </ol>
 *
 * <p>Connects to real sandbox PG (port 15432) + real Redis (port 16379) — NO mocks,
 * NO H2, NO embedded. audit.js dim 5 (spec_alignment) compliance.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class T01T02SessionResolveE2EIT extends IntegrationTestBase {

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
        // Clean test rows from previous runs (UUID-based ids keep tests independent
        // when running back-to-back).
        jdbc.update("DELETE FROM share_token WHERE jti LIKE 't01t02-%'");
        jdbc.update("DELETE FROM observer_invite WHERE invite_code LIKE 'T01%'");
        jdbc.update("DELETE FROM account_device WHERE device_fp LIKE 't01t02-fp-%'");
    }

    // ──────────────────────────────────────────────────────────────────────
    // Test 1 · TC-00.01 valid jwt + path '/' → decision=HOME (no redirect_to)
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void valid_jwt_returns_HOME() throws Exception {
        String jwt = signJwt(123L, 3600);
        HttpResponse<String> resp = postResolve(jwt, body("t01t02-fp-1", "icon", null, null));
        assertThat(resp.statusCode()).isEqualTo(200);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("decision").asText()).isEqualTo("HOME");
        assertThat(body.has("redirect_to")).isFalse();   // biz: redirect_to deferred to T03
        assertThat(body.has("shareContext")).isFalse();
        assertThat(body.has("observerContext")).isFalse();
    }

    // ──────────────────────────────────────────────────────────────────────
    // Test 2 · TC-00.02 expired jwt + no share / no observer → LANDING (P0 node-3 short-circuit)
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void expired_jwt_returns_LANDING() throws Exception {
        String expiredJwt = signJwt(456L, -60);  // 1 min in the past
        HttpResponse<String> resp = postResolve(expiredJwt, body("t01t02-fp-2", "unknown", null, null));
        assertThat(resp.statusCode()).isEqualTo(200);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("decision").asText()).isEqualTo("LANDING");
    }

    // ──────────────────────────────────────────────────────────────────────
    // Test 3 · valid share_token with future expires_at + status=ACTIVE → SHARED + context
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void valid_share_token_returns_SHARED_with_context() throws Exception {
        String jti = "t01t02-" + UUID.randomUUID();
        insertShareToken(jti, 1, OffsetDateTime.now().plusDays(2)); // ACTIVE + 2 days
        HttpResponse<String> resp = postResolve(null, body("t01t02-fp-3", "share", jti, null));
        assertThat(resp.statusCode()).isEqualTo(200);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("decision").asText()).isEqualTo("SHARED");
        assertThat(body.path("shareContext").path("shareType").asText()).isEqualTo("QUESTION");
        assertThat(body.path("shareContext").path("maskedSharerName").asText()).isEqualTo("X***");
        assertThat(body.path("shareContext").path("allowClaim").asBoolean()).isTrue();
        assertThat(body.path("shareContext").path("expiresAt").asText()).isNotBlank();
    }

    // ──────────────────────────────────────────────────────────────────────
    // Test 4 · expired share_token → LANDING graceful (NOT LOGIN — biz patch)
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void expired_share_token_falls_back_to_LANDING() throws Exception {
        String jti = "t01t02-" + UUID.randomUUID();
        insertShareToken(jti, 1, OffsetDateTime.now().minusHours(1)); // expired
        HttpResponse<String> resp = postResolve(null, body("t01t02-fp-4", "share", jti, null));
        assertThat(resp.statusCode()).isEqualTo(200);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("decision").asText())
                .as("expired share must degrade gracefully to LANDING per biz §2A.3.1 patch")
                .isEqualTo("LANDING");
        assertThat(body.has("shareContext")).isFalse();
    }

    // ──────────────────────────────────────────────────────────────────────
    // Test 5 · P0 fp anti-cheat — even with matching account_device row,
    // we MUST return LANDING (not WELCOME_BACK). SC-14 (P1) flips this later.
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void p0_fingerprint_short_circuit_returns_LANDING_not_WELCOMEBACK() throws Exception {
        // Seed an account_device row to prove node 3 IGNORES it in P0
        long nextId = jdbc.queryForObject("SELECT COALESCE(MAX(id),0)+1 FROM account_device", Long.class);
        jdbc.update(
                "INSERT INTO account_device(id, student_id, device_fp, platform, first_seen_at, last_seen_at, login_count) "
                        + "VALUES (?, ?, ?, 'H5', now(), now(), 5)",
                nextId, 999L, "t01t02-fp-anti-cheat"
        );

        HttpResponse<String> resp = postResolve(null, body("t01t02-fp-anti-cheat", "icon", null, null));
        assertThat(resp.statusCode()).isEqualTo(200);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("decision").asText())
                .as("P0 node 3 MUST NOT consult account_device — always LANDING")
                .isEqualTo("LANDING");
    }

    // ──────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────
    private String signJwt(long uid, long expDeltaSeconds) {
        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
        Instant now = Instant.now();
        Instant exp = now.plus(Duration.ofSeconds(expDeltaSeconds));
        return Jwts.builder()
                .subject(String.valueOf(uid))
                .issuer(jwtIssuer)
                .audience().add(jwtAudience).and()
                .issuedAt(Date.from(now))
                .expiration(Date.from(exp))
                .signWith(key, Jwts.SIG.HS256)
                .compact();
    }

    private String body(String fp, String src, String share, String obs) throws Exception {
        java.util.Map<String, Object> m = new java.util.HashMap<>();
        m.put("deviceFp", fp);
        m.put("entrySource", src);
        if (share != null) m.put("shareToken", share);
        if (obs != null) m.put("observerCode", obs);
        return objectMapper.writeValueAsString(m);
    }

    private HttpResponse<String> postResolve(String jwt, String jsonBody) throws Exception {
        HttpRequest.Builder b = HttpRequest.newBuilder()
                .uri(URI.create("http://127.0.0.1:" + port + "/api/session/resolve"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(jsonBody, StandardCharsets.UTF_8))
                .timeout(Duration.ofSeconds(10));
        if (jwt != null) b.header("Authorization", "Bearer " + jwt);
        return httpClient.send(b.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }

    private void insertShareToken(String jti, int status, OffsetDateTime expiresAt) {
        long nextId = jdbc.queryForObject("SELECT COALESCE(MAX(id),0)+1 FROM share_token", Long.class);
        jdbc.update(
                "INSERT INTO share_token(id, jti, sharer_student_id, share_type, relation_id, allow_claim, "
                        + "usage_limit, usage_count, status, created_at, expires_at) "
                        + "VALUES (?, ?, 12345, 'QUESTION', 'q-1', true, 1000, 0, ?, now(), ?)",
                nextId, jti, status, java.sql.Timestamp.from(expiresAt.toInstant())
        );
    }
}
