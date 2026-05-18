-- V1.0.086 · 2026-05-18 · SC20-T02 wb_review_node 表幂等建表 (兼容 V1.0.084 与 wrong_item_origin_image_key 同 84 版本冲突)
-- 背景: SC20-T01 在 backend/common/.../V1.0.084__wb_review_node_create_with_ai_judge_columns.sql 落地 14 base + 6 satellite = 20 列.
-- 但同 84 版本号还存在 V1.0.084__wrong_item_origin_image_key.sql · Flyway 多 84 时只跑 1 个 (字典序优先 wrong_item · 跳过 wb_review_node).
-- 已确认 (2026-05-18 SC20-T02 Phase 3 IT 失败现场): team-5-pg.wrongbook flyway_schema_history.1.0.084 = 'wrong_item_origin_image_key' · wb_review_node 表不存在.
-- 本 V1.0.086 与 V1.0.084 字面等价 (IF NOT EXISTS) · 不破 SC20-T01 已通过的 testcontainer · 修共享 sandbox PG 真表缺失.
-- 长期解: TL v1.2 patch 应让 SC20-T01 V1.0.084 重命名为 V1.0.0840 · 消除版本号冲突. 本 task 不动 SC20-T01 commit (CLAUDE.md Rule 3 Surgical).
CREATE TABLE IF NOT EXISTS wb_review_node (
  id                BIGINT PRIMARY KEY,
  plan_id           BIGINT NOT NULL,
  student_id        BIGINT NOT NULL,
  level             SMALLINT NOT NULL,
  level_code        VARCHAR(8) NOT NULL,
  due_at            TIMESTAMPTZ NOT NULL,
  window_end_at     TIMESTAMPTZ NOT NULL,
  ready_at          TIMESTAMPTZ,
  status            SMALLINT NOT NULL DEFAULT 0,
  pushed_at         TIMESTAMPTZ,
  reviewed_at       TIMESTAMPTZ,
  effect            SMALLINT,
  calendar_event_id BIGINT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_answer_image_key VARCHAR(512),
  ai_judge_verdict      VARCHAR(16),
  ai_judge_confidence   DECIMAL(3,2),
  ai_judge_reason       TEXT,
  ai_judge_metadata     JSONB,
  final_grade_source    VARCHAR(16) NOT NULL DEFAULT 'self',
  UNIQUE(plan_id, level)
);
CREATE INDEX IF NOT EXISTS idx_wb_node_due_status    ON wb_review_node(status, due_at);
CREATE INDEX IF NOT EXISTS idx_wb_node_student_due   ON wb_review_node(student_id, due_at) WHERE status IN (0,1,2);
CREATE INDEX IF NOT EXISTS idx_wrn_judge_source      ON wb_review_node(final_grade_source) WHERE final_grade_source != 'self';
CREATE INDEX IF NOT EXISTS idx_wrn_low_confidence    ON wb_review_node(ai_judge_confidence) WHERE ai_judge_confidence < 0.5;
