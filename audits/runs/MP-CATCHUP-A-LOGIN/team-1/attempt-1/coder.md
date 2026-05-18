# Coder Log · MP-CATCHUP-A-LOGIN · attempt-1

team: team-1 · branch: claude/nifty-kepler-3deb2c · worktree: nifty-kepler-3deb2c

## 1. 地形侦察

**业务侦察**:
- biz/业务与技术解决方案_AI错题本_基于日历系统.md §SC-01 (P00 登录) + §2A.3.1 决策树节点 1 (合法 JWT → 直达 deepLink 原目标)
- 用户视角: MP 缺登录页 (P00) · backend AuthController.java 已存在 (auth-service:8091) · 不动

**设计侦察**:
- design/mockups/wrongbook/00_login.html (mockup · 视觉锚 · 蓝紫主色 #7B6FE8)
- frontend/apps/h5/src/pages/Auth/Login.tsx (H5 业务逻辑 reference · MP 重写为 wxml + wx.* API)

**代码侦察 (标杆模板)**:
- frontend/apps/mp/pages/capture/index.ts → Page lifecycle + bindtap + setData pattern
- frontend/apps/mp/src/api/file.ts → httpJSON + apiBase('xxx') wrapper 风格 (沿其 Promise<T> + Error throw)
- frontend/apps/mp/src/api/_http.ts → dual-runtime wx.request/fetch + ApiResult 自动 unwrap (`{code, message, data}` → `data`)
- frontend/apps/mp/test/e2e/sc-16/t02-weekly-mp-page.spec.ts → mp.mockWxMethod return 形式 (函数 return {statusCode, data})
- frontend/apps/mp/test/e2e/_helpers.ts → connectMp + assertConsoleClean + assertPageRenders 三件套 (Rule 7 必用)
- frontend/apps/mp/test/e2e/automator-smoke.spec.ts → spec 标杆结构

**Phase 0 验**:
- pages/login/{ts,wxml,wxss,json} placeholder 4 件已存在 (commit 0857c9e prep)
- src/api/auth.ts stub 已 export `login` + `wechatLogin` 函数签名 (NOT_IMPLEMENTED throw)
- _http.ts PORT_MAP 已 +auth:8091
- app.json pages[] 已含 "pages/login/index" (第 11 项)
- 我只需 fill 上述文件 · 不新建文件 · 不动 app.json / _http.ts / backend / H5

## 2. 编码

**改文件清单 (commit e52d7ae 全包)**:
- `frontend/apps/mp/src/api/auth.ts` (+13 -34) · 替换 stub `throw NOT_IMPLEMENTED` · 沿 file.ts pattern:
  ```ts
  return httpJSON<LoginResponse>(`${apiBase('auth')}/api/auth/login`, {
    method: 'POST', body: { phone, password },
  });
  ```
  错误语义沿 _http.ts: 4xx/5xx → `throw new Error('HTTP <code>')` · 页面 mapError 把 401 → "手机号或密码错误"。
- `frontend/apps/mp/pages/login/index.wxml` (+62 -1) · 真 wxml: logo zone + 双 input + login-cta + 分隔线 + wechat-cta + consent-bar + error-banner (wx:if 控制)。8 data-test-id (p00-root / phone-input / password-input / login-submit-btn / wechat-cta-btn / error-banner / consent-bar / logo-zone)。
- `frontend/apps/mp/pages/login/index.wxss` (+128 -1) · 移动端居中卡片 · 蓝紫主色 (#7B6FE8) · 沿 mockup 视觉锚简化。
- `frontend/apps/mp/pages/login/index.json` (+3 -1) · navigationBar 颜色配 #7B6FE8 + white text。
- `frontend/apps/mp/pages/login/index.ts` (+106 -5) · Page 5 段:
  1. `data`: `phone / password / errorMsg / loading`
  2. `onPhoneInput / onPasswordInput`: 受控 input + 输入即清错
  3. `onLogin`: 前端 validate (`/^1[3-9]\d{9}$/` + pwd≥6) → setData(loading:true) → `await login(...)` → `wx.setStorageSync('jwt'|'userId'|'expiresAt')` → `wx.reLaunch('/pages/home/index')`; 失败 mapError → setData(errorMsg, loading:false)
  4. `onWechatLogin`: `wx.login` 拿 `code` → `await wechatLogin({code})` → 同上
  5. `mapError`: 401 → 手机号或密码错误 / 423 → 账号锁定 / 5xx → 服务暂不可用 / 其他 → 网络异常
- `frontend/apps/mp/test/e2e/mp-login/login.spec.ts` (+288 新建) · 4 testcase:
  - TC-1 `page_renders_with_login_form` · reLaunch → 验 7 testid 全在 + IDLE 态 error-banner 不渲染 + view 数 ≥ 8
  - TC-2 `login_success_navigates_to_home` · mock 200 → fill + tap → assert path=home + JWT 入 storage
  - TC-3 `login_failure_shows_error` · mock 401 → assert 仍在 login + error-banner 文本 "手机号或密码错误" + loading 复位 + JWT 未写入
  - TC-4 `invalid_phone_shows_inline_error` · 前端校验拦截 · `requestHit` 闭包验真不发 request (用 mp.evaluate 读 globalThis 计数器 不行 - 函数序列化丢闭包 - 改用 outer-scope `let` + mock 函数引用)
  - 沿 SC-16-T02 reference 用 `mp.mockWxMethod('request', fn)` return form (函数 return `{statusCode, data}` · IDE 内部派发)

**lint + tsc**:
- `node scripts/lint.mjs` → ✓ 0 errors
- `npx tsc --noEmit` (filter pages/welcome/* 团队 B 的 unrelated `Promise.allSettled` ES target 错): 我 scope 内 0 error
- `pnpm test:unit` → 252/252 passed

## 3. 真实 E2E

**E2E 真跑 raw (vitest --reporter=junit)**:
```
RUN  v1.6.1 frontend/apps/mp
✓ test/e2e/mp-login/login.spec.ts  (4 tests) 30086ms

Test Files  1 passed (1)
     Tests  4 passed (4)
  Duration  30.56s
```

**artifact 落 work_log_dir/test-reports/**:
- `login-junit.xml` (4 `<testcase>` · 4 PASS · 0 fail)
- `ide-console.txt` (空 · _helpers.ts connectMp() 的 mp.on('console') 没接到任何 [error]/[warn] · 是好事)

**testcase ↔ scope_in (DoD #1) 对照表**:

| testcase | scope_in 项 | API 触点 | assertion |
|---|---|---|---|
| TC-1 page_renders | scope_in 2(a-f) all UI elements | 无 (IDLE 态) | 7 testid 全在 · error-banner 默认隐 · view 数 ≥ 8 |
| TC-2 success | scope_in 1(a) login real + 4(b) storage + nav | POST /api/auth/login 200 → token | path=home · jwt+userId 入 storage |
| TC-3 401 | scope_in 1(b) 401 错误处理 + 4(d) setData errorMsg | POST /api/auth/login 401 | path=login · error-banner 显 "手机号或密码错误" · loading 复位 · 无 jwt |
| TC-4 invalid_phone | scope_in 4(b) 前端 validate (隐式) | 不发 request | requestHit=false · inline error |

**真 IDE 验证**:
- IDE 9420 ws bridge ESTABLISHED · automator 连接成功
- `mp.reLaunch('/pages/login/index')` 成功路由 · `mp.currentPage().path === 'pages/login/index'` 真
- input + tap 真触 wxml 上 bindinput / bindtap · setData 真 propagate 到 view
- `wx.setStorageSync('jwt', ...)` 真写入 IDE storage · `mp.evaluate(() => wx.getStorageSync('jwt'))` 真读回 'jwt-test-token'
- `wx.reLaunch('/pages/home/index')` 真切栈到 home (TC-2 验)

## 4. 自检

对照 coder-agent.md 铁律 1-7 + 补充 6 E2E DoD:

- [x] **铁律 1 单一专注**: 只做 MP-CATCHUP-A-LOGIN · 没碰其它 task。
- [x] **铁律 2 工作区隔离**: 全部改动在 `claude/nifty-kepler-3deb2c` 分支 · worktree 内。
- [x] **铁律 3 权限隔离**: 我只改 `dev_done=true`，不动 `passes`。
- [x] **铁律 4 git commit**: e52d7ae 描述性强 · git_commits[] 已记。
- [x] **铁律 5 工作日志**: 本 coder.md + bugs-found.md 落 work_log_dir/。
- [x] **铁律 6 lint+真编译**: lint 0 error · tsc scope 内 0 error · unit 252/252 passed。welcome 的 tsc error 是团队 B 的 unrelated WIP (Promise.allSettled · ES target 问题) · 不属我 scope。
- [x] **铁律 7 _helpers 三件套**: login.spec.ts 已 `import { type Mp, connectMp, assertConsoleClean }` · beforeAll 用 `({ mp, errors } = await connectMp())` · afterAll `assertConsoleClean(errors, 'mp-login/login.spec')` · ide-console.txt 落 test-reports/。
- [x] **补充 6 E2E DoD**: 4 testcase real run · 30s real · JUnit XML 真 · 三件套就位。dor_c1_to_c6_required=false → 不需 12 张截图 / Playwright 报告 / spec-trace.md / env-snapshot.md。

## 5. 提交

git commit:
- `e52d7ae` feat(MP-CATCHUP-A-LOGIN): P00 MP login 真页 + src/api/auth.ts 真实现 + 4 e2e testcase

verifiable: `git cat-file -e e52d7ae` → exit 0
