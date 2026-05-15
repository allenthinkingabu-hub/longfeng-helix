# bugs-found.md · SC01-MP-T13 · attempt-3

## Bug list

1. **Pre-existing: `_http.ts` block comment causes tsc parse error** (from attempt-1)
   - File: `frontend/apps/mp/src/api/_http.ts`
   - Fix: Replaced JSDoc block comment with single-line comments
   - Commit: `acd3fe8`

2. **Pre-existing: `_http.ts` missing type declarations** (from attempt-1)
   - File: `frontend/apps/mp/src/api/_http.ts`
   - Fix: Added ambient `declare` statements
   - Commit: `acd3fe8`

3. **Adversarial: memory curve card head content mismatch** (found by Tester attempt-1)
   - WXML hardcoded generic labels instead of data-bound problem-specific fields
   - Fix: Changed to `{{questionTitle}}` / `{{questionKpSummary}}` bindings
   - Commit: `5cb12cb`

4. **Adversarial: missing block-title right text** (found by Tester attempt-1)
   - Memory curve block-title missing right-aligned question info
   - Fix: Added `block-title-right` with data-bound content
   - Commit: `5cb12cb`
