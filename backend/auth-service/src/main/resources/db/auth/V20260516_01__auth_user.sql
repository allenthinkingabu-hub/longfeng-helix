-- PHASE-A · auth-service · auth_user table + test fixture
-- ============================================================
-- 1 row test fixture: email='test@example.com' / password='Test@1234'
-- Hash generated via real bcrypt (python3 bcrypt lib, rounds=10), verified
-- to match 'Test@1234' (len 60 · $2b$10$...). Audit/Tester can re-verify
-- with any standard bcrypt verify routine (Java BCryptPasswordEncoder.matches()
-- or `htpasswd -bvB` or python bcrypt.checkpw).
--
-- Field reference:
--   id              BIGSERIAL primary key
--   email           VARCHAR(255) UNIQUE NOT NULL (login lookup key)
--   password_hash   VARCHAR(72) NOT NULL (bcrypt format, max 72 char per spec)
--   status          VARCHAR(16) NOT NULL — ACTIVE / LOCKED / DELETED
--   failed_attempts INT NOT NULL DEFAULT 0 — running counter of consecutive failed logins
--   locked_until    TIMESTAMPTZ NULL — when not null and > now(), account is locked
--   last_login_at   TIMESTAMPTZ NULL — set on successful login
--   created_at      TIMESTAMPTZ NOT NULL DEFAULT now()

CREATE TABLE IF NOT EXISTS auth_user (
    id              BIGSERIAL PRIMARY KEY,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(72)  NOT NULL,
    status          VARCHAR(16)  NOT NULL DEFAULT 'ACTIVE'
                      CHECK (status IN ('ACTIVE', 'LOCKED', 'DELETED')),
    failed_attempts INT          NOT NULL DEFAULT 0,
    locked_until    TIMESTAMPTZ  NULL,
    last_login_at   TIMESTAMPTZ  NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_user_email ON auth_user(email);

-- Test fixture: real bcrypt hash for 'Test@1234'
INSERT INTO auth_user (email, password_hash, status, failed_attempts)
VALUES ('test@example.com', '$2b$10$LwxS2PKlU/1UQdXR47es/Obqj9DOz/sBNHuPMwpwdtp5U5inJa8oK', 'ACTIVE', 0)
ON CONFLICT (email) DO NOTHING;
