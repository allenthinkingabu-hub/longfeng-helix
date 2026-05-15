# SC01-T09 Adversarial Log · team-1 · attempt-2

## Round 1 · REJECT

**Tester**: 物理验证发现以下问题。

### Issue 1 (Critical): 归档 JUnit XML 与实际测试结果不一致

- **现象**: `test-reports/e2e/playwright/junit.xml` 显示 `tests="7" failures="1"`（VRT p07-list-baseline 2510px diff > 500 maxDiffPixels），但 coder.md 声称 "10/10 PASS"。
- **复现**:
  ```
  grep 'tests=' audits/runs/SC01-T09/team-1/attempt-2/test-reports/e2e/playwright/junit.xml
  # 输出: tests="7" failures="1"
  ```
- **根因**: Coder 归档了早期 7-test run 的 JUnit（attempt-1 原始 run，含 VRT 失败），未更新为 10-test 全绿结果。
- **影响**: audit.js 数字对齐检查会发现 tester.md 写 "10 passed" 但 JUnit 写 "7 tests 1 failure" → REDO。

### Issue 2 (Minor): 截图仅 3 张，DoR-3 要求 ≥ 4

- **现象**: `test-reports/e2e/screenshots/` 仅 3 张 (IDLE / LIST / ERROR)，缺少"进行中/Loading"态截图。
- **评估**: `physical_verification.dor_c1_to_c6_required: false`，且 P07 loading 态为瞬态 fallback（MOCK_SLOTS 立即渲染），不影响功能正确性。降级为 observation，不阻塞。

### Issue 3 (Observation): AC2 测试仅验证 tz 字段

- **现象**: test "AC2: POST /sessions request body is correct" 仅断言 `body.tz === 'Asia/Shanghai'`，未验证 `body.date` 或 `body.node_ids`。
- **评估**: `primary_apis` 标注 `{date?, node_ids?, tz?}` 全部可选，Home.tsx 仅发送 `{ tz }` 符合 API 契约。AC2 描述 `{date, node_ids:[...]}` 与 API spec 有歧义，但代码实现合理。降级为 observation。

---

## Round 1 · FIX

**Tester 自修复**（Issue 1 属于归档证据问题，Tester 有权重新归档自己跑的测试结果）：

1. 重新运行 `PLAYWRIGHT_BASE_URL=http://localhost:5195 npx playwright test tests/e2e/sc-01/t09-home-to-review-target.spec.ts --reporter=junit`
2. 结果: **10 tests / 0 failures / 0 skipped** (4.67s)
3. 用新 JUnit XML 覆盖 `test-reports/e2e/playwright/junit.xml`
4. 同时用 `--reporter=html` 重新归档 `index.html`

**验证修复**:
```
grep 'tests=' audits/runs/SC01-T09/team-1/attempt-2/test-reports/e2e/playwright/junit.xml
# 输出: tests="10" failures="0"
```

---

## Round 2 · PASS

修复后再次完整运行 E2E：

```
PLAYWRIGHT_BASE_URL=http://localhost:5195 npx playwright test tests/e2e/sc-01/t09-home-to-review-target.spec.ts --reporter=list

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

所有 10 个测试 PASS，包含 7 core + 3 adversarial。VRT baselines 全部匹配 (maxDiffPixels=500)。

### 为什么相信这些测试能抓到回归

- **ADV-1 (防抖)**: 如果 `isStarting` guard 被移除或 debounce 逻辑被破坏，`postCount` 会 > 1 → 测试立即失败。
- **ADV-2 (优雅降级)**: 如果 P07 对 `sid` 参数做了硬依赖（如 crash on null），navigating without sid 会 crash → 测试立即失败。
- **ADV-3 (零状态)**: 如果 CTA disabled 逻辑被移除（`today.total === 0` 条件），按钮会 enabled → `toBeDisabled()` 断言失败。
- **VRT (3 baselines)**: 任何 CSS 回归（布局偏移、颜色变更、字体变化）导致像素差 > 500 → `toHaveScreenshot` 失败。
- **AC2 (POST body)**: 如果 `createSession` 调用参数结构变化，`body.tz` 断言失败。
- **跨页导航 (AC3)**: 如果路由配置被改动或 `nav()` 调用路径变化，P07 root 不会出现 → timeout fail。
