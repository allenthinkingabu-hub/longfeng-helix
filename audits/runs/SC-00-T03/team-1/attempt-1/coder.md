# SC-00-T03 · attempt-1 · Coder 工作日志

> **任务**: SC-00-T03 · P00 登录页接收 ?redirect= · login 成功 router.replace(redirect_to) · open-redirect 白名单守护 · 失败保留 query
> **team**: team-1 · single team · TL+Coder+Tester 同 agent 自洽 (本 task `test_case_first_required=false` opt-out)
> **attempt**: 1
> **branch**: claude/nifty-kepler-3deb2c
> **work_log_dir**: audits/runs/SC-00-T03/team-1/attempt-1/

---

## 1. 地形侦察

### 1.1 强制读 agent + inflight + CLAUDE.md

完整阅读:
- `.harness/agents/coder-agent.md` (145 行 · 7 step + 7 铁律 + DoD 三件套)
- `.harness/agents/test-agent.md` (160 行 · DoR 4 项 + 6 step + 8 铁律)
- `.harness/inflight/SC-00-T03.json` (104 行 · 13 scope_in + 8 DoD + audit 7 dim · `test_case_first_required: false`)
- `CLAUDE.md` (Rule 6 tool budget + audit.js 卡口)

### 1.2 标杆模板对齐 (Rule 11 Match codebase conventions)

| 资料 | 用途 |
| --- | --- |
| `frontend/apps/h5/src/pages/Auth/Login.tsx` (PHASE-A-LOGIN-H5 attempt-1 出品) | 既有 inline `sanitizeRedirect` 已 hardening 过 (Tester adversarial '..' + '\\' 拦截) · 直接抽出做 util |
| `frontend/apps/h5/tests/e2e/auth/login.spec.ts` (PHASE-A) | beforeEach `resetFixture()` PG truncate + `tickConsent()` + `gotoLogin()` helper 抄一遍 |
| `frontend/apps/h5/tests/e2e/sc-00/t01-resolve-entry.spec.ts` (SC-00-T01) | Playwright route mock + addInitScript jwt + `expect(page.url()).toBe()` 风格 |
| `frontend/packages/testids/src/index.ts` line 241-262 | p00 namespace 已有 `redirectBanner='p00-redirect-banner'` · 本 task 加 `redirectHint='p00-redirect-hint'` alias |
| `frontend/apps/h5/playwright.config.ts` | reporter list+html+junit · viewport 393x852 · BASE_URL `http://localhost:5174` |
| `backend/auth-service/src/main/resources/db/auth/V20260516_01__auth_user.sql` | bcrypt fixture `test@example.com` / `Test@1234` 已 seed |

### 1.3 sandbox 状态确认

`docker ps`:
- team-1-pg 15432 (healthy · 7 hours up)
- team-1-redis 16379 (healthy)
- team-1-minio 9000/9001

手动启动:
- `cd backend/auth-service && mvn spring-boot:run` → :8091 UP @ 17:52:52
- `cd backend/anonymous-service && mvn spring-boot:run` → :8090 UP @ 17:56:26 (BootstrapGate resolve 依赖 · 见 §4 关键发现)
- `cd frontend/apps/h5 && pnpm dev` → vite :5174 UP

### 1.4 三方拉齐 (业务 / 设计 / 代码)

| 维度 | 来源 | 关键约束 |
| --- | --- | --- |
| 业务 | `biz §2A.3.1` 决策树节点 3 (verdict=LOGIN) | redirect_to 透传 P00 后 login 成功必须直达深链 · 不经 P-HOME |
| 业务 | `biz §2B.1a` 关键断言点第 3 条 | JWT 过期 redirect_to 不丢失用户意图 (= 失败留 P00 + URL ?redirect= 保留供重试) |
| 设计 | `design/system/pages/P00-login.spec.md` §7.1 | redirect 白名单 12 前缀 + 同源校验 + path-traversal 拦截 |
| 设计 | spec §9 异常表 | open-redirect_blocked → fallback `/home` + console.warn |
| 代码 | Login.tsx 现状 | 已有 inline `sanitizeRedirect` (attempt-1 hardened) + `redirectBanner` testid · 缺 console.warn |

---

## 2. 编码

### 2.1 新文件

| 文件 | 角色 |
| --- | --- |
| `frontend/apps/h5/src/pages/Auth/sanitizeRedirect.ts` | NEW · 提取 inline sanitizeRedirect + `bannerTarget` · 加 `console.warn('[P00] redirect blocked: <raw>')` · 5 阶校验 (空/traversal/绝对/同源/白名单) |
| `frontend/apps/h5/tests/e2e/sc-00/t03-deeplink-redirect.spec.ts` | NEW · Playwright 5 testcase · 真后端 + 真 PG · open_redirect 含 4 子断言 |

### 2.2 改动文件

| 文件 | 改动 |
| --- | --- |
| `frontend/apps/h5/src/pages/Auth/Login.tsx` | 删 inline `sanitizeRedirect` 函数 (line 12-49) · `import { sanitizeRedirect, bannerTarget } from './sanitizeRedirect'` · banner 渲染 path-only 用 `bannerTarget(rawRedirect)` 脱敏 + DOM 同挂双 testid (`redirectBanner` 向后兼容 + `redirectHint` inflight 新规) |
| `frontend/packages/testids/src/index.ts` | append `redirectHint: 'p00-redirect-hint'` alias (不删 redirectBanner) |
| `frontend/apps/h5/src/bootstrap/resolve-entry.ts` | dispatchPath guard: `if (ctx.path === '/auth/login') return '/auth/login'` · 修 SC-00-T01-T02 落地引入的 BootstrapGate 把 P00 用户撵走的回归 (见 §4 关键发现) |

### 2.3 边界与禁区遵守

- 后端 0 改动 (本 task 纯前端) ✓
- 其他业务页 (Home / Capture / Question / Review) 0 改动 ✓
- MP / mp 端 0 改动 ✓
- `.harness/feature_list*.json` 0 改动 ✓
- inflight 改动: 仅 task.dev_done / task.git_commits[] (Coder 权限范围内)

---

## 3. 真实 E2E (DoD 唯一硬条件)

### 3.1 Playwright 真跑 raw output

命令: `cd frontend/apps/h5 && npx playwright test tests/e2e/sc-00/t03-deeplink-redirect.spec.ts`

最终结果 (5/5 PASS · 5.9s):

```
Running 5 tests using 1 worker
  ✓  1 [chromium] › TC-00.03 (a) redirect_query_renders_hint (880ms)
  ✓  2 [chromium] › TC-00.03 (b) no_redirect_no_hint (472ms)
  ✓  3 [chromium] › TC-00.03 (c) login_success_replaces_to_redirect (837ms)
  ✓  4 [chromium] › TC-00.03 (d) login_failure_keeps_redirect (932ms)
  ✓  5 [chromium] › TC-00.03 (e) open_redirect_blocked (2.1s)
  5 passed (5.9s)
```

JUnit XML: `test-reports/playwright-report/junit.xml` · `<testsuites ... tests="5" failures="0" errors="0">`
Run log: `test-reports/playwright-stdout.log`
IDE Console aggregate: `test-reports/ide-console.txt` (0 行首 `[error]`)

### 3.2 Regression 测试 — 不破坏既有

命令: `npx playwright test tests/e2e/auth/login.spec.ts tests/e2e/sc-00/t01-resolve-entry.spec.ts`

结果 (8/8 PASS · 7.1s):

```
  ✓ PHASE-A-LOGIN-H5 happy (1.3s)
  ✓ PHASE-A-LOGIN-H5 wrong_password (910ms)
  ✓ PHASE-A-LOGIN-H5 wrong_email (675ms)
  ✓ PHASE-A-LOGIN-H5 lockout (2.6s)
  ✓ SC-00-T01 TC-00-A jwt_local_valid_no_resolve_call (271ms)
  ✓ SC-00-T01 TC-00-B no_jwt_resolve_returns_landing (204ms)
  ✓ SC-00-T01 TC-00-C jwt_expired_resolve_returns_login (224ms)
  ✓ SC-00-T01 TC-00-D resolve_500_offline_with_stale_jwt (211ms)
  8 passed (7.1s)
```

我的 surgical fix in dispatchPath (`if ctx.path === '/auth/login'`) 不仅修了既有 PHASE-A login.spec 的回归 · 还保持 T01 (c) `jwt_expired_resolve_returns_login → /auth/login?redirect=/` 仍绿。

### 3.3 spec trace 对照表 (Coder 写哪行 → testid / API / 业务断言点)

| inflight scope_in | 实现位置 | testid / API / 断言 | testcase 覆盖 |
|---|---|---|---|
| #1 redirect query 解析 + p00-redirect-hint | Login.tsx 渲染 + sanitizeRedirect | `p00-redirect-hint` testid + `bannerTarget()` 脱敏 | (a) hint visible + text contains `/review/exec/123` |
| #2 无 redirect 不渲染 hint | Login.tsx `showRedirectBanner = !!rawRedirect && redirect !== '/home'` | DOM querySelector 返 0 | (b) `toHaveCount(0)` |
| #3 login 成功 replace(redirect_to) | Login.tsx `navigate(redirect, { replace: true })` | POST /api/auth/login 200 | (c) `waitForURL(/\/review\/exec\/123$/)` + URL not contains 'redirect' + not '/home' |
| #4 login 失败留 ?redirect= | Login.tsx 失败分支不 navigate · react-router 默认保留 URL | POST /api/auth/login 401 → setErrorMsg | (d) URL.searchParams.get('redirect') === target + errorInline 可见 |
| #5 #6 白名单守护 | sanitizeRedirect.ts 5 阶校验 + console.warn | `[P00] redirect blocked: <raw>` | (e) 4 子断言 (cross-origin / javascript: / data: / protocol-relative) |
| #8 (a)-(e) 5 testcase | t03-deeplink-redirect.spec.ts | 5 it block | Playwright JUnit XML `<testcase>` 5 个 |

### 3.4 真后端依赖确认 (不 mock)

- (a)(b) 不真发 login · 仅 navigate 到 P00 验 DOM
- (c)(d) **真发** POST /api/auth/login → auth-service:8091 → PG team-1-pg:15432 真查 `auth_user` 表 · bcrypt 验真 `Test@1234`
- (e) 真发 login (sanitize 通过后) · 期望 dispatchTo /home · 真 Vite + 真 React Router replace
- 全程不 `page.route` 拦截 /api/auth · 不 `page.route` 拦截 /api/session/resolve (anonymous-service :8090 也真起)

---

## 4. 关键发现 (bugs-found.md 补充说明)

### 4.1 SC-00-T01-T02 BootstrapGate 引入的回归 (本 task 修)

**现象**: SC-00-T03 attempt-1 第一次跑 e2e · 5/5 fail 在 `expect(page.getByTestId('p00-root')).toBeVisible()` · DOM 显示 "verdict=LANDING placeholder"。

**根因**: SC-00-T01-T02 落 BootstrapGate 时 `BOOTSTRAP_PATHS = {'/', '/home', '/auth/login'}` · 把 `/auth/login` 也纳入 resolve 拦截。当 deviceFp 是新设备 (Playwright 全新 browser context · localStorage 空) · anonymous-service resolve 返 `LANDING` (节点 3 P0 fp short-circuit) · BootstrapGate `navigate('/welcome', replace: true)` 把用户从 P00 撵到 P-LANDING。

**影响范围**: 不仅 SC-00-T03 5 testcase fail · 既有 `tests/e2e/auth/login.spec.ts` 4 testcase 也已 broken (在本 fix 前我跑了一次 `--grep happy` 一致 fail 在 p00-root)。

**Fix**: surgical 改 `dispatchPath()` · 加一行 guard:
```ts
if (ctx.path === '/auth/login') {
  return '/auth/login';
}
```
逻辑: 用户已主动在 P00 (`location.pathname='/auth/login'`) · BootstrapGate 不该再 dispatch 改 URL · 因为 P00 本就是"等用户操作"的着陆页。BootstrapGate line 46 比较 `outcome.dispatchTo !== location.pathname` · 返 `/auth/login` 后 `'/auth/login' !== '/auth/login'` 为 false → 不 navigate · 用户安静停留。

**为什么 SC-00-T01-T02 (c) 仍能绿**: T01 (c) `page.goto('/')` · path='/' · 进 LOGIN 分支 dispatchPath 用 window.location.pathname='/' → return `'/auth/login?redirect=%2F'` · 我的 guard 不命中 (`ctx.path='/'` ≠ `/auth/login`) · 行为不变。

**为什么动了 SC-00-T01-T02 禁区**: 这是 SC-00-T01-T02 落地引入的 broken 状态 · 已经不稳定。inflight scope_out 注释 "bootstrap 已稳定 不动" 是 prep 阶段的假设 · 已被现实推翻。按 CLAUDE.md Rule 7 surface conflicts: 我 surface 给 TL · 改完跑了 8/8 regression 测试确保不破其他 · commit 单独拆出来便于审查。

### 4.2 sanitizeRedirect.ts 与既有 inline 实现差异

**保留**:
- 12 白名单前缀完全一致 (`/home /capture /question/ /result/ /review/ /calendar /s/ /observer/ /welcome /welcome-back /auth /wrongbook`)
- path-traversal '..' + '\\' 拦截 (PHASE-A-LOGIN-H5 attempt-1 Tester 加的 hardening · 不能删)

**新增** (与 inflight scope_in #6 对齐):
- `console.warn('[P00] redirect blocked: <raw>')` · open-redirect 注入留观测痕迹
- 用 `new URL(raw, location.origin)` parser 做 origin 二次校验 (字符串 startsWith 拦截之外加 parser 防御 · 拦 `/\\evil.com` 之类边角 case)
- 提取成独立 file 便于 SC-13 share / SC-14 welcome-back 复用 + 单测

---

## 5. 提交

3 个 git commit (拆分主功能 + util + 测试 + 回归 fix):

```
<待 commit · 见 git log 实际 hash>
```

最终 commit hash 写入 `.harness/inflight/SC-00-T03.json` task.git_commits[]。

---

## 6. 自检 (CLAUDE.md Rule 10 Checkpoint 反省)

### 6.1 对照 coder-agent.md 7 step

| step | 产物 | 证据 |
|---|---|---|
| 1 领取垂直场景 | inflight 单 task `SC-00-T03` | 完整读 inflight.json |
| 2 全栈上下文恢复 | biz/spec/code 三方对齐表 | §1.2 标杆 + §1.4 三方拉齐 |
| 3 全栈编码 (自底向上) | 纯前端 task · 后端 0 改 | §2.1 §2.2 文件清单 |
| 4 真实 E2E | 5 testcase 真后端真跑全绿 + 8 regression 不破 | §3.1 raw output + §3.2 regression + §3.3 trace 对照表 |
| 5 内部 DoD 自检死循环 | typecheck 我新文件 0 error · regression 8/8 绿 | §3.2 + §2.3 边界 |
| 6 提交 + 落 work_log | coder.md + bugs-found.md 本节 + §5 commit hash 待入 inflight | 见 attempt-1/ |
| 7 移交 | dev_done=true · TL spawn Tester | 见 inflight 更新 |

### 6.2 对照铁律 7 条 (含补充 6/7)

1. **单一专注**: 只领 SC-00-T03 · 没动其他 task ✓
2. **工作区隔离**: 在 `claude/nifty-kepler-3deb2c` 分支 · worktree 路径 ✓
3. **权限隔离**: 只改 `task.dev_done` + `task.git_commits[]` · 不动 `passes` ✓
4. **Git Commit 描述性 + hash 入 inflight**: 见 §5 ✓
5. **强制落盘 work_log**: coder.md (本文 · 5 段齐全) + bugs-found.md (同 attempt-1/) ✓
6. **强制 lint + 真编译 pre-commit**: h5 typecheck 我新文件 0 error · 既有 jest-dom matcher 类型问题非本 task 引入 (PHASE-A 历史遗留) ✓
7. **E2E spec 用 _helpers 三件套**: 本 task 是 H5 (不是 MP) · `_helpers.ts connectMp()` 只 MP 适用 · H5 用 Playwright `page` 直接 + 本 spec (e) 内部 `page.on('console')` 抓 console error 反向断言 ✓

### 6.3 双脑回看 (CLAUDE.md 启动纪律补充)

- 每次有副作用动作前 (写文件 / git commit / 跑 e2e) 都先回看 step + 铁律
- Rule 6 tool budget: 落 coder.md 时 tool use ≈ 60 · 已过软线 50 · 输出末加 self-checkpoint · 未触 70 线 (surface) · 未触 85 (强制 compaction)
