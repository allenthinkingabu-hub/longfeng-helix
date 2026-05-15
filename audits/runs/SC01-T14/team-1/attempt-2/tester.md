# tester.md · SC01-T14 · Tester attempt-2

## 验收概要

- **任务**: SC01-T14 · Tap「结束本次」· P09→P-HOME · 大卡数字 N→N-1 · 圆环动画
- **Coder commit**: 5accb29
- **Tester commit**: b4804fc (attempt-1 adversarial fixes)
- **验收结果**: **PASS** (adversarial 3 bug 修复 + Tab 3 覆盖补全 · 6/6 E2E PASS)
- **attempt-1 REDO 原因**: `tester_md_testcase_count_matches_xml: claimed=6 ≠ xml<testcase>=12` — tester.md 仅声明 6 但 test-reports/ 含 2 份 XML (coder 6 + tester 6 = 12)

## 物理验证命令

```bash
cd frontend/apps/h5
npx vite --port 5175 &  # vite dev server
PLAYWRIGHT_BASE_URL=http://localhost:5175 npx playwright test tests/e2e/sc-01/t14-done-to-home.spec.ts --reporter=list
```

## 测试通过数

**12 testcases passed** (Coder 6 + Tester 6 · 与 test-reports/ 下 2 份 results.xml 总计 `<testcase>` 数一致)

### Coder E2E run (6 tests · test-reports/e2e/coder/playwright/results.xml)

| # | 测试名 | 耗时 |
|---|--------|------|
| 1 | AC1+AC2 · tap 结束本次 → P09→P-HOME transition ≤500ms | 1.06s |
| 2 | AC3+AC4 · P-HOME renders with correct data after transition | 0.743s |
| 3 | TI3 · wb_done_exit 埋点 fires on tap 结束本次 | 0.648s |
| 4 | AC5 · done==total → hero 切「今天已完成」+ 大卡显示 0 | 0.682s |
| 5 | P-HOME renders READY state with data from API | 0.516s |
| 6 | P-HOME VRT · toHaveScreenshot baseline | 1.071s |

### Tester 回归 run (6 tests · test-reports/e2e/tester/results.xml)

| # | 测试名 | 耗时 | 覆盖 AC/TI |
|---|--------|------|------------|
| 1 | AC1+AC2 · tap 结束本次 → P09→P-HOME transition ≤500ms | 496ms | AC1, AC2 |
| 2 | AC3+AC4 · P-HOME renders with correct data after transition | 403ms | AC3, AC4, TI1 |
| 3 | TI3 · wb_done_exit 埋点 fires on tap 结束本次 | 360ms | TI3 |
| 4 | AC5 · done==total → hero 切「今天已完成」+ 大卡显示 0 + Tab 3 高亮 | 537ms | AC5, TI4 |
| 5 | P-HOME renders READY state with data from API | 341ms | AC3 standalone |
| 6 | P-HOME VRT · toHaveScreenshot baseline | 845ms | VRT |

## 对抗记录摘要

- **Round 1 REJECT (attempt-1)**: 2 bug (R1 VRT baseline stale 6102px · R2 TI3 空断言)
- **Round 2 FIX (attempt-1)**: VRT baseline 重生成 + TI3 改 window.dataLayer 真断言 → commit b4804fc
- **Round 3 VERIFY (attempt-1)**: 6/6 PASS → audit REDO (testcase count mismatch)
- **Round 4 REJECT (attempt-2)**: AC5 Tab 3 拍题入口高亮 未断言 (覆盖缺口)
- **Round 5 FIX (attempt-2)**: 新增 Tab 3 tabHighlight class 断言
- **Round 6 VERIFY (attempt-2)**: 6/6 PASS + testcase count 12 对齐
- 详见 `adversarial.md`

## 测试报告归档

- `test-reports/e2e/tester/run.log` — Tester Playwright 终端输出 (6 passed)
- `test-reports/e2e/tester/results.xml` — Tester JUnit XML (6 tests, 0 failures)
- `test-reports/e2e/coder/playwright/results.xml` — Coder JUnit XML (6 tests, 0 failures)
- `test-reports/e2e/coder/playwright/run.log` — Coder Playwright 终端输出
- `test-reports/e2e/coder/playwright/index.html` — Coder HTML report
- `test-reports/e2e/coder/screenshots/` — 4 态截图 + VRT baseline

## mock 计数审计

- `page.route`: 8 次 (Coder 脚本中 · 用于 mock 后端 API · dor_c1_to_c6_required=false)
- `vi.mock` / `jest.mock` / `MockMvc`: 0 次
- **Tester 自身文件中 page.route 出现次数**: 0 次

## VRT 阈值

- `maxDiffPixels`: 500 (未超标 · 按 audit.js 红线)
