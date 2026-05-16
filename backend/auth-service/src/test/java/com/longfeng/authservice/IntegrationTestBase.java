package com.longfeng.authservice;

import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * IT backbone — points Spring Boot at the sandbox containers running on dev box:
 *
 * <ul>
 *   <li>PostgreSQL localhost:15432/wrongbook (user=longfeng, password=longfeng_dev)
 *   <li>Redis      localhost:16379
 * </ul>
 *
 * <p>This matches file-service's IntegrationTestBase pattern verbatim. Flyway IS
 * enabled here (separate {@code flyway_schema_history_auth} table) so the
 * V20260516_01__auth_user.sql migration is replayed and the test fixture row
 * is materialized before any test runs.
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
        r.add("spring.flyway.locations", () -> "classpath:db/auth");
        r.add("spring.flyway.table", () -> "flyway_schema_history_auth");
        r.add("spring.flyway.baseline-on-migrate", () -> "true");
        r.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
        r.add("spring.data.redis.host", () -> "127.0.0.1");
        r.add("spring.data.redis.port", () -> "16379");
    }
}
