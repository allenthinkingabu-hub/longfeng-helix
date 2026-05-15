-- 幂等双保险 · wrong_item_id + node_index 唯一（active 行, 排除软删）
CREATE UNIQUE INDEX IF NOT EXISTS uk_review_plan_item_node
    ON review_plan (wrong_item_id, node_index) WHERE deleted_at IS NULL;
