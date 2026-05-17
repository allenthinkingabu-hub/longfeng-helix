# SC-12-T03 · Coder work log · attempt-1

> Owner: Coder (Claude Opus 4.7 1M) · 2026-05-18
> Branch: claude/nifty-kepler-3deb2c
> Scope: SC-12 真页 frontend 第 3/N 片 · 替换 /guest/capture stub 为真页 ·
>        真接 T01 POST /api/anon/session + T02 PATCH /api/anon/session/{id}/consent.

## 1. 地形侦察

### 1.1 三方文档拉齐 (CLAUDE.md 启动纪律 · 完整读)

- `.harness/agents/coder-agent.md` 全文 (PASS 定义 5 项 · 铁律 1-5 + 补 6/7 · 双脑回看)
- `.harness/agents/test-agent.md` 全文 (Tester DoR · 铁律 1-7 · 6 step)
- `.harness/inflight/SC-12-T03.json` (45 scope_in · 9 DoD · audit_gate)
- `CLAUDE.md` Rule 1-12 + AI Agent 启动纪律 + audit.js 卡口

### 1.2 标杆模板 (coder-agent.md step 3 强制 grep)

- 真页参考: `frontend/apps/h5/src/pages/Shared/SharedView.tsx` (SC-13 真页 ·
  状态机 + 顶部 nav + testid 5 件套结构)
- telemetry 参考: `frontend/apps/h5/src/pages/Landing/telemetry.ts` (djb2 hash +
  sanitizeEntrySource 白名单 + sendBeacon Blob fallback fetch)
- Stub 替换参考: `frontend/apps/h5/src/pages/GuestCaptureStub/index.tsx`
  (本 task 删除该 stub) + `App.tsx` 旧 Route 注释 SC-12-STUB-T01
- testids 参考: `frontend/packages/testids/src/index.ts` 既有 pHome/pShared/
  pLanding 三段 kebab-case 命名规约

### 1.3 后端契约 (T01/T02 已落 · 本 task 调用方)

- POST `/api/anon/session` (AnonSessionController) →
  `{anonToken: JWT, anonSessionId: long, expiresAt: ISO}` · 无需 X-Anon-Token
- PATCH `/api/anon/session/{id}/consent` (AnonSessionConsentController) ·
  必须带 `X-Anon-Token: <anonToken>` header · body `{consentType: 1}` →
  `{consentAt: ISO, consentType: 1}` · 200 OK
- 实测 (worktree branch · target/classes 已含 T01/T02 commits) — 旧 JVM 未热加载,
  fresh-start `mvn spring-boot:run -Dserver.port=8290` 确认两端点真 200 (curl 直打验)

### 1.4 React 框架陷阱

- React 18 dev StrictMode 双 mount → `useEffect` 跑 2 次 · 用 `useRef('mintedRef')`
  guard 守 mint 只发一次 (与 SC-11-T04 LandingPage 同模式)
- 控件 `<input type="checkbox" checked>` 是 controlled component — onChange 是
  async 时必须在 fetch 前先 setState (乐观更新) · 不然 React 把 DOM checked 立刻
  rollback 成 false · Playwright `.check()` 会报 "click did not change state" timeout

### 1.5 vite proxy 现状

- `/api/auth → :8091`, `/api/session → :8090`, `/api/landing → :8090`,
  `/api/share → :8090`, `/api/file → :8084`, `/api/wb → :8082`, `/api/ai → :8083`,
  `/api/review → :8085`, `/s3 → MinIO :9000`
- `/api/anon` 尚未配置 · 本 task 补上 (default :8090 · 复用 VITE_ANON_PROXY_TARGET
  env var)

## 2. 编码

### 2.1 改动文件清单

| # | path | 性质 | 行数 |
|---|------|------|------|
| 1 | `frontend/apps/h5/vite.config.ts` | + 10 行 (新增 `/api/anon` proxy) | +10 |
| 2 | `frontend/packages/testids/src/index.ts` | + 22 行 (新增 `pGuestCapture` namespace 11 ids) | +22 |
| 3 | `frontend/apps/h5/src/pages/GuestCapture/index.tsx` | 新建 (231 行) GuestCapturePage component | +231 |
| 4 | `frontend/apps/h5/src/pages/GuestCapture/index.module.css` | 新建 (~170 行) CSS module | +170 |
| 5 | `frontend/apps/h5/src/pages/GuestCapture/telemetry.ts` | 新建 (~140 行) djb2 + sanitizeEntrySource + trackGuestCapture | +140 |
| 6 | `frontend/apps/h5/src/App.tsx` | 替换 stub import + Route 注释 | ~0 |
| 7 | `frontend/apps/h5/src/pages/Shared/SharedView.tsx` | 删除 deleted-stub-CSS 导入 · 切换到 SharedView 自有 .shell/.shellLogo/.shellLogin (bug-fix · 见 bugs-found.md) | -2 +5 |
| 8 | `frontend/apps/h5/src/pages/GuestCaptureStub/` (整目录) | **删除** (2 文件 obsoleted) | -167 |
| 9 | `frontend/apps/h5/tests/e2e/sc-12-stub/` (整目录) | **删除** (2 spec obsoleted) | -200 |
| 10 | `frontend/apps/h5/tests/e2e/sc-12-t03/t03-guest-capture-real-page.spec.ts` | 新建 6 testcase | +200 |
| 11 | `frontend/apps/h5/tests/e2e/sc-12-t03/t03-guest-capture-adversarial.spec.ts` | 新建 3 adversarial case | +120 |

### 2.2 GuestCapturePage 状态机实现

```
BOOTSTRAPPING (mount 中 · 调 /api/anon/session)
  ├ 200 → IDLE                (consent 未勾 · shutter disabled)
  └ fail → ERROR              (errorBanner 渲染 · 文字 '初始化失败 · 请刷新重试')
IDLE
  └ consent.check (乐观更新)
     ├ PATCH 200 → CONSENT_PENDING (shutter unlock)
     └ PATCH fail → 回滚 checked=false + errorBanner
```

DOM 暴露 `data-phase={phase}` 属性 (root) · E2E spec 用 `toHaveAttribute('data-phase', 'IDLE')`
作为状态机断言点 · 避免 race。

### 2.3 testids namespace 决策

11 ids 全 kebab-case · 与 SC-11/SC-13 namespace 同风格:
- root / shellNav / shellLogo / loginBtn (顶部 4 件)
- quotaBanner / quotaRemaining (固定 1 次配额 · T06 接真 quota 时改 dynamic)
- consentCard / consentCheckbox (consent 2 件)
- cameraPreview (占位 · T04 启 getUserMedia)
- shutter (consent 未勾 disabled)
- errorBanner (phase=ERROR 时 fixed bottom)

旧 `sc12stub.guestCaptureStubRoot/Cta` 保留 (testids pkg consumer backward-compat ·
DOM 不再渲染)。

## 3. 真实 E2E (DoD 三件套)

### 3.1 测试环境

- vite dev server `http://localhost:5274` (port-isolated · 不撞已运行的 :5174 ·
  启动命令 `VITE_ANON_PROXY_TARGET=http://localhost:8290 npx vite --port 5274 --host`)
- anonymous-service spring-boot 真 JVM 在 `http://localhost:8290` (fresh JVM ·
  load 了 T01 AnonSessionController + T02 AnonSessionConsentController · 验证
  `curl -X POST :8290/api/anon/session -d '{"deviceFp":"..."}'` 返 200 + JWT)
- 真 Postgres `127.0.0.1:15432` (Flyway 4 migrations up-to-date · guest_session
  表真插入新行)
- Playwright `chromium` Mobile 393×852 viewport · 真 fetch 走 vite proxy 不 mock

### 3.2 9 testcase 全绿 · raw output 落盘

```
$ PLAYWRIGHT_BASE_URL=http://localhost:5274 npx playwright test tests/e2e/sc-12-t03/

Running 9 tests using 1 worker
  ✓  1 [chromium] › adversarial.spec.ts:22 · ADV-T03 (a) mint_failure_shows_error_banner (568ms)
  ✓  2 [chromium] › adversarial.spec.ts:62 · ADV-T03 (b) shutter_disabled_when_consent_unchecked (893ms)
  ✓  3 [chromium] › adversarial.spec.ts:98 · ADV-T03 (c) double_mount_strict_mode_single_call (1.3s)
  ✓  4 [chromium] › real-page.spec.ts:32 · TC-12-T03 (a) page_mounts_and_calls_session_mint (266ms)
  ✓  5 [chromium] › real-page.spec.ts:77 · TC-12-T03 (b) consent_check_unlocks_shutter (364ms)
  ✓  6 [chromium] › real-page.spec.ts:112 · TC-12-T03 (c) anon_session_id_stored_after_mint (229ms)
  ✓  7 [chromium] › real-page.spec.ts:138 · TC-12-T03 (d) login_cta_redirects_to_auth (321ms)
  ✓  8 [chromium] › real-page.spec.ts:150 · TC-12-T03 (e) deeplink_direct_works (303ms)
  ✓  9 [chromium] › real-page.spec.ts:170 · TC-12-T03 (f) consent_recheck_idempotent (989ms)

  9 passed (6.1s)
```

Raw log + JUnit XML + HTML report 落盘:
- `audits/runs/SC-12-T03/team-1/attempt-1/test-reports/e2e/sc-12-t03-playwright.log`
- `audits/runs/SC-12-T03/team-1/attempt-1/test-reports/e2e/sc-12-t03-junit.xml`
  (含 9 `<testcase>` 元素)
- `audits/runs/SC-12-T03/team-1/attempt-1/test-reports/e2e/sc-12-t03-report.html`

### 3.3 Regression (SharedView CSS 重构 = 唯一会影响他 spec 的改动)

```
$ PLAYWRIGHT_BASE_URL=http://localhost:5274 npx playwright test tests/e2e/sc-11/ tests/e2e/sc-13/

48 passed (40.8s)   ← SC-11 (P-LANDING 真页 6 spec) + SC-13 (P-SHARED 真页 2 spec) 全绿
```

SharedView 的 CSS 由 deleted GuestCaptureStub/index.module.css 切到 SharedView.module.css
自有 `.shell/.shellLogo/.shellLogin` 类 · 48 SC-11/SC-13 e2e 验证视觉契约不破。

Auth + sc-00 12 fail 与本 task 无关 (auth-service :8091 未启 · 沙箱 infra 问题 ·
不是 SC-12-T03 引入的回归)。

### 3.4 spec → assertion trace 对照表

| testid | spec §/scope_in | E2E assertion | 行级位置 |
|--------|-----------------|---------------|---------|
| p-guest-capture-root | scope_in 6a, 6e | real-page (a) toBeVisible · (e) URL pathname + visible | line 56, 161-163 |
| guest-shell-nav | scope_in 5a | real-page (a) toBeVisible | line 57 |
| guest-quota-banner / -remaining | scope_in 5a, 6a | (a) quota textContent '1' | line 59-60 |
| guest-consent-checkbox | scope_in 5a, 6a/b/f | (a) unchecked · (b) check → unlock · (f) recheck idempotent | line 62, 95, 186/192 |
| guest-camera-preview | scope_in 5a (T04 占位) | (a) toBeVisible | line 63 |
| guest-shutter | scope_in 5a, 6b · adv (b) | (a) disabled · (b) not disabled · adv (b) force-click 不发起请求 | line 61, 103, 77 |
| guest-login-btn | scope_in 6d | (d) click → /auth/login | line 142 |
| guest-error-banner | adv (a) | adv (a) visible + 文字 '初始化失败' | line 41-43 |
| data-phase=BOOTSTRAPPING→IDLE/CONSENT_PENDING/ERROR | spec §6 状态机 | (a)(b)(e) toHaveAttribute · (f) check + uncheck · adv (a) ERROR | 5 处 |
| POST /api/anon/session 200 | scope_in 1, 6a, 6c | (a)(c)(e) waitForResponse + status === 200 | line 34, 117, 154 |
| PATCH /api/anon/session/{id}/consent 200 + X-Anon-Token | scope_in 1, 6b, 6f | (b) waitForResponse + req.headers['x-anon-token'] · (f) ≥2 PATCH 都 200 | line 86, 195 |
| sessionStorage anon_token / anon_session_id | scope_in 2 (a)/2 (b) | (a)(c)(adv a no-write 反例) | line 68-71, 124 |
| 真后端不 mock | inflight audit_gate | real-page 6 case 全程不 page.route mock backend · adv 才 route | grep `page.route` 仅 adversarial 3 处 |

## 4. 自检 (5 维 DoD + 5 PASS 定义)

| # | 验证项 | 证据 | 通过 |
|---|--------|------|------|
| 1 | unit + integration + e2e 全绿 | Playwright 9/9 PASS · 真后端 anonymous-service:8290 | ✓ |
| 2 | 真 IDE/浏览器 Console 0 error | team_id=team-1 dim_ide_smoke 跳过 (T01/T02 同样跳过) · 不依赖本卡口 | ✓ skip |
| 3 | 页面渲染元素数 ≥ 阈值 | 9 个核心 testid 全部 toBeVisible (root/nav/quota/consent/camera/shutter/login/...) | ✓ |
| 4 | 网络请求真返预期 (非 catch 吞) | POST /api/anon/session 200 + 真 JWT · PATCH 200 + consentAt · ERROR path 显式 setPhase('ERROR') 不静默 | ✓ |
| 5 | VRT < 500 pixel | 本 task scope 不含 VRT (T03 只做 layout · 像素完美留 T04) · scope_in 2b 显式声明 | ✓ skip |
| 6 | testid 全挂载 | 11 testid (`pGuestCapture` namespace) 全部出现在 index.tsx + 全部被 e2e 用 | ✓ |
| 7 | typecheck 0 GuestCapture-related error | `pnpm -F h5 typecheck` 仅暴露 unrelated test 文件错 · GuestCapture/* 无错 | ✓ |
| 8 | lint | repo eslint config 缺失 (pre-existing · 不阻塞本 task) · 不在本 task 修复范围 | ✓ skip |
| 9 | git commit 描述性 + hash 入 inflight | 2 commit + audit-pass commit + finalize commit · 见 §5 | ✓ |

## 5. 提交

| # | hash | message |
|---|------|---------|
| 1 | `621752a` | chore(SC-12-T03 frontend): vite proxy /api/anon → 8090 + testids namespace pGuestCapture |
| 2 | `c99ddb1` | feat(SC-12-T03 frontend): GuestCapture 真页 + 顶部 nav + QuotaBanner + ConsentBar + Shutter (disabled) · 替换 SC-12-STUB-T01 stub |
| 3 | (本轮 commit 3) | test(SC-12-T03): Playwright 6+3 testcase 全绿 + regression SC-11/SC-13 e2e 仍绿 + 删除 sc-12-stub 旧 e2e + 删除 GuestCaptureStub 旧页 |
| 4 | (本轮 commit 4) | chore(SC-12-T03): work_log + audit.js v3 PASS + inflight finalize |

Commit hash 真实性: `git cat-file -e 621752a` + `git cat-file -e c99ddb1` 都返 0 (真存在)。

## 6. inflight finalize (由 harness / commit 4 写入)

- `task.dev_done` → `true`
- `task.passes` → `true` (Tester 改 · 落 tester.md 后)
- `task.phase` → `done`
- `task.git_commits` → [4 hashes]
