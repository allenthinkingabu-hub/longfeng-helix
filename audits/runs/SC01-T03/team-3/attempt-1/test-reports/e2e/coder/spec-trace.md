# spec-trace.md · SC01-T03 · attempt-1

| testid / API path | §5 API | §9 状态机 | assertion 行号 |
|---|---|---|---|
| `analyzing-pipeline-step-1..4` | GET /api/ai/stream/{taskId} (SSE STEP_START/DONE) | QUEUED→STREAMING (step wait→now→done) | t03-ai-stream-pipeline.spec.ts:202-205 (idle wait check) + :207 (DONE→nav) |
| `analyzing-pipeline-json-stream` | GET /api/ai/stream/{taskId} (SSE PARTIAL_JSON) | STREAMING (chunk append) | t03-ai-stream-pipeline.spec.ts — verified via AC3 in a11y test |
| `p03-fallback-banner` + `analyzing-pipeline-model-badge` | GET /api/ai/stream/{taskId} (SSE FALLBACK_MODEL) | STREAMING→SLOW (黄条+model switch) | t03-ai-stream-pipeline.spec.ts:253-260 |
| `analyzing-pipeline-cancel-btn` | POST /api/ai/cancel/{taskId} | STREAMING/SLOW→CANCELLED | t03-ai-stream-pipeline.spec.ts:279-293 |
| FAIL ×2 → `/manual-entry` | POST /api/ai/fallback/{taskId} | FAILED (failCount≥2) → nav manual-entry | t03-ai-stream-pipeline.spec.ts:390 |
| pipeline `aria-live=polite` + step `aria-busy=true` | — | now state a11y | t03-ai-stream-pipeline.spec.ts:410-420 |
| alias testids `ai-pipeline-step-1..4` + `ai-typewriter` + `ai-cancel-btn` | — | — | t03-ai-stream-pipeline.spec.ts:330-339 |
