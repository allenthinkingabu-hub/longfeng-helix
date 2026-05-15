# SC01-T02 Adversarial Log · team-1 · attempt-2

## Round 1 · REJECT — AC2 骨架屏断言不完整（4 步 step 未逐一验证）

### 发现

**AC2 要求**: "P03 首屏骨架屏 (4 步流水线占位 wait 态) 必须在跳转后 ≤ 100ms 渲染"

**Coder E2E 脚本 (t02-capture-to-analyzing.spec.ts L320-322)**:
- 仅断言 `p03-root` 和 `analyzing-pipeline` 容器可见
- **未逐一断言** 4 个 pipeline step (`step-1` 到 `step-4`) 是否都在 wait 态渲染
- 如果某个 step 组件条件渲染逻辑出 bug（如 step3/step4 未渲染），此测试不会捕获

**复现**:
```bash
# 查看现有断言 — 只有 root + pipeline，缺少 step1-step4
grep -n "TID_P03\." tests/e2e/sc-01/t02-capture-to-analyzing.spec.ts | head -10
# L321: await expect(...TID_P03.root...).toBeVisible
# L322: await expect(...TID_P03.pipeline...).toBeVisible
# → happy path 缺失 step1-step4 断言（AC6 有 step1 但 happy path 没有）
```

### 修复

**文件**: `frontend/apps/h5/tests/e2e/sc-01/t02-capture-to-analyzing.spec.ts`

**变更** (L323-327 新增):
```typescript
// AC2 strengthened: verify ALL 4 pipeline steps are present before SSE starts
await expect(page.locator(`[data-testid="${TID_P03.step1}"]`)).toBeVisible({ timeout: 2_000 });
await expect(page.locator(`[data-testid="${TID_P03.step2}"]`)).toBeVisible({ timeout: 2_000 });
await expect(page.locator(`[data-testid="${TID_P03.step3}"]`)).toBeVisible({ timeout: 2_000 });
await expect(page.locator(`[data-testid="${TID_P03.step4}"]`)).toBeVisible({ timeout: 2_000 });
```

### 验证

```bash
npx playwright test tests/e2e/sc-01/t02-capture-to-analyzing.spec.ts --reporter=list
# 6 passed (17.7s)
```

AC1-3 happy path 现在断言全部 4 步 pipeline step 可见，覆盖了骨架屏完整性。

### 我为什么相信这个测试能抓到回归

1. 如果 `AnalyzingPipeline` 组件移除或条件跳过某个 step → `toBeVisible` 超时失败
2. 由于 SSE gate 机制（`sseGate` Promise），验证发生在 SSE 事件流开始之前 → 确保检查的是 wait 态，不是已完成态
3. 如果 testid 命名变更 → locator 找不到元素 → 失败
4. VRT 基线 `p03-queued` 已含 4 步 wait 态，但 VRT 可能因 `maxDiffPixels=500` 容忍小偏差；逐一 `toBeVisible` 断言是确定性的，不受像素阈值影响

---

## Round 1 · FIX 确认 — PASS

修复后全量 6/6 PASS，AC2 断言覆盖完整。进入 PASS 宣判。

---

## 探索性测试审查（超纲对抗 · 不影响本轮 PASS 判定）

源码深度审查发现以下潜在风险，记录供后续 task 参考：

| # | 问题 | 文件 | 严重性 | 本轮影响 |
|---|------|------|--------|---------|
| 1 | handleFile 无防抖 — 快速重复选文件可能创建多个 question | Capture/index.tsx | HIGH | 超出 T02 scope |
| 2 | useEventSource SSE fetch 无 timeout — stream 挂住不自动断开 | useEventSource.ts | HIGH | AC6 已覆盖 SSE 失败 |
| 3 | Analyzing.onDone setTimeout 与 cancel 微小 race | Analyzing/index.tsx | MEDIUM | navigatedRef guard 已存在 |
