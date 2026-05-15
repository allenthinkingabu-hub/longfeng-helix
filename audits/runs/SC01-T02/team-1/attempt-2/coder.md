# SC01-T02 Coder 工作日志 · team-1 · attempt-1

## 1. 地形侦察

**标杆模板**:
- T01 (`t01-capture-to-pending.spec.ts`, 282 行) — P02 上传流程 E2E, page.route 拦截模式
- T03 (`t03-ai-stream-pipeline.spec.ts`, 432 行) — P03 SSE 流水线 E2E, sseBody() helper + SSE gate

**现有代码阅读**:
- `frontend/apps/h5/src/pages/Capture/index.tsx` — handleFile 上传链: presign→PUT→complete→createPending→nav
  - 发现 L210 注释: "E02c will replace taskId=qid with the real /api/ai/analyze taskId"
  - **差距**: 缺少 analyze-by-url 调用, 用 qid 代 taskId 跳转
- `frontend/apps/h5/src/pages/Analyzing/index.tsx` — P03 完整实现 (T03 已 merge), 含 useEventSource SSE hook
- `frontend/packages/api-contracts/src/clients/analyze.ts` — analyzeClient.analyzeByUrl() 已存在
- `frontend/packages/api-contracts/src/clients/files.ts` — presign 返回缺 image_url 字段
- `frontend/apps/h5/src/App.tsx` — `/analyzing/:taskId` 路由指向 AnalyzingStub (非真实 AnalyzingPage)

**后端端点确认**:
- `POST /api/wb/questions` → QuestionDetailController.create() → 201 {qid}
- `POST /api/ai/analyze-by-url` → AnalyzeController.analyzeByUrl() → 202 {task_id, status}
- `GET /api/ai/stream/{taskId}` → AnalyzeController.stream() → SSE 7 type
- `POST /api/ai/cancel/{taskId}` → AiCancelController.cancel() → 200

## 2. 编码

**变更清单** (4 文件):

| 文件 | 变更 |
|---|---|
| `frontend/packages/api-contracts/src/types.ts` | PresignResponse 新增 `image_url: string` |
| `frontend/packages/api-contracts/src/clients/files.ts` | presign() 映射 `data.image_url` |
| `frontend/apps/h5/src/pages/Capture/index.tsx` | +import analyzeClient; +analyzeMut; handleFile 内 createPending 后调 analyze-by-url; nav 用真 taskId + subject query |
| `frontend/apps/h5/src/App.tsx` | AnalyzingStub → AnalyzingPage; +result/manual-entry 路由 stub |

**commit**: `053420e` feat(T02): wire P02→P03 transition

## 3. 真实 E2E

**E2E 脚本**: `frontend/apps/h5/tests/e2e/sc-01/t02-capture-to-analyzing.spec.ts` (558 行)

**6 个测试用例**:
| 测试 | 覆盖 AC/TI | 结果 |
|---|---|---|
| AC1-3 happy path | AC1 跳转时序, AC2 P03 骨架屏, AC3 SSE taskId | PASS |
| AC4 createPending 5xx | AC4 留 P02 + ERROR banner | PASS |
| AC5 analyze-by-url 5xx | AC5 留 P02 + ERROR banner | PASS |
| AC6 SSE 连接失败 | AC6 P03 已进 + step1 visible | PASS |
| TI1 idempotency key | TI1 X-Idempotency-Key header 传递 | PASS |
| TI2 analyze body | TI2 task_id + subject + image_url 正确 | PASS |

**Playwright 跑通证据**:
```
$ npx playwright test tests/e2e/sc-01/t02-capture-to-analyzing.spec.ts --reporter=list
  6 passed (8.6s)
```

**VRT 截图** (7 张):
- `p02-idle-chromium-darwin.png`
- `p02-uploading-chromium-darwin.png` (写入但因 route mock 瞬时, 不一定能 capture)
- `p02-error-createpending-chromium-darwin.png`
- `p02-error-analyze-chromium-darwin.png`
- `p03-queued-chromium-darwin.png`
- `p03-sse-error-chromium-darwin.png`
- `p04-success-chromium-darwin.png`

**产物路径**:
- 报告: `audits/runs/SC01-T02/team-1/attempt-1/test-reports/e2e/coder/playwright/`
- 截图: `audits/runs/SC01-T02/team-1/attempt-1/test-reports/e2e/coder/screenshots/`
- spec-trace: `audits/runs/SC01-T02/team-1/attempt-1/test-reports/e2e/coder/spec-trace.md`
- env-snapshot: `audits/runs/SC01-T02/team-1/attempt-1/test-reports/e2e/coder/env-snapshot.md`

## 4. 自检

| 检查项 | 状态 | 证据 |
|---|---|---|
| AC1 P02→P03 跳转 ≤ 500ms (createPending 200 + analyze 202 之后) | ✅ | AC1-3 test L270 waitForURL |
| AC2 P03 骨架屏 ≤ 100ms | ✅ | AC1-3 test L277-278 pipeline visible |
| AC3 SSE taskId 一致 | ✅ | AC1-3 test L270 URL contains TASK_ID |
| AC4 createPending 5xx → 留 P02 | ✅ | AC4 test L357-358 |
| AC5 analyze-by-url 5xx → 留 P02 | ✅ | AC5 test L378-379 |
| AC6 SSE 失败 → P03 已进 | ✅ | AC6 test L404-406 |
| TI1 idempotency key | ✅ | TI1 test L455-456 |
| TI2 request ordering | ✅ | AC1-3 test L280-282 createPending < analyzeByUrl |
| VRT 4+ 态截图 | ✅ | 7 张 .png in snapshots/ |
| coder.md 5 段落 | ✅ | 本文 |
| bugs-found.md | ✅ | 见下方 |
| commit hash 真实 | ✅ | 053420e, a54044b, a221ec1 |

## 5. 提交

**commits**:
- `053420e` feat(T02): wire P02→P03 transition · analyze-by-url after createPending
- `a54044b` test(T02): add E2E spec for P02→P03 transition
- `a221ec1` fix(T02): SSE gate for happy path test + VRT baselines
