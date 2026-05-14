-- review_plan_outbox · Outbox 事件暂存 · ADR 0005 · Relay 扫表发 MQ
CREATE TABLE IF NOT EXISTS review_plan_outbox (
    id            BIGINT       PRIMARY KEY,
    plan_id       BIGINT       NOT NULL,
    event_type    VARCHAR(32)  NOT NULL,
    payload       JSONB        NOT NULL DEFAULT '{}',
    status        VARCHAR(16)  NOT NULL DEFAULT 'pending',
    retry_count   SMALLINT     NOT NULL DEFAULT 0,
    dispatched_at TIMESTAMPTZ,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT review_plan_outbox_event_type_check CHECK (
        event_type IN ('due','completed','mastered','opened','graded')
    )
);

CREATE INDEX IF NOT EXISTS idx_review_plan_outbox_status_created
    ON review_plan_outbox (status, created_at) WHERE status = 'pending';
