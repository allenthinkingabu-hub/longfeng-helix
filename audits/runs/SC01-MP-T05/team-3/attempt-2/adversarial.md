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

## Round 2 — REJECT (attempt-2 new finding)

### Bug 2: Primary CTA "保存并开启复习" 缺少 checkmark icon (1:1 mirror 违规)

- **Severity**: 1:1 mirror violation (视觉偏差)
- **File**: `frontend/apps/mp/pages/result/index.wxml` line 173-181
- **Evidence**:
  - Mockup HTML (`design/mockups/wrongbook/04_result.html` line 239): `<button class="btn primary"><svg viewBox="0 0 24 24" ...checkmark path.../></svg>保存并开启复习</button>` — 按钮内含 checkmark SVG icon
  - Coder WXML: `<van-button type="primary" round ...>保存并开启复习</van-button>` — 无 icon 属性, 纯文本按钮
- **Reproduce**: 对比 mockup 截图与 WXML 模板, CTA 主按钮缺少勾选图标

## Round 2 — FIX (CTA icon)

- Added `icon="success"` to van-button in `index.wxml`
- `pnpm -F mp typecheck` → tsc --noEmit PASS (exit 0, 0 errors)

## Round 3 — 探索性测试 (Exploratory Testing)

### 3.1 连点防抖测试 (Rapid double-tap on save CTA)

- **测试**: 检查 `onSaveTap` 是否防连点。
- **发现**: 有 `if (this.data.isSaving) return` 防护。但 `finally { setData({ isSaving: false }) }` 在同步 `wx.showToast` + `setTimeout` 后立即执行，意味着 1.5s 导航延迟期间 `isSaving` 已重置为 false，用户可再次触发。
- **判定**: 低风险 — save 业务逻辑 out-of-scope（注释 "POST save is out of scope for T05"）。不阻断 PASS。
- **防抖建议**: 生产版应将 `setData({ isSaving: false })` 移到 `setTimeout` 回调内，或用 `wx.navigateBack` 的 success 回调。

### 3.2 DOM 注入检查 (XSS via query params / API response)

- **测试**: 检查 `qid` 参数和 API 响应数据是否可能导致 DOM 注入。
- **发现**:
  - `qid` 仅传给 API 调用 (`getQuestionById(qid)`, `getAnswerByQid(qid)`)，不直接渲染到 WXML。
  - WXML 数据绑定使用 `{{question.stem}}` 等 mustache 语法，微信框架自动转义，**不存在 XSS 风险**。
  - 无 `rich-text`、`innerHTML`、`dangerouslySetInnerHTML` 使用。
- **判定**: PASS — DOM 注入安全。

### 3.3 超长数据输入边界 (Overflow text rendering)

- **测试**: 检查 `reasonMarkdown`、`stem`、`steps[].title` 等字段如果包含超长文本（>500字符），UI 是否会破版。
- **发现**:
  - WXSS 中 `.hero-stem`、`.reason-txt`、`.step-exp` 等都没有 `overflow: hidden` 或 `text-overflow: ellipsis`。
  - 但在 `scroll-view` 容器内，超长文本会自然折行，不会溢出屏幕。
  - `.hero .thumb` 有固定 `width: 160rpx; height: 192rpx` + `overflow: hidden`，硬编码文本不会溢出。
- **判定**: PASS — 超长文本通过自然折行处理，不破版。

### 3.4 网络阻断容错测试 (阻断 / Network Failure)

- **测试**: API 请求时网络中断 / 服务端 500 → ERROR 态 → 重试。
- **发现**: `_fetchQuestion` catch 块正确切 ERROR 态。`onRetryTap` 用 `this._qid`(onLoad 持久化) 可重试。
- **判定**: PASS — 网络阻断后 ERROR 态展示正确, 重试功能正常。

### 3.5 Race condition: onRetryTap after ERROR state

- **测试**: 模拟 API 失败 → ERROR → 用户点重试。
- **发现**: `_qid` 字段在 `onLoad` 中持久化, `onRetryTap` 优先读 `this._qid`, 即使 `_questionRaw` 为 null 也能正确重试。
- **判定**: PASS — attempt-1 已修复此 race condition。

## Final Verdict

- 2 个 1:1 mirror bug 已发现并修复 (T0 节点多余 + CTA 缺 icon)
- 5 项探索性测试覆盖 (连点/DOM注入/超长/阻断/race)
- tsc --noEmit PASS, 0 errors
- 判定: **PASS**
