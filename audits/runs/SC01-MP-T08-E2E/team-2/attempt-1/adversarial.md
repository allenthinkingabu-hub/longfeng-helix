# Adversarial Log — SC01-MP-T08-E2E (attempt 1, Tester)

## Round 1 · REJECT

**发现 2 个问题**：

### Issue 1 — Test 4 VRT 存在未使用变量 (dead code)
- **位置**: `frontend/apps/mp/test/e2e/home.spec.ts:106`
- **问题**: `const page = await mp.currentPage()` 声明后未使用。screenshot 调用的是 `mp.screenshot()` 而非 `page.screenshot()`。
- **严重性**: 死代码，容易误导后续维护者以为 `page` 对象在 VRT 流程中有用途。

### Issue 2 — Test 3 MVP 数据断言覆盖不完整
- **位置**: `frontend/apps/mp/test/e2e/home.spec.ts:75-102`
- **问题**: Test 3 标题 "page data contains expected MVP values after load" 但遗漏了两个用户可见的关键数据：
  - `estMin` (预计复习时间 25 分钟，显示在 review-card 区域)
  - `weekStats` (周统计 mastered/newItems/forgotten/masteryRate，显示在 weekly sparkline 卡片)
- **严重性**: 违反 CLAUDE.md Rule 9 "Tests verify intent, not just behavior" — 如果后续有人改了 `estMin` 默认值或 `weekStats` 结构，此测试不会 fail。
- **复现**: `grep -n 'estMin\|weekStats' frontend/apps/mp/test/e2e/home.spec.ts` → 0 匹配

## Round 1 · FIX

### Fix 1 — 移除 Test 4 中未使用的 `page` 变量
- 删除 `const page = await mp.currentPage();`
- 保留注释说明 screenshot 使用 mp-level API

### Fix 2 — Test 3 补充 `estMin` + `weekStats` 断言
- 添加 `expect(data.estMin).toBe(25)`
- 添加 `expect(data.weekStats).toEqual({ mastered: 23, newItems: 8, forgotten: 2, masteryRate: 68 })`

### 验证
- `tsc --noEmit` → 0 error ✓
- `pnpm -F mp test:unit` → 97/97 PASS ✓
- `pnpm -F mp lint` → 22 errors (全部为预存 van-* 组件路径缺失，非本次改动) ✓

## 最终判定: PASS

修复后 spec 结构完整 (beforeAll connect 8s + 4 tests + afterAll disconnect)，testid 映射与 wxml 一致，MVP 数据断言覆盖完整，VRT 阈值 5000px 符合 task context 规定。Phase 1 静态验证全过。
