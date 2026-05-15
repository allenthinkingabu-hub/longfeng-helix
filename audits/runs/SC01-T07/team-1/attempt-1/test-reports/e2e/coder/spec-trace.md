# spec-trace.md · SC01-T07 · P04→P05 transition + P05 list highlight

| testid | §5 API | §6 状态机 | assertion 行号 |
|---|---|---|---|
| p04-save-cta | POST /api/wb/questions/{qid}/save | DRAFT → SAVING → SAVED | t07-list-highlight-newest.spec.ts:248 |
| wrongbook.list.root | GET /api/wb/questions?sort=... | LOADING → LIST | t07-list-highlight-newest.spec.ts:255 |
| wrongbook.list.item-card + data-highlighted | GET /api/wb/questions?highlight={qid} | LIST → HIGHLIGHTED | t07-list-highlight-newest.spec.ts:263 |
| data-qid={qid} match | GET /api/wb/questions?highlight={qid} | HIGHLIGHTED (AC2 1st item match) | t07-list-highlight-newest.spec.ts:267 |
| wrongbook.list.item-card border-color | — | HIGHLIGHTED → LIST (3s fade) | t07-list-highlight-newest.spec.ts:274 |
| p05-page-header-title | — | LIST (AC4 header render) | t07-list-highlight-newest.spec.ts:301 |
| wrongbook.list.item-card 左色条 | — | LIST (AC4 card elements) | t07-list-highlight-newest.spec.ts:297 |
| stageBar 6 spans | — | LIST (AC4 6-stage progress) | t07-list-highlight-newest.spec.ts:311 |
| wrongbook.list.empty | GET /api/wb/questions → total=0 | LOADING → EMPTY | t07-list-highlight-newest.spec.ts:371 |
| error banner | GET /api/wb/questions → 5xx | LOADING → ERROR | t07-list-highlight-newest.spec.ts:385 |
