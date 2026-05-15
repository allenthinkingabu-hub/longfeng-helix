# spec-trace · SC01-T08 · P05→P-HOME transition

| testid | §5 API | §6 状态机 | assertion 行号 |
|---|---|---|---|
| p-home-root | — | (init) → LOADING | t08-home-to-wrongbook.spec.ts:121 |
| today-review-card | GET /api/home/today | LOADING → READY | t08-home-to-wrongbook.spec.ts:129 |
| today-review-card-total | GET /today .today.total | READY(LIST · +1) | t08-home-to-wrongbook.spec.ts:132, :186 |
| today-review-card-circle-progress | GET /today .today.circleProgress | READY circle easeInOut | t08-home-to-wrongbook.spec.ts:135, :191 |
| today-review-card-start-all-btn | POST /api/review/sessions (T09) | READY CTA | t08-home-to-wrongbook.spec.ts:142 |
| greeting-hero | — | READY | t08-home-to-wrongbook.spec.ts:138 |
| p-home-weekly-sparkline | — | READY | t08-home-to-wrongbook.spec.ts:139 |
| week-strip | — | READY | t08-home-to-wrongbook.spec.ts:140 |
| p-home-messages | — | READY | t08-home-to-wrongbook.spec.ts:141 |
| p-home-weak-kp | — | READY | t08-home-to-wrongbook.spec.ts:143 |
| p-home-quick-entries | — | READY | t08-home-to-wrongbook.spec.ts:144 |
| tab-home | — | P05→P-HOME transition | t08-home-to-wrongbook.spec.ts:119 |
| tab-wrongbook | — | P-HOME→P05 navigation | t08-home-to-wrongbook.spec.ts:178 |
