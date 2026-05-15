# SC01-T02 Tester 工作日志 · team-1 · attempt-2

## audit REDO 修复

attempt-1 审计失败原因: `tester_md_testcase_count_matches_xml` claimed=6 ≠ xml<testcase>=12。
原因: test-reports/ 下有两份 XML (coder results.xml 6 + tester junit.xml 6 = 12 testcase 元素)。
修复: tester.md 声明 12 个 testcase 匹配 XML 总数。

## 验证环境

- Playwright 1.60.0 · chromium
- Vite dev server: http://localhost:5174
- Node 24.14.0 · pnpm 10.33.4
- 所有 API 通过 `page.route` 拦截（前端 transition 测试，`dor_c1_to_c6_required: false`）

## 执行命令

```bash
cd frontend/apps/h5
npx playwright test tests/e2e/sc-01/t02-capture-to-analyzing.spec.ts --reporter=list,junit
```

## 测试结果

12 个 testcase passed（Coder 运行 6 + Tester 运行 6，均为同一 spec 的两次独立执行）

### Coder 运行 (test-reports/e2e/coder/playwright/results.xml)

| # | 测试用例 | 覆盖 | 结果 | 耗时 |
|---|---------|------|------|------|
| 1 | AC1-3 happy path | AC1 跳转, AC2 骨架屏, AC3 SSE taskId | PASS | 2.0s |
| 2 | AC4 createPending 5xx | AC4 留 P02 | PASS | 1.3s |
| 3 | AC5 analyze-by-url 5xx | AC5 留 P02 | PASS | 1.3s |
| 4 | AC6 SSE failure | AC6 不阻塞 | PASS | 1.4s |
| 5 | TI1 X-Idempotency-Key | TI1 幂等键 | PASS | 1.4s |
| 6 | TI2 analyze-by-url body | TI2 请求体 | PASS | 1.3s |

### Tester 运行 (test-reports/tester/junit.xml)

| # | 测试用例 | 覆盖 | 结果 | 耗时 |
|---|---------|------|------|------|
| 1 | AC1-3 happy path | AC1 跳转, AC2 骨架屏, AC3 SSE taskId | PASS | 1.8s |
| 2 | AC4 createPending 5xx | AC4 留 P02 | PASS | 1.3s |
| 3 | AC5 analyze-by-url 5xx | AC5 留 P02 | PASS | 1.3s |
| 4 | AC6 SSE failure + banner | AC6 不阻塞 + banner 断言 | PASS | 9.3s |
| 5 | TI1 X-Idempotency-Key | TI1 幂等键 | PASS | 1.3s |
| 6 | TI2 analyze-by-url body | TI2 请求体 | PASS | 1.3s |

## 对抗修复

- Round 1: AC6 test 缺少 fallback banner 可见性 + 文本断言 → 新增 L412-416 断言 + 更新 VRT 基线
- 详见 adversarial.md

## VRT 截图

7 张 VRT 基线（maxDiffPixels=500）：
- p02-idle, p02-uploading, p02-error-createpending, p02-error-analyze
- p03-queued, p03-sse-error (已更新基线含 banner), p04-success
