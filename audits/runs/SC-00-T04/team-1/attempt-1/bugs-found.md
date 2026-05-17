# Bugs Found · SC-00-T04 · attempt-1

## Bug 1 · Playwright init script 在 reload 时清掉 dismissed flag (测试 infra bug · 不是产品 bug)

**Severity**: Test infrastructure (false-negative · 不影响真实 user)

**Symptom**: case (f) `offline_banner_close_persists` 第一次跑失败 ·
expected `offline-banner-root` count === 0 after reload · received 1

**Root cause**: `page.addInitScript(...)` 注入的脚本在**每次 navigation (含 page.reload())** 都会重新执行。我在 init script 里 `sessionStorage.removeItem('offlineDismissed')` 想清初始状态 · 但 reload 时它也会跑 · 清掉了用户 close banner 后写入的 dismissed flag · 导致 reload 后 banner 又出现 (因为 dismissed 被 init script 清成 null · `visible = offline=true && !dismissed=true` 又变 true)。

**Fix**: 把 sessionStorage 清理拆出 init script · 改用一次性 `page.evaluate(() => { sessionStorage.removeItem(...) })` 在 first goto 之后调用 · init script 只留 `window.localStorage.setItem('jwt', ...)`.

**Commit**: 见第 3 个 commit (test attempt 修复)

**关键发现**: addInitScript 全 navigation 重跑 · 副作用要慎重。这是测试 infra 的真 bug · 不是产品 bug — useOfflineMode hook 的 sessionStorage 持久语义本身正确。

**调试方法**: 写了临时 debug spec 用 `page.evaluate(() => sessionStorage.*)` 打印 reload 前后状态 · 抓到 `offlineDismissed` 在 reload 后从 `'true'` 变回 `null` · 锁定 init script 是 culprit。

## Bug 2 · regression: T01 ADV-1 testid `shared-placeholder-root` 与 T04 落地的真 stub 冲突

**Severity**: Expected migration (foreseen · 不是 bug)

**Symptom**: T01 `t01-resolve-entry-adversarial.spec.ts` ADV-1 失败 · waiting for `shared-placeholder-root` (T01 占位 div) · 但 T04 已把 SharedStub 替换为真 stub UI · testid 改为 `shared-stub-root`

**Root cause**: SC-00-T01-T02 时 SharedStub 是占位 `<div data-testid="shared-placeholder-root">` · ADV-1 的注释明说「T04 占位页负责调后端」即预知 T04 会接手。本 task 落地真 stub 自然 testid 要迁移。

**Fix**: T01 ADV-1 spec testid 从 `shared-placeholder-root` 迁到 `shared-stub-root` + 注释明示 SC-00-T04 (2026-05-17) 迁移历史。

**Commit**: 第 3 个 commit (test)

## 总结

本 attempt 修复 2 类问题:
- 1 真 bug (Test infra · case (f) reload init script side-effect)
- 1 预期迁移 (T01 ADV-1 testid 跟随 T04 真 stub 落地)

**0 产品代码 bug** · 三个 stub 页 + OfflineBanner + resolve-entry 升级在第一次跑就符合预期 · 这是因为本 task pure 前端 · 实现路径直接 · 标杆模板 (Login.tsx) 强。

第 1 个 bug 揪出有价值: 加深对 Playwright `addInitScript` 全 navigation 重跑的理解 · 后续涉及 reload + sessionStorage 测试都要规避此陷阱。
