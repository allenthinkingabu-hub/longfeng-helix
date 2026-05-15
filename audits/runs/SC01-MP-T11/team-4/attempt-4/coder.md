# coder.md · SC01-MP-T11 · P08 复习执行 MP 1:1 mirror · attempt-3

> Carry-forward from attempt-1 (commit e609eae) + Tester nodeIndex bugfix (commit 612e5f2).
> attempt-2 audit REDO: coder.md 未在 attempt-2 目录落盘 → 本轮补齐。

## 1. 地形侦察

- **标杆模板**: `frontend/apps/mp/pages/capture/` — Page() pattern, Vant Weapp, data-test-id, rpx
- **H5 sibling**: `frontend/apps/h5/src/pages/ReviewExec/index.tsx` — READING→ANSWERING→REVEALED→GRADED 状态机
- **API client**: `frontend/apps/mp/src/api/_http.ts` — apiBase('review') → port 8085
- **Mockup SoT**: `design/mockups/wrongbook/08_review_exec.html` — 287 行
- **testids**: `frontend/packages/testids/src/index.ts` L424-484 — TEST_IDS.p08 (15 静态) + p08Ids (2 动态)

## 2. 编码

### 文件清单 (attempt-1 原始交付 + attempt-2 bugfix)

| 文件 | 动作 | 说明 |
|---|---|---|
| `frontend/apps/mp/src/api/review.ts` | NEW | getNode + revealNode + gradeNode · 真 API |
| `frontend/apps/mp/pages/review-exec/index.wxml` | NEW | 1:1 mockup WXML mirror · Vant 替换 SVG |
| `frontend/apps/mp/pages/review-exec/index.wxss` | NEW | 全量样式 · rpx · 4 态 UI |
| `frontend/apps/mp/pages/review-exec/index.ts` | NEW+FIX | 状态机 + nodeIndex 2→1 bugfix |
| `frontend/apps/mp/pages/review-exec/index.json` | NEW | Vant 组件注册 |
| `frontend/apps/mp/app.json` | MOD | +pages/review-exec/index |
| `frontend/apps/mp/src/api/_http.ts` | BUGFIX | JSDoc + declare types |

### 状态机
- READING → onCanvasTouch → ANSWERING
- ANSWERING → onRevealTap → REVEALED (POST /api/review/nodes/{nid}/reveal)
- REVEALED → onGradeTap → GRADED (POST /api/review/nodes/{nid}/grade)
- any → onCloseTap → showExitSheet overlay

## 3. 真实 E2E

PHASE-C 人工视觉验收路线 · automator E2E 已跳过 (TL 决策)。

### tsc PASS
```
$ pnpm -F mp typecheck
> tsc --noEmit
(exit 0 · 0 errors)
```

### 4 态 mockup baseline 截图
| 状态 | 文件 |
|---|---|
| READING | design/system/screenshots/mp-baseline/pT11-reading.png |
| ANSWERING | design/system/screenshots/mp-baseline/pT11-answering.png |
| EXIT-CONFIRM | design/system/screenshots/mp-baseline/pT11-exit-confirm.png |
| DONE | design/system/screenshots/mp-baseline/pT11-done.png |

## 4. 自检

| 检查项 | 状态 | 证据 |
|---|---|---|
| WXML 1:1 mirror | ✅ | 13 区块全覆盖 |
| wxss rpx 样式 | ✅ | 605 行 |
| 状态机 4 态 | ✅ | READING→ANSWERING→REVEALED→GRADED |
| 真 API (0 mock) | ✅ | import from src/api/review |
| app.json 更新 | ✅ | pages/review-exec/index |
| tsc PASS | ✅ | 0 errors |
| 4 截图落盘 | ✅ | 393x852 PNG |
| spec-trace.md | ✅ | attempt-1 目录 |
| testid 挂载 | ✅ | 19 data-test-id |
| nodeIndex bugfix | ✅ | 2→1 (commit 612e5f2) |

## 5. 提交

- attempt-1 commit: e609eae (原始交付)
- attempt-2 bugfix commit: 612e5f2 (nodeIndex 2→1)
- attempt-3 commit: (本次 coder.md 落盘)
