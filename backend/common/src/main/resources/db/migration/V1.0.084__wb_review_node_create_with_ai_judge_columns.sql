-- V1.0.084 (codebase 命名风格 · satellite v1.1 §4.16 字面将由 parent v1.2 改齐)
-- 注: master §4.5 (L1559-L1580) 原 paper-only · 本 migration 首次实装
-- 14 base 列字面与 master §4.5 一致 · 末尾 6 列为 satellite M-AI-ANSWER-JUDGE 增量
-- 用户 2026-05-18 决策 B: 一次 CREATE TABLE 14 base + 6 satellite = 20 列 · 4 indexes (master 原 2 + satellite 新 2)
CREATE TABLE wb_review_node (
  -- master §4.5 base 14 列 (字面与 master L1562-L1577 一致)
  id                BIGINT PRIMARY KEY,
  plan_id           BIGINT NOT NULL,
  student_id        BIGINT NOT NULL,
  level             SMALLINT NOT NULL,             -- 0..6 对应 T0..T6
  level_code        VARCHAR(8) NOT NULL,           -- INITIAL/H1/D1/D3/D7/D15/D30
  due_at            TIMESTAMPTZ NOT NULL,          -- 艾宾浩斯计算得到
  window_end_at     TIMESTAMPTZ NOT NULL,          -- due_at + 24h
  ready_at          TIMESTAMPTZ,                   -- due_at - 30min (预生成任务时刻)
  status            SMALLINT NOT NULL DEFAULT 0,   -- 0 SCHEDULED 1 READY 2 PUSHED 3 REVIEWED 4 FORGOTTEN 9 FAILED
  pushed_at         TIMESTAMPTZ,
  reviewed_at       TIMESTAMPTZ,
  effect            SMALLINT,                       -- 1 掌握 2 部分 3 未掌握
  calendar_event_id BIGINT,                         -- 关联日历事件 ID (外挂到 calendar_event.relation_id)
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- satellite M-AI-ANSWER-JUDGE 增量 6 列
  user_answer_image_key VARCHAR(512),               -- OSS object key · null = 学生未走拍照路径
  ai_judge_verdict      VARCHAR(16),                -- 'MASTERED' | 'PARTIAL' | 'FORGOT' · null = AI 未判
  ai_judge_confidence   DECIMAL(3,2),               -- 0.00-1.00 · null = AI 未判
  ai_judge_reason       TEXT,                        -- AI 解释 · 100 字内 · 中文 · null = AI 未判
  ai_judge_metadata     JSONB,                       -- {model_used, prompt_version, token_cost_usd, latency_ms, status}
  final_grade_source    VARCHAR(16) NOT NULL DEFAULT 'self',  -- 'self' | 'ai_accepted' | 'ai_overridden'
  -- master §4.5 base 约束
  UNIQUE(plan_id, level)
);
-- master §4.5 base 2 indexes (字面与 master L1579-L1580 一致)
CREATE INDEX idx_wb_node_due_status    ON wb_review_node(status, due_at);
CREATE INDEX idx_wb_node_student_due   ON wb_review_node(student_id, due_at) WHERE status IN (0,1,2);
-- satellite 增量 2 partial indexes
CREATE INDEX idx_wrn_judge_source      ON wb_review_node(final_grade_source) WHERE final_grade_source != 'self';
CREATE INDEX idx_wrn_low_confidence    ON wb_review_node(ai_judge_confidence) WHERE ai_judge_confidence < 0.5;
