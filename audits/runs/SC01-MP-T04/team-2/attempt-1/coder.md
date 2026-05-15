# coder.md · SC01-MP-T04 · P03→P04 transition · attempt-1

## 1. 地形侦察

- 完整读 coder-agent.md (铁律 1-5 + 补充 6/7 + 执行流程 7 步)
- 完整读 SHARED-E2E-PROTOCOL.md (三轴隔离 + DoR C-1..C-6)
- 完整读 SC01-MP-T04.json inflight (wave-2 transition scope · budget 25-40 tool use)
- 完整读 design/mockups/wrongbook/03_analyzing.html + 04_result.html
- 完整读 pages/analyzing/index.ts + pages/result/index.ts (wave-1 实现)
- 完整读 H5 sibling: frontend/apps/h5/src/pages/Analyzing/index.tsx (transition pattern: `nav('/question/${qid}/result')`)
- 完整读 test/api/ai.integration.spec.ts (existing test pattern)
- 完整读 src/api/ai.ts + _http.ts + wrongbook.ts + review.ts (API 层)

标杆模板: H5 AnalyzingPage.onDone → navigateRef + setTimeout(200ms) 跳 result

## 2. 编码

### 2.1 核心 transition (pages/analyzing/index.ts)
- 新增 `_qid` 字段，在 `onLoad` 时从 `options.qid` 捕获 (来自 P02 capture 页面)
- 在 `_pollOnce` 的 `resp.status === 'SUCCEEDED'` 分支后，加 `setTimeout(300ms)` + `wx.navigateTo({ url: '/pages/result/index?qid=' + qid })`
- qid 优先级: `this._qid || this.data.taskId` (与 H5 sibling 对齐: `qid ?? taskId`)

### 2.2 修复 wave-1 合并遗漏的 API exports (tsc 前置条件)
- `src/api/ai.ts`: 新增 `startAnalyze`, `pollAnalyzeStatus`, `PollAnalyzeStatusResponse` (analyzing 页面 import 依赖)
- `src/api/wrongbook.ts`: 新增 `createQuestion` (capture 页面 import 依赖)
- `src/api/review.ts`: 新增 `getNode`, `revealNode`, `gradeNode` (review-exec 页面 import 依赖)

### 2.3 vitest transition test (test/transitions/analyzing-to-result.spec.ts)
5 test cases:
1. SUCCEEDED → wx.navigateTo with correct qid URL
2. taskId fallback when _qid is empty
3. FAILED → no navigation
4. RUNNING → no navigation
5. onLoad captures qid from options

Mock 范围: 仅 mock wx runtime APIs (wx.navigateTo/navigateBack/request) · 0 backend mock

## 3. 真实 E2E

本任务 `physical_verification.dor_c1_to_c6_required = false` (wave-2 transition · 无 UI E2E · vitest + tsc 验证)

- `pnpm -F mp typecheck` → PASS (0 errors)
- `pnpm -F mp test:e2e` → transition test 5/5 PASS · pre-existing integration tests fail due to backend services not running (not in scope)

## 4. 自检

| 检查项 | 结果 | 证据 |
|---|---|---|
| transition action 落地 | PASS | pages/analyzing/index.ts:155-160 · wx.navigateTo |
| qid 从 options 捕获 | PASS | pages/analyzing/index.ts:87 `this._qid = options.qid` |
| vitest 0 backend mock | PASS | test/transitions/analyzing-to-result.spec.ts · 仅 mock wx.* |
| tsc --noEmit | PASS | `pnpm -F mp typecheck` 0 errors |
| spec-trace.md | PASS | audits/runs/SC01-MP-T04/team-2/attempt-1/spec-trace.md |

## 5. 提交

- commit: `39bdc90` — feat(SC01-MP-T04): P03→P04 transition · analyzing success → wx.navigateTo result page
- `git cat-file -e 39bdc90` → exists
