# adversarial.md · SC01-MP-T05 · P04 Result Page · attempt-1

## Round 1 — REJECT

### Bug: Ebbinghaus timeline renders 7 nodes (T0–T6) but mockup shows only 6 (T1–T6)

- **Severity**: 1:1 mirror violation
- **File**: `frontend/apps/mp/pages/result/index.ts`
- **Evidence**:
  - Mockup HTML (`design/mockups/wrongbook/04_result.html` lines 224–230): exactly 6 `<div class="node">` elements labelled T1, T2, T3, T4, T5, T6. First node (T1) has `.first` class.
  - Coder's `index.ts` lines 67–75 (default data) had 7 entries: `T0 "现在"`, T1, T2, T3, T4, T5, T6.
  - `_buildTimeline()` also used `['T0', 'T1', ..., 'T6']` (7 levels).
  - `TIMELINE_LABELS` constant had 7 labels including `'现在'`.
  - WXML line 150: `"保存后将在日历自动生成 6 个复习节点"` contradicts 7 rendered nodes.
- **Reproduce**: count `<view class="node">` rendered at runtime — 7 instead of mockup's 6.
- **Expected**: T1–T6 only (6 nodes), matching mockup exactly. T1 should get `node-first` class (index === 0).

## Round 1 — FIX

Applied 3 edits to `frontend/apps/mp/pages/result/index.ts`:

1. `TIMELINE_LABELS`: removed `'现在'` entry → `['15:28', '明日', '4/24', '4/28', '5/6', '5/21']` (6 labels)
2. Default `timelineNodes` data: removed `{ tLevel: 'T0', label: '现在' }` → 6 entries T1–T6
3. `_buildTimeline()` levels: `['T0', ..., 'T6']` → `['T1', ..., 'T6']` (6 levels)

### Re-verification after fix

- `pnpm -F mp typecheck` → tsc --noEmit PASS (exit 0, 0 errors)
- Timeline nodes count now matches mockup: 6 nodes (T1–T6)
- First node (T1, index === 0) correctly gets `node-first` class via WXML `{{index === 0 ? 'node-first' : ''}}`
- "6 个复习节点" text now consistent with rendered count
