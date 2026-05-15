# spec-trace · SC01-T05 · P04 Save to Wrongbook

| testid | §5 API | §6 状态机 | §9 异常 | assertion 行号 |
|---|---|---|---|---|
| p04-root | — | LOADING→DRAFT | — | t05-result-save.spec.ts:151 |
| p04-question-hero | GET /api/wb/questions/{qid} | DRAFT (content visible) | — | t05-result-save.spec.ts:157 |
| p04-answers-row | GET /api/wb/questions/{qid} | DRAFT | — | t05-result-save.spec.ts:158 |
| p04-reason-card | GET /api/wb/questions/{qid} | DRAFT | — | t05-result-save.spec.ts:159 |
| p04-solution-stepper | GET /api/wb/questions/{qid} | DRAFT | — | t05-result-save.spec.ts:160 |
| p04-meta-chips | GET /api/wb/questions/{qid} | DRAFT | — | t05-result-save.spec.ts:161 |
| memory-curve | GET /api/wb/questions/{qid} | DRAFT | — | t05-result-save.spec.ts:162 |
| p04-save-cta | POST /api/wb/questions/{qid}/save | DRAFT→SAVING | — | t05-result-save.spec.ts:165-170 |
| result-save-loading | POST /save (AC1 spinner) | SAVING | — | t05-result-save.spec.ts:174 |
| (POST body) | POST /save strategyCode=EBBINGHAUS_STD + X-Request-Id (AC2) | SAVING | — | t05-result-save.spec.ts:186-191 |
| (navigation) | — | SAVING→SAVED→nav /wrongbook | — | t05-result-save.spec.ts:194 |
| result-save-toast | POST /save 5xx (AC5) | SAVING→DRAFT | 5xx toast 保存中… | t05-result-save.spec.ts:215-217 |
| result-lowconf-banner | — | LOW_CONF (conf<0.6) | 低置信度黄条 | t05-result-save.spec.ts:290 |
| result-confirm-modal | — | LOW_CONF→confirmOpen | TC-01.04 强制确认 | t05-result-save.spec.ts:296 |
| result-confirm-no-btn | — | confirmOpen→LOW_CONF | — | t05-result-save.spec.ts:299 |
| result-confirm-yes-btn | POST /save | confirmOpen→SAVING | TC-01.04 确认保存 | t05-result-save.spec.ts:304 |
