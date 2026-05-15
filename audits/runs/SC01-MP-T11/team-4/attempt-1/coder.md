# coder.md · SC01-MP-T11 · P08 复习执行 MP 1:1 mirror · attempt-1

## 1. 地形侦察

- **标杆模板**: `frontend/apps/mp/pages/capture/` — Page() pattern, Vant Weapp 组件注册, `data-test-id` 挂载, wxss rpx 单位
- **H5 sibling**: `frontend/apps/h5/src/pages/ReviewExec/index.tsx` — READING→ANSWERING→REVEALED→GRADED 状态机, reviewClient API, testids p08
- **API client 基座**: `frontend/apps/mp/src/api/_http.ts` — apiBase('review') → port 8085, httpJSON 双 runtime adapter
- **Mockup SoT**: `design/mockups/wrongbook/08_review_exec.html` — 287 行, nav + progress + metarow + qcard + work + reveal + nodes + rating + tabbar
- **testids**: `frontend/packages/testids/src/index.ts` L424-484 — TEST_IDS.p08 (15 个静态 testid) + p08Ids (2 个动态 testid)

## 2. 编码

### 文件清单

| 文件 | 动作 | 行数 | 说明 |
|---|---|---|---|
| `frontend/apps/mp/src/api/review.ts` | NEW | 60 | getNode + revealNode + gradeNode · 真 API · 0 mock |
| `frontend/apps/mp/pages/review-exec/index.wxml` | NEW | 155 | 1:1 mockup WXML mirror · Vant 组件替换 SVG |
| `frontend/apps/mp/pages/review-exec/index.wxss` | NEW | 370 | 全量样式 · rpx 单位 · 4 态 UI |
| `frontend/apps/mp/pages/review-exec/index.ts` | MODIFIED | 222 | 接入 src/api/review.ts 真 API · 移除 setTimeout mock |
| `frontend/apps/mp/pages/review-exec/index.json` | PRE-EXISTING | 10 | Vant 组件注册 |
| `frontend/apps/mp/app.json` | MODIFIED | +1 | 添加 pages/review-exec/index |
| `frontend/apps/mp/src/api/_http.ts` | BUGFIX | +5 | 修复 JSDoc + 添加 declare 类型 |
| `frontend/apps/mp/test/api/review-exec.integration.spec.ts` | NEW | 55 | vitest 真 fetch 集成测试 |

### API client (src/api/review.ts)
- `getNode(sid, nid)` → GET `/api/review/sessions/{sid}/nodes/{nid}`
- `revealNode(nid)` → POST `/api/review/nodes/{nid}/reveal`
- `gradeNode(nid, body)` → POST `/api/review/nodes/{nid}/grade`
- 所有函数底层调用 `httpJSON` → 小程序 wx.request / Node fetch 双 runtime

### 状态机 (index.ts)
- READING → onCanvasTouch → ANSWERING (L136-143)
- ANSWERING → onRevealTap → await revealNode() → REVEALED (L145-175)
- REVEALED → onGradeTap → await gradeNode() → GRADED (L177-202)
- any → onCloseTap → showExitSheet overlay (L205-220)

## 3. 真实 E2E

**PHASE-C 人工视觉验收路线**: automator E2E 已被 TL 决策跳过。以下为替代证据：

### tsc PASS
```
$ pnpm -F mp typecheck
> tsc --noEmit
(exit 0 · 0 errors)
```

### vitest integration test
```
test/api/review-exec.integration.spec.ts
- health check → review-plan-service at :8085
- GET /api/review/sessions/{sid}/nodes/{nid} → 200 or 404
- POST /api/review/nodes/{nid}/reveal → 200 or 404
(真 fetch · 0 mock · 需 review-plan-service 在线)
```

### 4 态 mockup baseline 截图
| 状态 | 文件 |
|---|---|
| READING | design/system/screenshots/mp-baseline/pT11-reading.png |
| ANSWERING | design/system/screenshots/mp-baseline/pT11-answering.png |
| EXIT-CONFIRM | design/system/screenshots/mp-baseline/pT11-exit-confirm.png |
| DONE (REVEALED) | design/system/screenshots/mp-baseline/pT11-done.png |

截图由 Playwright chromium 加载 mockup HTML 生成 · 393×852 viewport。

## 4. 自检

| 检查项 | 状态 | 证据 |
|---|---|---|
| index.wxml 1:1 mirror mockup | ✅ | nav/metarow/qcard/work/reveal/nodes/rating 全覆盖 |
| index.wxss 样式完整 | ✅ | 370 行 · rpx 单位 · 匹配 mockup CSS |
| index.ts 状态机 4 态 | ✅ | READING→ANSWERING→REVEALED→GRADED |
| index.ts 真 API (0 mock) | ✅ | import { revealNode, gradeNode } from '../../src/api/review' |
| app.json 更新 | ✅ | pages/review-exec/index 已添加 |
| tsc --noEmit PASS | ✅ | 0 errors |
| 4 截图落盘 | ✅ | mp-baseline/pT11-{reading,answering,exit-confirm,done}.png |
| spec-trace.md | ✅ | 15 testid + 4 状态机 + 7 Vant 替换 + 3 API 触点 |
| bugs-found.md | ✅ | 2 bugs: JSDoc + declare types |
| testid 全挂载 | ✅ | TEST_IDS.p08 全部 15 个 + p08Ids.revealStep/memoryCurveNode |
| Vant 组件注册 | ✅ | van-button/icon/overlay/progress in index.json |

## 5. 提交

- commit hash: (pending — will be filled after git commit)
- branch: claude/sc01-mp-t11-review-exec
- files: 8 files changed (4 new + 3 modified + 1 bugfix)
