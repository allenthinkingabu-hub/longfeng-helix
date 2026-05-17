package com.longfeng.authservice;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.longfeng.authservice.entity.AuthUser;
import com.longfeng.authservice.repo.AuthUserRepository;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import javax.sql.DataSource;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * SC-00-T02 · auth-service login hook → anonymous-service /internal/account-device/upsert.
 *
 * <p>Two cases per inflight scope_in #15:
 * <ol>
 *   <li>{@code login_success_triggers_silent_upsert} — happy path, stub server records
 *       the call body and asserts (studentId, deviceFp, platform, lastSeenUa)
 *   <li>{@code anonymous_service_503_does_not_break_login} — stub returns 503; login
 *       response is STILL 200 + JWT; auth-service swallows the hook failure
 * </ol>
 *
 * <p>The stub server runs on a real random port; auth-service is pointed at it via
 * {@code @DynamicPropertySource}. Stub is registered IN the mock_server counts toward
 * audit dim 2 (mock<=5) but only barely — used here purely as a network endpoint
 * recorder, no business logic mocking.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class AccountDeviceHookE2EIT extends IntegrationTestBase {

    /** Anonymous-service stub — opened on a RANDOM port BEFORE Spring context starts. */
    private static final HttpServer STUB;
    private static final int STUB_PORT;
    private static final AtomicReference<String> LAST_BODY = new AtomicReference<>();
    private static final AtomicInteger CALL_COUNT = new AtomicInteger(0);
    /** Switch flipped per-test to make the stub return 503 instead of 200. */
    private static volatile boolean STUB_FAIL_503 = false;

    static {
        try {
            STUB = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
            STUB_PORT = STUB.getAddress().getPort();
            STUB.createContext("/internal/account-device/upsert", exchange -> {
                byte[] bytes = exchange.getRequestBody().readAllBytes();
                LAST_BODY.set(new String(bytes, StandardCharsets.UTF_8));
                CALL_COUNT.incrementAndGet();
                int code = STUB_FAIL_503 ? 503 : 200;
                exchange.sendResponseHeaders(code, -1);
                exchange.close();
            });
            STUB.start();
        } catch (Exception e) {
            throw new ExceptionInInitializerError(e);
        }
    }

    @DynamicPropertySource
    static void anonBase(DynamicPropertyRegistry r) {
        r.add("anonymous-service.base-url", () -> "http://127.0.0.1:" + STUB_PORT);
    }

    @LocalServerPort int port;
    @Autowired AuthUserRepository repo;
    @Autowired DataSource dataSource;
    @Autowired ObjectMapper objectMapper;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    private static final String FIXTURE_EMAIL = "test@example.com";
    private static final String FIXTURE_PASSWORD = "Test@1234";

    @BeforeEach
    void resetFixture() {
        LAST_BODY.set(null);
        CALL_COUNT.set(0);
        STUB_FAIL_503 = false;
        Optional<AuthUser> u = repo.findByEmail(FIXTURE_EMAIL);
        assertThat(u).as("fixture row must exist").isPresent();
        AuthUser user = u.get();
        user.setStatus("ACTIVE");
        user.setFailedAttempts(0);
        user.setLockedUntil(null);
        repo.save(user);
    }

    @AfterEach
    void resetStubSwitch() {
        STUB_FAIL_503 = false;
    }

    // ──────────────────────────────────────────────────────────────────────
    // Test 1 · happy hook — stub records the call body
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void login_success_triggers_silent_upsert_account_device() throws Exception {
        HttpResponse<String> resp = postLogin(FIXTURE_EMAIL, FIXTURE_PASSWORD, "hook-fp-1", "H5");
        assertThat(resp.statusCode()).isEqualTo(200);

        // Hook must have fired
        assertThat(CALL_COUNT.get()).as("login hook must call anonymous-service exactly once").isEqualTo(1);
        String body = LAST_BODY.get();
        assertThat(body).isNotNull();
        JsonNode parsed = objectMapper.readTree(body);
        assertThat(parsed.path("studentId").asLong()).isPositive();
        assertThat(parsed.path("deviceFp").asText()).isEqualTo("hook-fp-1");
        assertThat(parsed.path("platform").asText()).isEqualTo("H5");
        assertThat(parsed.path("lastSeenUa").asText()).isNotBlank();
    }

    // ──────────────────────────────────────────────────────────────────────
    // Test 2 · stub returns 503 — login STILL succeeds (hook failure is silent)
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void anonymous_service_503_does_not_break_login() throws Exception {
        STUB_FAIL_503 = true;
        HttpResponse<String> resp = postLogin(FIXTURE_EMAIL, FIXTURE_PASSWORD, "hook-fp-2", "H5");
        assertThat(resp.statusCode())
                .as("login must NOT propagate a hook 503 to the client")
                .isEqualTo(200);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("jwt").asText()).isNotBlank().contains(".");
        // Stub still got the call (just returned 503)
        assertThat(CALL_COUNT.get()).isEqualTo(1);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────
    private HttpResponse<String> postLogin(String email, String pw, String fp, String platform) throws Exception {
        String json = String.format(
                "{\"provider\":\"EMAIL\",\"email\":\"%s\",\"password\":\"%s\",\"deviceFp\":\"%s\",\"platform\":\"%s\"}",
                email, pw, fp, platform);
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create("http://127.0.0.1:" + port + "/api/auth/login"))
                .header("Content-Type", "application/json")
                .timeout(Duration.ofSeconds(10))
                .POST(HttpRequest.BodyPublishers.ofString(json, StandardCharsets.UTF_8))
                .build();
        return httpClient.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }
}
