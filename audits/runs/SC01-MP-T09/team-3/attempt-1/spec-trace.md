# Spec Trace · SC01-MP-T09 · P07 今日复习

## Mockup → Code Mapping

| Mockup Element | HTML class/section | WXML element | WXSS class |
|---|---|---|---|
| Nav bar (back + 排序·时间) | `.nav .row .back` | `view.nav > view.nav-row > view.back` | `.nav`, `.back`, `.nav-right` |
| Title "今日复习" | `.nav h1` | `text.nav-title` | `.nav-title` |
| Hero gradient card | `.hero` | `view.hero` | `.hero` |
| Live dot + date | `.hero .t .live` | `view.hero-tag > view.live-dot` | `.hero-tag`, `.live-dot` |
| Total count "8 题待复习" | `.hero h2` | `text.hero-total` | `.hero-total` |
| Est minutes | `.hero h2 .sz` | `text.hero-sz` | `.hero-sz` |
| 3 stats (已完成/进行中/未开始) | `.hero .stats-row .st` | `view.stats-row > view.st` | `.stats-row`, `.st`, `.st-v`, `.st-l` |
| Progress bar | `.hero .pg` | `view.pg > view.pg-fill` | `.pg`, `.pg-fill` |
| Progress text | `.hero .pg-txt` | `view.pg-txt` | `.pg-txt` |
| Slot header (现在·上午) | `.slot` | `view.slot` | `.slot`, `.slot-icon`, `.slot-title`, `.slot-line`, `.slot-count` |
| Item card | `.it` | `view.it` | `.it` |
| Side color bar | `.it .side` | `view.side` | `.side`, `.it.red .side`, etc. |
| Time column | `.it .tc` | `view.tc > text.hh + text.lv` | `.tc`, `.hh`, `.lv` |
| Body (subject, stem, tags) | `.it .body` | `view.body` | `.body`, `.body-h`, `.stem`, `.tags`, `.tg` |
| Countdown badge | `.cd.now/.soon/.wait` | `text.cd.cd-now/cd-soon/cd-wait` | `.cd`, `.cd-now`, `.cd-soon`, `.cd-wait` |
| Arrow | `.arrow` | `view.arrow` | `.arrow` |
| CTA "全部开始" | `.cta` | `view.cta` | `.cta`, `.cta-sz` |
| Tab bar | `.tabbar .tab` | `view.tabbar > view.tab` | `.tabbar`, `.tab`, `.tab.active`, `.badge` |

## testid Mapping

| testid | Element |
|---|---|
| `p07-root` | Page root |
| `today-review-card` | Hero card |
| `today-review-card-total` | Total count |
| `today-review-card-done` | Done count |
| `today-review-card-est-min` | Estimated minutes |
| `today-review-card-progress-bar` | Progress bar |
| `p07-hero-progress-pct` | Progress percentage |
| `today-review-card-mastery-pct` | Mastery percentage |
| `today-review-card-particles` | Hero bubble decoration |
| `p07-empty-state` | Empty state |
| `p07-bottom-cta-start-all-btn` | CTA button |

## API Mapping

| API | Endpoint | Used in |
|---|---|---|
| getToday | `GET /api/review/today?tz=Asia/Shanghai` | `_fetchToday()` |
| createSession | `POST /api/review/sessions` | `onStartAllTap()` |
