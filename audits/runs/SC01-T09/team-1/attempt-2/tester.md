# SC01-T09 Tester Log · team-1 · attempt-2

## 测试环境

- **E2E 框架**: Playwright (chromium)
- **Dev server**: `http://localhost:5195` (vite dev server · worktree port)
- **Clock**: `page.clock.install({ time: '2026-05-15T02:00:00.000Z' })` (UTC = 10:00 CST · 确保 VRT 确定性)
- **API 策略**: `page.route()` mock 3 个 API endpoint (确定性 E2E · `physical_verification.dor_c1_to_c6_required: false`)
- **maxDiffPixels**: 500 (audit c4b 合规)

## 测试命令

```bash
cd frontend/apps/h5
PLAYWRIGHT_BASE_URL=http://localhost:5195 npx playwright test tests/e2e/sc-01/t09-home-to-review-target.spec.ts --reporter=list,junit
```

## 测试结果 · 10 passed

```
Running 10 tests using 1 worker

  ✓  1 P-HOME renders with hero card and start button (809ms)
  ✓  2 AC1+AC2+AC3: Tap 全部开始 → POST /sessions → navigate P07 (432ms)
  ✓  3 AC4: P07 完整渲染 - Hero + 3 stat + progress + slots + CTA (347ms)
  ✓  4 AC4: P07 slot groups render correctly (340ms)
  ✓  5 AC2: POST /sessions request body is correct (397ms)
  ✓  6 P07 error state: POST /sessions fails → toast (395ms)
  ✓  7 P07 back navigation returns to P-HOME (373ms)
  ✓  8 ADV-1: Rapid double-click should not fire POST twice (770ms)
  ✓  9 ADV-2: P07 with missing sid param still renders gracefully (306ms)
  ✓ 10 ADV-3: P-HOME CTA disabled when total=0 (292ms)

  10 passed (5.3s)
```

## AC 覆盖映射

| AC | 测试 | 验证方式 |
|---|---|---|
| AC1 | #2 AC1+AC2+AC3 | click CTA → button loading state + navigation |
| AC2 | #5 AC2 POST body | 拦截 POST /sessions 验证 `body.tz` |
| AC3 | #2 AC1+AC2+AC3 | P07 root visible within 2000ms timeout |
| AC4 | #3 + #4 | Hero card + 3 stat cards + progress bar + slot groups + CTA 全部 `toBeVisible()` |
| AC5 | N/A (API optional params) | `primary_apis` 标注 `node_ids?` 可选 · 由后端 session 逻辑保证 |

## TI 覆盖映射

| TI | 测试 | 验证方式 |
|---|---|---|
| TI1 | #2 | POST /sessions → 200 {sid} (mock 验证请求发送) |
| TI2 | N/A | 需真后端验证 · `physical_verification.dor_c1_to_c6_required: false` |
| TI3 | N/A | `track()` 调用在 Home.tsx:82 · 无后端埋点系统可验证 |
| TI4 | #3 | `toHaveScreenshot('p07-list-baseline.png', { maxDiffPixels: 500 })` |

## 对抗测试 (3 adversarial)

| # | 测试 | 防护逻辑 |
|---|---|---|
| ADV-1 | Rapid double-click | `isStarting` guard 防止重复 POST |
| ADV-2 | Missing sid param | P07 优雅降级 · 从 API 获取数据 |
| ADV-3 | total=0 disabled | CTA `disabled={total === 0}` |

## 归档文件

- `test-reports/e2e/playwright/junit.xml` — 10 testcases / 0 failures (替换了 Coder 归档的 stale 7-test JUnit)
- `test-reports/e2e/playwright/index.html` — Playwright HTML report
- `test-reports/e2e/screenshots/` — 3 VRT baselines (IDLE / LIST / ERROR)
- `adversarial.md` — 1 轮 REJECT (stale JUnit) + 1 轮 FIX + PASS

## 结论

**PASS** · 10/10 E2E 全绿 · 3 adversarial tests 覆盖防抖/降级/零状态 · VRT 3 baselines maxDiffPixels=500 合规 · JUnit XML 数字对齐 (10 testcases = 10 passed)。
