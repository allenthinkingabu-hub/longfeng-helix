-- SC-12 / P00 spec §5 #3 · 加 phone 登录 + WeChat OAuth (wx_openid/wx_unionid).
--
-- biz §2A.3.1 决策树 + spec P00-login.spec.md §5 #2 (login 接受 email/phone) +
-- #3 (wechat-login). 老 V20260516_01 表只有 email + password_hash · 现在补:
--   · phone 列 (unique nullable) → 手机号登录
--   · wx_openid / wx_unionid 列 → 微信 OAuth 登录
--   · email / password_hash 改 nullable → 微信纯注册用户不需要 email/password
--   · CHECK 约束: 至少有一种登录凭证 (email OR phone OR wx_openid)

ALTER TABLE auth_user ADD COLUMN phone VARCHAR(20);
ALTER TABLE auth_user ADD COLUMN wx_openid VARCHAR(64);
ALTER TABLE auth_user ADD COLUMN wx_unionid VARCHAR(64);

ALTER TABLE auth_user ALTER COLUMN email DROP NOT NULL;
ALTER TABLE auth_user ALTER COLUMN password_hash DROP NOT NULL;

-- Unique partial indexes · NULL 不参与唯一性 (PG 支持 WHERE 子句)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_auth_user_phone
    ON auth_user(phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_auth_user_wx_openid
    ON auth_user(wx_openid) WHERE wx_openid IS NOT NULL;

-- 至少一种登录凭证 · 防止全 NULL 的孤儿行
ALTER TABLE auth_user ADD CONSTRAINT auth_user_login_method_chk
    CHECK (email IS NOT NULL OR phone IS NOT NULL OR wx_openid IS NOT NULL);

-- Seed test phone fixture: phone=13800138000 / password=Test@1234 (同 V20260516_01 bcrypt hash)
INSERT INTO auth_user (phone, password_hash, status, failed_attempts)
VALUES ('13800138000', '$2b$10$LwxS2PKlU/1UQdXR47es/Obqj9DOz/sBNHuPMwpwdtp5U5inJa8oK', 'ACTIVE', 0)
ON CONFLICT DO NOTHING;
