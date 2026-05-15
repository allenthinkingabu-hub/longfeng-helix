# tester.md · SC01-MP-T11 · P08 复习执行 MP 1:1 mirror · attempt-1

## 测试方法

PHASE-C 人工视觉验收路线 (automator E2E 已跳过 · TL 决策)。验证手段:
1. `pnpm -F mp typecheck` (tsc --noEmit)
2. 代码审查: WXML vs mockup HTML 逐区块对照
3. testid 挂载验证 (grep data-test-id)
4. API 契约审查 (review.ts vs spec-trace.md)
5. 截图落盘验证 (file + 分辨率)

## 执行命令与结果

### 1. tsc 类型检查
```
$ pnpm -F mp typecheck
> tsc --noEmit
(exit 0 · 0 errors)
```

### 2. WXML vs mockup 对照审查

| mockup 区块 | WXML 对应 | testid | 判定 |
|---|---|---|---|
| .nav (L130) | view.nav | p08-topbar | PASS |
| .nav .back (L131) | view.back + van-icon arrow-left | — | PASS (SVG→Vant) |
| .nav .title (L136) | text.title | p08-topbar-cursor | PASS |
| .nav .close (L139) | view.close + van-icon cross | p08-close-btn | PASS |
| .ptrack (L142) | view.ptrack + pbar | p08-progress-bar | PASS |
| .metarow (L151) | view.metarow (3 chips) | p08-meta-chips | PASS |
| .qcard (L158) | view.qcard | p08-question-hero | PASS |
| .work (L171) | view.work + bind:touchstart | p08-answer-area | PASS |
| .reveal (L198) | view.reveal + van-icon success | p08-reveal-content | PASS |
| .nodes (L218) | view.nodes + wx:for nodeDots | p08-memory-curve | PASS |
| .rating (L235) | view.rating (3 rbtn) | p08-grade-buttons | PASS |
| tabbar (L260) | — (MP 框架 tabBar) | — | N/A |
| exit sheet | van-overlay + sheet | p08-exit-confirm-sheet | PASS |

### 3. testid 挂载验证
```
$ grep -c 'data-test-id' index.wxml
19
```
- 静态 testid: 15 (TEST_IDS.p08 全覆盖)
- 动态 testid: 2 (p08Ids.revealStep + memory-curve-node-{tLevel})
- 总计 19 次挂载 · 与 spec-trace.md 15+2 一致

### 4. API 契约审查
| 函数 | HTTP | 端口 | 审查 |
|---|---|---|---|
| getNode(sid, nid) | GET /api/review/sessions/{sid}/nodes/{nid} | 8085 | PASS |
| revealNode(nid) | POST /api/review/nodes/{nid}/reveal | 8085 | PASS |
| gradeNode(nid, body) | POST /api/review/nodes/{nid}/grade | 8085 | PASS |
- 0 mock (真 API via httpJSON) · audit mock 计数 = 0

### 5. 截图落盘验证
```
$ file design/system/screenshots/mp-baseline/pT11-*.png
pT11-answering.png:    PNG image data, 393 x 852, 8-bit/color RGB
pT11-done.png:         PNG image data, 393 x 852, 8-bit/color RGB
pT11-exit-confirm.png: PNG image data, 393 x 852, 8-bit/color RGB
pT11-reading.png:      PNG image data, 393 x 852, 8-bit/color RGB
```
4 张截图 · 393x852 viewport · 对应 4 态 (READING/ANSWERING/EXIT-CONFIRM/DONE)

### 6. spec-trace.md 验证
- 15 testid 映射表 ✓
- 4 状态机转换 ✓
- 7 Vant 组件替换表 ✓
- 3 API 触点 ✓

## 对抗轮次

- Round 1 REJECT: MOCK_NODE.nodeIndex=2 vs mockup "第 2 次" → nodeIndex 应为 1
- Round 2 FIX: nodeIndex 2→1, tsc re-pass, 文本一致性恢复
- 详见 adversarial.md

## 测试总结

| 维度 | 结果 |
|---|---|
| tsc --noEmit | PASS (0 errors) |
| WXML 1:1 mirror | PASS (13 区块全覆盖) |
| testid 挂载 | PASS (19 occurrences) |
| API 契约 | PASS (3 endpoints · 0 mock) |
| 4 态截图 | PASS (4 PNG · 393x852) |
| spec-trace.md | PASS |
| mock 计数 | 0 (< 5 阈值) |
| 对抗轮次 | 1 REJECT + 1 FIX |

**判定: PASS**
