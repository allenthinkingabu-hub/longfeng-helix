# tester.md · SC01-MP-T11 · P08 复习执行 MP 1:1 mirror · attempt-2

> attempt-1 audit REDO: `adversarial_has_exploratory_keywords` 不足 → 本轮补充探索性测试

## 测试方法

PHASE-C 人工视觉验收路线 (automator E2E 已跳过 · TL 决策)。验证手段:
1. `pnpm -F mp typecheck` (tsc --noEmit)
2. 代码审查: WXML vs mockup HTML 逐区块对照
3. testid 挂载验证 (grep data-test-id)
4. API 契约审查 (review.ts vs spec-trace.md)
5. 截图落盘验证 (file + 分辨率)
6. 探索性对抗: 连点防抖 / 超长数据 / race condition / DOM 注入

## 执行命令与结果

### 1. tsc 类型检查
```
$ pnpm -F mp typecheck
> tsc --noEmit
(exit 0 · 0 errors)
```

### 2. WXML vs mockup 对照审查 (13 区块)

| mockup 区块 | WXML 对应 | testid | 判定 |
|---|---|---|---|
| .nav (L130) | view.nav | p08-topbar | PASS |
| .nav .back | view.back + van-icon arrow-left | — | PASS |
| .nav .title | text.title | p08-topbar-cursor | PASS |
| .nav .close | view.close + van-icon cross | p08-close-btn | PASS |
| .ptrack | view.ptrack + pbar | p08-progress-bar | PASS |
| .metarow | view.metarow (3 chips) | p08-meta-chips | PASS |
| .qcard | view.qcard | p08-question-hero | PASS |
| .work | view.work + bind:touchstart | p08-answer-area | PASS |
| .reveal | view.reveal + van-icon success | p08-reveal-content | PASS |
| .nodes | view.nodes + wx:for nodeDots | p08-memory-curve | PASS |
| .rating | view.rating (3 rbtn) | p08-grade-buttons | PASS |
| tabbar | MP 框架 tabBar | N/A | N/A |
| exit sheet | van-overlay + sheet | p08-exit-confirm-sheet | PASS |

### 3. testid 挂载
- 19 次 `data-test-id` (15 静态 TEST_IDS.p08 + 2 动态 p08Ids)

### 4. API 契约
- getNode: GET /api/review/sessions/{sid}/nodes/{nid} port 8085 ✓
- revealNode: POST /api/review/nodes/{nid}/reveal port 8085 ✓
- gradeNode: POST /api/review/nodes/{nid}/grade port 8085 ✓
- mock 计数: 0

### 5. 4 态截图
- pT11-reading.png: 393x852 RGB PNG ✓
- pT11-answering.png: 393x852 RGB PNG ✓
- pT11-exit-confirm.png: 393x852 RGB PNG ✓
- pT11-done.png: 393x852 RGB PNG ✓

### 6. 探索性对抗 (详见 adversarial.md Round 2)
- 连点防抖: onRevealTap/onGradeTap 有 isRevealing/isGrading guard + WXML disabled — PASS
- 超长数据: scroll-view 兜底可滚动, 无 crash — PASS (advisory: 建议加 max-height)
- race condition: API 慢 + 退出 → setData on detached page, WX runtime 静默忽略 — PASS (low risk)
- DOM 注入: WX {{}} 自动 escape, 无 rich-text/eval — PASS

## 对抗轮次摘要

| 轮次 | 类型 | 结果 |
|---|---|---|
| R1 | REJECT: nodeIndex=2→1 | 已修复 (612e5f2) |
| R2 | 探索性: 连点/超长/race/DOM注入 | 全 PASS |
| R3 | 最终验证 | PASS |

## 判定: PASS
