package com.longfeng.wrongbook;

import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * wrongbook-service IT backbone · 接 sandbox 常驻容器
 * PG: team-2-pg @ 15433 · Redis: team-2-redis @ 16380
 * Flyway enabled (空库, 迁移从 V1.0.067 开始)
 */
public abstract class IntegrationTestBase {

    protected static final String DB_URL = "jdbc:postgresql://127.0.0.1:15433/wrongbook?stringtype=unspecified";
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
        r.add("spring.flyway.enabled", () -> "true");
        r.add("spring.flyway.locations", () -> "classpath:db/wrongbook");
        r.add("spring.jpa.hibernate.ddl-auto", () -> "validate");
        r.add("app.snowflake.worker-id", () -> "17");
    }
}
