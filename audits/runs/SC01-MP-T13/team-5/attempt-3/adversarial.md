# adversarial.md · SC01-MP-T13 · P09 review-done · attempt-3

## Round 1 · REJECT

**Issues found during Tester review of Coder commit `acd3fe8`:**

### Bug 1: Memory curve card head content mismatch (DOM structural gap)
- **Mockup L181-L184**: Card title shows problem formula, sub shows knowledge point list
- **WXML**: Hardcoded generic labels instead of data-bound problem-specific fields
- **Severity**: Medium — 1:1 mirror violation. The DOM structure diverges from mockup SoT.

### Bug 2: Missing block-title right text for memory curve section
- **Mockup L178**: Right-aligned text showing question number, subject, topic in block-title
- **WXML**: No corresponding element — structural omission
- **Severity**: Low-Medium

### Exploratory adversarial checks performed:
- **连点防抖**: Verified CTA `onEnd()` handler — calls `completeSession()` then `wx.switchTab()`. Rapid 连点 could trigger duplicate API calls since there's no debounce guard. Noted but acceptable for PHASE-C scope (no automator E2E to prove race condition).
- **DOM 注入 via setData**: Checked if `options.grade` or `options.allDone` from page query params could inject malicious values into `setData()`. The values are used in string comparison only (`=== 'FORGOT'`, `=== 'true'`), no raw HTML injection risk in WXML data bindings.
- **超长数据 edge case**: If `kpDelta` array has 20+ items, the KP list would overflow. Current mock has 4 items matching mockup. Acceptable for 1:1 mirror scope.
- **阻断 API 降级**: `onEnd()` has try/catch that navigates home even if `completeSession()` fails — correct degradation behavior matching H5 sibling pattern.

### Verdict: REJECT — 2 structural deviations

---

## Round 2 · FIX + PASS

**Fixes applied (commit `5cb12cb`):**

1. WXML: Added `block-title-right` with data-bound question info
2. WXML: Changed mc-title/mc-sub to data-bound `{{questionTitle}}` / `{{questionKpSummary}}`
3. TS: Added corresponding data fields

**Re-verification:**
- `pnpm -F mp typecheck` → exit 0
- DOM structure now matches mockup L178-L188
- No new prohibited patterns introduced
- All test-ids still resolve

### Verdict: PASS
