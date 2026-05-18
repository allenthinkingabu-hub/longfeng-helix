-- V1.0.084 · 2026-05-18 · 把 wrong_item 历史 JPA ddl-auto 自动加列正式写进 flyway.
--
-- 背景: WrongItem entity (wrongbook-service) 有 @Column(name="origin_image_key")
-- 但创建 wrong_item 的 V1.0.002__wrong_item.sql 没定义此列 ·
-- production team-1-pg 通过 ddl-auto: update 自动加了 · 但 test PG (testcontainers fresh)
-- 只跑 flyway · 缺这列 → SC-16 failedTop SQL 报 "column does not exist".
--
-- 同时把 processed_image_key 一起标准化 (同根问题 · 同 JPA entity 字段).
-- IF NOT EXISTS 让生产已有列幂等 · 测试 fresh PG 真正建.

ALTER TABLE wrong_item
    ADD COLUMN IF NOT EXISTS origin_image_key    VARCHAR(512);

ALTER TABLE wrong_item
    ADD COLUMN IF NOT EXISTS processed_image_key VARCHAR(512);
