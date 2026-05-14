-- review_outcome · 复习结果流水表 · 每次 complete 写一行审计
CREATE TABLE IF NOT EXISTS review_outcome (
    id                   BIGINT       PRIMARY KEY,
    plan_id              BIGINT       NOT NULL,
    wrong_item_id        BIGINT       NOT NULL,
    user_id              BIGINT       NOT NULL,
    quality              SMALLINT     NOT NULL,
    ease_factor_before   NUMERIC(5,3),
    ease_factor_after    NUMERIC(5,3),
    interval_days_before INTEGER,
    interval_days_after  INTEGER,
    completed_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_outcome_plan ON review_outcome (plan_id, completed_at DESC);
