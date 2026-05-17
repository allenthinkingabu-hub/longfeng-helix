# SC-11-T03 · Tester Attempt-1 · 验证日志

> 验证 SC-11-T03 Coder attempt-1 交付 · 是否满足 inflight DoD 8 项 + audit.js v3
> 7 dim · 重点验证关键断言点 (/api/ai/* + /api/guest/* 累计 0 calls)。

## DoR (Definition of Ready) 准入检查

| # | DoR 项 | 状态 | 证据 |
|---|--------|------|------|
| DoR-1 | E2E 脚本本体存在 | ✓ | `frontend/apps/h5/tests/e2e/sc-11/t03-landing-sample-chips-overlay.spec.ts` 真后端 + 真 vite + 真 React (no mock 业务) |
| DoR-2 | 真机跑通 raw output | ✓ | `test-reports/playwright-list.log` · `9 passed (7.8s)` |
| DoR-3 | 真截图证据 ≥ 4 张 | ✓ | `test-reports/screenshots/` 4 张 (chips_visible / overlay_math_open / overlay_english_open / closed_back_to_landing) |
| DoR-4 | spec trace 对照表 | ✓ | coder.md §3.3 给出 6 行 spec.md §6 → testid → assertion 对照表 |

**DoR PASS** · 进入正式测试。

## 实跑命令 + 测试通过数

### 真测命令
```
cd frontend/apps/h5
PLAYWRIGHT_BASE_URL=http://localhost:5174 pnpm exec playwright test \
  tests/e2e/sc-11/t03-landing-sample-chips-overlay.spec.ts \
  tests/e2e/sc-11/t03-landing-sample-chips-adversarial.spec.ts \
  --reporter=list
```

### 通过数
- 主 spec: **5 testcase passed** (chips_render_3_subjects / chip_tap_opens_overlay / overlay_close_via_x_button / overlay_close_via_mask_tap / no_ai_calls_during_overlay)
- 对抗 spec: **4 testcase passed** (android_back_closes_overlay / 3_chip_cycle_open_close / sheet_click_does_not_close / chip_double_tap_no_double_overlay)
- 合计: **9/9 testcase PASS · 7.8s 完成**
- evidence-capture: **1/1 PASS** (ide-console.txt + 4 screenshots)
- regression (SC-11 全套): **25/25 PASS** (T01 11 + T02 6 + T03 9 · 含 evidence specs · 20.0s)

### 测试通过数对账 (audit.js v3 红线)
- 主 spec + 对抗 spec 合计 = **9 testcase**
- evidence-capture: 1
- 不计 evidence: 主验收 9 testcase 与 inflight DoD #4 红线 "5 case + 2+ case = 7+" 满足且超额 (实际 9 > 7)
- raw `playwright-list.log` 含 `9 passed (7.8s)` · 数字一致

## 5 维度自检 (PASS 定义 · 2026-05-16 用户视角)

| # | 项 | 状态 | 证据 |
|---|----|------|------|
| 1 | unit + integration + e2e 全绿 | ✓ | 本 task 纯前端无 unit · e2e 9/9 PASS |
| 2 | IDE / 浏览器 Console 零 [error] | ✓ | `test-reports/ide-console.txt` 5 行 · 仅 [debug] vite + [info] React DevTools + [warning] React Router (不计) · 0 [error] |
| 3 | 页面渲染元素数 ≥ 阈值 | ✓ | 浮层 4 elements (root + close + 3 cards) · chip 3 elements · 主 spec (b)(c) 全部 `toBeVisible` 验证 |
| 4 | 网络请求真返预期 · 非 catch 静默吞 | ✓ | (e) `no_ai_calls_during_overlay` page.route spy 验证 0 调用 · 真 backend `/api/landing/samples` 返 3 学科 · DEGRADED 态测试 (T01) 仍 PASS |
| 5 | 截图与 mockup baseline | N/A | inflight 未要求 VRT pixel diff (T01 已守 mockup baseline · T03 复用同一 LandingPage 不引入新视觉) |

## 关键断言点验证 (biz §2B.12 · 浮层不调 AI)

- testcase: `t03-landing-sample-chips-overlay.spec.ts:146 TC-11-T03 (e) no_ai_calls_during_overlay`
- 实现: `page.route('**/api/ai/**', ...)` + `page.route('**/api/guest/**', ...)` 双重 spy · 命中即计数 + abort
- 流程: 完整开合 3 次 (math → ×, english → ×, physics → ×) · 期间 mount 3 卡片 (errorCard / correctionCard / variantCard) 全部 visible
- 结果: `aiCallCount === 0` AND `guestCallCount === 0` · 真测 PASS
- **结论**: 浮层 100% 静态读 SC-11-T01 已 fetch 的 samples · 无任何 AI / guest 接口触发 · 符合 biz 关键断言点

## mock 计数 (audit.js v3 红线 ≤ 5)

| 文件 | 类型 | 次数 |
|------|------|------|
| t03-landing-sample-chips-overlay.spec.ts | page.route (AI spy) | 1 |
| t03-landing-sample-chips-overlay.spec.ts | page.route (guest spy) | 1 |
| **合计** | | **2** |

2 ≤ 5 红线 · 远未到风险。无 vi.mock / MockMvc / jest.mock / wx.cloud.mock。

## VRT maxDiffPixels (audit.js v3 红线 ≤ 500)

本 task 未引入新 VRT 断言 (复用 SC-11-T01/T02 已守的 mockup baseline)。

## 决策与宣判

**PASS** · 9/9 testcase 真机跑通 · 关键断言点 0 AI call · 0 console error · 全部 DoD 项满足。
将 inflight `task.passes` 设 `true` · 触发 audit.js v3 7 dim 审计。
