# spec-trace.md · SC01-MP-T04 · P03→P04 transition

| testid / API | §5 API | §9 状态机 | assertion 位置 |
|---|---|---|---|
| wx.navigateTo (P03→P04) | GET /api/ai/tasks/:taskId/status → SUCCEEDED | analyzing → success → navigate | analyzing-to-result.spec.ts:73-76 |
| qid from onLoad options | — | init (options.qid captured) | analyzing-to-result.spec.ts:128-131 |
| taskId fallback as qid | GET /api/ai/tasks/:taskId/status → SUCCEEDED | analyzing → success → navigate (qid=taskId) | analyzing-to-result.spec.ts:95-98 |
| FAILED no navigate | GET /api/ai/tasks/:taskId/status → FAILED | analyzing → error (no nav) | analyzing-to-result.spec.ts:116-117 |
| RUNNING no navigate | GET /api/ai/tasks/:taskId/status → RUNNING | analyzing (intermediate, no nav) | analyzing-to-result.spec.ts:137-138 |
