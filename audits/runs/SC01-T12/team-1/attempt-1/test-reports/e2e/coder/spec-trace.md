# spec-trace · SC-01-T12 · P08 Grade → P09 Transition

| testid | §5 API | §9 状态机 | assertion 行号 |
|---|---|---|---|
| p08-grade-buttons-forgot | POST /api/review/nodes/{nid}/grade {FORGOT} | REVEALED → GRADED | t12-exec-to-done.spec.ts:358-366 |
| p08-grade-buttons-partial | POST /api/review/nodes/{nid}/grade {PARTIAL} | REVEALED → GRADED | t12-exec-to-done.spec.ts:217-225 |
| p08-grade-buttons-mastered | POST /api/review/nodes/{nid}/grade {MASTERED} | REVEALED → GRADED (disabled after reveal §6.4) | t12-exec-to-done.spec.ts:213-214 |
| p08-reveal-content | POST /api/review/nodes/{nid}/reveal | ANSWERING → REVEALED | t12-exec-to-done.spec.ts:191-193 |
| p09-root | — (route transition) | GRADED → done.RESULT | t12-exec-to-done.spec.ts:229 |
| p09-hero-title | GET /api/review/nodes/{nid}/result | done.RESULT (MASTERED / FORGOT variant) | t12-exec-to-done.spec.ts:234,372 |
| p09-advance-banner-text | GET /api/review/nodes/{nid}/result | T+1 推进文案 | t12-exec-to-done.spec.ts:242 |
| p09-cta-row-continue-btn | POST /sessions/{sid}/next | done.RESULT → P08 next | t12-exec-to-done.spec.ts:245 |
| p09-cta-row-end-btn | — | done.RESULT → P-HOME | t12-exec-to-done.spec.ts:246 |
| memory-curve | — | 7 nodes T0..T6 visible | t12-exec-to-done.spec.ts:442-447 |
| memory-curve-node-T0..T6 | — | 7 dot rendering | t12-exec-to-done.spec.ts:445-446 |
| X-Idempotency-Key | POST /grade header | 幂等重入保证 | t12-exec-to-done.spec.ts:277-278 |
