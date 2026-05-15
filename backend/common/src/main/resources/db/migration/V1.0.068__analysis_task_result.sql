-- V1.0.067 · ai-analysis-service tables: analysis_task + analysis_result
-- Tracks AI analysis requests and their results (4-step pipeline: preprocess → OCR → diagnosis → solution)

CREATE TABLE IF NOT EXISTS analysis_task (
    id              BIGINT          PRIMARY KEY,
    task_id         VARCHAR(64)     NOT NULL,
    student_id      BIGINT,
    subject         VARCHAR(50),
    image_url       TEXT,
    status          VARCHAR(20)     NOT NULL DEFAULT 'ANALYZING',
    version         BIGINT          NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    CONSTRAINT uk_analysis_task_task_id UNIQUE (task_id),
    CONSTRAINT ck_analysis_task_status CHECK (status IN ('ANALYZING','DONE','FAILED','CANCELLED'))
);

CREATE INDEX IF NOT EXISTS idx_analysis_task_student_status ON analysis_task (student_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_analysis_task_created ON analysis_task (created_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS analysis_result (
    id              BIGINT          PRIMARY KEY,
    task_id         VARCHAR(64)     NOT NULL,
    stem            TEXT,
    error_reason    TEXT,
    steps           JSONB,
    explain_chunks  JSONB,
    provider        VARCHAR(50),
    model           VARCHAR(100),
    usage_tokens    INTEGER         DEFAULT 0,
    version         BIGINT          NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,
    CONSTRAINT fk_analysis_result_task FOREIGN KEY (task_id) REFERENCES analysis_task(task_id)
);

CREATE INDEX IF NOT EXISTS idx_analysis_result_task ON analysis_result (task_id) WHERE deleted_at IS NULL;
