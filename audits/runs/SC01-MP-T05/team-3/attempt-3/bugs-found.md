# bugs-found.md · SC01-MP-T05 · attempt-3

> Consolidated from attempt-1 (Coder) + attempt-2 (Tester adversarial).

## Bug 1: _http.ts JSDoc comment prematurely closed by `*/` in glob pattern

- **File**: `frontend/apps/mp/src/api/_http.ts` line 6
- **Description**: JSDoc block comment contained `api/*.ts` which has `*/` that terminates the comment prematurely.
- **Fix**: Rewrote comment to avoid `*/` inside comment body.
- **Commit**: cd44386

## Bug 2: Missing Node ambient types for dual-runtime _http.ts

- **File**: `frontend/apps/mp/typings/index.d.ts`
- **Description**: `_http.ts` uses `process.env`, `fetch`, `AbortController` for vitest/Node code path but MP tsconfig only has `miniprogram-api-typings`.
- **Fix**: Added ambient type declarations.
- **Commit**: cd44386

## Bug 3: Ebbinghaus timeline had 7 nodes (T0–T6) instead of mockup's 6 (T1–T6)

- **File**: `frontend/apps/mp/pages/result/index.ts`
- **Description**: Extra T0 "现在" node not present in mockup. 1:1 mirror violation.
- **Fix**: Removed T0 from TIMELINE_LABELS, default data, and _buildTimeline().
- **Commit**: d9eff0e

## Bug 4: onRetryTap silent failure after ERROR state

- **File**: `frontend/apps/mp/pages/result/index.ts`
- **Description**: `onRetryTap` read `_questionRaw?.id` but `_questionRaw` is only set on API success. After ERROR, retry silently does nothing.
- **Fix**: Added `_qid` field persisted from `onLoad`, used as fallback in retry.
- **Commit**: 47a9815
