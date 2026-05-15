# SC01-T01 · team-1 · attempt-1 · Bugs Found & Fixed

## Bug 1 · P0 · FE questionsClient sends wrong field names to backend

- **File**: `frontend/packages/api-contracts/src/clients/questions.ts`
- **Root cause**: FE `CreateQuestionReq` uses `studentId` + `image_key` but backend DTO expects `student_id` + `origin_image_key` (via `@JsonProperty`). Raw `JSON.stringify(req)` sends wrong keys → 400 validation error.
- **Fix**: Added explicit body mapping in `createPending()` to convert FE camelCase → backend snake_case.
- **Fix commit**: `7769378`

## Bug 2 · P0 · /api/file/complete/{objectKey} fails when objectKey contains '/'

- **File**: `backend/file-service/src/main/java/com/longfeng/fileservice/controller/PresignController.java`
- **Root cause**: objectKey is like `wrongbook/0/202605/7/snowflake_file.jpg` with `/` chars. `encodeURIComponent` converts to `%2F` which Spring rejects. Path variable can't hold multi-segment values.
- **Fix**: Added `@RequestParam(value = "key", required = false)` fallback and mapped both `/complete/{objectKey}` and `/complete` endpoints. FE switched to query param: `POST /api/file/complete?key=...`.
- **Fix commit**: `7769378`

## Bug 3 · P0 · Browser CORS blocks direct PUT to MinIO presigned URL

- **File**: `frontend/packages/api-contracts/src/clients/files.ts` + `frontend/apps/h5/vite.config.ts`
- **Root cause**: Presigned URL points to `http://localhost:9000` (MinIO), browser at `localhost:5181` can't PUT cross-origin. MinIO doesn't support CORS config via `mc cors set` or S3 API (returns NotImplemented).
- **Fix**: Added vite proxy `/s3` → `http://localhost:9000` and rewrote upload URLs in `directUpload()` to use relative `/s3/...` paths.
- **Fix commit**: `7769378`

## Bug 4 · P1 · Flyway migration conflicts with existing sandbox schema

- **File**: `backend/file-service/src/main/resources/application.yml` + `backend/wrongbook-service/src/main/resources/application.yml`
- **Root cause**: Sandbox PG has pre-existing tables from prior migrations. Flyway V1.0.050 tries `CREATE TABLE IF NOT EXISTS review_plan` (skipped) then `CREATE INDEX ON review_plan(student_id)` but existing table lacks `student_id` column → error.
- **Fix**: Disabled Flyway (`flyway.enabled: false`) and switched JPA to `ddl-auto: update` since schema is manually managed in sandbox.
- **Fix commit**: `7769378`

## Bug 5 · P2 · Missing `wrong_item.created_at` column in sandbox PG

- **File**: Sandbox PG table `public.wrong_item`
- **Root cause**: Pre-existing table missing `created_at`, `updated_at`, `idempotency_key` columns that wrongbook-service JPA entities expect.
- **Fix**: `ALTER TABLE wrong_item ADD COLUMN IF NOT EXISTS ...` for all 3 missing columns.
- **Fix commit**: N/A (sandbox-only DDL, not in source code)

---

## Tally

- **Bugs found + fixed**: 5 (3× P0 + 1× P1 + 1× P2)
- **0-bug declaration**: Not applicable (≥1 bug)
