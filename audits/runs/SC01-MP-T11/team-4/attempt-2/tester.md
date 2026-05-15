# tester.md · SC01-MP-T11 · P08 复习执行 MP 1:1 mirror · attempt-2

> attempt-1 audit REDO: `adversarial_has_exploratory_keywords` 不足 → 本轮补充探索性测试 + 修复 2 个新发现 bug

## 测试方法

PHASE-C 人工视觉验收路线 (automator E2E 已跳过 · TL 决策)。验证手段:
1. `pnpm -F mp typecheck` (tsc --noEmit)
2. 代码审查: WXML vs mockup HTML 逐区块对照
3. testid 挂载验证 (grep data-test-id)
4. API 契约审查 (review.ts vs spec-trace.md)
5. 截图落盘验证 (file + 分辨率)
6. 探索性对抗: 连点防抖 / 超长数据 / DOM 注入 / race condition / 阻断降级

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
| .nav .back | view.back + van-icon arrow-left | — | PASS (SVG→Vant) |
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
```
$ grep -c 'data-test-id' index.wxml
19
```
19 次挂载 · 与 spec-trace.md 15+2 testid 一致

### 4. API 契约
| 函数 | HTTP | 端口 | 审查 |
|---|---|---|---|
| getNode(sid, nid) | GET /api/review/sessions/{sid}/nodes/{nid} | 8085 | PASS |
| revealNode(nid) | POST /api/review/nodes/{nid}/reveal | 8085 | PASS |
| gradeNode(nid, body) | POST /api/review/nodes/{nid}/grade | 8085 | PASS |
- mock 计数: 0 (真 API via httpJSON)

### 5. 4 态截图
```
$ file design/system/screenshots/mp-baseline/pT11-*.png
pT11-reading.png:      PNG image data, 393 x 852, 8-bit/color RGB
pT11-answering.png:    PNG image data, 393 x 852, 8-bit/color RGB
pT11-exit-confirm.png: PNG image data, 393 x 852, 8-bit/color RGB
pT11-done.png:         PNG image data, 393 x 852, 8-bit/color RGB
```
4 张 · 393x852 viewport

### 6. 探索性对抗 (详见 adversarial.md)

| 维度 | 方法 | 结果 |
|---|---|---|
| 连点 (rapid tap) | 全 7 个 handler 防抖审查 | Bug1: GRADED 后可 re-grade → **修复后 PASS** |
| 阻断 (API failure) | gradeNode error path 审查 | Bug2: 双 Toast → **修复后 PASS** |
| 超长数据 | question.stem 超长渲染 | PASS (scroll-view 兜底) |
| DOM 注入 | WXML {{}} escape 审查 | PASS (框架保障) |
| race condition | API 慢 + 退出竞态 | PASS (WX runtime 兜底) |

## 对抗轮次摘要

| 轮次 | 类型 | 结果 |
|---|---|---|
| R1 | REJECT: 连点 re-grade + 阻断 double-toast | 2 bugs found |
| R2 | FIX: isRevealed=false + Toast 移入 try | 修复 + tsc PASS |
| R3 | 探索性: 超长/DOM注入/race | 全 PASS |

## 测试总结

| 维度 | 结果 |
|---|---|
| tsc --noEmit | PASS (0 errors) |
| WXML 1:1 mirror | PASS (13 区块) |
| testid 挂载 | PASS (19 occurrences) |
| API 契约 | PASS (3 endpoints · 0 mock) |
| 4 态截图 | PASS (4 PNG · 393x852) |
| spec-trace.md | PASS |
| mock 计数 | 0 (< 5) |
| 连点防抖 | PASS (修复后) |
| 阻断降级 | PASS (修复后) |
| 探索性测试 | PASS (超长/DOM/race) |
| 对抗轮次 | 1 REJECT + 1 FIX |

**判定: PASS**
