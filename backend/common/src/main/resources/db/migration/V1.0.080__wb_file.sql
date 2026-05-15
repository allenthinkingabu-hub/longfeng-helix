-- V1.0.080 · wb_file + wb_file_lifecycle tables for file-service presign chain
-- Idempotent: IF NOT EXISTS guards for sandbox re-run safety

CREATE TABLE IF NOT EXISTS wb_file (
    id              BIGINT       PRIMARY KEY,
    tenant_id       BIGINT,
    student_id      BIGINT,
    object_key      VARCHAR(500),
    mime_type       VARCHAR(100),
    bytes           BIGINT,
    sha256_hash     CHAR(64),
    status          SMALLINT     DEFAULT 0,
    storage_class   VARCHAR(50),
    created_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS wb_file_lifecycle (
    id              BIGINT       PRIMARY KEY REFERENCES wb_file(id),
    tenant_id       BIGINT,
    promote_at      TIMESTAMPTZ,
    archive_at      TIMESTAMPTZ
);
