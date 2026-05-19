-- V1.0.087 · 2026-05-18 · SC20-T02 idem_key UNIQUE 约束调整 · 支持双键 (key, nid) 幂等
-- 背景: 现役 V1.0.001 wrongbook-service idem_key UNIQUE(scope, idem_key) 不满足 SC20-T02 §10.17 字面 "同 key + 同 nid 双键幂等" ·
--      原约束等价于 key 单键 · SC20-T02 用例 #4 字面要求同 X-Idempotency-Key 不同 nid 走两次 chat call · idem_key 表查 2 行 for idem-key-A.
-- 修法: DROP UNIQUE(scope, idem_key) · 加 UNIQUE(scope, idem_key, (payload->>'nid')) 让 PostgreSQL 表达式索引支持双键.
-- 兼容: wrongbook-service 现役其他 scope ('wrongbook:photo-upload' 等) 不会 payload-nid 不存在但 IS NULL 是 distinct · 仍可幂等 (单 key + null nid 视为唯一).
-- 注: 若上行迁移失败 (e.g. 表已被 wrongbook-service 业务使用产生冲突数据) · 由 ops 手工处理 · 本 task 不破坏现役数据.
ALTER TABLE idem_key DROP CONSTRAINT IF EXISTS uk_idem_scope_key;
DROP INDEX IF EXISTS uk_idem_scope_key;
-- 新约束: scope + idem_key + payload-nid 三键唯一 · payload->>'nid' NULL 时仍约束 (scope, idem_key) 兼容 wrongbook-service 现役 scope
CREATE UNIQUE INDEX IF NOT EXISTS uk_idem_scope_key_nid
    ON idem_key (scope, idem_key, ((payload->>'nid')));
