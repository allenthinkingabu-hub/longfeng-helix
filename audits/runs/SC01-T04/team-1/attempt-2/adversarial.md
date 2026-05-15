# adversarial.md · SC01-T04 · Tester team-1 attempt-2

## audit REDO 背景

previous_audit_verdict redo_reason: `[test_validity.tester_md_testcase_count_matches_xml] claimed=4 ≠ xml<testcase>=8`

修复策略: tester.md 声称 8 个 testcase (coder XML 4 + tester XML 4) 与 audit.js 统计对齐。

---

## Round 1 · REJECT — TI1 不变量 E2E 断言不完整

### 发现

审查 E2E 脚本 `tests/e2e/sc-01/t04-analyze-done-to-result.spec.ts` 第 259-260 行:

```typescript
// TI1: T0=now visible as timeline node
await expect(page.locator('[data-testid="result-timeline-node-T0"]')).toBeVisible();
```

**问题**: 仅检查 T0 可见性，但 TI1 不变量要求:
- T0 `data-status` = `now`
- T1-T6 `data-status` = `future`（6 个节点全部）

源码 `Result/index.tsx:430-431` 渲染 `data-testid="result-timeline-node-{tLevel}"` + `data-status={node.status}`。单元测试 `Result.test.tsx:113-119` 有完整断言，但 E2E 脚本遗漏。

**影响**: 若 status 属性渲染错误（如 T1 误标 `now`），E2E 无法捕获回归。

**复现**:
```bash
grep -n 'timeline-node' tests/e2e/sc-01/t04-analyze-done-to-result.spec.ts
# 仅 L260 一处可见性检查，无 data-status 断言
```

### 修复

在 AC1-4 测试中补全 TI1 完整断言:
```typescript
// TI1: T0=now, T1-T6=future (完整不变量验证)
await expect(page.locator('[data-testid="result-timeline-node-T0"]')).toBeVisible();
await expect(page.locator('[data-testid="result-timeline-node-T0"]')).toHaveAttribute('data-status', 'now');
for (const t of ['T1', 'T2', 'T3', 'T4', 'T5', 'T6']) {
  await expect(page.locator(`[data-testid="result-timeline-node-${t}"]`)).toBeVisible();
  await expect(page.locator(`[data-testid="result-timeline-node-${t}"]`)).toHaveAttribute('data-status', 'future');
}
```

### 修复后验证

```
PLAYWRIGHT_BASE_URL=http://localhost:5175 npx playwright test tests/e2e/sc-01/t04-analyze-done-to-result.spec.ts --reporter=list

Running 4 tests using 1 worker
  ✓  1 AC1-4 (947ms)
  ✓  2 AC5 (926ms)
  ✓  3 direct P04 mount (298ms)
  ✓  4 P04 GET API error (2.3s)
  4 passed (5.2s)
```

T0 `data-status=now` + T1-T6 `data-status=future` 全部断言通过。

---

## Round 2 · 超纲对抗验证 — PASS

### 审查项

1. **testcase count 对齐**: coder XML 4 + tester XML 4 = 8 total `<testcase>`, tester.md 声称 8 → 匹配 (修复 attempt-1 审计失败根因)
2. **mock 计数**: `page.route` = 6 次 (单 test 最多 4 ≤ 5), 无 `vi.mock`/`jest.mock`/`MockMvc` → 合规
3. **maxDiffPixels**: 500 × 2 处 = 上限值，无超标
4. **page.evaluate**: 仅 1 处 `window.scrollY` 只读，不改组件状态
5. **DOM 注入检查**: `addInitScript` 仅设 localStorage auth token（合法 setup），无走后门改 state
6. **TI1 完整性**: T0=now + T1-T6=future 7 节点 `data-status` 物理验证通过
7. **AC5 低置信度路径**: confidence=0.42 → 黄条可见 + 保存触发确认弹窗 + 复核关闭 + 确认后导航
8. **AC2 滚动置顶**: `window.scrollY === 0` 验证通过
9. **API 500 降级**: test 4 验证 GET 返回 500 时页面 ERROR 态兜底不崩溃

### 判定

AC1-5 全覆盖，TI1 完整验证，testcase count 对齐 (8=8)，VRT 稳定。**PASS**。
