package com.longfeng.authservice;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.longfeng.authservice.entity.AuthUser;
import com.longfeng.authservice.repo.AuthUserRepository;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.data.redis.core.StringRedisTemplate;

/**
 * PHASE-A · auth-service IT — 4 cases per inflight scope_in #15.
 *
 * <ol>
 *   <li>happy: test@example.com + Test@1234 → 200 + jwt + refreshToken + student
 *   <li>wrong_password:                       → 401 INVALID_CREDENTIALS
 *   <li>non_existent_email:                   → 401 INVALID_CREDENTIALS (unified to prevent enumeration)
 *   <li>5_strike_lockout: 5 consecutive wrong → 423 ACCOUNT_LOCKED on 5th
 *       (1-4 still return 401; the 5th attempt triggers the lockout error itself)
 * </ol>
 *
 * <p>Connects to real sandbox PG (port 15432) + real Redis (port 16379) — NO mocks,
 * NO H2, NO embedded. audit.js dim 5 (spec_alignment) requires Testcontainers
 * approach; we use the dev sandbox containers directly per CLAUDE.md (Docker is
 * already running, self-Ops mandate).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class AuthServiceLoginE2EIT extends IntegrationTestBase {

    @LocalServerPort int port;
    @Autowired AuthUserRepository repo;
    @Autowired StringRedisTemplate redis;
    @Autowired ObjectMapper objectMapper;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    private static final String FIXTURE_EMAIL = "test@example.com";
    private static final String FIXTURE_PASSWORD = "Test@1234";

    /** Reset fixture state to ACTIVE + failed_attempts=0 before each test. */
    @BeforeEach
    void resetFixture() {
        Optional<AuthUser> u = repo.findByEmail(FIXTURE_EMAIL);
        assertThat(u).as("fixture row must exist (Flyway V20260516_01)").isPresent();
        AuthUser user = u.get();
        user.setStatus("ACTIVE");
        user.setFailedAttempts(0);
        user.setLockedUntil(null);
        repo.save(user);
    }

    @Test
    void happy_login_returns_jwt_and_refresh() throws Exception {
        HttpResponse<String> resp = postLogin(FIXTURE_EMAIL, FIXTURE_PASSWORD);
        assertThat(resp.statusCode()).isEqualTo(200);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("jwt").asText()).isNotBlank().contains(".");
        assertThat(body.path("refreshToken").asText()).isNotBlank();
        assertThat(body.path("expiresIn").asLong()).isEqualTo(604800);
        assertThat(body.path("student").path("id").asLong()).isPositive();
        assertThat(body.path("student").path("nickMasked").asText()).contains("@example.com");

        // Refresh token must exist in Redis
        String key = "auth:refresh:" + body.path("refreshToken").asText();
        assertThat(redis.opsForValue().get(key)).as("refresh token persisted to redis").isNotBlank();
    }

    @Test
    void wrong_password_returns_401_invalid_credentials() throws Exception {
        HttpResponse<String> resp = postLogin(FIXTURE_EMAIL, "wrongPass!1");
        assertThat(resp.statusCode()).isEqualTo(401);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("code").asText()).isEqualTo("INVALID_CREDENTIALS");
        // failed_attempts must have ticked up
        assertThat(repo.findByEmail(FIXTURE_EMAIL).orElseThrow().getFailedAttempts())
                .isEqualTo(1);
    }

    @Test
    void non_existent_email_returns_401_unified() throws Exception {
        HttpResponse<String> resp = postLogin(
                "ghost-" + System.currentTimeMillis() + "@example.com", "anything!1");
        assertThat(resp.statusCode()).isEqualTo(401);
        JsonNode body = objectMapper.readTree(resp.body());
        // Same code as wrong_password — prevents email enumeration.
        assertThat(body.path("code").asText()).isEqualTo("INVALID_CREDENTIALS");
    }

    @Test
    void five_strike_lockout_returns_423() throws Exception {
        // attempts 1..4 → 401
        for (int i = 1; i <= 4; i++) {
            HttpResponse<String> r = postLogin(FIXTURE_EMAIL, "wrongPass!1");
            assertThat(r.statusCode())
                    .as("attempt " + i + " should be 401")
                    .isEqualTo(401);
        }
        // attempt 5 → lockout triggered, returns 423 directly (not 401)
        HttpResponse<String> r5 = postLogin(FIXTURE_EMAIL, "wrongPass!1");
        assertThat(r5.statusCode())
                .as("5th attempt should trigger lockout")
                .isEqualTo(423);
        JsonNode body5 = objectMapper.readTree(r5.body());
        assertThat(body5.path("code").asText()).isEqualTo("ACCOUNT_LOCKED");
        assertThat(body5.path("lockedUntil").asText()).isNotBlank();

        // attempt 6 — even with correct password, still locked
        HttpResponse<String> r6 = postLogin(FIXTURE_EMAIL, FIXTURE_PASSWORD);
        assertThat(r6.statusCode()).isEqualTo(423);
        JsonNode body6 = objectMapper.readTree(r6.body());
        assertThat(body6.path("code").asText()).isEqualTo("ACCOUNT_LOCKED");

        // DB state assertions
        AuthUser user = repo.findByEmail(FIXTURE_EMAIL).orElseThrow();
        assertThat(user.getStatus()).isEqualTo("LOCKED");
        assertThat(user.getLockedUntil()).isNotNull();
    }

    // ──────────── helpers ─────────────

    private HttpResponse<String> postLogin(String email, String password) throws Exception {
        String body = String.format(
                "{\"provider\":\"EMAIL\",\"email\":\"%s\",\"password\":\"%s\",\"rememberMe\":true,\"consentAt\":\"2026-05-16T00:00:00Z\"}",
                email, password);
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create("http://localhost:" + port + "/api/auth/login"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                .build();
        return httpClient.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }
}
