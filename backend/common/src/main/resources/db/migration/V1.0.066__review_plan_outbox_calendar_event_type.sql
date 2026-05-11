-- SC-01-C07 · A06 §3 D5 · review_plan_outbox.event_type CHECK 再次扩展：
-- 原值域 (due/completed/mastered/opened/graded) 扩为加入 (calendar_event_batch_create)
-- 回滚安全：旧行不会因新增枚举值失效（CHECK 是允许列表，扩展为超集）

ALTER TABLE review_plan_outbox
  DROP CONSTRAINT IF EXISTS review_plan_outbox_event_type_check;

ALTER TABLE review_plan_outbox
  ADD CONSTRAINT review_plan_outbox_event_type_check
  CHECK (event_type IN (
    'due',
    'completed',
    'mastered',
    'opened',
    'graded',
    'calendar_event_batch_create'
  ));

COMMENT ON COLUMN review_plan_outbox.event_type IS
  '事件类型 · due (XXL-Job 派发) / completed (POST /complete) / mastered (Q-G 三连掌握) '
  '/ opened (P08 节点打开) / graded (P08 三态评分 · SC-01-C05) '
  '/ calendar_event_batch_create (calendar-core 503 兜底 · 批量创建 7 条 calendar_event · SC-01-C07)';
