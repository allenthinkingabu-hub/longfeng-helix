# SC01-T09 Tester Log · team-1 · attempt-1

## 测试环境

- Playwright chromium · viewport 393×852
- Vite dev server: `http://localhost:5190`
- 环境变量: `PLAYWRIGHT_BASE_URL=http://localhost:5190`
- 时钟冻结: `page.clock.install({ time: '2026-05-15T02:00:00.000Z' })` (10:00 CST)

## 执行命令

```bash
PLAYWRIGHT_BASE_URL=http://localhost:5190 npx playwright test tests/e2e/sc-01/t09-home-to-review-target.spec.ts --reporter=list
```

## 测试结果 · 10/10 PASS

```
Running 10 tests using 1 worker

  ✓   1 P-HOME renders with hero card and start button (371ms)
  ✓   2 AC1+AC2+AC3: Tap 全部开始 → POST /sessions → navigate P07 (416ms)
  ✓   3 AC4: P07 完整渲染 - Hero + 3 stat + progress + slots + CTA (367ms)
  ✓   4 AC4: P07 slot groups render correctly (352ms)
  ✓   5 AC2: POST /sessions request body is correct (958ms)
  ✓   6 P07 error state: POST /sessions fails → toast (557ms)
  ✓   7 P07 back navigation returns to P-HOME (421ms)
  ✓   8 ADV-1: Rapid double-click "全部开始" should not fire POST twice (735ms)
  ✓   9 ADV-2: P07 with missing sid param still renders gracefully (263ms)
  ✓  10 ADV-3: P-HOME CTA disabled when total=0 (263ms)

  10 passed (5.3s)
```

## AC 覆盖

| AC | 测试用例 | 状态 |
|---|---|---|
| AC1 | Test 2: Tap 按钮 → click → navigate | ✅ |
| AC2 | Test 2 + Test 5: POST /sessions body {tz: 'Asia/Shanghai'} | ✅ |
| AC3 | Test 2: P-HOME → P07 transition (timeout 2000ms) | ✅ |
| AC4 | Test 3 + Test 4: Hero + 3 stat + progress + slots + CTA | ✅ |
| AC5 | 隐含: mock data ACTIVE items match total | ✅ |

## TI 覆盖

| TI | 验证 | 状态 |
|---|---|---|
| TI1 | session in-memory (mock API, no DB) | ✅ mock |
| TI2 | 未直接测 (session 重播需真后端) | N/A |
| TI3 | 埋点 track() 调用存在于 code (grep 确认) | ✅ |
| TI4 | VRT screenshot p07-list-baseline.png | ✅ |

## VRT 截图 (3 baselines · maxDiffPixels ≤ 500)

- `p-home-idle-baseline-chromium-darwin.png`
- `p07-list-baseline-chromium-darwin.png`
- `p-home-error-baseline-chromium-darwin.png`

## Tester 修复记录

1. `maxDiffPixels: 2000` → `500` (违反 audit 红线)
2. 添加 `page.clock.install()` 冻结时间 — 消除 date/countdown VRT 抖动
3. Mock response 格式修复: `{ data: {...} }` → flat shape (homeClient 不解包 .data)
4. 新增 3 个对抗测试 (ADV-1 防抖 / ADV-2 缺参容错 / ADV-3 total=0 disabled)
