-- V1.0.085 · idem_key 表确保存在 (与 wrongbook-service V1.0.001 DDL 等价 · 共享 DB 同表)
-- 原因: SC20-T02 AnswerJudgeService 在 review-plan-service 使用 scope='ai-judge:judge' 落 idem_key 表
--      review-plan-service 与 wrongbook-service 共享 team-5-pg.wrongbook DB · 表已存在不重建
--      IF NOT EXISTS 防 review-plan-service 单跑时重建表冲突 · 沿现役共享 DB 模式
CREATE TABLE IF NOT EXISTS idem_key (
    id        BIGINT      PRIMARY KEY,
    scope     VARCHAR(64) NOT NULL,
    idem_key  VARCHAR(256) NOT NULL,
    payload   JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- UNIQUE 约束: 若 wrongbook V1.0.001 已建则不重建 · CREATE UNIQUE INDEX IF NOT EXISTS 兜底
CREATE UNIQUE INDEX IF NOT EXISTS uk_idem_scope_key ON idem_key(scope, idem_key);
