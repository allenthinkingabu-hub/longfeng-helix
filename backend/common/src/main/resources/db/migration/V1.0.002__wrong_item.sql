-- wrong_item · 错题条目表 · review_plan 的 FK 目标
CREATE TABLE IF NOT EXISTS wrong_item (
    id           BIGINT       PRIMARY KEY,
    student_id   BIGINT       NOT NULL,
    subject      VARCHAR(32),
    source_type  SMALLINT     NOT NULL DEFAULT 1,
    status       SMALLINT     NOT NULL DEFAULT 0,
    mastery      SMALLINT     NOT NULL DEFAULT 0,
    version      BIGINT       NOT NULL DEFAULT 0,
    deleted_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wrong_item_student ON wrong_item (student_id);
