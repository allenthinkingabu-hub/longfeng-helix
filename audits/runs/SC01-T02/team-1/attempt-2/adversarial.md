# SC01-T02 Adversarial Log · team-1 · attempt-1

## Round 1 · REJECT — AC6 fallback banner 断言缺失

### 发现

**AC6 要求**: "SSE 连接失败 → 顶部 toast + 不阻塞 (允许 P03 已进)"

**Coder E2E 脚本 (t02-capture-to-analyzing.spec.ts L389-417)**:
- 仅断言 `p03-root` 和 `step1` 可见
- **未断言** fallback banner (`p03-fallback-banner`) 是否出现
- **未断言** banner 文本内容
- VRT 基线在 banner 出现之前截图，掩盖了 banner 是否真正渲染

**复现**:
```bash
# 添加 banner 断言后运行
npx playwright test -g "AC6" --reporter=list
# → FAIL: locator('[data-testid="p03-fallback-banner"]') not found (5s timeout)
```

**根因分析**:
- `useEventSource` hook 使用 fetch + 重试逻辑（maxRetries=3, exponential backoff 1s+2s+4s ≈ 7s）
- SSE 500 后 hook 静默重试 3 次，耗时 ~7s 才触发 `onFail('NETWORK_ERROR')`
- `onFail` 调用后 `errorBanner` 才被设置 → banner 才渲染
- 原测试 5s 内截图，banner 尚未出现

### 修复

**文件**: `frontend/apps/h5/tests/e2e/sc-01/t02-capture-to-analyzing.spec.ts`

**变更** (L412-416):
```typescript
// AC6: fallback banner must appear after SSE retries exhausted
// useEventSource retries 3x with exponential backoff (1s+2s+4s ≈ 7s) before calling onFail
const banner = page.locator('[data-testid="p03-fallback-banner"]');
await expect(banner).toBeVisible({ timeout: 15_000 });
const bannerText = await banner.textContent();
expect(bannerText, 'AC6: fallback banner shows error text').toBeTruthy();
```

**VRT 基线更新**: `p03-sse-error-chromium-darwin.png` 重新生成（含 banner 渲染后的截图）

### 验证

```bash
npx playwright test tests/e2e/sc-01/t02-capture-to-analyzing.spec.ts --reporter=list
# 6 passed (16.7s)
```

AC6 test 现在 9.3s 完成（含 ~7s SSE 重试等待），banner 可见性 + 文本断言均 PASS。

### 我为什么相信这个测试能抓到回归

1. 如果 `useEventSource` 的 `onFail` 回调不再触发 → banner 不渲染 → `toBeVisible` 超时失败
2. 如果 banner testid 被改名或删除 → locator 找不到元素 → 失败
3. 如果 banner 文本为空 → `toBeTruthy()` 失败
4. VRT 基线包含 banner 渲染后的完整页面 → CSS 回归（banner 样式丢失/错位）会被像素 diff 捕获

---

## Round 1 · FIX 确认 — PASS

修复后全量 6/6 PASS，AC6 断言覆盖完整。进入 PASS 宣判。
