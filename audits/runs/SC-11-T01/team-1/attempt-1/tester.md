# SC-11-T01 · Tester work log · attempt-1 (TL self-execute)

## 实际运行的命令

### Backend IT

```bash
cd backend/anonymous-service
mvn -q -Dtest=T01LandingShellApiE2EIT test
```

**结果**: Tests run: **4**, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 12.36 s

落盘 raw:
- `test-reports/it/TEST-com.longfeng.anonymousservice.T01LandingShellApiE2EIT.xml` (41KB JUnit · 4 `<testcase>` 元素 · 已 grep 验证)
- `test-reports/it/com.longfeng.anonymousservice.T01LandingShellApiE2EIT.txt`

### Playwright E2E

```bash
cd frontend/apps/h5
PLAYWRIGHT_BASE_URL=http://localhost:5176 \
  pnpm exec playwright test tests/e2e/sc-11/t01-landing-shell.spec.ts \
  --reporter=list,junit
```

**结果**: 5 passed (3.0s) · 全 5 case 名单:
1. TC-11-T01 (a) loading_skeleton_then_ready: race-free allSettled · skeleton → samples section
2. TC-11-T01 (b) samples_5xx_falls_to_degraded_state: 500 · banner visible · samples 区缺失
3. TC-11-T01 (c) kpi_5xx_partial_degraded: kpi 500 · kpi-bar absent · samples 正常
4. TC-11-T01 (d) no_auth_no_resolve_calls: 匿名访问 · /api/auth/* + /api/session/resolve count===0
5. TC-11-T01 (e) cdn_cache_headers: samples response · Cache-Control + Vary headers (CDN 强缓存)

落盘 raw:
- `test-reports/e2e/playwright-junit.xml` (10KB JUnit · 5 `<testcase>` 元素)
- `test-reports/e2e/playwright-run.log` (raw stdout · 含每个 case 名 + 耗时)

### Regression (full suite)

```bash
PLAYWRIGHT_BASE_URL=http://localhost:5176 \
  pnpm exec playwright test tests/e2e/sc-00/ tests/e2e/auth/ tests/e2e/sc-11/
```

**结果**: **38 passed** (30.4s)
- SC-00 28/28 (含 t01 (b) testid 迁移修复后)
- auth 5/5
- SC-11 5/5

### IDE Console capture (real subscription)

```bash
PLAYWRIGHT_BASE_URL=http://localhost:5176 \
  pnpm exec playwright test tests/e2e/sc-11/t01-ide-console-capture.spec.ts
```

**结果**: 1 passed · ide-console.txt 5 行 · **0 [error]**

### Screenshot collector

```bash
PLAYWRIGHT_BASE_URL=http://localhost:5176 \
  pnpm exec playwright test tests/e2e/sc-11/t01-screenshots.spec.ts
```

**结果**: 4 passed · 4 PNG 落盘 (00_loading_skeleton / 01_ready_full / 02_degraded_samples / 03_degraded_kpi)

### CDN header real evidence

```bash
curl -sD - "http://localhost:8190/api/landing/samples?bucket=default" -o /dev/null
```

**结果**:
```
HTTP/1.1 200 
Cache-Control: public, max-age=3600
Vary: bucket
Content-Type: application/json
```

落盘: `test-reports/curl-samples-default.txt` / `curl-samples-variant_b.txt` / `curl-kpi.txt`

## Testcase count vs XML 一致性 (audit dim test_validity 自查)

| 数源 | 数值 |
|---|---|
| coder claimed 测试用例数 | 9 (5 Playwright + 4 Backend IT) |
| `playwright-junit.xml` `<testcase>` 元素数 | 5 |
| `TEST-T01LandingShellApiE2EIT.xml` `<testcase>` 元素数 | 4 |
| 合计 XML `<testcase>` | **9** |
| 一致性 | **✓ 9 == 9** |

## Mock 计数 (audit dim tester_compliance 自查)

主 spec `tests/e2e/sc-11/t01-landing-shell.spec.ts` 共用了 5 个测试基础设施 route hook (case (a) 1 spy/delay · case (b) 1 inject 500 · case (c) 1 inject 500 · case (d) 2 spy)，全部用于注入 5xx / spy 计数 / 延时模拟，0 个返业务 wire shape。Backend IT 0 mock (真 Spring Boot context · 真 RandomPort · 真 HttpClient)。审计红线 ≤ 5，本主 spec 边界值合规。

## IDE Console 0 [error] (audit dim ide_smoke 自查)

`test-reports/ide-console.txt` 真订阅 · 共 5 行:
- 2 [debug] vite HMR
- 1 [info] React DevTools install hint
- 2 [warning] React Router future-flag (v7 startTransition + relativeSplatPath)
- **0 [error]**

grep 命令验真:
```bash
grep -c '^\[error\]' audits/runs/SC-11-T01/team-1/attempt-1/test-reports/ide-console.txt
# → 0
```

## VRT (audit dim test_validity 自查)

本 task scope_in 没要求 `expect(page).toHaveScreenshot()` 像素 diff baseline (P-LANDING 完整视觉留 SC-11-T02/T03/T04 fleshes) · 仅要求 4 状态截图证据落盘 · 已落 (00/01/02/03 PNG · 36-78KB · fullPage)

`maxDiffPixels`: 测试代码内 0 出现 (no VRT) · 不存在放宽阈值掩盖瑕疵的可能 · audit.js 默认阈值 500 不触发

## 自检对照

- ✓ Tests run 数字 == XML `<testcase>` 数 (9 == 9 · audit dim test_validity)
- ✓ mock ≤ 5 主 spec · 全为合法用途 (audit dim tester_compliance)
- ✓ 至少 1 轮 REJECT · adversarial.md 详述 (audit dim tester_compliance)
- ✓ 真 Vite + 真 anonymous-service:8190 联调 · 非 fetch mock (audit dim spec_alignment)
- ✓ IDE Console 0 [error] (audit dim ide_smoke)
- ✓ Bug reality: 2 bugs · 在 bugs-found.md 列出修复 commit + 文件路径 (audit dim bug_reality)
- ✓ test_case_first_required=false · 跳过 dim test_cases_alignment (inflight 明示)
