package com.longfeng.calendar;

import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * S5 IT backbone · 复用常驻 sandbox 容器 (PG:15435 · inflight sandbox config).
 *
 * <p>Pattern aligned with file-service IntegrationTestBase.
 * Flyway disabled — sandbox schema is managed externally + common JAR migrations
 * reference tables (review_plan_outbox etc.) that don't exist in a calendar-only DB.
 * Hibernate ddl-auto=none — trust sandbox schema.
 * Table creation done via JDBC in test @BeforeEach.
 */
public abstract class IntegrationTestBase {

    protected static final String DB_URL = "jdbc:postgresql://127.0.0.1:15435/wrongbook";
    protected static final String DB_USER = "longfeng";
    protected static final String DB_PASSWORD = "longfeng_dev";

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", () -> DB_URL);
        r.add("spring.datasource.username", () -> DB_USER);
        r.add("spring.datasource.password", () -> DB_PASSWORD);
        // Disable Flyway: common JAR migrations reference tables from other services
        r.add("spring.flyway.enabled", () -> "false");
        r.add("spring.jpa.hibernate.ddl-auto", () -> "none");
        r.add("spring.cache.type", () -> "none");
    }

    /** DDL for calendar_event table — run from @BeforeEach to ensure schema exists. */
    protected static final String CREATE_TABLE_DDL = """
            CREATE TABLE IF NOT EXISTS calendar_event (
                id              BIGINT          NOT NULL,
                relation_type   VARCHAR(32)     NOT NULL,
                relation_id     VARCHAR(128)    NOT NULL,
                owner_id        BIGINT          NOT NULL,
                title           VARCHAR(256)    NOT NULL,
                start_at        TIMESTAMPTZ     NOT NULL,
                end_at          TIMESTAMPTZ     NOT NULL,
                state           VARCHAR(32)     NOT NULL DEFAULT 'SCHEDULED',
                color_tag       VARCHAR(16),
                source          VARCHAR(64),
                idempotency_key VARCHAR(256),
                subscribed      BOOLEAN         NOT NULL DEFAULT FALSE,
                subscribed_at   TIMESTAMPTZ,
                version         BIGINT          NOT NULL DEFAULT 0,
                created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
                updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
                deleted_at      TIMESTAMPTZ,
                CONSTRAINT pk_calendar_event PRIMARY KEY (id)
            )
            """;

    protected static final String CREATE_INDEXES_DDL = """
            CREATE UNIQUE INDEX IF NOT EXISTS uk_calendar_event_idem_key
                ON calendar_event (idempotency_key) WHERE deleted_at IS NULL;
            CREATE INDEX IF NOT EXISTS idx_calendar_event_owner_start
                ON calendar_event (owner_id, start_at) WHERE deleted_at IS NULL;
            CREATE INDEX IF NOT EXISTS idx_calendar_event_relation
                ON calendar_event (relation_type, relation_id) WHERE deleted_at IS NULL
            """;
}
