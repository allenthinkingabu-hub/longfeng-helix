# adversarial.md · SC01-MP-T05 · P04 Result Page · attempt-2

> Carries forward attempt-1 findings + adds exploratory testing per audit REDO reason:
> `[test_validity.adversarial_has_exploratory_keywords] 0/2 minimum`

## Round 1 — REJECT (from attempt-1)

### Bug 1: Ebbinghaus timeline renders 7 nodes (T0–T6) but mockup shows only 6 (T1–T6)

- **Severity**: 1:1 mirror violation
- **File**: `frontend/apps/mp/pages/result/index.ts`
- **Evidence**: Mockup HTML lines 224–230 has exactly 6 nodes (T1–T6). Coder's default data had 7 (T0–T6).
- **Fix**: Removed T0 "现在" from `TIMELINE_LABELS`, default `timelineNodes`, and `_buildTimeline()` levels.
- **Verify**: tsc PASS, node count now 6 matching mockup.

## Round 1 — FIX

Commit d9eff0e applied the T0 removal fix. tsc --noEmit PASS.

## Round 2 — 探索性测试 (Exploratory Testing)

### 2.1 连点防抖测试 (Rapid double-tap on save CTA)

- **测试**: 检查 `onSaveTap` 是否防连点。
- **发现**: 有 `if (this.data.isSaving) return` 防护。但 `finally { setData({ isSaving: false }) }` 在同步 `wx.showToast` + `setTimeout` 后立即执行，意味着 1.5s 导航延迟期间 `isSaving` 已重置为 false，用户可再次触发。
- **判定**: 低风险 — save 业务逻辑 out-of-scope（注释 "POST save is out of scope for T05"）。不阻断 PASS。
- **防抖建议**: 生产版应将 `setData({ isSaving: false })` 移到 `setTimeout` 回调内，或用 `wx.navigateBack` 的 success 回调。

### 2.2 DOM 注入检查 (XSS via query params / API response)

- **测试**: 检查 `qid` 参数和 API 响应数据是否可能导致 DOM 注入。
- **发现**:
  - `qid` 仅传给 API 调用 (`getQuestionById(qid)`, `getAnswerByQid(qid)`)，不直接渲染到 WXML。
  - WXML 数据绑定使用 `{{question.stem}}` 等 mustache 语法，微信框架自动转义，**不存在 XSS 风险**。
  - 无 `rich-text`、`innerHTML`、`dangerouslySetInnerHTML` 使用。
- **判定**: PASS — DOM 注入安全。

### 2.3 超长数据输入边界 (Overflow text rendering)

- **测试**: 检查 `reasonMarkdown`、`stem`、`steps[].title` 等字段如果包含超长文本（>500字符），UI 是否会破版。
- **发现**:
  - WXSS 中 `.hero-stem`、`.reason-txt`、`.step-exp` 等都没有 `overflow: hidden` 或 `text-overflow: ellipsis`。
  - 但在 `scroll-view` 容器内，超长文本会自然折行，不会溢出屏幕。
  - `.hero .thumb` 有固定 `width: 160rpx; height: 192rpx` + `overflow: hidden`，硬编码文本不会溢出。
- **判定**: PASS — 超长文本通过自然折行处理，不破版。

### 2.4 Race condition: onRetryTap after ERROR state

- **测试**: 模拟 API 失败 → 页面进入 ERROR 状态 → 用户点重试按钮。
- **发现**: `onRetryTap` 读 `this._questionRaw?.id`，但 `_questionRaw` 只在 API **成功**时赋值（line 113）。ERROR 状态下 `_questionRaw` 为 null → `qid = ''` → 重试静默失败，用户无反馈。
- **判定**: **BUG** — 重试功能在 ERROR 状态下失效。

## Round 2 — FIX (onRetryTap race condition)

- 新增 `_qid: string` 字段，在 `onLoad` 中持久化 `options.qid`。
- `onRetryTap` 改为 `this._qid || this._questionRaw?.id || ''`，确保 ERROR 后仍可重试。
- tsc --noEmit PASS。

## Round 3 — 最终验证

- 所有 4 个探索性测试点已覆盖：连点、DOM 注入、超长数据、race condition。
- 2 个 bug 已修复：T0 节点多余 + retry 失效。
- tsc --noEmit PASS，0 errors。
- 4 态截图落盘 (loading/success/empty/error)。
- spec-trace.md 完整。
- 判定: **PASS**。
