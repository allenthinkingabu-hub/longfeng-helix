# spec-trace · SC01-T01 · team-1 · attempt-3

> SHARED-E2E-PROTOCOL.md v1 §3 DoR-C-5 · 行级别可追溯的 spec ↔ E2E assertion 对照表

依据:
- design/system/pages/P02-capture.spec.md §5 API 触点 + §6 状态机 + §10 验收点
- .harness/inflight/SC01-T01.json task.acceptance_criteria (AC1-AC6) + task.test_invariants (TI1-TI5)
- frontend/apps/h5/tests/e2e/sc-01/t01-capture-to-pending.spec.ts (5 个 test case · 313 行)

## 主表 (AC × spec.ts 行号 × test name × §5 API 触点 × §9 状态机分支)

| AC | spec.ts 行号 | test name | §5 API 触点 | §9 状态机分支 |
|----|------------|-----------|-----------|-------------|
| AC1 (presign Header X-Idempotency-Key + body{sha256_hash,size,mime} → 200) | 136-149 | happy path | POST /api/file/presign | IDLE → UPLOADING |
| AC2 (同 idemKey 24h 内同 file_key · TC-01.02 内嵌) | 202-225 | TC-01.02 · same X-Idempotency-Key reuses file_key | POST /api/file/presign × 2 | UPLOADING idempotent |
| AC3 (POST /api/wb/questions Header X-Idempotency-Key → 200 PENDING) | 159-164 | happy path | POST /api/wb/questions | UPLOADING → UPLOADED |
| AC4 (POST /api/ai/analyze-by-url → 202 + router.push /analyzing/) | 166-176 | happy path | POST /api/ai/analyze-by-url | UPLOADED → nav P03 |
| AC5 (shutter UPLOADING aria-disabled='true' · 10 click → 1 presign) | 267-289 | TI4 · shutter 10 rapid clicks | testid capture-shutter | UPLOADING 防抖 |
| AC6 (缺 X-Idempotency-Key → 400 非 500) | 233-253 | AC6 · missing header returns 400 | POST /api/file/presign 无 header | IDLE → ERROR |

## 不变量 (TI) 对照

| TI | spec.ts 行号 | test name | 不变量 | 状态机分支 |
|----|------------|-----------|--------|-----------|
| TI1 (同 idemKey 24h wb_file 仅 1 行) | 219 | TC-01.02 同 AC2 行 | second.file_key === first.file_key (file_key 复用 = wb_file 仅 1 行的代表性断言) | UPLOADING idempotent |
| TI2 (缺 header 返 400 非 500) | 248, 252 | AC6 · missing header returns 400 | toBe(400) + toBeLessThan(500) | IDLE → ERROR |
| TI3 (presign/PUT/wb-questions 失败不跳 P03) | 298-321 | TI3 · presign 5xx no nav | errorBanner.toBeVisible + url.not.toMatch(/analyzing/) | UPLOADING → ERROR (路由门禁) |
| TI4 (shutter UPLOADING 10 click 1 presign) | 281 | TI4 · 10 rapid clicks | presignCount.toBe(1) | UPLOADING 防抖 |
| TI5 (4 态 VRT screenshot) | 103-105 / 131-133 / 172-174 / 308-310 | happy path + TI3 | page.screenshot × 4 → 12 张 audit png | 4 态全覆盖 |

## §5 API 触点 (P02-capture.spec.md §5) 逐条对照

| Method | Path | 用途 | E2E 覆盖行号 | 真机跑结果 (attempt-3) |
|--------|------|------|------------|----------------------|
| POST | /api/file/presign | 拿到上传 URL | spec.ts:107-110 (waitForResponse) | 500 INTERNAL_SERVER_ERROR (后端 file-service spring-boot 未起 · vite proxy 8081 无 server) |
| POST | /api/wb/questions | 创建 PENDING question | spec.ts:111-114 | 未触达 (presign 500 前置阻塞) |
| POST | /api/ai/analyze (实际路径 /api/ai/analyze-by-url) | 触发 AI 分析 | spec.ts:115-119 | 未触达 |
| GET (隐式 nav) | /analyzing/{taskId} | router.push 跳 P03 | spec.ts:167-168 (waitForURL) | 未触达 |

## testid 对照 (P02-capture.spec.md §13 + frontend/packages/testids §p02)

| testid | E2E locator 用法行号 |
|--------|---------------------|
| p02-root | spec.ts:87 (beforeEach mount 验证) |
| subject-chip-math | spec.ts:117, 270, 302 (3 处) |
| capture-shutter | spec.ts:279 (TI4 toBeDisabled) |
| p02-upload-progress | spec.ts:125, 275 (2 处) |
| p02-error-banner | spec.ts:306 (TI3 ERROR 态断言) |
| p02-file-input | spec.ts:64 (injectFixtureFile helper · setInputFiles) |

## 真机跑结果 (attempt-3)

**Playwright run 命令**:
```
cd frontend/apps/h5
PLAYWRIGHT_BASE_URL=http://localhost:5174 pnpm exec playwright test \
  tests/e2e/sc-01/t01-capture-to-pending.spec.ts --project=chromium
```

**结果**: 5 test cases · **2 PASS / 3 FAIL** (~7.9s)

| # | Test case | 结果 | 原因 |
|---|-----------|------|------|
| 1 | happy path · presign 200 + PUT + wb/questions + analyze + 跳 /analyzing/ | FAIL | 后端 file-service Spring Boot 未起 · presign 返 500 (vite proxy 反代 8081 无 server) |
| 2 | TC-01.02 · same X-Idempotency-Key 24h reuses file_key | FAIL | 同上 (presign 500) |
| 3 | AC6 · missing X-Idempotency-Key Header returns 400 | FAIL | 同上 (presign 500 而非预期 400) |
| 4 | TI4 · shutter 10 rapid clicks during UPLOADING fire only 1 presign | PASS | TI4 防抖完全在前端，不依赖后端 真 PASS |
| 5 | TI3 · presign 5xx failure shows ERROR banner + does NOT navigate | PASS | TI3 用 page.route 注入 500，本来就模拟后端失败 真 PASS |

**真机产物归档** (本 attempt-3 work_log_dir):
- playwright/index.html (~540KB HTML 报告)
- playwright/results.xml (JUnit XML · 5 个 `<testcase>`)
- playwright/run.log (完整 stdout · 失败堆栈 + 通过明细)
- screenshots/<state>-{baseline,actual,diff}.png × 12 (idle/uploading/success/error)
- backend-it/verify.log (mvn -pl file-service verify · BUILD FAILURE 真证)
- backend-it/failsafe-xml/* × 9 (TEST-*.xml × 4 + *.txt × 4 + failsafe-summary.xml)

## attempt-4 改进方向 (handoff)

1. **后端 sandbox 完整起**: 让 file-service + wrongbook-service + ai-analysis-service 三个 spring-boot 后台启动 + vite proxy 反代 → 让 happy path 真过
2. **MinIO bucket / Snowflake worker 冲突排查**: PresignRealPgIT 500 根因待查 (本 attempt-3 已建 wrongbook-dev + s6-it-bucket bucket · 但 PresignController 在 IT 环境仍返 500 · 需查 logs/file-service.log)
3. **BackendChainIT seed 缺 file_asset 表**: bad SQL grammar `DELETE FROM file_asset` · file_asset 表不存在; 需建或改用 file.wb_file 表名

## 跨 attempt 复用 (SHARED-E2E-PROTOCOL §6)

源脚本 `frontend/apps/h5/tests/e2e/sc-01/t01-capture-to-pending.spec.ts` 跨 attempt 复用 (git tracked)。attempt-3 在 attempt-2 留下的脚本上仅 append 了 trace 头注释 (4 行) · 主体 313 行 0 修改。
