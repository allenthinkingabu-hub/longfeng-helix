# coder.md · SC01-MP-T13 · P09 review-done MP mirror · attempt-1

## 1. 地形侦察

- 完整读 `coder-agent.md` 全文 (铁律 1-5 + 补充 6/7)
- 完整读 `SHARED-E2E-PROTOCOL.md` (三轴隔离 + DoR C-1..C-6)
- 完整读 `.harness/inflight/SC01-MP-T13.json` (task context + PHASE-C 人工视觉路线)
- 完整读 `CLAUDE.md` (Rule 1-12 + 启动纪律 + audit.js)
- 完整读 `design/mockups/wrongbook/09_review_done.html` (设计真相 SoT · 328 行)
- 完整读 `frontend/apps/h5/src/pages/ReviewDone/index.tsx` (H5 sibling · state machine + API contract)
- 完整读 `frontend/apps/h5/vite.config.ts` (review=8085 proxy)
- 完整读 `frontend/apps/mp/src/api/_http.ts` (TL 已写 · apiBase('review') → 8085)
- 标杆模板: `frontend/apps/mp/pages/capture/` (4 文件 pattern: json/wxml/wxss/ts + Vant + testids)

## 2. 编码

### 2.1 页面文件 (4-file set)
- `pages/review-done/index.json`: Vant 组件声明 (van-button, van-icon, van-toast) + 导航栏绿底白字
- `pages/review-done/index.wxml`: 1:1 mirror mockup DOM 结构
  - Hero celebration (confetti + checkmark + title/sub/chips)
  - Scroll content: memory curve card (6-node timeline + advance banner) + next due card + stats row + KP chart
  - CTA dock: van-button × 2 (结束本次 + 继续复习)
  - State machine: wx:if 控制 LOADING/RESULT/ALL_DONE 三态显示
- `pages/review-done/index.wxss`: 全量 CSS 1:1 对齐 mockup `:root` 变量 + 布局
- `pages/review-done/index.ts`: Page() with state machine + mock data + real API import
  - `buildTLevels()`: 预计算 node dot/label CSS class 供 WXML 直接绑定
  - `onEnd()`: 调 `completeSession(sid)` 真 API

### 2.2 API client
- `src/api/review.ts`: `completeSession(sid)` → POST `/api/review/sessions/{sid}/complete`
  - 通过 `_http.ts` dual adapter (wx.request in MP / fetch in vitest)

### 2.3 Pre-existing bug fix
- `src/api/_http.ts`: 修复 JSDoc block comment 导致 tsc 5.9.3 parse error + 缺少 ambient type declarations

### 2.4 app.json
- 添加 `pages/review-done/index` 到 pages 数组

### 2.5 Integration test
- `test/api/review-done.integration.spec.ts`: vitest · 真 fetch · 0 mock
  - health check → POST complete endpoint → 断言 200/404
  - `completeSession()` function import 测试

## 3. 真实 E2E

PHASE-C 人工视觉路线 · automator E2E 跳过 (inflight `dor_c1_to_c6_required: false`)

### 3.1 tsc typecheck
```
$ pnpm -F mp typecheck
> tsc --noEmit
(exit 0 · 0 errors)
```

### 3.2 Mockup 4-state baseline 截图
Playwright chromium 加载 `design/mockups/wrongbook/09_review_done.html` → 4 screenshots:
- `design/system/screenshots/mp-baseline/p09-idle.png` (RESULT · 本题已掌握)
- `design/system/screenshots/mp-baseline/p09-loading.png` (LOADING · skeleton)
- `design/system/screenshots/mp-baseline/p09-success.png` (ALL_DONE · 今日复习全部完成)
- `design/system/screenshots/mp-baseline/p09-error.png` (FORGOT · 需要再练习 · orange hero)

## 4. 自检

| DoD item | Status | Evidence |
|---|---|---|
| index.{json,wxml,wxss,ts} 全实现 | ✅ | 4 files in `pages/review-done/` |
| app.json pages 数组更新 | ✅ | `pages/review-done/index` added |
| tsc --noEmit PASS | ✅ | `pnpm -F mp typecheck` exit 0 |
| API client review.ts | ✅ | `src/api/review.ts` · completeSession |
| Integration test | ✅ | `test/api/review-done.integration.spec.ts` · 0 mock |
| 4 baseline screenshots | ✅ | `design/system/screenshots/mp-baseline/p09-*.png` |
| spec-trace.md | ✅ | `audits/runs/SC01-MP-T13/team-5/attempt-1/spec-trace.md` |
| coder.md (5 段) | ✅ | this file |
| bugs-found.md | ✅ | 2 pre-existing bugs fixed |

## 5. 提交

- Commit: `acd3fe8` — feat(SC01-MP-T13): P09 review-done MP page 1:1 mirror + real API + tsc PASS
- Branch: `claude/sc01-mp-t13-review-done`
- 15 files changed, 1125 insertions(+), 16 deletions(-)
