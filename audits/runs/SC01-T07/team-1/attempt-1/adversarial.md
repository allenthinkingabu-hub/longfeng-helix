# adversarial.md · SC01-T07 · Tester team-1 attempt-1

## DoR 准入

| # | 检查项 | 结果 |
|---|--------|------|
| DoR-1 | E2E 脚本存在 `frontend/apps/h5/tests/e2e/sc-01/t07-list-highlight-newest.spec.ts` | ✅ PASS |
| DoR-2 | 真机跑通 raw output `test-reports/e2e/coder/playwright/run.log` 6/6 passed | ✅ PASS |
| DoR-3 | VRT 截图 5 baselines at `t07-*-snapshots/` (p05-highlighted/list/idle/empty/error) | ✅ PASS (`dor_c1_to_c6_required: false`) |
| DoR-4 | spec-trace 对照表 `test-reports/e2e/coder/spec-trace.md` 10 行映射 | ✅ PASS |

DoR 通过 → 进入正式测试。

---

## REJECT Round 1 · 对抗发现

### Finding 1: AC3 borderWidth 未验证

- **严重度**: Medium
- **AC3 原文**: "第 1 卡绿色高亮 (border **2px** solid green-500) 持续 3s 后 fade-out 至正常态"
- **问题**: Coder 的 E2E 只验证了 `borderColor` 包含 `rgb(52, 199, 89)`，但未验证 `borderWidth === '2px'`。若 CSS 被改为 1px，测试仍会绿灯。
- **位置**: `t07-list-highlight-newest.spec.ts:265` 只有 `expect(borderColor).toContain('52, 199, 89')`
- **复现**: 审查代码即可确认缺失

### Finding 2: TI2 post-fade border 残留未验证

- **严重度**: High
- **TI2 原文**: "高亮 fade-out 后卡片回归正常颜色 (不残留 border)"
- **问题**: Coder 的 E2E 在 t=3.5s 检查 `data-highlighted` 属性消失，但此时 CSS 过渡仍在进行（0.8s transition 只完成了 0.5s/0.8s）。实际计算样式为 `rgba(52, 199, 89, 0.1)` — 绿色边框残留！
- **位置**: `t07-list-highlight-newest.spec.ts:274-277`
- **复现**: 添加 `expect(postFadeBorder).not.toContain('52, 199, 89')` 断言 → 测试失败
- **证据**:
  ```
  Error: expect(received).not.toContain(expected)
  Expected substring: not "52, 199, 89"
  Received string:        "rgba(52, 199, 89, 0.1)"
  ```
- **根因**: 等待时间 3.5s 不够。时间线：t=0 HIGHLIGHTED → t=3s fade 开始 → t=3.8s fade 完成。在 t=3.5s 时 CSS transition 还在中途。
- **修复要求**: 等待时间从 3.5s → 4.5s（超过 3s highlight + 0.8s CSS transition = 3.8s 的边界）

---

## FIX Round 1 · 修复验证

### Fix 1: 添加 borderWidth 断言

```diff
+    const borderWidth = await highlightedCard.evaluate((el) => window.getComputedStyle(el).borderWidth);
+    expect(borderWidth).toBe('2px');
```

结果: ✅ PASS — `borderWidth` 确认为 `2px`

### Fix 2: 修复 TI2 timing + 添加 post-fade border 断言

```diff
-    await page.waitForTimeout(3500);
-    await expect(highlightedCard).not.toBeVisible({ timeout: 3000 });
+    await page.waitForTimeout(4500); // 4.5s > 3.8s (3s highlight + 0.8s transition)
+    await expect(highlightedCard).not.toBeVisible({ timeout: 3000 });
+    const cardAfterFade = page.locator(`[data-qid="${MOCK_QID}"]`);
+    await expect(cardAfterFade).toBeVisible({ timeout: 3000 });
+    const postFadeBorder = await cardAfterFade.evaluate((el) => window.getComputedStyle(el).borderColor);
+    expect(postFadeBorder).not.toContain('52, 199, 89');
```

结果: ✅ PASS — t=4.5s 后 border 无绿色残留

### 修复后全量回归

```
Running 6 tests using 1 worker
  ✓ AC1+AC2+AC3: P04 save → P05 with highlight → green border 3s fade (5.1s)
  ✓ AC4: highlighted card renders all required elements (312ms)
  ✓ TI1: highlight={qid} not in list → fallback no highlight (238ms)
  ✓ 4-state VRT: loading state (769ms)
  ✓ 4-state VRT: empty state (253ms)
  ✓ 4-state VRT: error state (2.3s)
  6 passed (9.6s)
```

---

## 最终裁决: PASS

6/6 E2E 测试全绿 · AC1-AC4 + TI1-TI2 已验证 · 5 态 VRT baseline 存在 · mock ≤ 3 · maxDiffPixels ≤ 500 · 对抗 1 轮 REJECT + 1 轮 FIX 完成。
