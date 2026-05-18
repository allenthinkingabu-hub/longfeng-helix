package com.longfeng.anonymousservice;

import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * IT backbone — points Spring Boot at the sandbox containers running on the
 * dev box (per CLAUDE.md "self-Ops" mandate · Docker is already running):
 *
 * <ul>
 *   <li>PostgreSQL localhost:15432/wrongbook (user=longfeng, password=longfeng_dev)
 *   <li>Redis      localhost:16379
 * </ul>
 *
 * <p>This matches auth-service / file-service's IntegrationTestBase pattern
 * verbatim. Flyway IS enabled here against a separate
 * {@code flyway_schema_history_anonymous} history table so the
 * V20260421_02__init_anonymous.sql migration is replayed without colliding
 * with the common module's own flyway_schema_history table.
 */
public abstract class IntegrationTestBase {

    protected static final String DB_URL =
            "jdbc:postgresql://127.0.0.1:15432/wrongbook";
    protected static final String DB_USER = "longfeng";
    protected static final String DB_PASSWORD = "longfeng_dev";

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", () -> DB_URL);
        r.add("spring.datasource.username", () -> DB_USER);
        r.add("spring.datasource.password", () -> DB_PASSWORD);
        r.add("spring.flyway.enabled", () -> "true");
        r.add("spring.flyway.locations", () -> "classpath:db/anonymous");
        r.add("spring.flyway.table", () -> "flyway_schema_history_anonymous");
        r.add("spring.flyway.baseline-on-migrate", () -> "true");
        r.add("spring.flyway.ignore-migration-patterns", () -> "*:missing");
        r.add("spring.data.redis.host", () -> "127.0.0.1");
        r.add("spring.data.redis.port", () -> "16379");
        // SC-12-T06 fix · Spring's TestContext cache keeps ~11 distinct
        // ApplicationContexts alive across this module's IT suite (each unique
        // @DynamicPropertySource set is a fresh context). With HikariCP's
        // default pool of 10 connections per context, the team-1-pg sandbox
        // (max_connections=100) refused new clients during `mvn verify`
        // once T06 added two more contexts (E2EIT + DownE2EIT).
        // Pinning maximum-pool-size to 4 caps total IT-suite PG consumption
        // at ~44 connections — comfortably under the sandbox limit and well
        // above what any single IT class needs (each IT issues ~3-5 in-flight
        // HTTP→JPA roundtrips concurrently). Identical fix file-service uses.
        r.add("spring.datasource.hikari.maximum-pool-size", () -> "4");
        r.add("spring.datasource.hikari.minimum-idle", () -> "1");
    }
}
