# spec-trace · SC01-T09 · attempt-1

| testid | §5 API | §6 状态机 | assertion 行号 |
|---|---|---|---|
| `p-home-root` | — | mount → LOADING → READY | t09-home-to-review-target.spec.ts:138 |
| `today-review-card` | GET /api/home/today | READY(LIST) | t09-home-to-review-target.spec.ts:140 |
| `today-review-card-total` | GET /api/home/today → today.total | READY | t09-home-to-review-target.spec.ts:142 |
| `today-review-card-start-all-btn` | POST /api/review/sessions | READY → (导出 P07) | t09-home-to-review-target.spec.ts:144,157 |
| `today-review-card-circle-progress` | GET /api/home/today → circleProgress | READY | t09-home-to-review-target.spec.ts:139 (implicit) |
| `p07-root` | — | today.LIST | t09-home-to-review-target.spec.ts:161,173 |
| `today-review-card` (P07) | GET /api/review/today | today.LIST | t09-home-to-review-target.spec.ts:176 |
| `today-review-card-total` (P07) | GET /api/review/today → totalCount | today.LIST | t09-home-to-review-target.spec.ts:179 |
| `today-review-card-done` | GET /api/review/today → doneCount | today.LIST | t09-home-to-review-target.spec.ts:182 |
| `today-review-card-est-min` | computed from total*3 | today.LIST | t09-home-to-review-target.spec.ts:185 |
| `today-review-card-progress-bar` | computed doneCount/totalCount | today.LIST | t09-home-to-review-target.spec.ts:188 |
| `p07-hero-progress-pct` | computed | today.LIST | t09-home-to-review-target.spec.ts:191 |
| `today-review-card-mastery-pct` | hardcoded 72% (Phase 1+) | today.LIST | t09-home-to-review-target.spec.ts:194 |
| `today-review-card-particles` | — (decorative) | today.LIST | t09-home-to-review-target.spec.ts:197 |
| `p07-bottom-cta-start-all-btn` | POST /api/review/sessions | today.LIST → session.OPEN | t09-home-to-review-target.spec.ts:200 |
| `p07-slot-{key}-header` | GET /api/review/today → slots | today.LIST slot render | t09-home-to-review-target.spec.ts:214-216 |
