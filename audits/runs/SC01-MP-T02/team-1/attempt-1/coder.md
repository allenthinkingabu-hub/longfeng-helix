# Coder Report · SC01-MP-T02 · P02→P03 capture→analyzing transition

## 1. 地形侦察

- Read `pages/capture/index.ts` (wave-1 T01): already had navigateTo but passed `qid` + `subject` — analyzing page expects `imageUrl` + `subject`
- Read `pages/analyzing/index.ts` (wave-1 T03): `onLoad` uses `options.imageUrl` for `_startAnalysis`; imports `startAnalyze` + `pollAnalyzeStatus` from `src/api/ai.ts`
- Read `src/api/ai.ts`: only exported `getAnswerByQid` — missing `startAnalyze`, `pollAnalyzeStatus`, `PollAnalyzeStatusResponse` (tsc break)
- Read `src/api/wrongbook.ts`: only exported `getQuestionById` — missing `createQuestion` (tsc break, capture imports it)
- Read H5 sibling `frontend/apps/h5/src/pages/Capture/index.tsx`: calls `analyzeByUrl` before navigating, passes `taskId` in route
- Read `design/mockups/wrongbook/02_capture.html` + `03_analyzing.html`: P02 shutter → capture → P03 AI analyzing with 4-step progress
- Identified pre-existing tsc errors: `pages/review-exec/index.ts` imports `getNode`, `revealNode`, `gradeNode` from `src/api/review.ts` which don't exist

## 2. 编码

### Changes made:

1. **`src/api/ai.ts`** — Added missing `startAnalyze`, `pollAnalyzeStatus`, `StartAnalyzeRequest`, `StartAnalyzeResponse`, `PollAnalyzeStatusResponse` exports. These are required by `pages/analyzing/index.ts` imports. Without them tsc fails.

2. **`src/api/wrongbook.ts`** — Added missing `createQuestion`, `CreateQuestionReq`, `CreateQuestionResp` exports. Required by `pages/capture/index.ts` import.

3. **`pages/capture/index.ts`** (line 149-155) — Fixed navigateTo URL params:
   - Before: `qid=${created.qid}&subject=${this.data.subject}` (analyzing ignores `qid` in onLoad)
   - After: `imageUrl=${imageUrl}&subject=${this.data.subject}&qid=${created.qid}` (analyzing uses `imageUrl` to kick off `_startAnalysis`)

4. **`test/transitions/capture-to-analyzing.spec.ts`** — New vitest test with 3 cases:
   - Happy path: verifies `wx.navigateTo` called with correct URL containing `imageUrl`, `subject`, `qid`
   - State: verifies `UPLOADED` state + `uploadPct=100` after successful upload
   - Error: verifies oversized file (>10MB) sets `ERROR` state without navigation
   - Mock scope: wx runtime only (wx.request, wx.uploadFile, wx.navigateTo) — 0 backend mock

## 3. 真实 E2E

> dor_c1_to_c6_required=false per inflight — wave-2 transition task, vitest + tsc only

### Vitest results:
```
✓ test/transitions/capture-to-analyzing.spec.ts (3 tests) 3ms
  ✓ handleCapture triggers wx.navigateTo with imageUrl + subject + qid
  ✓ state transitions to UPLOADED before navigation
  ✓ oversized file sets ERROR state without navigating
```

### tsc results:
```
0 errors from T02 changes
3 pre-existing errors in review-exec/index.ts (not my changes)
```

## 4. 自检

| Step | Done? | Evidence |
|------|-------|----------|
| transition action in capture | Yes | `pages/capture/index.ts:149-155` |
| vitest 0 backend mock | Yes | `test/transitions/capture-to-analyzing.spec.ts` — only wx runtime mocked |
| tsc --noEmit pass (my changes) | Yes | `npx tsc --noEmit 2>&1 \| grep -v review-exec` → 0 errors |
| coder.md 5 sections | Yes | This file |
| bugs-found.md | Yes | See companion file |
| spec-trace.md | Yes | See companion file |

## 5. 提交

Commit hash: ffa0acc
