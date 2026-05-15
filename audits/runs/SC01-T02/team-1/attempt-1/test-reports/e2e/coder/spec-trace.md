# spec-trace · SC01-T02 · P02→P03 跳转

| testid / API | §5 API | §6/§9 状态机 | assertion 行号 |
|---|---|---|---|
| `p02-root` | — | IDLE 初始态 | t02-capture-to-analyzing.spec.ts:245 (beforeEach visible) |
| `subject-chip-math` | — | subject 选择 | t02-capture-to-analyzing.spec.ts:262 |
| `p02-file-input` | — | IDLE→UPLOADING 触发 | t02-capture-to-analyzing.spec.ts:265 (injectFixtureFile) |
| — | POST /api/file/presign | UPLOADING 进度 15% | route mock L112-117 |
| — | PUT /s3/** | UPLOADING 进度 60% | route mock L120-124 |
| — | POST /api/file/complete | UPLOADING 进度 80% | route mock L127-131 |
| — | POST /api/wb/questions 201 | UPLOADING 进度 90% | route mock L134-146 + TI2 ordering L280-282 |
| — | POST /api/ai/analyze-by-url 202 | UPLOADED → nav P03 | route mock L149-154 + AC1 URL assert L270-272 |
| `p03-root` | — | P03 mount (骨架屏) | t02-capture-to-analyzing.spec.ts:277 |
| `analyzing-pipeline` | — | 4 步 wait 态 | t02-capture-to-analyzing.spec.ts:278 |
| — | GET /api/ai/stream/{taskId} SSE | QUEUED→STREAMING | route mock L156-165 + gate |
| — | SSE DONE event | SUCCEEDED→nav P04 | t02-capture-to-analyzing.spec.ts:290-291 |
| `p02-error-banner` | POST /api/wb/questions 500 | ERROR 态 (AC4) | t02-capture-to-analyzing.spec.ts:357 |
| `p02-error-banner` | POST /api/ai/analyze-by-url 500 | ERROR 态 (AC5) | t02-capture-to-analyzing.spec.ts:378 |
| `p03-root` + step1 | GET /api/ai/stream 500 | SSE 失败 (AC6) | t02-capture-to-analyzing.spec.ts:404-406 |
| X-Idempotency-Key | POST /api/wb/questions header | TI1 幂等键 | t02-capture-to-analyzing.spec.ts:455-456 |
| analyze-by-url body | POST /api/ai/analyze-by-url | TI2 请求体 | t02-capture-to-analyzing.spec.ts:523-526 |
