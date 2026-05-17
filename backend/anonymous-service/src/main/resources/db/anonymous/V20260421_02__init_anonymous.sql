-- ============================================================================
-- V20260421_02 · anonymous-service · 7 anonymous-state tables DDL
-- ============================================================================
-- Source of truth: biz/业务与技术解决方案_AI错题本_基于日历系统.md §4.10–§4.13
--
-- Tables created (in dependency order):
--   1. guest_session         (§4.10 · SC-11/SC-12)
--   2. guest_rate_bucket     (§4.10 关联表 · Redis 失败降级)
--   3. share_token           (§4.11 · SC-09/SC-13)
--   4. share_token_audit     (§4.11)
--   5. observer_invite       (§4.12 · P1 SC-15)
--   6. observer_session      (§4.12)
--   7. account_device        (§4.13 · P1 SC-14)
--
-- biz quote re-printed inline above each CREATE TABLE for traceability.
-- This migration is *additive* (CREATE TABLE only, no ALTER) so re-running it
-- on a clean DB is the only happy path; Flyway's flyway_schema_history_anonymous
-- table guarantees idempotency on retries.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. guest_session — 匿名态游客会话 (biz §4.10 · SC-11 / SC-12)
-- ----------------------------------------------------------------------------
-- 游客试用 + 注册认领 (Try Before Signup) 的核心载体。设备维度 1 次完整 AI 分析,
-- 结果保存 24 h; 注册后一键 claim 到正式账号并自动排艾宾浩斯节点。
-- ----------------------------------------------------------------------------
CREATE TABLE guest_session (
    id                       BIGINT       PRIMARY KEY,
    device_fp                VARCHAR(128) NOT NULL,
    ip_hash                  VARCHAR(64),
    ua                       VARCHAR(256),
    entry_source             VARCHAR(32),
    experiment_bucket        VARCHAR(32),
    image_tmp_url            VARCHAR(512),
    analysis_result_json     JSONB,
    consent_at               TIMESTAMPTZ,
    consent_type             SMALLINT,
    status                   SMALLINT     NOT NULL DEFAULT 0,
    claimed_by_student_id    BIGINT,
    claimed_question_id      BIGINT,
    created_at               TIMESTAMPTZ  NOT NULL DEFAULT now(),
    expires_at               TIMESTAMPTZ  NOT NULL,
    claimed_at               TIMESTAMPTZ
);

COMMENT ON TABLE  guest_session                       IS '匿名态游客会话 · biz §4.10 · SC-11/SC-12';
COMMENT ON COLUMN guest_session.device_fp             IS '设备指纹 (IndexedDB + Canvas + UA 组合)';
COMMENT ON COLUMN guest_session.ip_hash               IS 'IP 做 HMAC, 避免明文留存';
COMMENT ON COLUMN guest_session.entry_source          IS 'ad/qr/share/direct';
COMMENT ON COLUMN guest_session.experiment_bucket     IS 'A/B 桶';
COMMENT ON COLUMN guest_session.image_tmp_url         IS '临时 OSS bucket, 5 min 签名';
COMMENT ON COLUMN guest_session.analysis_result_json  IS 'AI 结构化结果快照';
COMMENT ON COLUMN guest_session.consent_at            IS '未成年人保护合规';
COMMENT ON COLUMN guest_session.consent_type          IS '1 ADULT / 2 MINOR_WITH_GUARDIAN / 3 MINOR_NO_GUARDIAN';
COMMENT ON COLUMN guest_session.status                IS '0 CREATED / 1 ANALYZING / 2 RESULT_READY / 3 FAILED / 4 CLAIMED / 9 EXPIRED';
COMMENT ON COLUMN guest_session.claimed_by_student_id IS 'claim 后回写';
COMMENT ON COLUMN guest_session.claimed_question_id   IS '绑定到 wb_question.id';
COMMENT ON COLUMN guest_session.expires_at            IS '默认 created_at + 24h';

CREATE INDEX idx_guest_session_fp_day   ON guest_session(device_fp, created_at);
CREATE INDEX idx_guest_session_expires  ON guest_session(expires_at) WHERE status IN (0, 1, 2);
CREATE UNIQUE INDEX uq_guest_claim      ON guest_session(claimed_question_id) WHERE claimed_question_id IS NOT NULL;


-- ----------------------------------------------------------------------------
-- 2. guest_rate_bucket — guest 每日限流降级表 (biz §4.10 末尾 line 1693)
-- ----------------------------------------------------------------------------
-- "Redis 失败时降级写库:(device_fp, ip_hash, date) 联合唯一, 计数字段 count, 上限 1/day"
-- ----------------------------------------------------------------------------
CREATE TABLE guest_rate_bucket (
    id          BIGINT       PRIMARY KEY,
    device_fp   VARCHAR(128) NOT NULL,
    ip_hash     VARCHAR(64)  NOT NULL,
    bucket_date DATE         NOT NULL,
    count       INT          NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT ck_guest_rate_bucket_count_le_1 CHECK (count <= 1)
);

COMMENT ON TABLE  guest_rate_bucket           IS 'guest 每日限流降级表 · biz §4.10 末尾 · Redis 失败时落 PG';
COMMENT ON COLUMN guest_rate_bucket.count     IS '当日已用次数, 上限 1/day';
COMMENT ON COLUMN guest_rate_bucket.bucket_date IS '按日期分桶, 与 device_fp+ip_hash 三元唯一';

CREATE UNIQUE INDEX uq_guest_rate_bucket_fp_ip_date
    ON guest_rate_bucket(device_fp, ip_hash, bucket_date);


-- ----------------------------------------------------------------------------
-- 3. share_token — 匿名态分享令牌 (biz §4.11 · SC-09 / SC-13)
-- ----------------------------------------------------------------------------
-- HS256 JWT 签名 + TTL ≤ 7d + 撤销位 (status=REVOKED 后写 Redis Bloom share:revoked)
-- ----------------------------------------------------------------------------
CREATE TABLE share_token (
    id                BIGINT       PRIMARY KEY,
    jti               VARCHAR(64)  NOT NULL UNIQUE,
    sharer_student_id BIGINT       NOT NULL,
    share_type        VARCHAR(16)  NOT NULL,
    relation_id       VARCHAR(128) NOT NULL,
    allow_claim       BOOLEAN      NOT NULL DEFAULT false,
    usage_limit       INT          NOT NULL DEFAULT 1000,
    usage_count       INT          NOT NULL DEFAULT 0,
    status            SMALLINT     NOT NULL DEFAULT 1,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    expires_at        TIMESTAMPTZ  NOT NULL
);

COMMENT ON TABLE  share_token                   IS '匿名态分享令牌 · biz §4.11 · SC-09/SC-13';
COMMENT ON COLUMN share_token.jti               IS 'HS256 JWT 的 jti, 全局唯一';
COMMENT ON COLUMN share_token.share_type        IS 'EXAM_DAY / QUESTION / REVIEW_NODE';
COMMENT ON COLUMN share_token.relation_id       IS 'question:id / event:id / node:id';
COMMENT ON COLUMN share_token.allow_claim       IS '接收方注册后是否允许一键加入错题本';
COMMENT ON COLUMN share_token.status            IS '1 ACTIVE / 2 EXPIRED / 3 REVOKED / 4 EXHAUSTED';
COMMENT ON COLUMN share_token.expires_at        IS '<= created_at + 7d';

CREATE INDEX idx_share_token_sharer ON share_token(sharer_student_id, created_at);


-- ----------------------------------------------------------------------------
-- 4. share_token_audit — 分享令牌访问审计 (biz §4.11)
-- ----------------------------------------------------------------------------
CREATE TABLE share_token_audit (
    id                  BIGINT       PRIMARY KEY,
    jti                 VARCHAR(64)  NOT NULL,
    viewer_device_fp    VARCHAR(128),
    viewer_ip_hash      VARCHAR(64),
    upgraded_student_id BIGINT,
    viewed_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE  share_token_audit                     IS '分享令牌访问审计 · biz §4.11';
COMMENT ON COLUMN share_token_audit.upgraded_student_id IS '接收方注册成功后回填';

CREATE INDEX idx_share_audit_jti ON share_token_audit(jti, viewed_at);


-- ----------------------------------------------------------------------------
-- 5. observer_invite — 观察者邀请 (biz §4.12 · P1 · SC-15)
-- ----------------------------------------------------------------------------
-- 6 位大写字母+数字邀请码, 24h 一次性兑换
-- ----------------------------------------------------------------------------
CREATE TABLE observer_invite (
    id          BIGINT       PRIMARY KEY,
    invite_code CHAR(6)      NOT NULL UNIQUE,
    student_id  BIGINT       NOT NULL,
    role        VARCHAR(16)  NOT NULL,
    status      SMALLINT     NOT NULL DEFAULT 1,
    expires_at  TIMESTAMPTZ  NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE  observer_invite             IS '观察者邀请 · biz §4.12 · P1 · SC-15';
COMMENT ON COLUMN observer_invite.invite_code IS '6 位大写字母+数字';
COMMENT ON COLUMN observer_invite.role        IS 'PARENT / TEACHER';
COMMENT ON COLUMN observer_invite.status      IS '1 PENDING / 2 EXCHANGED / 3 EXPIRED / 4 REVOKED';
COMMENT ON COLUMN observer_invite.expires_at  IS '默认 created_at + 24h';


-- ----------------------------------------------------------------------------
-- 6. observer_session — 观察者会话 (biz §4.12 · P1 · SC-15)
-- ----------------------------------------------------------------------------
-- 学生端 P13 触发撤销 → status=3 → 写 Redis obs:revoked:{jti} → 网关 ≤1s 命中
-- ----------------------------------------------------------------------------
CREATE TABLE observer_session (
    id                      BIGINT       PRIMARY KEY,
    jti                     VARCHAR(64)  NOT NULL UNIQUE,
    student_id              BIGINT       NOT NULL,
    role                    VARCHAR(16)  NOT NULL,
    device_fp               VARCHAR(128),
    status                  SMALLINT     NOT NULL DEFAULT 1,
    issued_at               TIMESTAMPTZ  NOT NULL DEFAULT now(),
    last_seen_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    expires_at              TIMESTAMPTZ  NOT NULL,
    revoked_by_student_at   TIMESTAMPTZ
);

COMMENT ON TABLE  observer_session            IS '观察者会话 · biz §4.12 · P1 · SC-15';
COMMENT ON COLUMN observer_session.jti        IS 'OBSERVER JWT 的 jti, 全局唯一';
COMMENT ON COLUMN observer_session.role       IS 'PARENT / TEACHER';
COMMENT ON COLUMN observer_session.status     IS '1 ACTIVE / 2 EXPIRED / 3 REVOKED_BY_STUDENT';
COMMENT ON COLUMN observer_session.expires_at IS 'PARENT 30d / TEACHER 90d';

CREATE INDEX idx_observer_session_student ON observer_session(student_id, status);


-- ----------------------------------------------------------------------------
-- 7. account_device — 设备指纹软绑定 (biz §4.13 · P1 · SC-14)
-- ----------------------------------------------------------------------------
-- 仅登录成功后写;不在匿名态写。device_fp 多对多 student_id → P-WELCOMEBACK 选账号。
-- ----------------------------------------------------------------------------
CREATE TABLE account_device (
    id            BIGINT       PRIMARY KEY,
    student_id    BIGINT       NOT NULL,
    device_fp     VARCHAR(128) NOT NULL,
    platform      VARCHAR(16),
    first_seen_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    last_seen_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    login_count   INT          NOT NULL DEFAULT 1
);

COMMENT ON TABLE  account_device          IS '设备指纹软绑定 · biz §4.13 · P1 · SC-14';
COMMENT ON COLUMN account_device.platform IS 'H5 / MINIP / IOS / ANDROID';

CREATE UNIQUE INDEX uq_account_device ON account_device(student_id, device_fp);
CREATE INDEX idx_account_device_fp    ON account_device(device_fp);
