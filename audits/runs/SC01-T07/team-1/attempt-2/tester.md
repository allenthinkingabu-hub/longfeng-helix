# tester.md · SC01-T07 · Tester team-1 attempt-2

## audit REDO 修复

- **previous_audit_verdict.redo_reason**: `[test_validity.tester_md_testcase_count_matches_xml] claimed=6 but no <testcase> in XML — tester.md may inflate`
- **修复**: 用 `--reporter=junit` 重跑 Playwright，生成 `junit-results.xml` 含 6 个 `<testcase>` 标签，与 tester.md claimed=6 对齐

## 测试环境

- Runner: Playwright (chromium, headless)
- BASE_URL: http://localhost:5174 (Vite dev server)
- API: Mocked via `page.route()` — 3 routes (list, detail, save) · `dor_c1_to_c6_required: false`
- Node: local · macOS Darwin

## 执行命令

```bash
cd frontend/apps/h5
# JUnit XML (audit.js 需要 <testcase> 标签)
npx playwright test tests/e2e/sc-01/t07-list-highlight-newest.spec.ts --reporter=junit > test-reports/e2e/junit-results.xml
# Human-readable log
npx playwright test tests/e2e/sc-01/t07-list-highlight-newest.spec.ts --reporter=list > test-reports/e2e/tester-run.log
```

## 测试结果: 6 passed (9.9s)

| # | Test | Time | Status |
|---|------|------|--------|
| 1 | AC1+AC2+AC3: P04 save → P05 with highlight → green border 3s fade | 5.3s | ✅ PASS |
| 2 | AC4: highlighted card renders all required elements | 358ms | ✅ PASS |
| 3 | TI1: highlight={qid} not in list → fallback no highlight | 260ms | ✅ PASS |
| 4 | 4-state VRT: loading state | 739ms | ✅ PASS |
| 5 | 4-state VRT: empty state | 275ms | ✅ PASS |
| 6 | 4-state VRT: error state | 2.3s | ✅ PASS |

**Total: 6 testcases passed** (与 `junit-results.xml` 中 6 个 `<testcase>` 标签对齐)

## AC 覆盖映射

| AC | 验证内容 | 测试 # | 结论 |
|----|---------|--------|------|
| AC1 | save 200 → P04→P05 跳转 · scrollY=0 | 1 | ✅ |
| AC2 | GET /api/wb/questions?highlight={qid} → 200 · 第 1 项 qid 匹配 | 1 | ✅ |
| AC3 | border 2px solid green (#34C759) 持续 3s → fade-out · borderWidth=2px + borderColor 验证 | 1 | ✅ |
| AC4 | 左色条 + 学科 chip + KP chips + 难度 ★ + 6 段 stage bar + 下次到期 | 2 | ✅ |

## TI 覆盖映射

| TI | 验证内容 | 测试 # | 结论 |
|----|---------|--------|------|
| TI1 | highlight={qid} 不在 list → fallback 不高亮 | 3 | ✅ |
| TI2 | 高亮 fade-out 后无 border 残留 (post-fade border check at t=4.5s) | 1 | ✅ |
| TI3 | 埋点 wb_list_view{highlightedQid} | — | ⚠️ 未测 (telemetry spy 需额外 mock) |
| TI4 | 4 态 VRT screenshot (loading/empty/list/error) | 4,5,2,6 | ✅ |

## Mock 计数

| # | 路由 | 用途 |
|---|------|------|
| 1 | `**/api/wb/questions?*` | 列表 GET (list/empty/error) |
| 2 | `**/api/wb/questions/{qid}` | 详情 GET (P04 渲染) |
| 3 | `**/api/wb/questions/{qid}/save` | 保存 POST (P04→P05 跳转) |

**Total mock: 3 (≤ 5 audit limit)**

## 对抗记录

- 1 轮 REJECT: AC3 borderWidth 缺失 + TI2 post-fade timing bug (3.5s < 3.8s transition end)
- 1 轮 FIX: 添加 borderWidth=2px 断言 + 调整 wait 到 4.5s + 添加 post-fade borderColor 断言
- 详见 `adversarial.md`
