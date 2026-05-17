package com.longfeng.anonymousservice;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * PHASE-A-ANON · anonymous-service skeleton IT.
 *
 * <p>Five test cases covering every DoD assertion in inflight scope_in 10–12:
 *
 * <ol>
 *   <li>{@code actuator_health_returns_200_up}              — /actuator/health is UP
 *   <li>{@code actuator_info_carries_application_name}      — /actuator/info → name=anonymous-service
 *   <li>{@code flyway_history_records_v20260421_02}         — flyway_schema_history_anonymous row exists
 *   <li>{@code all_7_anonymous_tables_exist_with_columns}   — 7 tables present + critical columns + indices
 *   <li>{@code pnpm_typecheck_api_contracts_passes}         — cross-language guard rail
 * </ol>
 *
 * <p>Connects to real sandbox PG (port 15432) + real Redis (port 16379). NO mocks,
 * NO H2, NO embedded — per audit.js dim 5 (spec_alignment) and PHASE-A-LOGIN-H5 precedent.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class AnonymousServiceSkeletonE2EIT extends IntegrationTestBase {

    @LocalServerPort int port;
    @Autowired DataSource dataSource;
    @Autowired ObjectMapper objectMapper;

    /** All 7 anonymous-state tables per biz §4.10–§4.13. */
    private static final List<String> ANON_TABLES = Arrays.asList(
            "guest_session",
            "guest_rate_bucket",
            "share_token",
            "share_token_audit",
            "observer_invite",
            "observer_session",
            "account_device"
    );

    /** HTTP client matching auth-service IT — avoids TestRestTemplate's 4xx-as-throwable behaviour. */
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .build();

    // ──────────────────────────────────────────────────────────────────────
    // Test 1 · /actuator/health → 200 {"status":"UP"}
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void actuator_health_returns_200_up() throws Exception {
        HttpResponse<String> resp = get("/actuator/health");
        assertThat(resp.statusCode())
                .as("/actuator/health must return 200")
                .isEqualTo(200);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("status").asText())
                .as("/actuator/health body must include status: UP")
                .isEqualTo("UP");
    }

    // ──────────────────────────────────────────────────────────────────────
    // Test 2 · /actuator/info → name=anonymous-service
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void actuator_info_carries_application_name() throws Exception {
        HttpResponse<String> resp = get("/actuator/info");
        assertThat(resp.statusCode())
                .as("/actuator/info must return 200 (enabled via management.info.env)")
                .isEqualTo(200);
        JsonNode body = objectMapper.readTree(resp.body());
        assertThat(body.path("app").path("name").asText())
                .as("info.app.name must be anonymous-service")
                .isEqualTo("anonymous-service");
    }

    // ──────────────────────────────────────────────────────────────────────
    // Test 3 · Flyway recorded the V20260421_02 migration
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void flyway_history_records_v20260421_02() {
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM flyway_schema_history_anonymous WHERE version = ?",
                Integer.class,
                "20260421.02"
        );
        assertThat(count)
                .as("flyway_schema_history_anonymous must contain exactly 1 row for V20260421_02")
                .isEqualTo(1);

        // Also assert the row points at the right script + succeeded
        String script = jdbc.queryForObject(
                "SELECT script FROM flyway_schema_history_anonymous WHERE version = ?",
                String.class,
                "20260421.02"
        );
        assertThat(script).contains("V20260421_02__init_anonymous.sql");

        Boolean success = jdbc.queryForObject(
                "SELECT success FROM flyway_schema_history_anonymous WHERE version = ?",
                Boolean.class,
                "20260421.02"
        );
        assertThat(success).isTrue();
    }

    // ──────────────────────────────────────────────────────────────────────
    // Test 4 · 7 tables exist + key columns + key indices (biz §4.10–§4.13)
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void all_7_anonymous_tables_exist_with_columns() {
        JdbcTemplate jdbc = new JdbcTemplate(dataSource);

        // 4a · all 7 tables present
        List<String> found = jdbc.queryForList(
                "SELECT table_name FROM information_schema.tables "
                        + "WHERE table_schema = 'public' AND table_name = ANY(?)",
                String.class,
                (Object) ANON_TABLES.toArray(new String[0])
        );
        assertThat(found)
                .as("All 7 anonymous-state tables must exist in public schema (biz §4.10–§4.13)")
                .containsExactlyInAnyOrderElementsOf(ANON_TABLES);

        // 4b · guest_session must have the biz-mandated columns
        Set<String> guestCols = new HashSet<>(jdbc.queryForList(
                "SELECT column_name FROM information_schema.columns "
                        + "WHERE table_name = 'guest_session'",
                String.class));
        assertThat(guestCols).as("guest_session columns vs biz §4.10").contains(
                "id", "device_fp", "ip_hash", "ua", "entry_source", "experiment_bucket",
                "image_tmp_url", "analysis_result_json", "consent_at", "consent_type",
                "status", "claimed_by_student_id", "claimed_question_id",
                "created_at", "expires_at", "claimed_at");

        // 4c · share_token columns (biz §4.11)
        Set<String> shareCols = new HashSet<>(jdbc.queryForList(
                "SELECT column_name FROM information_schema.columns "
                        + "WHERE table_name = 'share_token'",
                String.class));
        assertThat(shareCols).as("share_token columns vs biz §4.11").contains(
                "id", "jti", "sharer_student_id", "share_type", "relation_id",
                "allow_claim", "usage_limit", "usage_count", "status",
                "created_at", "expires_at");

        // 4d · observer_session columns (biz §4.12)
        Set<String> obsCols = new HashSet<>(jdbc.queryForList(
                "SELECT column_name FROM information_schema.columns "
                        + "WHERE table_name = 'observer_session'",
                String.class));
        assertThat(obsCols).as("observer_session columns vs biz §4.12").contains(
                "id", "jti", "student_id", "role", "device_fp", "status",
                "issued_at", "last_seen_at", "expires_at", "revoked_by_student_at");

        // 4e · account_device unique index uq_account_device (biz §4.13)
        Set<String> indices = new HashSet<>(jdbc.queryForList(
                "SELECT indexname FROM pg_indexes "
                        + "WHERE schemaname = 'public' "
                        + "  AND tablename IN ('guest_session','share_token','share_token_audit',"
                        + "                    'observer_session','account_device','guest_rate_bucket')",
                String.class));
        assertThat(indices).as("Critical indices per biz §4.10–§4.13").contains(
                "idx_guest_session_fp_day",
                "idx_guest_session_expires",
                "uq_guest_claim",
                "uq_guest_rate_bucket_fp_ip_date",
                "idx_share_token_sharer",
                "idx_share_audit_jti",
                "idx_observer_session_student",
                "uq_account_device",
                "idx_account_device_fp");

        // 4f · share_token.jti UNIQUE constraint (biz §4.11 "NOT NULL UNIQUE")
        Integer uqShareJti = jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.table_constraints tc "
                        + "JOIN information_schema.constraint_column_usage cu USING (constraint_name) "
                        + "WHERE tc.table_name = 'share_token' "
                        + "  AND tc.constraint_type = 'UNIQUE' "
                        + "  AND cu.column_name = 'jti'",
                Integer.class);
        assertThat(uqShareJti).isGreaterThanOrEqualTo(1);

        // 4g · guest_rate_bucket.count CHECK constraint (count <= 1 per biz §4.10 末尾)
        Integer ckCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.check_constraints "
                        + "WHERE constraint_name = 'ck_guest_rate_bucket_count_le_1'",
                Integer.class);
        assertThat(ckCount)
                .as("guest_rate_bucket must enforce count <= 1 (biz §4.10 末尾 line 1693)")
                .isEqualTo(1);
    }

    // ──────────────────────────────────────────────────────────────────────
    // Test 5 · cross-language gate · pnpm typecheck of api-contracts must pass
    // ──────────────────────────────────────────────────────────────────────
    @Test
    void pnpm_typecheck_api_contracts_passes() throws Exception {
        File repoRoot = locateRepoRoot();
        File pkg = new File(repoRoot, "frontend/packages/api-contracts");
        assertThat(pkg).as("api-contracts package must exist at " + pkg).isDirectory();

        // Run from frontend root so pnpm-workspace resolves @longfeng/api-contracts.
        ProcessBuilder pb = new ProcessBuilder("pnpm", "-F", "@longfeng/api-contracts", "typecheck")
                .directory(new File(repoRoot, "frontend"))
                .redirectErrorStream(true);
        Process proc = pb.start();

        StringBuilder out = new StringBuilder();
        try (BufferedReader br = new BufferedReader(
                new InputStreamReader(proc.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = br.readLine()) != null) {
                out.append(line).append('\n');
            }
        }
        boolean finished = proc.waitFor(180, java.util.concurrent.TimeUnit.SECONDS);
        assertThat(finished).as("pnpm typecheck timed out (>180s)").isTrue();
        int exit = proc.exitValue();

        if (exit != 0) {
            // Surface the full output so REDO loops can see exactly which schema broke.
            throw new AssertionError(
                    "pnpm -F @longfeng/api-contracts typecheck failed (exit=" + exit + ")\n"
                            + "----- output -----\n" + out + "------------------\n");
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────────────
    private HttpResponse<String> get(String path) throws IOException, InterruptedException {
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create("http://127.0.0.1:" + port + path))
                .timeout(Duration.ofSeconds(10))
                .GET()
                .build();
        return httpClient.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }

    /**
     * Walk up the working directory looking for the repo root (which contains a
     * {@code frontend/pnpm-workspace.yaml}). Works from both Maven default and IDE runs.
     */
    private static File locateRepoRoot() {
        File dir = new File(System.getProperty("user.dir")).getAbsoluteFile();
        List<File> tried = new ArrayList<>();
        for (int i = 0; i < 6 && dir != null; i++) {
            tried.add(dir);
            File marker = new File(dir, "frontend/pnpm-workspace.yaml");
            if (marker.isFile()) {
                return dir;
            }
            dir = dir.getParentFile();
        }
        throw new IllegalStateException(
                "Cannot locate repo root (looked for frontend/pnpm-workspace.yaml); tried: " + tried);
    }
}
