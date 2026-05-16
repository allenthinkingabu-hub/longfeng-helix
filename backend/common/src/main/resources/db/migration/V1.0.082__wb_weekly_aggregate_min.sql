-- SC-16 T01 · weekly_aggregate service 最小数据源
-- 建立 biz §10.14 字面要求的 wb_question / wb_review_record 表 (最小列子集)
-- 不照搬 master §4.2 / §4.6 全集 (那是未来 P-OBSERVER / wrongbook-service 完整实现的范围)
-- 本迁移仅覆盖 SC-16 weekly_aggregate 计算 4 字段 (masteryRate / sparkline / streak / newCount) 所需的最小列
-- master §4.2/§4.5/§4.6 完整 schema (含 embedding / knowledge_tags / level_code 等) 留给后续 P-OBSERVER / wrongbook-service-v2 task

-- ═══ 1. wb_question (错题卡 · 最小列 · 仅 weekly_aggregate 用 newCount 计数 + subject/kp 投影) ═══
CREATE TABLE IF NOT EXISTS wb_question (
    id             BIGINT       PRIMARY KEY,                  -- 应用侧雪花 ID (与既有 wrong_item 同生成器)
    owner_id       BIGINT       NOT NULL,                     -- 学生 ID · biz §10.14 字段 4 字面引用
    subject_code   VARCHAR(16)  NOT NULL,                     -- math / physics / english ...
    kp_id          VARCHAR(64),                                -- 知识点 ID (KP-382 等) · 用于 weakKPs 聚合
    kp_name        VARCHAR(128),                              -- 知识点名称 · weakKPs.kpName 投影
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),       -- biz §10.14 newCount 计数依据
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at     TIMESTAMPTZ,
    CONSTRAINT ck_wb_q_subject CHECK (subject_code IN (
        'math','physics','chinese','english','biology',
        'chemistry','history','geography','politics'
    ))
);

CREATE INDEX IF NOT EXISTS idx_wb_q_owner_created
    ON wb_question (owner_id, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_wb_q_kp
    ON wb_question (owner_id, kp_id)
    WHERE deleted_at IS NULL AND kp_id IS NOT NULL;

-- ═══ 2. wb_review_record (执行流水 · biz §4.6 速查 + §10.14 字段 1/2/3 字面字段集) ═══
-- 注: biz §10.14 字面用 reviewed_at / grade / duration_sec 列 · 与 master §4.6 (start_at/end_at/duration_ms/self_rating) drift
-- 选取 biz §10.14 字面列名 (因 §10.14 是 weekly_aggregate 的字面规约 · spec drift surface 在 bugs-found.md)
CREATE TABLE IF NOT EXISTS wb_review_record (
    id             BIGINT       PRIMARY KEY,
    student_id     BIGINT       NOT NULL,                     -- biz §10.14 字段 1/2/3 字面引用
    question_id    BIGINT       NOT NULL,                     -- FK to wb_question (业务侧 · 不挂硬外键 · 跨 module read-only)
    reviewed_at    TIMESTAMPTZ  NOT NULL,                     -- biz §10.14 字段 1/2 字面 (UTC 存 · student_tz 转算)
    grade          VARCHAR(16),                                -- biz §10.14 字段 1 字面 (MASTERED / FORGOT / NULL=未评)
    duration_sec   INTEGER,                                    -- biz §10.14 stats.reviewedDurationMin 计算源 (sum/60)
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT ck_wb_rec_grade CHECK (grade IS NULL OR grade IN ('MASTERED', 'FORGOT', 'PARTIAL'))
);

CREATE INDEX IF NOT EXISTS idx_wb_rec_student_reviewed
    ON wb_review_record (student_id, reviewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_wb_rec_student_grade_reviewed
    ON wb_review_record (student_id, grade, reviewed_at DESC)
    WHERE grade IS NOT NULL;
