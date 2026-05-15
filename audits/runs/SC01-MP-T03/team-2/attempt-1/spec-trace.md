# spec-trace.md · SC01-MP-T03 · P03 Analyzing 1:1 Mirror

## Mockup DOM → WXML 映射表

| Mockup CSS class | WXML element | data-test-id | 说明 |
|---|---|---|---|
| `.nav` | `view.nav` | — | 导航栏容器 |
| `.nav .back` | `view.back` | — | 返回按钮 "拍题" |
| `.nav h1` | `text.nav-title` | — | "AI 正在分析…" + badge |
| `.badge` | `view.badge > text.badge-text` | — | "N / 4" 进度标记 |
| `.preview` | `view.preview` | `p03-thumb-card` | 图片预览卡 |
| `.thumb` | `view.thumb` | `p03-thumb-card-image` | 缩略图区 |
| `.meta .t1` | `text.meta-title` | `p03-thumb-card-title` | 题目标题 |
| `.meta .t2 .chip` | `text.chip` (×3) | — | 学科/年级/时间 chips |
| `.model` | `view.model-badge` | `analyzing-pipeline-model-badge` | 模型状态指示 |
| `.model .dot` | `view.model-dot` | — | 绿色圆点 |
| `.stages` | `view.stages` | `analyzing-pipeline` | 4步流水线容器 |
| `.step` (×4) | `view.step` (wx:for) | `analyzing-pipeline-step-{1..4}` | 各步骤行 |
| `.step .ico.done` | `van-icon[name=success]` | — | 完成态 ✓ icon |
| `.step .ico.now` | `text.ico-num` | — | 进行态 数字 |
| `.step .ico.wait` | `text.ico-num` | — | 等待态 数字 |
| `.step .shim` | `view.shim > view.shim-bar` | — | 进度条动画 |
| `.stream` | `view.stream` | `analyzing-pipeline-json-stream` | SSE JSON 终端 |
| `.stream .hdr` | `view.stream-hdr` | — | 终端头 (SSE路径+dots) |
| `.stream pre` | `text.stream-pre` | — | JSON 文本内容 |
| `.cancel` | `view.cancel-wrap` | `analyzing-pipeline-cancel-btn` | "放弃本次分析" 按钮 |
| `.tabbar` | `view.tabbar` | — | 底部 tab bar |
| `.tab` (×5) | `view.tab` (×5) | — | 首页/错题本/拍题/复习/我的 |

## State Machine

| 状态 | statusText | steps 表现 | 触发条件 |
|---|---|---|---|
| `init` | "准备分析…" | 全部 wait | 页面刚加载, 无 imageUrl |
| `analyzing` | "AI 正在分析…" | step 1-2 done, step 3 now, step 4 wait | startAnalyze 成功 + polling |
| `success` | "AI 分析完成" | 全部 done | pollStatus → SUCCEEDED |
| `error` | "AI 分析失败" | 当前 step fail, 之前 done | pollStatus → FAILED 或超时 |

## Vant 组件替换 H5 Konsta 对照

| H5 (Konsta / React) | MP (Vant Weapp) | 用途 |
|---|---|---|
| `<CheckIcon />` (inline SVG) | `<van-icon name="success" />` | 步骤完成 ✓ |
| `<XIcon />` (inline SVG) | `<van-icon name="cross" />` | 步骤失败 ✗ |
| `<BackChevron />` (inline SVG) | `<text class="back-chevron">` + CSS | 返回箭头 |
| `useEventSource` hook (SSE) | polling via `setInterval` + `pollAnalyzeStatus` | 状态更新机制 (MP 无 EventSource) |
| React Router `useNavigate` | `wx.navigateBack()` | 页面导航 |
| CSS Modules | WXSS page scope | 样式隔离 |

## API 触点

| 接口 | 方法 | 路径 | 来源 |
|---|---|---|---|
| startAnalyze | POST | `/api/ai/analyze` | src/api/ai.ts:28 |
| pollAnalyzeStatus | GET | `/api/ai/analyze/:taskId` | src/api/ai.ts:43 |
| httpJSON | — | — | src/api/_http.ts (wx.request / fetch 双 adapter) |
| apiBase('ai') | — | `http://localhost:8083` | src/api/_http.ts:28 |
