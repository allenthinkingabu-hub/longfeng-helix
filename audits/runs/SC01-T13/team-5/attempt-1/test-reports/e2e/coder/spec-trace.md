# spec-trace.md · SC01-T13 · P09 ReviewDone

| testid | §5 API | §6 状态机 | assertion 行号 |
|---|---|---|---|
| `p09-root` | — | (mount) → done.LOADING | t13-review-done.spec.ts:115 |
| `celebrate-hero` | GET /api/review/nodes/{nid}/result → 200 | done.LOADING → done.RESULT | t13-review-done.spec.ts:119 |
| `p09-hero-title` | — | done.RESULT ("本题已掌握") | t13-review-done.spec.ts:127 |
| `p09-hero-checkmark` | — | done.RESULT (checkmark visible) | t13-review-done.spec.ts:123 |
| `confetti-burst` | — | done.RESULT (confetti ≤1s, pointer-events:none TI1) | t13-review-done.spec.ts:131-135 |
| `confetti-burst-particle-{0..7}` | — | done.RESULT (8 particles attached) | t13-review-done.spec.ts:138-141 |
| `memory-curve` | GET /result → nodeIndex | done.RESULT (SVG curve card) | t13-review-done.spec.ts:177-178 |
| `memory-curve-node-{T1..T6}` | GET /result → nodeIndex=2 | done.RESULT (T1/T2=done, T3=now, T4-T6=future) | t13-review-done.spec.ts:181-184 |
| `p09-advance-banner` | — | done.RESULT (AI advance text) | t13-review-done.spec.ts:187-188 |
| `p09-advance-banner-text` | GET /result → nodeIndex | done.RESULT (contains "T3") | t13-review-done.spec.ts:167-168 |
| `p09-next-due-card` | GET /result → nextDueAt | done.RESULT (date + calendar) | t13-review-done.spec.ts:208-209 |
| `p09-next-due-card-add-calendar-btn` | POST /api/calendar/events/{eid}/subscribe → 200 | — (AC4 tap → Toast) | t13-review-done.spec.ts:213-225 |
| `p09-stats-row` | — | done.RESULT (3 stat cards) | t13-review-done.spec.ts:234-235 |
| `p09-stats-row-mastered` | — | done.RESULT (contains "Mastered") | t13-review-done.spec.ts:237-239 |
| `p09-stats-row-partial` | — | done.RESULT (contains "Partial") | t13-review-done.spec.ts:241-243 |
| `p09-stats-row-forgot` | — | done.RESULT (contains "Forgot") | t13-review-done.spec.ts:245-247 |
| `p09-kp-chart` | — | done.RESULT (KP bars) | t13-review-done.spec.ts:250-251 |
| `p09-kp-chart-row-{0..3}-bar-new` | — | done.RESULT (4 bar fills) | t13-review-done.spec.ts:254-257 |
| `p09-cta-row` | — | done.RESULT (dual CTA) | t13-review-done.spec.ts:316 |
| `p09-cta-row-continue-btn` | — | done.RESULT → done.EXIT (visible) / ALL_DONE (hidden TI2) | t13-review-done.spec.ts:318-320, 270-271 |
| `p09-cta-row-end-btn` | — | done.RESULT / done.ALL_DONE (always visible) | t13-review-done.spec.ts:322-324, 274-275 |
| `celebrate-hero-streak-number` | — | done.ALL_DONE (streak visible) | t13-review-done.spec.ts:278-279 |
| `p09-hero-title` (ALL_DONE) | — | done.ALL_DONE ("今日复习全部完成") | t13-review-done.spec.ts:266-267 |
