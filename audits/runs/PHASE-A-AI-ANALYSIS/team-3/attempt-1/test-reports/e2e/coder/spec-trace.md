# spec-trace · PHASE-A-AI-ANALYSIS · attempt-1

| # | Endpoint | A04 Spec Section | IT Assertion | IT File:Line |
|---|---|---|---|---|
| A04-01 | POST /api/ai/analyze-by-url | §1.1 AnalyzeController.analyzeByUrl | 202 + taskId + DB persist | AiAnalysisIT.java:46 |
| A04-02 | POST /api/ai/analyze-by-url | §1.1 auto-taskId | auto-gen when not provided | AiAnalysisIT.java:65 |
| A04-03 | GET /api/ai/result/{taskId} | §1.1 AnalyzeController.result | poll DONE after pipeline | AiAnalysisIT.java:85 |
| A04-04 | GET /api/ai/result/{taskId} | §1.1 unknown taskId | NOT_FOUND | AiAnalysisIT.java:98 |
| A04-05 | POST /api/ai/cancel/{taskId} | §1.1 AiCancelController.cancel | 200 CANCELLED | AiAnalysisIT.java:114 |
| A04-06 | POST /api/ai/cancel/{taskId} | §1.1 cancel idempotent | unknown taskId → CANCELLED | AiAnalysisIT.java:127 |
| A04-07 | POST /api/ai/fallback/{taskId} | §1.1 AiFallbackController.fallback | FALLBACK + manual_form + ocrText | AiAnalysisIT.java:142 |
| A04-08 | GET /api/ai/models | §1.1 AiModelsController.listModels | NORMAL → 1 model | AiAnalysisIT.java:161 |
| A04-09 | GET /api/ai/models | §1.1 tier filtering | VIP → 3 models | AiAnalysisIT.java:170 |
| A04-10 | GET /api/ai/models | §1.1 tier filtering | VIP_PLUS → 4 models | AiAnalysisIT.java:178 |
| A04-11 | GET /analysis/{itemId} | §1.1 AnalysisController.latest | 404 for nonexistent | AiAnalysisIT.java:186 |
| A04-12 | GET /analysis/{itemId}/similar | §1.1 AnalysisController.similar | empty list stub | AiAnalysisIT.java:193 |
| A04-13 | GET /analysis/provider | §1.1 AnalysisController.provider | active=qianwen | AiAnalysisIT.java:201 |
| A04-14 | full pipeline | §1-§2 all endpoints | 202 → DONE → result → DB | AiAnalysisIT.java:218 |

## 7 Event Types Coverage

| Event Type | Factory Method | Pipeline Step | Tested In |
|---|---|---|---|
| STEP_START | AnalysisChunk.stepStart(step) | Steps 1-4 | A04-14 (full pipeline) |
| STEP_DONE | AnalysisChunk.stepDone(step, ms) | Steps 1-4 | A04-14 (full pipeline) |
| PARTIAL_JSON | AnalysisChunk.partialJson(fragment) | Steps 2-3 | A04-14 (full pipeline) |
| DONE | AnalysisChunk.done(result) | Final | A04-03, A04-14 |
| FAIL | AnalysisChunk.fail(errorCode) | On error | A04-07 (fallback emits fail) |
| CANCELLED | AnalysisChunk.cancelled() | On cancel | A04-05, A04-06 |
| FALLBACK_MODEL | AnalysisChunk.fallbackModel(from,to) | On provider switch | Via FallbackOrchestrator |
