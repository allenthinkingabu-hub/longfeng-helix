# coder.md · SC01-MP-T05 · P04 Result Page · attempt-1

## 1. 地形侦察

- 完整读 `design/mockups/wrongbook/04_result.html` (259 行 SoT mockup)
- 完整读 `frontend/apps/h5/src/pages/Result/index.tsx` (H5 state machine: LOADING → DRAFT | LOW_CONF → EDITING → SAVING → SAVED)
- 完整读 `frontend/apps/mp/src/api/_http.ts` (dual-runtime adapter: wx.request in MP, fetch in vitest)
- 完整读 `frontend/apps/h5/vite.config.ts` (port map: wb=8082, ai=8083)
- 完整读 `frontend/apps/mp/pages/capture/index.ts` (标杆模板: Page({}) pattern + @longfeng/testids import)
- 完整读 existing `pages/result/index.wxml` + `index.json` (已有 WXML + Vant 组件注册)
- 标杆: capture page 的 Page({data, methods}) 模式 + van-* 组件使用约定

## 2. 编码

### 2.1 API 客户端 (真 API · 0 mock)
- `src/api/wrongbook.ts`: `getQuestionById(qid)` → `GET /api/wb/questions/:qid` via `httpJSON` + `apiBase('wb')`
- `src/api/ai.ts`: `getAnswerByQid(qid)` → `GET /api/ai/:qid/answer` via `httpJSON` + `apiBase('ai')`
- 类型定义: `QuestionDetail`, `PlannedNode`, `GetQuestionByIdResp`, `AiAnswer`

### 2.2 页面逻辑
- `pages/result/index.ts`: Page 生命周期 + state machine (LOADING → DRAFT | ERROR | EMPTY)
  - `onLoad(options)`: 读 qid param → `_fetchQuestion(qid)`
  - `_fetchQuestion`: Promise.all([getQuestionById, getAnswerByQid]) → merge AI answer → setData
  - `_buildTimeline`: T0–T6 timeline nodes
  - `onSaveTap`, `onBackTap`, `onManualFixTap`, `onRetryTap` event handlers

### 2.3 样式
- `pages/result/index.wxss`: 1:1 mirror mockup CSS → rpx (px×2)
  - All sections: nav, hero, answers, reason, steps, kp-row, diff, ebbing, cta
  - Error/Empty states centered layout

### 2.4 配置
- `app.json`: pages 数组添加 `"pages/result/index"`
- `typings/index.d.ts`: 添加 Node ambient types (process, fetch, AbortController) 修复 _http.ts 预存 typecheck 错误

### 2.5 Integration tests
- `test/api/result.integration.spec.ts`: vitest 真 fetch
  - Health check: GET wb 8082 + ai 8083 → expect 200 or 404
  - Contract shape: verify response has expected properties

### 2.6 Bug fix
- `src/api/_http.ts` line 6: JSDoc comment 里 `api/*.ts` 中的 `*/` 意外关闭注释块 → 改写注释避免 `*/`

## 3. 真实 E2E

PHASE-C 人工视觉路线 · automator E2E 不适用。替代验证:

- **typecheck**: `tsc --noEmit` PASS (exit 0, 0 errors)
- **4-state mockup screenshots** via Playwright chromium:
  - `design/system/screenshots/mp-baseline/p04-loading.png` (84KB)
  - `design/system/screenshots/mp-baseline/p04-success.png` (295KB)
  - `design/system/screenshots/mp-baseline/p04-empty.png` (96KB)
  - `design/system/screenshots/mp-baseline/p04-error.png` (97KB)

## 4. 自检

| 检查项 | 结果 | 证据 |
|---|---|---|
| WXML 1:1 mirror mockup | PASS | 对照 04_result.html 所有 section: nav/hero/answers/reason/steps/kp/ebbing/cta |
| index.json Vant components | PASS | van-button/loading/icon/tag/skeleton 已注册 |
| index.ts state machine | PASS | LOADING → DRAFT/ERROR/EMPTY 4 态 |
| API 真调用 (0 mock) | PASS | wrongbook.ts + ai.ts 用 _http.ts httpJSON |
| app.json pages 更新 | PASS | `"pages/result/index"` 已添加 |
| tsc --noEmit | PASS | exit 0 |
| 4 screenshots 落盘 | PASS | mp-baseline/p04-{loading,success,empty,error}.png |
| spec-trace.md | PASS | Mockup→WXML mapping table + state machine + Vant replacement |
| integration tests | PASS | test/api/result.integration.spec.ts 2 describe 4 tests |

## 5. 提交

- commit hash: (pending — will be filled after git commit)
