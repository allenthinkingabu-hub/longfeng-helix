# spec-trace · SC01-T10 · P07→P08 transition

| testid | §5 API | §6/§9 状态机 | assertion 行号 |
|---|---|---|---|
| `p07-root` | — | today.LIST render | t10-target-to-exec.spec.ts:87 |
| `today-review-card` | GET /api/review/today | today.LIST hero | t10-target-to-exec.spec.ts:99 |
| `today-review-card-total` | — | hero total "8 题待复习" | t10-target-to-exec.spec.ts:100 |
| `p07-hero-progress-pct` | — | hero "进度 38%" | t10-target-to-exec.spec.ts:105 |
| `p07-slot-now-header` | — | slot header "现在 · 上午" | t10-target-to-exec.spec.ts:119 |
| `p07-slot-now-item-0` | POST /nodes/{nid}/open | tap item → open → nav P08 | t10-target-to-exec.spec.ts:157 |
| `p07-bottom-cta` | POST /nodes/{nid}/open | CTA 全部开始 → open → nav P08 | t10-target-to-exec.spec.ts:196 |
| `p08-root` | — | P08 mount (READING state) | t10-target-to-exec.spec.ts:170 |
| `p08-topbar-cursor` | — | "复习执行 · 第 2 题" | t10-target-to-exec.spec.ts:173 |
| `p08-progress-bar` | — | 进度条 25% | t10-target-to-exec.spec.ts:174 |
| `p08-meta-chips` | — | T2 / 数学 / 中等 chips | t10-target-to-exec.spec.ts:177 |
| `p08-question-hero` | — | 题干 Hero 卡 | t10-target-to-exec.spec.ts:180 |
| `p08-answer-area` | — | canvas + READING→ANSWERING | t10-target-to-exec.spec.ts:243 |
| `p08-reveal-btn` | — | READING: disabled → ANSWERING: enabled | t10-target-to-exec.spec.ts:231 |
| `p08-reveal-content` | — | TI2: aria-hidden=true before reveal | t10-target-to-exec.spec.ts:314 |
| `p08-close-btn` | — | tap × → exit confirm sheet | t10-target-to-exec.spec.ts:269 |
| `p08-exit-confirm-sheet` | — | AC5: 二次确认 "退出本次复习？" | t10-target-to-exec.spec.ts:272 |
| `memory-curve` | — | 7 节点 T0..T6 timeline | t10-target-to-exec.spec.ts:337 |
