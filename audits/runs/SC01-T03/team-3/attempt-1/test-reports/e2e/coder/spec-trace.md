| testid | §5 API | §6 状态机 | assertion 行号 |
|---|---|---|---|
| p03-root | — | (entry) → QUEUED | t03-ai-stream-pipeline.spec.ts:165 |
| analyzing-pipeline-step-1 | GET /api/ai/stream/{taskId} | STREAMING (STEP_START 1 → now) | t03-ai-stream-pipeline.spec.ts:223-225 |
| analyzing-pipeline-step-2 | GET /api/ai/stream/{taskId} | STREAMING (STEP_DONE 2 → done) | t03-ai-stream-pipeline.spec.ts:258-260 |
| analyzing-pipeline-step-3 | GET /api/ai/stream/{taskId} | STREAMING (STEP_START 3 → now) | t03-ai-stream-pipeline.spec.ts:312-316 |
| analyzing-pipeline-step-4 | GET /api/ai/stream/{taskId} | STREAMING (STEP_DONE 4 → done) | t03-ai-stream-pipeline.spec.ts:312-316 |
| analyzing-pipeline-json-stream | GET /api/ai/stream (PARTIAL_JSON) | STREAMING (chunk append) | t03-ai-stream-pipeline.spec.ts:72-78 |
| analyzing-pipeline-model-badge | — | SLOW (FALLBACK_MODEL → gpt-4o-mini) | t03-ai-stream-pipeline.spec.ts:254-255 |
| p03-fallback-banner | — | SLOW (黄条 visible) | t03-ai-stream-pipeline.spec.ts:249-251 |
| analyzing-pipeline-cancel-btn | POST /api/ai/cancel/{taskId} | → CANCELLED → nav P-HOME | t03-ai-stream-pipeline.spec.ts:276-295 |
| ai-pipeline-step-1..4 (alias) | — | alias visible alongside canonical | t03-ai-stream-pipeline.spec.ts:329-331 |
| ai-typewriter (alias) | — | alias visible | t03-ai-stream-pipeline.spec.ts:334 |
| ai-cancel-btn (alias) | — | alias visible | t03-ai-stream-pipeline.spec.ts:337 |
| (2x FAIL) | POST /api/ai/fallback/{taskId} | FAILED → nav /manual-entry | t03-ai-stream-pipeline.spec.ts:396 |
| analyzing-pipeline (aria-live) | — | aria-live=polite | t03-ai-stream-pipeline.spec.ts:413 |
| analyzing-pipeline-step-1 (aria-busy) | — | now → aria-busy=true | t03-ai-stream-pipeline.spec.ts:418-419 |
