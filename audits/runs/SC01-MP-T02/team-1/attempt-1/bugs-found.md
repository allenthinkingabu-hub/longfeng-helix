# Bugs Found · SC01-MP-T02 · attempt-1

## Bug 1: capture navigateTo passed wrong params to analyzing page
- **File**: `frontend/apps/mp/pages/capture/index.ts:149-154`
- **Description**: navigateTo URL had `qid` + `subject` but analyzing `onLoad` expects `imageUrl` + `subject`. Without `imageUrl`, analyzing falls into demo mode instead of starting real AI analysis.
- **Fix commit**: (see main commit)

## Bug 2: `startAnalyze` / `pollAnalyzeStatus` / `PollAnalyzeStatusResponse` missing from ai.ts
- **File**: `frontend/apps/mp/src/api/ai.ts`
- **Description**: `pages/analyzing/index.ts` imports these but they didn't exist → tsc error
- **Fix commit**: (see main commit)

## Bug 3: `createQuestion` missing from wrongbook.ts
- **File**: `frontend/apps/mp/src/api/wrongbook.ts`
- **Description**: `pages/capture/index.ts` imports `createQuestion` but it wasn't exported → tsc error
- **Fix commit**: (see main commit)

## Pre-existing (NOT fixed — scope_out per Rule 3 Surgical):

## Bug 4: review-exec page imports missing API functions
- **File**: `frontend/apps/mp/pages/review-exec/index.ts:7`
- **Description**: Imports `getNode`, `revealNode`, `gradeNode` from `src/api/review.ts` which don't exist → tsc error. Pre-existing from wave-1 T11 merge.
- **Fix**: Not in scope for T02. Should be addressed by the review-exec task owner.
