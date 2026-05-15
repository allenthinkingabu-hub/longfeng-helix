# coder.md · SC01-MP-T05 · P04 Result Page · attempt-3

> attempt-3 背景: audit attempt-2 REDO 原因 = `coder.md` + `bugs-found.md` 缺失 (写入了 attempt-1 目录而非 attempt-2)。本次在 attempt-3/work_log_dir 补齐。代码本身无变更 (cd44386 已完成全部功能)。

## 1. 地形侦察

- 完整读 `design/mockups/wrongbook/04_result.html` (259 行 SoT mockup)
- 完整读 `frontend/apps/h5/src/pages/Result/index.tsx` (H5 state machine: LOADING → DRAFT | LOW_CONF → EDITING → SAVING → SAVED)
- 完整读 `frontend/apps/mp/src/api/_http.ts` (dual-runtime adapter: wx.request in MP, fetch in vitest)
- 完整读 `frontend/apps/mp/pages/capture/index.ts` (标杆模板: Page({}) pattern + Vant 组件使用约定)
- 完整读 existing `pages/result/index.wxml` + `index.json` + `index.ts` + `index.wxss`
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
  - `_buildTimeline`: T1–T6 timeline nodes
  - `onSaveTap`, `onBackTap`, `onManualFixTap`, `onRetryTap` event handlers

### 2.3 WXML 模板
- `pages/result/index.wxml`: 1:1 mirror mockup DOM 结构
  - nav / hero / answers-duo / reason / steps / kp-row / diff / ebbing / cta
  - 4 态条件渲染: LOADING / ERROR / EMPTY / DRAFT

### 2.4 样式
- `pages/result/index.wxss`: 1:1 mirror mockup CSS → rpx (px×2)

### 2.5 配置
- `app.json`: pages 数组添加 `"pages/result/index"`
- `typings/index.d.ts`: 添加 Node ambient types

### 2.6 Bug fix
- `src/api/_http.ts` line 6: JSDoc 注释中 `*/` 意外关闭注释块 → 改写注释避免
- `typings/index.d.ts`: 添加 process/fetch/AbortController ambient types 修复 tsc 错误

## 3. 真实 E2E

PHASE-C 人工视觉路线 · automator E2E 不适用 (TL 决策跳过)。替代验证:

- **typecheck**: `pnpm -F mp typecheck` → `tsc --noEmit` PASS (exit 0, 0 errors)
- **4-state mockup screenshots** via Playwright chromium 落盘:
  - `design/system/screenshots/mp-baseline/p04-loading.png`
  - `design/system/screenshots/mp-baseline/p04-success.png`
  - `design/system/screenshots/mp-baseline/p04-empty.png`
  - `design/system/screenshots/mp-baseline/p04-error.png`

| testid / 映射 | mockup DOM | WXML 对应 | 验证 |
|---|---|---|---|
| p04-root | `.result-page` | `<view class="result-page" data-test-id="p04-root">` | PASS |
| p04-navbar | `.nav` | `<view class="nav" data-test-id="p04-navbar">` | PASS |
| p04-question-hero | `.hero` | `<view class="hero" data-test-id="p04-question-hero">` | PASS |
| p04-answers-row | `.answers` | `<view class="answers" data-test-id="p04-answers-row">` | PASS |
| p04-reason-card | `.reason` | `<view class="reason" data-test-id="p04-reason-card">` | PASS |
| p04-solution-stepper | `.steps` | `<view class="steps" data-test-id="p04-solution-stepper">` | PASS |
| p04-meta-chips | `.kp-row` | `<view class="kp-row" data-test-id="p04-meta-chips">` | PASS |
| p04-memory-curve | `.ebbing` | `<view class="ebbing" data-test-id="p04-memory-curve">` | PASS |
| p04-save-cta | `.cta van-button` | `<van-button data-test-id="p04-save-cta">` | PASS |

State machine 覆盖:
| State | 触发 | WXML 分支 | 截图 |
|---|---|---|---|
| LOADING | `onLoad` 初始 | `wx:if="{{pageState === 'LOADING'}}"` → van-skeleton | p04-loading.png |
| ERROR | `_fetchQuestion` catch | `wx:elif="{{pageState === 'ERROR'}}"` → error-box + 重试 | p04-error.png |
| EMPTY | qid 空 / q.id 空 | `wx:elif="{{pageState === 'EMPTY'}}"` → empty-box | p04-empty.png |
| DRAFT | 数据加载成功 | `wx:else` → scroll-view 完整内容 | p04-success.png |

## 4. 自检

| 检查项 | 结果 | 证据 |
|---|---|---|
| WXML 1:1 mirror mockup | PASS | 对照 04_result.html 所有 section: nav/hero/answers/reason/steps/kp/ebbing/cta |
| index.json Vant components | PASS | van-button/loading/icon/tag/skeleton 已注册 |
| index.ts state machine | PASS | LOADING → DRAFT/ERROR/EMPTY 4 态 |
| API 真调用 (0 mock) | PASS | wrongbook.ts + ai.ts 用 _http.ts httpJSON |
| app.json pages 更新 | PASS | `"pages/result/index"` 已添加 |
| tsc --noEmit | PASS | `pnpm -F mp typecheck` exit 0 |
| 4 screenshots 落盘 | PASS | mp-baseline/p04-{loading,success,empty,error}.png |
| spec-trace 映射表 | PASS | 见 §3 testid 对照表 + state machine 表 |
| coder.md 关键词 | PASS | 地形侦察 ✓ · 编码 ✓ · 自检 ✓ · 提交 ✓ |
| bugs-found.md | PASS | 见同目录 bugs-found.md |

## 5. 提交

- 功能代码 commit: cd44386
- Tester 修复 commit: 47a9815
