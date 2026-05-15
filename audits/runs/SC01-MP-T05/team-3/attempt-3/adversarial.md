# adversarial.md · SC01-MP-T05 · P04 Result Page · attempt-3

> Consolidated from attempt-1 + attempt-2 adversarial rounds.

## Round 1 — REJECT

### Bug: Ebbinghaus timeline renders 7 nodes (T0–T6) but mockup shows only 6 (T1–T6)

- **Severity**: 1:1 mirror violation
- **File**: `frontend/apps/mp/pages/result/index.ts`
- **Evidence**: Mockup HTML lines 224–230 has exactly 6 nodes (T1–T6). Code had 7 (T0–T6).
- **Fix**: Removed T0 from TIMELINE_LABELS, default data, _buildTimeline(). Commit d9eff0e.

## Round 1 — FIX

tsc --noEmit PASS. Node count now 6 matching mockup.

## Round 2 — 探索性测试 (Exploratory Testing)

### 2.1 连点防抖测试 (Rapid double-tap on save CTA)

- **测试**: 检查 `onSaveTap` 是否防连点。
- **发现**: 有 `isSaving` guard，但 finally 块立即重置。低风险 — save 逻辑 out-of-scope。
- **判定**: PASS (不阻断)。

### 2.2 DOM 注入检查 (XSS via query params / API response)

- **测试**: 检查 qid 和 API 数据是否可能导致 DOM 注入。
- **发现**: WXML mustache 语法自动转义。无 rich-text/innerHTML。
- **判定**: PASS — DOM 注入安全。

### 2.3 超长数据输入边界 (Overflow text rendering)

- **测试**: 检查超长 stem/reason/steps 文本是否破版。
- **发现**: scroll-view 容器自然折行，thumb 有 overflow:hidden。
- **判定**: PASS。

### 2.4 Race condition: onRetryTap after ERROR state

- **测试**: API 失败后点重试。
- **发现**: `_questionRaw` 为 null 导致 retry 静默失败。
- **判定**: **BUG** → 修复: 新增 `_qid` 字段。Commit 47a9815。

## Round 2 — FIX

`_qid` 持久化 + `onRetryTap` fallback。tsc PASS。

## Round 3 — 最终验证 PASS

4 个探索性测试覆盖，2 个 bug 已修复，tsc PASS，4 态截图落盘。
