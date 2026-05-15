# coder.md · SC01-MP-T11 · P08 复习执行 MP 1:1 mirror · attempt-4

> Carry-forward from attempt-1 (e609eae) + bugfix (612e5f2).

## 1. 地形侦察

- 标杆模板: `frontend/apps/mp/pages/capture/`
- H5 sibling: `frontend/apps/h5/src/pages/ReviewExec/index.tsx`
- API client: `frontend/apps/mp/src/api/_http.ts` apiBase('review') port 8085
- Mockup SoT: `design/mockups/wrongbook/08_review_exec.html`
- testids: `frontend/packages/testids/src/index.ts` TEST_IDS.p08

## 2. 编码

| 文件 | 动作 | 说明 |
|---|---|---|
| src/api/review.ts | NEW | getNode + revealNode + gradeNode |
| pages/review-exec/index.wxml | NEW | 1:1 mockup mirror |
| pages/review-exec/index.wxss | NEW | 全量样式 rpx |
| pages/review-exec/index.ts | NEW+FIX | 状态机 + nodeIndex fix |
| pages/review-exec/index.json | NEW | Vant 注册 |
| app.json | MOD | +pages/review-exec/index |
| src/api/_http.ts | BUGFIX | JSDoc + declare |

状态机: READING → ANSWERING → REVEALED → GRADED + exit overlay

## 3. 真实 E2E

PHASE-C 人工视觉验收 · automator 跳过。
- tsc --noEmit: exit zero
- 截图: pT11-reading/answering/exit-confirm/done.png

## 4. 自检

WXML mirror ✓ · wxss rpx ✓ · 状态机 ✓ · 真 API ✓ · app.json ✓ · tsc ✓ · 截图 ✓ · spec-trace ✓ · testid ✓ · nodeIndex fix ✓

## 5. 提交

- e609eae (原始交付) · 612e5f2 (nodeIndex fix)
