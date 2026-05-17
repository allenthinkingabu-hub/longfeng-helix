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
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import javax.crypto.SecretKey;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * SC-13-SHARER · sharer-side endpoints E2E IT — POST /api/share/tokens +
 * DELETE /api/share/tokens/{jti} against real PG (15432) and real Redis (16379).
 *
 * <p>8 testcases pinning biz §10.9 contract:
 * <ol>
 *   <li>{@code issue_returns_200_with_jwt_and_shareurl_and_db_row} — happy path:
 *       HTTP 200 · response fields complete · JWT verifies under same secret/iss/aud ·
 *       DB row inserted · receiver-side {@code GET /api/share/{token}} now returns 200
 *   <li>{@code issue_without_bearer_returns_401} — missing Authorization header → 401
 *   <li>{@code issue_invalid_share_type_returns_400} — shareType='FOO' fails @Pattern → 400
 *   <li>{@code issue_long_exp_clamped_to_7d} — expiresInSec=86_400_000 (1000d) is clamped to
 *       now+7d (within ±5s tolerance)
 *   <li>{@code revoke_by_owner_returns_204_and_jti_in_redis_revoked} — happy revoke:
 *       204 · DB status=3 · Redis SISMEMBER share:revoked = true
 *   <li>{@code revoke_by_other_user_returns_403_not_owner} — A issues, B revokes → 403
 *   <li>{@code revoke_unknown_jti_returns_404} — jti has no DB row → 404
 *   <li>{@code round_trip_get_after_revoke_returns_403_revoked} — issue → receiver 200 →
 *       revoke → receiver 403 TOKEN_REVOKED (SC-13 lookup path stays correct)
 * </ol>
 *
 * <p>JWT-helper pattern mirrors {@code T01T02SessionResolveE2EIT.signJwt} — same secret /
 * issuer / audience injected via @Value (anon.jwt.*). Sharer JWTs use the same key as
 * receiver-side share JWTs; that's exactly the parity required by JwtVerifier.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SC13SharerE2EIT extends IntegrationTestBase {

    private static final String REVOKED_SET_KEY = "share:revoked";
    private static final long SHARER_A = 4242L;
    private static final long SHARER_B = 4343L;

    @LocalServerPort int port;
    @Autowired DataSource dataSource;
    @Autowired ObjectMapper objectMapper;
    @Autowired StringRedisTemplate redis;

    @Value("${anon.jwt.secret}") String jwtSecret;
    @Value("${anon.jwt.issuer}") String jwtIssuer;
    @Value("${anon.jwt.audience}") String jwtAudience;
    @Value("${share.public-base-url}") String publicBaseUrl;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    private JdbcTemplate jdbc;

    @BeforeEach
    void setUp() {
        jdbc = new JdbcTemplate(dataSource);
        // Drop any share_token row created by previous SC-13-SHARER runs (we don't
        // know the auto-generated jti, but sharer_student_id is owned by this suite).
        jdbc.update("DELETE FROM share_token WHERE sharer_student_id IN (?, ?)", SHARER_A, SHARER_B);
        // Drain Redis revoked set (cheap; SC13ShareE2EIT does the same).
        redis.delete(REVOKED_SET_KEY);
    }

    // ──────────────────────────────────────────────────────────────────────
    // (a) issue — happy path
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void issue_returns_200_with_jwt_and_shareurl_and_db_row() throws Exception {
        String sharerJwt = signSharerJwt(SHARER_A, 3600);
        HttpResponse<String> resp = postIssue(sharerJwt, issueBody("QUESTION", "wb_question:42", null, true));
        assertThat(resp.statusCode()).isEqualTo(200);

        JsonNode body = objectMapper.readTree(resp.body());
        // response shape — 4 fields required (biz §10.9)
        String shareToken = body.path("shareToken").asText();
        String jti = body.path("jti").asText();
        String shareUrl = body.path("shareUrl").asText();
        String expiresAt = body.path("expiresAt").asText();
        assertThat(shareToken).isNotBlank();
        assertThat(jti).hasSize(32);  // UUID v4 sans hyphens
        assertThat(shareUrl).isEqualTo(publicBaseUrl + "/s/" + shareToken);
        assertThat(expiresAt).isNotBlank();

        // The signed JWT must verify under the same secret/iss/aud as receiver-side
        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
        Jws<Claims> parsed = Jwts.parser()
                .verifyWith(key)
                .requireIssuer(jwtIssuer)
                .requireAudience(jwtAudience)
                .build()
                .parseSignedClaims(shareToken);
        Claims claims = parsed.getPayload();
        assertThat(claims.getId()).isEqualTo(jti);
        assertThat(claims.getSubject()).isEqualTo(String.valueOf(SHARER_A));
        assertThat(claims.get("shareType", String.class)).isEqualTo("QUESTION");
        assertThat(claims.get("relationId", String.class)).isEqualTo("wb_question:42");
        assertThat(claims.get("allowClaim", Boolean.class)).isTrue();

        // DB row inserted, status=ACTIVE
        Map<String, Object> row = jdbc.queryForMap(
                "SELECT sharer_student_id, share_type, relation_id, allow_claim, status, expires_at "
                        + "FROM share_token WHERE jti = ?", jti);
        assertThat(((Number) row.get("sharer_student_id")).longValue()).isEqualTo(SHARER_A);
        assertThat(row.get("share_type")).isEqualTo("QUESTION");
        assertThat(row.get("relation_id")).isEqualTo("wb_question:42");
        assertThat(row.get("allow_claim")).isEqualTo(Boolean.TRUE);
        assertThat(((Number) row.get("status")).intValue()).isEqualTo(1);

        // Round-trip — receiver-side GET /api/share/{token} now returns 200 SUCCESS
        HttpResponse<String> getResp = getReceiver(shareToken);
        assertThat(getResp.statusCode()).isEqualTo(200);
        JsonNode getBody = objectMapper.readTree(getResp.body());
        assertThat(getBody.path("type").asText()).isEqualTo("QUESTION");
        assertThat(getBody.path("signatureValid").asBoolean()).isTrue();
    }

    // ──────────────────────────────────────────────────────────────────────
    // (b) issue — no Bearer → 401
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void issue_without_bearer_returns_401() throws Exception {
        HttpResponse<String> resp = postIssue(null, issueBody("QUESTION", "wb_question:1", null, false));
        assertThat(resp.statusCode()).isEqualTo(401);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("code").asText()).isEqualTo("UNAUTHENTICATED");
    }

    // ──────────────────────────────────────────────────────────────────────
    // (c) issue — invalid shareType ('FOO') fails @Pattern → 400
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void issue_invalid_share_type_returns_400() throws Exception {
        String sharerJwt = signSharerJwt(SHARER_A, 3600);
        HttpResponse<String> resp = postIssue(sharerJwt, issueBody("FOO", "wb_question:1", null, false));
        assertThat(resp.statusCode()).isEqualTo(400);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("code").asText()).isEqualTo("VALIDATION_FAILED");
        assertThat(body.path("message").asText()).contains("shareType");
    }

    // ──────────────────────────────────────────────────────────────────────
    // (d) issue — gigantic expiresInSec clamped to 7d
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void issue_long_exp_clamped_to_7d() throws Exception {
        String sharerJwt = signSharerJwt(SHARER_A, 3600);
        long ridiculous = 86_400L * 1000L;  // 1000 days
        HttpResponse<String> resp = postIssue(sharerJwt,
                issueBody("REVIEW_NODE", "node:99", ridiculous, false));
        assertThat(resp.statusCode()).isEqualTo(200);
        JsonNode body = objectMapper.readTree(resp.body());

        OffsetDateTime expiresAt = OffsetDateTime.parse(body.path("expiresAt").asText());
        OffsetDateTime expected7d = OffsetDateTime.now().plusDays(7);
        long deltaSec = Math.abs(java.time.Duration.between(expected7d, expiresAt).getSeconds());
        assertThat(deltaSec)
                .as("expiresAt must clamp to now+7d (biz §4.11 hard cap)")
                .isLessThanOrEqualTo(5);
    }

    // ──────────────────────────────────────────────────────────────────────
    // (e) revoke — owner revokes → 204 + Redis SADD share:revoked
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void revoke_by_owner_returns_204_and_jti_in_redis_revoked() throws Exception {
        String sharerJwt = signSharerJwt(SHARER_A, 3600);
        // Issue first
        HttpResponse<String> issueResp = postIssue(sharerJwt,
                issueBody("EXAM_DAY", "event:7", null, false));
        assertThat(issueResp.statusCode()).isEqualTo(200);
        String jti = objectMapper.readTree(issueResp.body()).path("jti").asText();

        HttpResponse<String> revokeResp = deleteRevoke(jti, sharerJwt);
        assertThat(revokeResp.statusCode()).isEqualTo(204);

        // DB status flipped to 3 REVOKED
        Integer status = jdbc.queryForObject(
                "SELECT status FROM share_token WHERE jti = ?", Integer.class, jti);
        assertThat(status).isEqualTo(3);

        // Redis SET share:revoked contains the jti
        Boolean member = redis.opsForSet().isMember(REVOKED_SET_KEY, jti);
        assertThat(member).isTrue();
    }

    // ──────────────────────────────────────────────────────────────────────
    // (f) revoke — caller B tries to revoke A's token → 403 NOT_OWNER
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void revoke_by_other_user_returns_403_not_owner() throws Exception {
        String aJwt = signSharerJwt(SHARER_A, 3600);
        HttpResponse<String> issueResp = postIssue(aJwt,
                issueBody("QUESTION", "wb_question:13", null, false));
        String jti = objectMapper.readTree(issueResp.body()).path("jti").asText();

        // B (different sub) tries to revoke
        String bJwt = signSharerJwt(SHARER_B, 3600);
        HttpResponse<String> revokeResp = deleteRevoke(jti, bJwt);
        assertThat(revokeResp.statusCode()).isEqualTo(403);
        JsonNode body = objectMapper.readTree(revokeResp.body());
        assertThat(body.path("code").asText()).isEqualTo("NOT_OWNER");

        // DB row must remain ACTIVE
        Integer status = jdbc.queryForObject(
                "SELECT status FROM share_token WHERE jti = ?", Integer.class, jti);
        assertThat(status).isEqualTo(1);
    }

    // ──────────────────────────────────────────────────────────────────────
    // (g) revoke — unknown jti → 404
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void revoke_unknown_jti_returns_404() throws Exception {
        String sharerJwt = signSharerJwt(SHARER_A, 3600);
        String unknownJti = "nonexistent-" + UUID.randomUUID().toString().replace("-", "");
        HttpResponse<String> resp = deleteRevoke(unknownJti, sharerJwt);
        assertThat(resp.statusCode()).isEqualTo(404);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("code").asText()).isEqualTo("TOKEN_NOT_FOUND");
    }

    // ──────────────────────────────────────────────────────────────────────
    // (e2) revoke twice — second call must be idempotent · 204 ALREADY_REVOKED
    // ──────────────────────────────────────────────────────────────────────
    // Added in Tester Round 1 REJECT (adversarial.md): the implementation's
    // ALREADY_REVOKED branch claims idempotency but no testcase pinned it.
    // Without this, a regression could change 204 → 409 silently.
    @Test
    void revoke_twice_is_idempotent_returns_204_and_redis_set_heals() throws Exception {
        String sharerJwt = signSharerJwt(SHARER_A, 3600);
        HttpResponse<String> issueResp = postIssue(sharerJwt,
                issueBody("QUESTION", "wb_question:idempotent", null, false));
        String jti = objectMapper.readTree(issueResp.body()).path("jti").asText();

        // first revoke — SUCCESS
        assertThat(deleteRevoke(jti, sharerJwt).statusCode()).isEqualTo(204);

        // simulate a Redis-side drift: drain the SET so the second revoke must
        // heal it (mirrors a Redis flush / failover where DB was the survivor).
        redis.delete(REVOKED_SET_KEY);

        // second revoke — must still 204 (ALREADY_REVOKED idempotent path)
        assertThat(deleteRevoke(jti, sharerJwt).statusCode()).isEqualTo(204);

        // DB still status=3 · Redis re-populated with jti (heal-on-idempotent guarantee)
        Integer status = jdbc.queryForObject(
                "SELECT status FROM share_token WHERE jti = ?", Integer.class, jti);
        assertThat(status).isEqualTo(3);
        assertThat(redis.opsForSet().isMember(REVOKED_SET_KEY, jti))
                .as("idempotent revoke must SADD again to heal a missed Redis write")
                .isTrue();
    }

    // ──────────────────────────────────────────────────────────────────────
    // (h) round-trip — issue → GET 200 → revoke → GET 403 TOKEN_REVOKED
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void round_trip_get_after_revoke_returns_403_revoked() throws Exception {
        String sharerJwt = signSharerJwt(SHARER_A, 3600);
        HttpResponse<String> issueResp = postIssue(sharerJwt,
                issueBody("QUESTION", "wb_question:99", null, true));
        JsonNode issued = objectMapper.readTree(issueResp.body());
        String shareToken = issued.path("shareToken").asText();
        String jti = issued.path("jti").asText();

        // before revoke — receiver-side returns 200 SUCCESS
        HttpResponse<String> beforeGet = getReceiver(shareToken);
        assertThat(beforeGet.statusCode()).isEqualTo(200);

        // revoke
        HttpResponse<String> revokeResp = deleteRevoke(jti, sharerJwt);
        assertThat(revokeResp.statusCode()).isEqualTo(204);

        // after revoke — receiver-side returns 403 TOKEN_REVOKED (Redis hit short-circuits)
        HttpResponse<String> afterGet = getReceiver(shareToken);
        assertThat(afterGet.statusCode()).isEqualTo(403);
        JsonNode afterBody = objectMapper.readTree(afterGet.body());
        assertThat(afterBody.path("code").asText()).isEqualTo("TOKEN_REVOKED");
    }

    // ──────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────
    private String signSharerJwt(long studentId, long expDeltaSeconds) {
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

    private String issueBody(String shareType, String relationId, Long expiresInSec, Boolean allowClaim)
            throws Exception {
        Map<String, Object> m = new HashMap<>();
        m.put("shareType", shareType);
        m.put("relationId", relationId);
        if (expiresInSec != null) m.put("expiresInSec", expiresInSec);
        if (allowClaim != null) m.put("allowClaim", allowClaim);
        return objectMapper.writeValueAsString(m);
    }

    private HttpResponse<String> postIssue(String jwt, String body) throws Exception {
        HttpRequest.Builder b = HttpRequest.newBuilder()
                .uri(URI.create("http://127.0.0.1:" + port + "/api/share/tokens"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                .timeout(Duration.ofSeconds(10));
        if (jwt != null) b.header("Authorization", "Bearer " + jwt);
        return httpClient.send(b.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }

    private HttpResponse<String> deleteRevoke(String jti, String jwt) throws Exception {
        HttpRequest.Builder b = HttpRequest.newBuilder()
                .uri(URI.create("http://127.0.0.1:" + port + "/api/share/tokens/" + jti))
                .DELETE()
                .timeout(Duration.ofSeconds(10));
        if (jwt != null) b.header("Authorization", "Bearer " + jwt);
        return httpClient.send(b.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }

    private HttpResponse<String> getReceiver(String shareToken) throws Exception {
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create("http://127.0.0.1:" + port + "/api/share/" + shareToken))
                .header("Accept", "application/json")
                .GET()
                .timeout(Duration.ofSeconds(10))
                .build();
        return httpClient.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }
}
