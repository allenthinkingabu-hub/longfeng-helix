# spec-trace.md · SC01-T04 · Coder team-1 attempt-1

| testid / API path | §5 API | §6/§9 状态机 | assertion 行号 |
|---|---|---|---|
| `p03-root` | — (P03 page root) | entry → QUEUED | t04-analyze-done-to-result.spec.ts:209 |
| SSE `/api/ai/stream/{taskId}` | P03 §5 行 1 GET SSE | QUEUED → STREAMING → SUCCEEDED | t04-analyze-done-to-result.spec.ts:155-165 (route) |
| `p04-root` | — (P04 page root) | LOADING → DRAFT | t04-analyze-done-to-result.spec.ts:224 |
| `p04-question-hero` | GET `/api/wb/questions/{qid}` P04 §5 行 1 | DRAFT render | t04-analyze-done-to-result.spec.ts:228, 240 |
| `p04-answers-row` | GET response `.question.myAnswer + correctAnswer` | DRAFT render | t04-analyze-done-to-result.spec.ts:243 |
| `p04-reason-card` | GET response `.question.reasonMarkdown` | DRAFT render | t04-analyze-done-to-result.spec.ts:246 |
| `p04-solution-stepper` | GET response `.question.steps[]` | DRAFT render | t04-analyze-done-to-result.spec.ts:249 |
| `p04-meta-chips` | GET response `.question.knowledgePoints + difficulty` | DRAFT render | t04-analyze-done-to-result.spec.ts:253 |
| `memory-curve` | GET response `.plannedNodes[]` (T1-T6) | DRAFT render | t04-analyze-done-to-result.spec.ts:256 |
| `result-timeline-node-T0` | — (FE computed T0=now) | TI1: T0=now visible | t04-analyze-done-to-result.spec.ts:259 |
| `result-lowconf-banner` | GET response `.question.confidence < 0.6` | LOW_CONF → 黄条 | t04-analyze-done-to-result.spec.ts:305 |
| `result-confirm-modal` | — (FE state) | LOW_CONF → confirmOpen | t04-analyze-done-to-result.spec.ts:319 |
| `result-confirm-no-btn` | — | confirmOpen → LOW_CONF | t04-analyze-done-to-result.spec.ts:322 |
| `result-confirm-yes-btn` | POST `/api/wb/questions/{qid}/save` | confirmOpen → SAVING | t04-analyze-done-to-result.spec.ts:328 |
| nav `/question/{qid}/result` | P03 §6 SUCCEEDED → nav | SUCCEEDED → DRAFT transition | t04-analyze-done-to-result.spec.ts:220 |
