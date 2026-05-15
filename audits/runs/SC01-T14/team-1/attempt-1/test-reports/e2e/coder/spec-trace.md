# spec-trace · SC01-T14 · P09→P-HOME

| testid | §5 API | §6 状态机 | assertion 行号 |
|---|---|---|---|
| `p09-cta-row-end-btn` | — (UI tap 触发) | done.ALL_DONE → home.READY | t14-done-to-home.spec.ts:164 |
| `p-home-root` | GET /api/home/today | LOADING → READY | t14-done-to-home.spec.ts:166 |
| `today-review-card-total` | GET /api/home/today → today.total - today.done | READY(LIST·-1) N→N-1 | t14-done-to-home.spec.ts:191 |
| `today-review-card-circle-progress` | GET /api/home/today → today.circleProgress | READY 圆环动画 | t14-done-to-home.spec.ts:195 |
| `today-review-card` | GET /api/home/today | READY → EMPTY(ALL_DONE) | t14-done-to-home.spec.ts:299 |
| `today-review-card-start-all-btn` | POST /api/review/sessions (T09) | READY CTA | t14-done-to-home.spec.ts:311 |
| `week-strip` | — (hardcoded MVP) | READY 渲染 | t14-done-to-home.spec.ts:342 |
| `p-home-quick-entries` | — (hardcoded MVP) | READY 渲染 | t14-done-to-home.spec.ts:343 |
| `p-home-weak-kp` | — (hardcoded MVP) | READY 渲染 | t14-done-to-home.spec.ts:341 |
| VRT `p-home-ready-baseline.png` | — | READY 全屏 | t14-done-to-home.spec.ts:369 |
