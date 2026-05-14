-- V1.0.081 · file_asset table for file-service upload/complete/download chain
-- Idempotent: IF NOT EXISTS guard for sandbox re-run safety

CREATE TABLE IF NOT EXISTS file_asset (
    id                  BIGINT       PRIMARY KEY,
    object_key          VARCHAR(500) UNIQUE,
    status              VARCHAR(50)  DEFAULT 'PENDING',
    owner_id            BIGINT,
    mime_type           VARCHAR(100),
    file_size           BIGINT,
    variant_thumb_key   VARCHAR(500),
    variant_medium_key  VARCHAR(500)
);
