-- PHASE-A · wrongbook-service 业务表 · wrong_item + wrong_item_tag + wrong_attempt + wrong_item_outbox + idem_key
-- 对齐 A01-wrongbook-schema.md §1.1 wrong_item 字段清单 + §1.2 枚举值 + §1.3 协同表

-- ═══ 1. wrong_item (主错题表 · 6 态状态机) ═══
CREATE TABLE IF NOT EXISTS wrong_item (
    id               BIGINT       PRIMARY KEY,  -- 应用侧雪花 ID
    student_id       BIGINT       NOT NULL,
    subject          VARCHAR(16)  NOT NULL,
    grade_code       VARCHAR(16),
    source_type      SMALLINT     NOT NULL,
    origin_image_key VARCHAR(512),
    processed_image_key VARCHAR(512),
    ocr_text         TEXT,
    stem_text        TEXT,
    status           SMALLINT     NOT NULL DEFAULT 0,
    mastery          SMALLINT     NOT NULL DEFAULT 0,
    difficulty       SMALLINT,
    mastered_at      TIMESTAMPTZ,
    version          BIGINT       NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted_at       TIMESTAMPTZ,

    CONSTRAINT ck_wrong_status   CHECK (status IN (0,1,2,3,8,9)),
    CONSTRAINT ck_wrong_mastery  CHECK (mastery BETWEEN 0 AND 2),
    CONSTRAINT ck_wrong_source   CHECK (source_type BETWEEN 1 AND 5),
    CONSTRAINT ck_wrong_subject  CHECK (subject IN (
        'math','physics','chinese','english','biology',
        'chemistry','history','geography','politics'
    ))
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_wrong_student_status
    ON wrong_item (student_id, status, created_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_wrong_subject
    ON wrong_item (student_id, subject)
    WHERE deleted_at IS NULL;

-- ═══ 2. wrong_item_tag (多标签 · M:N) ═══
CREATE TABLE IF NOT EXISTS wrong_item_tag (
    id           BIGINT      PRIMARY KEY,
    wrong_item_id BIGINT     NOT NULL REFERENCES wrong_item(id) ON DELETE CASCADE,
    tag_code     VARCHAR(64) NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wrong_item_tag_item
    ON wrong_item_tag (wrong_item_id);

-- ═══ 3. wrong_attempt (作答记录 · append-only) ═══
CREATE TABLE IF NOT EXISTS wrong_attempt (
    id           BIGINT      PRIMARY KEY,
    wrong_item_id BIGINT     NOT NULL REFERENCES wrong_item(id) ON DELETE CASCADE,
    answer_text  TEXT,
    is_correct   BOOLEAN     NOT NULL DEFAULT false,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wrong_attempt_item
    ON wrong_attempt (wrong_item_id, created_at DESC);

-- ═══ 4. wrong_item_outbox (事件发件箱 · 异步投递) ═══
CREATE TABLE IF NOT EXISTS wrong_item_outbox (
    id           BIGINT      PRIMARY KEY,
    wrong_item_id BIGINT     NOT NULL REFERENCES wrong_item(id) ON DELETE CASCADE,
    event_type   VARCHAR(64) NOT NULL,
    payload      JSONB,
    sent         BOOLEAN     NOT NULL DEFAULT false,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wrong_outbox_unsent
    ON wrong_item_outbox (sent, created_at)
    WHERE sent = false;

-- ═══ 5. idem_key (全局幂等键表 · scope + idem_key 唯一) ═══
CREATE TABLE IF NOT EXISTS idem_key (
    id        BIGINT      PRIMARY KEY,
    scope     VARCHAR(64) NOT NULL,
    idem_key  VARCHAR(256) NOT NULL,
    payload   JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT uk_idem_scope_key UNIQUE (scope, idem_key)
);
