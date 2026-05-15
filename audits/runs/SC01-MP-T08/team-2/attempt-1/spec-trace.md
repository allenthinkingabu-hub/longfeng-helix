# Spec Trace · SC01-MP-T08 · P-HOME

## Mockup → WXML trace

| Mockup section | WXML element | testId |
|---|---|---|
| .hero (aurora gradient) | `.hero` | — |
| .hsafe greeting | `.greeting` | `pHome.greetingHero` |
| .streakbar flame | `.flame` | `pHome.streakFireIcon` |
| streak days number | `text` in flame | `pHome.streakDaysNumber` |
| .reviewhero card | `.review-card` | `pHome.todayReviewCard` |
| .rh-circle progress | `.rh-circle` | `pHome.circleProgress` |
| .rh-title "N 题" | `.rh-title-em` | `pHome.totalLabel` |
| .rh-btn CTA | `.rh-btn` | `pHome.startAllBtn` |
| .weekly summary | `.weekly` | `pHome.weeklySparkline` |
| .weekcard schedule | `.weekcard` | `pHome.weekStrip` |
| .msgs messages | `.msgs` | `pHome.messages` |
| messages "全部" link | `.sec-m` | `pHome.messagesMoreLink` |
| .kpcard AI weak KP | `.kpcard` | `pHome.weakKp` |
| .quick entries | `.quick` | `pHome.quickEntries` |

## API trace

| API endpoint | Client function | File |
|---|---|---|
| GET /api/review/today?tz= | `getHomeTodayCount()` | `src/api/home.ts` |

## State machine trace

| State | Condition | UI |
|---|---|---|
| LOADING | data=null, no error | Skeleton |
| READY | data.total > 0 | Full page |
| EMPTY | data.total = 0 | "今天没有复习安排" |
| ERROR | hasError, no data | Yellow banner |
