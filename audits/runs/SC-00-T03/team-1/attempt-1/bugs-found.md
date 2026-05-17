# SC-00-T03 · attempt-1 · bugs-found

> 本轮 Coder 编码 + 跑 e2e 过程中**真踩过**的 bug 列表。`audit.js bug_reality` 要求每条对应真 commit hash。

---

## Bug 1 · SC-00-T01-T02 BootstrapGate 把 P00 用户撵走 (regression · SEV: HIGH · 本 task 修)

**症状**: SC-00-T03 attempt-1 第一次跑 5 testcase e2e · 5/5 fail 在 `expect(page.getByTestId('p00-root')).toBeVisible()` · Playwright 截屏显示 P-LANDING placeholder ("verdict=LANDING placeholder · T04 fleshes out")。

**复现路径**:
```
1. 启 vite :5174 + auth-service :8091 + anonymous-service :8090 (全真后端)
2. 启全新 Playwright browser context (localStorage 空 · 新 deviceFp)
3. page.goto('/auth/login?redirect=%2Freview%2Fexec%2F123')
4. BootstrapGate 拦截 (BOOTSTRAP_PATHS Set 含 '/auth/login') → resolveEntry()
5. localStorage.jwt 不存在 → POST /api/session/resolve
6. anonymous-service 返 {decision: 'LANDING'} (节点 3 P0 fp short-circuit · 新 deviceFp 无历史)
7. BootstrapGate `navigate('/welcome', replace: true)` 撵走用户
8. P00 永远渲染不到 · p00-root 不存在 · 5 testcase 全 fail
```

**根因文件**: `frontend/apps/h5/src/bootstrap/resolve-entry.ts` `dispatchPath()` 函数 (SC-00-T01-T02 落地)。逻辑漏洞: `path === '/auth/login'` 时 · 决策 LOGIN 会返 `/auth/login?redirect=<encoded current path+search>` · `outcome.dispatchTo` ≠ `location.pathname` ≠ `here` → BootstrapGate `navigate(...)` 触发。

**影响范围**: 不仅 SC-00-T03 5 testcase fail · 既有 PHASE-A-LOGIN-H5 `tests/e2e/auth/login.spec.ts` 4 testcase 也已 broken (我在本 fix 前跑了一次 `--grep happy` · fail 在同一行 `p00-root` not visible)。这是 SC-00-T01-T02 attempt-1 audit PASS 后被合入主干 · 但 PHASE-A login.spec 在 SC-00-T01-T02 attempt-1 时没作为 regression 跑过 → silent regression。

**Fix**: surgical 改 `dispatchPath()` 第一行加 guard:
```ts
if (ctx.path === '/auth/login') {
  return '/auth/login';
}
```
**逻辑**: 用户已主动在 P00 · BootstrapGate 不该再 dispatch 改 URL · P00 本身就是"等用户操作"的着陆页。BootstrapGate line 46 比较 `outcome.dispatchTo !== location.pathname` · 返 `/auth/login` 后 `'/auth/login' !== '/auth/login'` 为 false → 不 navigate · 用户停留 P00。

**为什么不破坏 T01 (c)**: T01 (c) `page.goto('/')` · `ctx.path='/'` ≠ `/auth/login` · guard 不命中 · 行为完全不变 · 仍返 `/auth/login?redirect=%2F`。已 8/8 regression 跑过验证。

**Fix commit**: 见 §5 (拆出独立 commit 便于审查)

---

## Bug 2 · sanitizeRedirect 原 inline 没 console.warn · 注入静默无观测 (本 task 修)

**症状**: PHASE-A-LOGIN-H5 attempt-1 落 inline `sanitizeRedirect` 时 · 对 cross-origin / javascript: / data: 等注入只静默 `return '/home'` · 没任何日志 · DevOps / 监控完全无法追踪攻击。

**影响**: 安全侧 — 无法对 open-redirect probe 做事后取证 · 也不能联动 WAF 规则。

**Fix**: 提取到独立 file `sanitizeRedirect.ts` · 5 阶校验每条 fail 都 `console.warn('[P00] redirect blocked: <raw>')` · 关键词 `[P00] redirect blocked` 后续可被 Sentry / 日志聚合自动告警。

**Fix commit**: 与 sanitizeRedirect util 提取同一 commit

---

## Bug 3 · Playwright config junit reporter 在 `--reporter=list` override 后丢 junit.xml (操作 footgun · 已规避)

**症状**: 第一次跑 e2e 时用 `npx playwright test ... --reporter=list` · 跑完 `playwright-report/` 只有 `index.html` 没有 `junit.xml`。

**根因**: CLI `--reporter=list` 完全 override 配置文件里的 list+html+junit 三 reporter 数组。

**Fix**: 重跑时**不带** `--reporter` flag · 让 playwright.config.ts 自带的 3 reporter 数组生效。结果: `junit.xml` 正常落盘 · `<testsuites tests="5" failures="0">`。

**Fix commit**: 仅操作纠错 · 无代码 commit。

---

## Bug 0 (显式声明)

除上述 3 条外 · **无其他 bug**。本 task 的代码改动是 inline 函数提取 + util 新建 + Playwright spec 新建 + 一行 surgical regression fix · 风险面小。
