-- S5 · calendar-core · calendar_event table
-- Feign target for review-plan-service batch create + P09 subscribe
-- biz §2A.4 S5 + P09-review-done.spec.md §5 #3

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
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_calendar_event_idem_key
    ON calendar_event (idempotency_key) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_event_owner_start
    ON calendar_event (owner_id, start_at) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_event_relation
    ON calendar_event (relation_type, relation_id) WHERE deleted_at IS NULL;

COMMENT ON TABLE calendar_event IS
    'S5 calendar-core 日历事件 · review-plan-service Feign /internal/events/batch 写入 · P09 subscribe';
COMMENT ON COLUMN calendar_event.relation_type IS 'STUDY / EXAM / CUSTOM';
COMMENT ON COLUMN calendar_event.relation_id IS '双向指针 e.g. question:123:node:456';
COMMENT ON COLUMN calendar_event.state IS 'SCHEDULED / COMPLETED / CANCELLED';
COMMENT ON COLUMN calendar_event.idempotency_key IS '幂等键 = relation_id (batch create 场景)';
