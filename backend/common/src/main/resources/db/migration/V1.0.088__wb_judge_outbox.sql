-- SC21-T01 · wb_judge_outbox · RLHF override 数据投递 RocketMQ ai-judge.overridden topic 兜底
-- biz §2B.21 SC-21 步 5 + §12 S5.6.5 + §17 决策 #3 沿默认 是
-- 设计沿现役 review_plan_outbox (V1.0.054) pattern · 但表结构按 SC-21 业务字段精剪
-- (review_plan_outbox 是按 plan_id + event_type 通用 · 本表专门记 override RLHF · 字段语义不同)
CREATE TABLE IF NOT EXISTS wb_judge_outbox (
    id            BIGINT       PRIMARY KEY,
    nid           BIGINT       NOT NULL,                          -- review_plan.id (= wb_review_node.plan_id)
    ai_verdict    VARCHAR(16)  NOT NULL,                          -- MASTERED | PARTIAL | FORGOT (AI 判定)
    user_verdict  VARCHAR(16)  NOT NULL,                          -- MASTERED | PARTIAL | FORGOT (学生 override)
    image_key     VARCHAR(512),                                   -- wb_review_node.user_answer_image_key snapshot · null 允许 (学生未拍照场景)
    reason        TEXT,                                           -- wb_review_node.ai_judge_reason snapshot · null 允许
    retry_count   SMALLINT     NOT NULL DEFAULT 0,
    status        VARCHAR(16)  NOT NULL DEFAULT 'PENDING',
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    last_retry_at TIMESTAMPTZ,

    CONSTRAINT wb_judge_outbox_status_check CHECK (
        status IN ('PENDING','SENT','FAILED')
    ),
    CONSTRAINT wb_judge_outbox_verdict_check CHECK (
        ai_verdict IN ('MASTERED','PARTIAL','FORGOT')
        AND user_verdict IN ('MASTERED','PARTIAL','FORGOT')
    )
);

-- TI3 relay FIFO 串行 · 索引扫 PENDING + retry_count<5 行 · 按 created_at 升序
CREATE INDEX IF NOT EXISTS idx_wb_judge_outbox_status_created_at
    ON wb_judge_outbox (status, created_at) WHERE status = 'PENDING';

-- TI1 idempotency · 同 nid + 同 ai_verdict + 同 user_verdict 唯一 (5min 内重复 INSERT → unique violation 沉默吞 · 不入二次行)
CREATE UNIQUE INDEX IF NOT EXISTS uq_wb_judge_outbox_nid_verdicts
    ON wb_judge_outbox (nid, ai_verdict, user_verdict);
