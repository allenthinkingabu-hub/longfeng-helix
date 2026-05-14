-- review_plan · S5 复习计划核心表 · 7 nodes per wrong_item (T0..T6)
CREATE TABLE IF NOT EXISTS review_plan (
    id                    BIGINT       PRIMARY KEY,
    wrong_item_id         BIGINT       NOT NULL,
    student_id            BIGINT       NOT NULL,
    node_index            SMALLINT     NOT NULL,
    strategy_code         VARCHAR(32)  NOT NULL DEFAULT 'EBBINGHAUS_SM2',
    start_at              TIMESTAMPTZ,
    current_level         SMALLINT     NOT NULL DEFAULT 0,
    interval_index        SMALLINT     NOT NULL DEFAULT 0,
    ease_factor           NUMERIC(5,3) NOT NULL DEFAULT 2.500,
    status                SMALLINT     NOT NULL DEFAULT 0,
    next_due_at           TIMESTAMPTZ,
    completed_at          TIMESTAMPTZ,
    total_review          INTEGER      NOT NULL DEFAULT 0,
    total_forget          INTEGER      NOT NULL DEFAULT 0,
    consecutive_good_count SMALLINT    NOT NULL DEFAULT 0,
    mastery_score         INTEGER      NOT NULL DEFAULT 0,
    dispatch_version      BIGINT       NOT NULL DEFAULT 0,
    version               BIGINT       NOT NULL DEFAULT 0,
    deleted_at            TIMESTAMPTZ,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_plan_student_status ON review_plan (student_id, status);
CREATE INDEX IF NOT EXISTS idx_review_plan_due ON review_plan (status, next_due_at) WHERE deleted_at IS NULL;
