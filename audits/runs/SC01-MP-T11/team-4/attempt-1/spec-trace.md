# spec-trace.md · SC01-MP-T11 · P08 review-exec MP 1:1 mirror

## Mockup DOM → WXML 映射表

| Mockup DOM (08_review_exec.html) | WXML Element | testid | 备注 |
|---|---|---|---|
| `.nav` (L130) | `view.nav` | p08-topbar | 自定义导航栏 |
| `.nav .back` (L131) | `view.back` | — | van-icon arrow-left 替代 SVG |
| `.nav .center .title` (L136) | `text.title` | p08-topbar-cursor | 显示"复习执行 · 第 N 题" |
| `.nav .close` (L139) | `view.close` | p08-close-btn | van-icon cross 替代 SVG |
| `.ptrack` (L142) | `view.ptrack` | p08-progress-bar | 进度条 25% |
| `.metarow` (L151) | `view.metarow` | p08-meta-chips | 3 chips: T级/科目/难度 |
| `.qcard` (L158) | `view.qcard` | p08-question-hero | 题干卡 |
| `.work` (L171) | `view.work` | p08-answer-area | bind:touchstart=onCanvasTouch |
| `.reveal` (L198) | `view.reveal` | p08-reveal-content | wx:if isRevealed 控制显隐 |
| `.reveal .head .ico` (L201) | `view.reveal-ico` | p08-reveal-checkmark | van-icon success |
| `.nodes` (L218) | `view.nodes` | p08-memory-curve | 7 dots 时间线 |
| `.rating` (L235) | `view.rating` | p08-grade-buttons | 3 按钮: 未掌握/部分/已掌握 |
| `.rbtn.forgot` (L241) | `view.rbtn-forgot` | p08-grade-buttons-forgot | data-grade="FORGOT" |
| `.rbtn.partial` (L246) | `view.rbtn-partial` | p08-grade-buttons-partial | data-grade="PARTIAL" |
| `.rbtn.master` (L251) | `view.rbtn-master` | p08-grade-buttons-mastered | data-grade="MASTERED" |

## State Machine

| 状态 | 触发 | 目标状态 | API 调用 | index.ts 行号 |
|---|---|---|---|---|
| READING | touchstart on work area | ANSWERING | — | index.ts:136-143 |
| ANSWERING | tap 揭示答案 | REVEALED | POST /api/review/nodes/{nid}/reveal | index.ts:145-175 |
| REVEALED | tap 评分按钮 | GRADED | POST /api/review/nodes/{nid}/grade | index.ts:177-202 |
| any | tap close (×) | showExitSheet=true | — | index.ts:205-207 |

## Vant 组件替换表

| H5 Konsta / 原生 HTML | MP Vant Weapp | 用途 |
|---|---|---|
| `<svg>` back arrow | `van-icon name="arrow-left"` | 返回按钮图标 |
| `<svg>` close X | `van-icon name="cross"` | 关闭按钮图标 |
| `<svg>` checkmark | `van-icon name="success"` | 答案揭示 ✓ |
| `<svg>` edit/star icons | `van-icon name="edit/star"` | 工具栏图标 |
| `<button>` 揭示答案 | `van-button type="primary" round` | 揭示按钮 |
| 自定义 overlay | `van-overlay` | 退出确认遮罩 |
| `<button>` 取消/退出 | `van-button plain/danger` | 退出确认操作 |

## API 触点 (src/api/review.ts)

| 函数 | HTTP | 端口 | 行号 |
|---|---|---|---|
| `getNode(sid, nid)` | GET /api/review/sessions/{sid}/nodes/{nid} | 8085 | review.ts:45-47 |
| `revealNode(nid)` | POST /api/review/nodes/{nid}/reveal | 8085 | review.ts:50-53 |
| `gradeNode(nid, body)` | POST /api/review/nodes/{nid}/grade | 8085 | review.ts:56-60 |
