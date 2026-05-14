-- user_account · 最小用户表 · 供 review-plan / wrongbook 等服务的 FK 和 IT 测试用
CREATE TABLE IF NOT EXISTS user_account (
    id         BIGINT       PRIMARY KEY,
    username   VARCHAR(64)  NOT NULL,
    role       VARCHAR(16)  NOT NULL DEFAULT 'STUDENT',
    status     SMALLINT     NOT NULL DEFAULT 1,
    timezone   VARCHAR(48)  DEFAULT 'Asia/Shanghai',
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
