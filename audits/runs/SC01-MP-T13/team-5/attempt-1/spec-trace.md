# spec-trace.md · SC01-MP-T13 · P09 review-done MP mirror

## Mockup DOM → WXML 映射表

| Mockup element | CSS class | WXML element | data-test-id |
|---|---|---|---|
| `.hero` | `.hero` | `<view class="hero">` | `celebrate-hero` |
| `.confetti > .c` | `.c` | `<view class="confetti-particle">` | `confetti-burst` |
| `.hicon` | `.hicon` | `<view class="hero-icon">` | `p09-hero-checkmark` |
| `.htitle` | `.htitle` | `<view class="hero-title">` | `p09-hero-title` |
| `.hchips` | `.hchips` | `<view class="hero-chips">` | `celebrate-hero-streak-number` (ALL_DONE) |
| `.card.mc` | `.mc` | `<view class="card" data-test-id="memory-curve">` | `memory-curve` |
| `.nodes .row .node` | `.node` | `<view class="node">` | `memory-curve-node-T{n}` |
| `.advance` | `.advance` | `<view class="advance">` | `p09-advance-banner` |
| `.nxt` | `.nxt` | `<view class="next-card">` | `p09-next-due-card` |
| `.nxt .add` | `.add` | `<view class="add-calendar-btn">` | `p09-next-due-card-add-calendar-btn` |
| `.stats .stt` (×3) | `.stt` | `<view class="stat">` (×3) | `p09-stats-row-{mastered,partial,forgot}` |
| `.kplist .kp` | `.kp` | `<view class="kp-row">` | `p09-kp-chart` |
| `.cta .btn.sec` | `.btn.sec` | `<van-button custom-class="btn-sec">` | `p09-cta-row-end-btn` |
| `.cta .btn.pri` | `.btn.pri` | `<van-button type="primary" custom-class="btn-pri">` | `p09-cta-row-continue-btn` |

## State machine

| State | Trigger | Hero title | CTA buttons | Mockup screenshot |
|---|---|---|---|---|
| LOADING | `onLoad` initial | (skeleton) | hidden | p09-loading.png |
| RESULT | API loaded, `allDone !== 'true'` | 本题已掌握 / 需要再练习 | 结束本次 + 继续复习 | p09-idle.png |
| ALL_DONE | `allDone === 'true'` | 今日复习全部完成 🎉 | 结束本次 only | p09-success.png |
| ERROR (FORGOT) | `grade === 'FORGOT'` | 需要再练习 | 结束本次 + 继续复习 | p09-error.png |

## Vant 组件替换表

| H5 (Konsta/React) | MP (Vant Weapp) | Usage |
|---|---|---|
| `<button className={s.btn}>` | `<van-button>` | CTA 结束本次 / 继续复习 |
| React `useState` toast | `<van-toast>` | Toast 消息提示 |
| `<svg>` icons inline | `<image src="/images/...">` or emoji fallback | Hero checkmark (SVG→image), calendar (📅), advance (★) |

## API contract

| API | Method | Path | Used in |
|---|---|---|---|
| completeSession | POST | `/api/review/sessions/{sid}/complete` | `onEnd()` handler → `src/api/review.ts` |
