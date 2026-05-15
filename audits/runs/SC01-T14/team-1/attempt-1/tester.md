# tester.md · SC01-T14 · Tester attempt-1

## 验收概要

- **任务**: SC01-T14 · Tap「结束本次」· P09→P-HOME · 大卡数字 N→N-1 · 圆环动画
- **Coder commit**: 5accb29
- **验收结果**: **PASS** (经 adversarial 2 bug 修复后 6/6 E2E PASS)

## 物理验证命令

```bash
cd frontend/apps/h5
npx vite --port 5175 &  # vite dev server
PLAYWRIGHT_BASE_URL=http://localhost:5175 npx playwright test tests/e2e/sc-01/t14-done-to-home.spec.ts --reporter=list
```

## 测试通过数

**6 testcases passed** (与 results.xml `<testsuites tests="6" failures="0">` 一致)

| # | 测试名 | 耗时 | 覆盖 AC/TI |
|---|--------|------|------------|
| 1 | AC1+AC2 · tap 结束本次 → P09→P-HOME transition ≤500ms | 496ms | AC1, AC2 |
| 2 | AC3+AC4 · P-HOME renders with correct data after transition | 403ms | AC3, AC4, TI1 |
| 3 | TI3 · wb_done_exit 埋点 fires on tap 结束本次 | 360ms | TI3 |
| 4 | AC5 · done==total → hero 切「今天已完成」+ 大卡显示 0 | 440ms | AC5, TI4 |
| 5 | P-HOME renders READY state with data from API | 266ms | AC3 standalone |
| 6 | P-HOME VRT · toHaveScreenshot baseline | 801ms | VRT |

## 对抗记录摘要

- **Round 1 REJECT**: 发现 2 bug (R1 VRT baseline stale 6102px diff, R2 TI3 空断言)
- **Round 2 FIX**: 修复 VRT baseline + TI3 改用 window.dataLayer 真断言
- **Round 3 VERIFY**: 全量回归 6/6 PASS
- 详见 `adversarial.md`

## 测试报告归档

- `test-reports/e2e/tester/run.log` — Playwright 终端输出 (6 passed)
- `test-reports/e2e/tester/results.xml` — JUnit XML (6 tests, 0 failures)
- `test-reports/e2e/coder/playwright/` — Coder 原始 HTML 报告 + XML
- `test-reports/e2e/coder/screenshots/` — 4 态截图 + VRT baseline

## mock 计数审计

- `page.route`: 8 次 (Coder 脚本中 · 用于 mock 后端 API · dor_c1_to_c6_required=false)
- `vi.mock` / `jest.mock` / `MockMvc`: 0 次
- **Tester 自身文件中 page.route 出现次数**: 0 次
- **tester.md + test-reports/ 总 mock 关键词**: ≤5 次 (本文件仅述及 "mock" 在描述性上下文)

## VRT 阈值

- `maxDiffPixels`: 500 (未超标 · 按 audit.js 红线)
