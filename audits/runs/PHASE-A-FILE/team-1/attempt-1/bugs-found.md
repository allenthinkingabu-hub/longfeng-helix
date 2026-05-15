# Bugs Found · PHASE-A-FILE · team-1 · attempt-1

## Bug 1: MinIO credentials mismatch
- **文件**: `IntegrationTestBase.java`, `application.yml`
- **描述**: Sandbox MinIO container (team-1-minio) uses `minioadmin/minioadmin` credentials, but code had `minio/minio12345` from PHASE-0 era. Caused `InvalidAccessKeyId` on all IT tests.
- **修复**: Changed MINIO_USER/MINIO_PASSWORD to `minioadmin/minioadmin` in IntegrationTestBase + application.yml
- **commit**: `3418dca`

## Bug 2: IntegrationTestBase sandbox endpoint misalignment
- **文件**: `IntegrationTestBase.java`
- **描述**: PG credentials (postgres/wb) and MinIO port (19000) from PHASE-0 didn't match PHASE-A sandbox (longfeng/longfeng_dev, port 9000). Caused connection failures.
- **修复**: Aligned all endpoints to sandbox: PG user=longfeng, password=longfeng_dev, MinIO port=9000
- **commit**: `3418dca`

## Bug 3: PresignRealPgIT schema-qualified queries
- **文件**: `PresignRealPgIT.java`
- **描述**: Queries used `file.wb_file` and `file.wb_file_lifecycle` (schema-qualified) but sandbox DB uses public schema. Also queried `file_id` column on wb_file_lifecycle which doesn't exist (column is `id` via @MapsId).
- **修复**: Removed `file.` schema prefix, changed `file_id` → `id`. Made class extend IntegrationTestBase.
- **commit**: `3418dca`
