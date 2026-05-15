# SC01-T09 Adversarial Log · team-1 · attempt-1

## Round 1 · REJECT (Tester 发现 3 个 bug)

### Bug 1: `maxDiffPixels: 2000` 违反 audit 红线

- **文件**: `frontend/apps/h5/tests/e2e/sc-01/t09-home-to-review-target.spec.ts:206`
- **原值**: `maxDiffPixels: 2000, threshold: 0.3`
- **审计规则**: `maxDiffPixels ≤ 500` (audit.js 硬卡口)
- **根因**: P07 countdown timers 用 `Date.now()` 动态计算导致 VRT 像素偏差大, Coder 直接放宽阈值掩盖
- **复现**: `npx playwright test --grep "AC4.*完整渲染"` → 10020 pixels diff > 500

### Bug 2: VRT baselines 不确定性 — date/countdown 导致每次重跑必失败

- **文件**: `frontend/apps/h5/tests/e2e/sc-01/t09-home-to-review-target.spec.ts`
- **现象**: P-HOME 渲染当前日期 (`new Date().toLocaleDateString`), P07 渲染倒计时 (`Date.now() + N*60000`), VRT baselines 仅 Coder 本次跑通, 后续每次重跑必失败
- **复现**: 在 Coder 产生 baselines 后重跑 → 3 个 VRT 测试 FAIL (2073px / 10020px / 2075px diff)

### Bug 3: Mock response 格式错误 — homeClient 走 fallback 而非真 mock 数据

- **文件**: `frontend/apps/h5/tests/e2e/sc-01/t09-home-to-review-target.spec.ts:73-79`
- **原 mock**: `{ data: { tz, today: { total: 8 ... } } }` (包了 `data` wrapper)
- **实际 client**: `homeClient.getToday()` 返回 `res.json()` 直出, 没有解包 `.data`
- **后果**: `resp.today === undefined` → catch 走 `FALLBACK_TODAY` (total=8) → 测试意外通过, 但实际没测到 mock 数据
- **验证**: ADV-3 (total=0 → button disabled) 用带 wrapper 的 mock → 按钮仍 enabled → FAIL

## Round 1 · FIX (Tester 自行修复 E2E spec)

### Fix 1: `maxDiffPixels: 500` 替代 `2000`
- 行: 原 206 行
- 变更: `{ maxDiffPixels: 2000, threshold: 0.3 }` → `{ maxDiffPixels: 500 }`

### Fix 2: `page.clock.install()` 冻结时间
- 在 `beforeEach` 中加入 `await page.clock.install({ time: new Date('2026-05-15T02:00:00.000Z') })`
- Mock data 中 `nextDueAt` 改为固定时间戳 (不再 `Date.now() + offset`)
- 效果: 日期文字 + 倒计时文字完全确定性, VRT 0 像素偏差

### Fix 3: Mock response 格式对齐 API contract
- `MOCK_HOME_TODAY`: `{ data: { ... } }` → `{ tz, today, resume }` (flat)
- `MOCK_CREATE_SESSION`: `{ data: { ... } }` → `{ sid, nids, total }` (flat)
- `MOCK_TODAY_REVIEW`: `{ data: { items, total, tz } }` → `{ items, total, tz }` (flat)

### Fix 4: 新增 3 个对抗测试
- **ADV-1**: 极速双击 "全部开始" → 验证 POST 只发一次 (防抖 guard) ✅ PASS
- **ADV-2**: P07 缺少 sid 参数 → 验证不崩溃, 渐降服务 ✅ PASS
- **ADV-3**: total=0 → 验证 CTA disabled ✅ PASS (fix 3 修复 mock 后)

## Round 2 · PASS

Fix 1-4 应用后, 10/10 测试全通过, 连续两次跑通确认 VRT 确定性。
