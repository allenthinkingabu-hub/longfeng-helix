# spec-trace.md · SC01-MP-T01 · P02 Capture 1:1 mirror

## Mockup DOM → WXML 映射表

| Mockup HTML element | WXML element | data-test-id | Vant 替换 |
|---|---|---|---|
| `.nav .icon-btn` (back) | `view.icon-btn` | `p02-topbar-back` | `van-icon name="arrow-left"` |
| `.nav .title` | `text.nav-title` | — | — |
| `.nav .icon-btn` (flash) | `view.icon-btn` | `p02-topbar-flash-btn` | `van-icon name="bulb-o"` |
| `.detect` (badge) | `view.detect` | `p02-detect-badge` | — |
| `.tip` (card) | `view.tip` | `p02-tip-card` | `van-icon name="shield-o"` |
| `.view` (viewfinder) | `view.view` | `p02-viewfinder` | — |
| `.paper` | `view.paper` | `p02-paper` | — |
| `.bracket.tl/tr/bl/br` | `view.bracket.bracket-tl/tr/bl/br` | — | — |
| `.scan` | `view.scan` | — | — |
| `.subjects > .subj` | `view.subjects > view.subj` | `subject-chip-{math,physics,...}` | — |
| `.modes > span` | `view.modes > view.mode-btn` | `p02-mode-tabs-tab-{1,2,3}` | — |
| `.dock` | `view.dock` | — | — |
| `.shutter` | `view.shutter` | `capture-shutter` | `van-icon name="photograph"` |
| `.control-btn` (gallery) | `view.control-btn` | `p02-gallery-btn` | `van-icon name="photo-o"` |
| `.control-btn` (file) | `view.control-btn` | — | `van-icon name="description"` |
| `.tabbar > .tab` | `view.tabbar > view.tab` | — | `van-icon name="wap-home-o/notes-o/photograph/clock-o/contact"` |
| upload progress overlay | `view.upload-overlay` | `p02-upload-progress` | `van-loading` |
| error banner | `view.error-banner` | `p02-error-banner` | `van-icon name="warning-o"` |

## State Machine

| State | Trigger | Next State | UI 变化 |
|---|---|---|---|
| IDLE | shutter tap / gallery | UPLOADING | overlay + loading spinner + pct |
| UPLOADING | presign + upload + createQuestion success | UPLOADED | pct=100 |
| UPLOADED | 300ms timeout | nav to /pages/analyzing | — |
| UPLOADING | any error | ERROR | error banner shows |
| ERROR | user retap shutter | UPLOADING | banner hides, overlay shows |

## Vant Weapp 组件替换 H5 Konsta

| H5 (Konsta/原生) | MP (Vant Weapp) | 用途 |
|---|---|---|
| inline SVG icons | `van-icon` | 导航图标、控制图标、tabbar 图标 |
| CSS spinner | `van-loading` | 上传进度 overlay |
| `<button>` | `view + bindtap` | shutter / gallery / subject chips |
| React Router `useNavigate` | `wx.navigateTo / wx.navigateBack` | 页面导航 |

## API 触点

| API | 端口 | 路径 | 用途 | 对应代码 |
|---|---|---|---|---|
| presign | 8084 | POST /api/file/presign | 获取上传 URL | `src/api/file.ts:presign()` → `pages/capture/index.ts:handleCapture()` |
| createQuestion | 8082 | POST /api/wb/questions | 创建错题记录 | `src/api/wrongbook.ts:createQuestion()` → `pages/capture/index.ts:handleCapture()` |
