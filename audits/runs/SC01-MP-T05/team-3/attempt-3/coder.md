# coder.md · SC01-MP-T05 · P04 Result Page · attempt-3

> Carries forward attempt-1 coder work (cd44386) + attempt-2 tester fixes.
> Audit REDO reason: coder.md + bugs-found.md missing from attempt-2 directory.

## 1. 地形侦察

- 完整读 `design/mockups/wrongbook/04_result.html` (259 行 SoT mockup)
- 完整读 `frontend/apps/h5/src/pages/Result/index.tsx` (H5 state machine)
- 完整读 `frontend/apps/mp/src/api/_http.ts` (dual-runtime adapter)
- 完整读 `frontend/apps/mp/pages/capture/index.ts` (标杆模板: Page({}) pattern)
- 完整读 previous attempt-1 coder.md + attempt-2 adversarial.md

## 2. 编码

### Original implementation (attempt-1, commit cd44386)
- `pages/result/index.{json,wxml,wxss,ts}` 全 1:1 mirror mockup
- `src/api/wrongbook.ts` + `src/api/ai.ts` API clients (0 mock)
- `app.json` pages array updated
- `typings/index.d.ts` Node ambient types

### Tester-found fixes (attempt-2, commit 47a9815)
- **Bug fix 1**: Removed extra T0 "现在" node from Ebbinghaus timeline (mockup only has T1–T6)
  - `TIMELINE_LABELS`: 7→6 entries
  - `timelineNodes` default data: 7→6 entries
  - `_buildTimeline()` levels: 7→6 entries
- **Bug fix 2**: `onRetryTap` used `_questionRaw?.id` which is null after ERROR → added `_qid` field persisted from `onLoad`

## 3. 自检

| 检查项 | 结果 | 证据 |
|---|---|---|
| WXML 1:1 mirror mockup | PASS | All sections match 04_result.html |
| Ebbinghaus nodes = 6 (T1–T6) | PASS | Matches mockup (fixed in attempt-2) |
| onRetryTap works after ERROR | PASS | Uses `_qid` fallback (fixed in attempt-2) |
| tsc --noEmit | PASS | exit 0, 0 errors |
| 4 screenshots | PASS | p04-{loading,success,empty,error}.png |
| spec-trace.md | PASS | test-reports/e2e/coder/spec-trace.md |
| app.json updated | PASS | `"pages/result/index"` line 4 |

## 4. 提交

- Original: cd44386 (attempt-1)
- Fixes: d9eff0e (attempt-1 tester commit), 47a9815 (attempt-2 tester + retry fix)
