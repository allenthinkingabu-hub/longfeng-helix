# Adversarial Round Log · SC-00-T04 · attempt-1

> Tester 视角破坏性边界对抗 + 真 bug 触发 + Coder 真 fix · 至少 1 REJECT + 1 fix

## Round 1 · REJECT · case (f) reload 后 banner 又出现

**Tester 发起**: 跑 t04-fallback-stubs.spec.ts case (f) `offline_banner_close_persists`
**实际结果**: ✘ 失败
**期望**: `getByTestId('offline-banner-root').toHaveCount(0)` after reload
**实测**: count = 1 (9 × locator resolved to 1 element · timeout 5000ms)

### Tester 调试动作

写临时 debug spec 用 `page.evaluate(() => sessionStorage.*)` 在 4 个时间点打印状态:

```
[DEBUG] before close ss = { offlineMode: 'true', offlineDismissed: null }
[DEBUG] after close ss = { offlineMode: 'true', offlineDismissed: 'true' }
[DEBUG] right after reload ss = { offlineMode: 'true', offlineDismissed: null }  ← 异常!
[DEBUG] after reload + 1500ms ss = { offlineMode: 'true', offlineDismissed: null }
[DEBUG] banner count = 1
```

**根因锁定**: reload 后 `offlineDismissed` 从 `'true'` 变回 `null` · 而 sessionStorage 在 page.reload() 时应**保留** (浏览器规范 · 只有关 tab 才清)。唯一可能清空它的: `page.addInitScript` 注入的脚本在 reload 时**重新执行**。

确认 case (f) 的 addInitScript 内容:
```ts
await page.addInitScript((jwt: string) => {
  window.localStorage.setItem('jwt', jwt);
  window.sessionStorage.removeItem('offlineMode');
  window.sessionStorage.removeItem('offlineDismissed');  // ← 这行 reload 时也跑 · 清掉真实 dismissed!
}, staleJwt);
```

**Bug 性质**: Test infrastructure side-effect (addInitScript 全 navigation 重跑 · 副作用要慎重)
**Bug 位置**: `frontend/apps/h5/tests/e2e/sc-00/t04-fallback-stubs.spec.ts` case (f) init script
**Bug 不是**: 产品 OfflineBanner / useOfflineMode hook / resolve-entry sessionStorage 持久语义 — 这些都正确。

### Tester REJECT 理由

case (f) **测的本意是** "用户关闭 banner 后 · 即便 reload + 仍 5xx · banner 应保持隐藏 (尊重用户选择)" · 现在测试 setup 自己清掉了 dismissed flag · 测试 setup 与测试本意冲突 · 必须修。

## Round 2 · Coder FIX · 拆 init script 一次性清

**Coder 修复方案**: 把 sessionStorage 清理拆出 addInitScript · 改为先 `goto('/')` 一次拿到 page context · 再 `page.evaluate(() => sessionStorage.removeItem(...))` 一次性清初始状态 · 之后 `goto('/')` 第二次时 init script 只 set jwt · 不动 sessionStorage。

修改后代码:

```ts
// NOTE: addInitScript runs on EVERY navigation (including page.reload()).
// We must NOT touch sessionStorage here, or the test's "did dismissed
// flag survive reload?" assertion is invalidated. Only seed localStorage.jwt.
await page.addInitScript((jwt: string) => {
  window.localStorage.setItem('jwt', jwt);
}, staleJwt);

await page.route('**/api/session/resolve', ...);

// Initial visit: explicitly clear sessionStorage (one-shot, NOT via init script).
await page.goto('/');
await page.evaluate(() => {
  sessionStorage.removeItem('offlineMode');
  sessionStorage.removeItem('offlineDismissed');
});
await page.goto('/');  // 重 boot 让 resolve 跑一次
```

**再跑结果**: ✅ PASS (1.8s)

```
✓ TC-00-T04 (f) offline_banner_close_persists: close → hidden · reload + 仍 5xx → banner 不再出现 (1.8s)
```

## Round 3 · Tester 重审 · regression 验证

**Tester 行动**: 跑全部 9 case + 既有 17 case regression。

**结果**:
- T04 新 9 case 全绿 (含修后的 (f))
- T01 ADV-1 失败 (`shared-placeholder-root` not found) — 但**这是预期 testid 迁移** · T01 时 SharedStub 是占位 div · T04 落地真 stub 后 testid 改为 `shared-stub-root` · T01 spec 注释明说 「T04 占位页负责调后端」即预知。
- Coder 同步修 T01 ADV-1 testid (commit 第 3 个) · 注释加 migration 历史

**最终 regression**: 9 + 17 = 26/26 全绿。

## 探索性 keyword 覆盖审计 (audit dim 4)

| keyword | 出现位置 | case |
|---------|---------|------|
| **timeout** | t04-fallback-adversarial.spec.ts:55 标题 + comment + AbortController 注释 | ADV (a) |
| **5xx** | t04-fallback-stubs.spec.ts:139 注释 + adversarial.spec.ts:95 标题 · stubs (e)(f) + ADV (b) 用 500/503 | (e)(f)(b) |
| **abort** | adversarial.spec.ts:55 标题 + bootstrap/resolve-entry.ts AbortController 注释 | ADV (a) |
| **sessionStorage** | stubs (e)(f) + hook useOfflineMode + Coder bug fix 详解 | (e)(f) |
| **hash** | adversarial.spec.ts:43 refDjb2Hex + (c) 标题 + djb2.ts | ADV (c) |

5 keyword 全命中 · audit dim 4 探索性 keyword 红线 PASS。

## 总结

- **1 轮真 REJECT** (Round 1 · case (f) reload sessionStorage 副作用)
- **1 轮真 FIX** (Round 2 · 拆 init script · 改 evaluate 一次性清)
- **1 轮 regression 重审** (Round 3 · 触发 T01 ADV-1 testid 迁移 · 同步 fix)

**0 互相批准嫌疑**: 真 bug 真抓真改 · 不是 "一上来就 PASS" 凑 PASS · audit dim 2 adversarial 要求满足。

最终 26/26 全绿 + DoR 4 项全过 + mock ≤ 5 business mock + IDE console 0 [error] + 探索性 keyword 5/5 全命中。**PASS**。
