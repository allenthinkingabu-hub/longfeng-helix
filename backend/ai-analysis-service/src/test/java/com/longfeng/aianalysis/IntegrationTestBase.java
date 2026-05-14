package com.longfeng.aianalysis;

import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * ai-analysis-service IT backbone · connects to sandbox resident containers:
 * <ul>
 *   <li>PostgreSQL 15434 · sandbox PG</li>
 *   <li>Redis 16381 · sandbox Redis</li>
 * </ul>
 * Flyway disabled (sandbox schema managed externally).
 * Hibernate ddl-auto=none (trust sandbox schema).
 */
public abstract class IntegrationTestBase {

    protected static final String DB_URL = "jdbc:postgresql://127.0.0.1:15434/wrongbook";
    protected static final String DB_USER = "longfeng";
    protected static final String DB_PASSWORD = "longfeng_dev";

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", () -> DB_URL);
        r.add("spring.datasource.username", () -> DB_USER);
        r.add("spring.datasource.password", () -> DB_PASSWORD);
        r.add("spring.flyway.url", () -> DB_URL);
        r.add("spring.flyway.user", () -> DB_USER);
        r.add("spring.flyway.password", () -> DB_PASSWORD);
        r.add("spring.flyway.locations", () -> "classpath:db/migration");
        // Disable Flyway in IT: sandbox schema managed by ops scripts
        r.add("spring.flyway.enabled", () -> "false");
        // Trust sandbox schema, no Hibernate validation
        r.add("spring.jpa.hibernate.ddl-auto", () -> "none");
        r.add("spring.cache.type", () -> "none");
        // Redis sandbox
        r.add("spring.data.redis.host", () -> "127.0.0.1");
        r.add("spring.data.redis.port", () -> "16381");
    }
}
