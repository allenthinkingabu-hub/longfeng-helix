# spec-trace.md · SC01-MP-T05 · P04 Result page

## Mockup DOM → WXML 映射表

| Mockup HTML element | WXML element | data-test-id | Notes |
|---|---|---|---|
| `.nav .back` | `view.nav-back` | `p04-navbar` | van-icon replaces raw SVG |
| `.nav h1 + .tag` | `text.nav-h1 + van-tag` | — | van-tag replaces CSS `.tag` |
| `.hero` (stem+thumb) | `view.hero` | `p04-question-hero` | 1:1 layout flex |
| `.hero .thumb` | `view.thumb` | — | Identical structure |
| `.hero .kicker` | `text.hero-kicker` | — | Dynamic from API |
| `.hero .stem` | `text.hero-stem` | `result-hero-stem` | `{{question.stem}}` binding |
| `.hero .formula` | `text.hero-formula` | — | `wx:if="{{question.formula}}"` |
| `.answers .ans.wrong` | `view.ans.ans-wrong` | `p04-answers-row-wrong` | van-icon ✗ |
| `.answers .ans.right` | `view.ans.ans-right` | `p04-answers-row-right` | van-icon ✓ |
| `.reason` | `view.reason` | `p04-reason-card` | border-left red accent |
| `.reason .txt` | `text.reason-txt` | `p04-reason-card-text` | `{{question.reasonMarkdown}}` |
| `.steps .step` | `view.step wx:for` | `p04-solution-stepper-step-{{item.idx}}` | wx:for loop |
| `.kp-row .kp .chips` | `text.chip wx:for` | `p04-meta-chips` | chip/chip-outline toggle |
| `.diff .stars` | `text.star wx:for` | — | `{{diffStars}}` boolean array |
| `.ebbing .nodes .node` | `view.node wx:for` | `result-timeline-node-{{item.tLevel}}` | T0–T6 |
| `.cta .btn.ghost` | `van-button plain` | — | "手动修正" |
| `.cta .btn.primary` | `van-button type="primary"` | `p04-save-cta` | "保存并开启复习" |

## State machine

| State | Trigger | UI |
|---|---|---|
| `LOADING` | onLoad | van-skeleton |
| `DRAFT` | API success + confidence ≥ 0.6 | Full content |
| `ERROR` | API fetch failure | error-box + retry button |
| `EMPTY` | No qid param or empty response | empty-box |

## Vant Weapp component replacement

| H5 (Konsta/raw) | MP (Vant Weapp) | Usage |
|---|---|---|
| raw `<svg>` back arrow | `van-icon name="arrow-left"` | Nav back |
| raw `<svg>` icons | `van-icon name="edit" / "down"` | Nav actions |
| CSS `.tag` | `van-tag type="success"` | Analysis duration badge |
| CSS skeleton divs | `van-skeleton` | Loading state |
| raw `<svg>` ✗/✓ | `van-icon name="cross" / "success"` | Answer icons |
| raw `<svg>` warning | `van-icon name="warning"` | Reason card icon |
| raw `<svg>` clock | `van-icon name="clock-o"` | Ebbinghaus header |
| raw `<button>` | `van-button` | CTA buttons |

## API contracts

| Endpoint | Method | Service | Port | Usage |
|---|---|---|---|---|
| `/api/wb/questions/:qid` | GET | wrongbook-service | 8082 | Question detail + planned nodes |
| `/api/ai/:qid/answer` | GET | ai-analysis-service | 8083 | AI reason + confidence |
