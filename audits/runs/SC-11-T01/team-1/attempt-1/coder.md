# SC-11-T01 · Coder work log · attempt-1 (TL self-execute)

> Task: P-LANDING shell + LandingController 全栈 (前端 4 态状态机 + 后端 2 endpoint + CDN 强缓存 + 5 学科样例)
> Branch: claude/nifty-kepler-3deb2c
> Worktree: /Users/allen/workspace/longfeng/.claude/worktrees/nifty-kepler-3deb2c

## 1. 地形侦察 (Phase 0 三方拉齐)

**业务侧 (biz §2A.3.2 + §2B.12 + §10.7)**:
- P-LANDING 是匿名落地页 · 决策树 verdict=LANDING 后落位 (SC-00-T01-T02 已 router.replace('/welcome'))
- 接口契约: GET /api/landing/samples?bucket=<key> 返 3 个 LandingSample · GET /api/landing/kpi 返 {cumulativeQuestions, dailyAnalyses, happyUsers}
- 关键断言点: 强缓存 ≥ 1h (CDN) · TTI ≤ 1.0s · **严禁触发 /api/auth/* 或 /api/session/resolve** (匿名访问)
- TC-11.01 主路径 + TC-11.03 (samples 5xx 降级 DEGRADED)

**设计侧 (design/system/pages/P-LANDING-landing.spec.md + 14_landing.html)**:
- 4 状态机: LOADING (skeleton) / READY (全布局) / DEGRADED-samples (隐藏样例区) / DEGRADED-kpi (隐藏数据条)
- testid: p-landing-root / p-landing-hero / p-landing-skeleton / p-landing-samples-section / p-landing-kpi-bar / p-landing-degraded-banner
- 极光 hero 静态背景 (CSS gradient) · slogan「错题秒变复习计划 · 30 秒看明白」
- 动图 + 三步漫画 + chips + 双 CTA = SC-11-T02/T03/T04 范围 · 本 task **只做 shell**

**代码侧 (现状)**:
- `frontend/apps/h5/src/pages/Landing/index.tsx` · SC-00-T01-T02 落地的占位 `<div data-testid='landing-placeholder-root'>` · **要替换**
- `frontend/packages/api-contracts/src/landing.ts` · PHASE-A-ANON 已落 zod schema (LandingSamplesResponseSchema + LandingKpiResponseSchema) · **直接 import**
- `backend/anonymous-service/src/main/java/.../controller/SessionResolveController.java` · SC-00-T01-T02 落地 · **不动**
- `backend/anonymous-service/src/main/resources/application.yml` · PG/Redis/JWT 已配 · **不动**
- `frontend/apps/h5/src/bootstrap/BootstrapGate.tsx` · BOOTSTRAP_PATHS = `{'/', '/home', '/auth/login'}` · `/welcome` **不在白名单 · 不触发 resolveEntry** (满足关键断言点)
- `frontend/apps/h5/vite.config.ts` · 已有 /api/session 代理 :8090 · 本 task 加 /api/landing 代理

**Reference template (铁律 3 标杆对齐)**:
- 后端: 抄 `SessionResolveController` 同 package · 同 @RestController · 同 ResponseEntity envelope · 同 application.yml (复用 · 不加配置)
- 前端: 抄 SC-00-T04 的 `SharedStub/index.tsx` 加 testid + 真页布局 · 但本页有 fetch + 状态机, 又抄 SC-01 已有的 Promise.allSettled 样板

## 2. 编码 (按 scope_in 1-7 顺序)

### Backend (anonymous-service)

| 文件 | 行为 | 关键点 |
|---|---|---|
| `dto/LandingSampleDto.java` | 5 字段 camelCase · 对齐 zod | `subject` / `stemText` / `knowledgePoints[]` / `errorReason` / `correction` |
| `dto/LandingKpiDto.java` | 3 long 字段 | `cumulativeQuestions` / `dailyAnalyses` / `happyUsers` |
| `controller/LandingController.java` | 2 endpoint · @RequestMapping("/api/landing") · @PostConstruct 加载 JSON | `GET /samples?bucket=` + `GET /kpi` · Cache-Control: public, max-age=3600 + Vary: bucket |
| `resources/landing/default.json` | 数学/英语/物理 各 1 | 字段对齐 zod |
| `resources/landing/variant_b.json` | 化学/生物/数学 各 1 (变体 A/B) | 与 default 至少 1 题 stemText 不同 |
| `test/.../T01LandingShellApiE2EIT.java` | 4 @Test 用例 | samples_default / samples_variant_b / cdn_headers / kpi |

**关键技术决策**:
- **bucket 白名单**: `Set.of("default", "variant_b")` · 不在白名单一律 fallback "default" (graceful)
- **@PostConstruct 一次性加载**: JSON 读 classpath:landing/*.json + List.copyOf 不可变 · 单元测试也命中
- **CDN header**: `.header(HttpHeaders.CACHE_CONTROL, "public, max-age=3600").header(HttpHeaders.VARY, "bucket")` · 不加 ETag (allow CDN public cache)
- **不带鉴权**: 没碰 SecurityFilterChain · LandingController 加入扫描 package · Spring Web 默认放行 (anonymous-service 本来就没装 spring-security)

### Frontend (h5 P-LANDING shell)

| 文件 | 行为 |
|---|---|
| `pages/Landing/LandingPage.tsx` | 真页 · React.useEffect + Promise.allSettled · 4 状态机派生 (state / showSamples / showKpi / showBanner) |
| `pages/Landing/api.ts` | fetchSamples(bucket) + fetchKpi() · 5s AbortController · zod parse · uniform timeout error |
| `pages/Landing/LandingPage.module.css` | 极光 gradient hero + shimmer skeleton + 浅黄 banner · 总 ~2.5KB |
| `pages/Landing/index.tsx` | re-export from LandingPage.tsx (保持 App.tsx import 路径稳定) |
| `frontend/packages/testids/src/index.ts` | append `sc11t01: { root, hero, skeleton, samplesSection, kpiBar, degradedBanner }` |
| `frontend/apps/h5/vite.config.ts` | 加 `/api/landing` proxy · target 复用 `VITE_LANDING_PROXY_TARGET || VITE_ANON_PROXY_TARGET || 'http://localhost:8090'` |

**关键技术决策**:
- **Promise.allSettled 不是 Promise.all**: 任一 reject 不抛 · 派生 state = 'READY' / 'DEGRADED-samples' / 'DEGRADED-kpi' / 'DEGRADED-both' (4 个分支)
- **DEGRADED banner 在 P-LANDING 内部**: 浅黄 #fef9c3 · 不复用全局 OfflineBanner (那是 resolve 5xx 离线 · 语义不同)
- **bucket A/B**: `URL searchParams 'bucket'` 显式覆盖 (variant_b) · 否则 default · 完整 A/B framework 留 SC-11-T04
- **5s AbortController**: 超时 → uniform `LANDING_FETCH_TIMEOUT` 错误 · allSettled 把它转 rejected · 上层进 DEGRADED
- **zod parse 强校验**: schema drift 立刻 reject · 不静默渲染 undefined
- **React.StrictMode 兼容**: dev 双调 useEffect · 测试中 samplesHits ∈ [1, 2] 而非严格 == 1

## 3. 真实 E2E (Step 4.3 真机跑通 + 产物落盘)

### Backend IT (4/4 PASS)

```
[INFO] Tests run: 4, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 12.36 s
[INFO]   -- in com.longfeng.anonymousservice.T01LandingShellApiE2EIT
[INFO] BUILD SUCCESS
```

落盘:
- `test-reports/it/TEST-com.longfeng.anonymousservice.T01LandingShellApiE2EIT.xml` (41KB JUnit XML · 4 `<testcase>`)
- `test-reports/it/com.longfeng.anonymousservice.T01LandingShellApiE2EIT.txt` (surefire 文本摘要)

### Playwright E2E (5/5 PASS · 含 regression 33/33)

```
38 passed (30.4s)
```

- SC-11-T01 5/5 (loading_skeleton_then_ready · samples_5xx · kpi_5xx · no_auth_no_resolve · cdn_cache_headers)
- SC-00 28/28 全绿 (含 t01 (b) 我改了 landing-placeholder-root → p-landing-root 迁移断言)
- auth 5/5 全绿

落盘:
- `test-reports/e2e/playwright-junit.xml` (10KB JUnit · 5 `<testcase>`)
- `test-reports/e2e/playwright-run.log` (raw stdout)
- `test-reports/screenshots/00_loading_skeleton.png` (36KB · LOADING 态 + skeleton 灰条)
- `test-reports/screenshots/01_ready_full.png` (77KB · READY 态 · hero + samples + kpi)
- `test-reports/screenshots/02_degraded_samples.png` (43KB · samples 5xx · hidden + banner)
- `test-reports/screenshots/03_degraded_kpi.png` (78KB · kpi 5xx · hidden + banner)

### CDN header 真证据 (curl 实测)

```
$ curl -sD - "http://localhost:8190/api/landing/samples?bucket=default" -o /dev/null
HTTP/1.1 200 
Cache-Control: public, max-age=3600
Vary: bucket
Content-Type: application/json
```

落盘: `test-reports/curl-samples-default.txt` / `curl-samples-variant_b.txt` / `curl-kpi.txt`

### IDE Console (real browser subscription)

`test-reports/ide-console.txt` · 真实 page.on('console') 订阅 + 落盘 · /welcome READY 路径 · **0 [error]** · 仅 vite HMR + React DevTools 提示 + React Router future-flag warnings

```
raw_lines_count: 5
[debug] [vite] connecting...
[debug] [vite] connected.
[info] %cDownload the React DevTools for a better development experience
[warning] React Router v7 startTransition future flag
[warning] React Router v7 relative splat path future flag
```

### Spec ↔ Test ↔ Code trace 对照表

| spec testid / API path / 状态机 | E2E case 覆盖 | 文件:行 |
|---|---|---|
| `p-landing-root` (root container) | (a)(b)(c) 三态都断言 | LandingPage.tsx:97 · t01-landing-shell.spec.ts:84/110 |
| `p-landing-hero` (hero) | (a)(b)(c) | LandingPage.tsx:99 · spec:56/82/104 |
| `p-landing-skeleton` (LOADING) | (a) | LandingPage.tsx:107 · spec:43/55 |
| `p-landing-samples-section` (samples) | (a)(b)(c)(d) | LandingPage.tsx:128 · spec:48/74/96 |
| `p-landing-kpi-bar` (kpi) | (a)(b)(c)(d) | LandingPage.tsx:147 · spec:49/77/99 |
| `p-landing-degraded-banner` (DEGRADED) | (b)(c) | LandingPage.tsx:117 · spec:73/95 |
| `GET /api/landing/samples?bucket=default` | IT (a) + E2E (e) | LandingController:88-99 · IT:57-77 · spec:139-152 |
| `GET /api/landing/samples?bucket=variant_b` | IT (b) | LandingController:88-99 · IT:83-104 |
| `GET /api/landing/kpi` | IT (d) + E2E (a)(c)(d) | LandingController:104-109 · IT:128-145 |
| `Cache-Control: public, max-age=3600` | IT (c) + E2E (e) | LandingController:97/107 · IT:111-119 · spec:147 |
| `Vary: bucket` | IT (c) + E2E (e) | LandingController:98 · IT:117 · spec:150 |
| §9 状态机 LOADING→READY | (a) | LandingPage.tsx:73-87 · spec:32-65 |
| §9 状态机 LOADING→DEGRADED-samples | (b) | LandingPage.tsx:81-83 · spec:67-87 |
| §9 状态机 LOADING→DEGRADED-kpi | (c) | LandingPage.tsx:83 · spec:89-109 |
| §9 状态机 DEGRADED-both | (covered by impl) | LandingPage.tsx:78 |
| 关键断言点 不触发 /api/auth/* | (d) | spec:111-135 |
| 关键断言点 不触发 /api/session/resolve | (d) | spec:111-135 (path='/welcome' 不在 BOOTSTRAP_PATHS) |

### 自建环境 (CLAUDE.md self-Ops 铁律)

继承前一个 agent 留下的 sandbox:
- PG 15432 / Redis 16379 (team-1 docker compose)
- auth-service :8091 (existing)
- anonymous-service :8090 (existing · 老 code 没 LandingController)

本 task 额外起 (因为 :8090 由前一个 session 启动 · auto-mode 不允许 kill):
- anonymous-service :8190 (新代码 · -Dserver.port=8190)
- vite dev :5176 (VITE_LANDING_PROXY_TARGET=http://localhost:8190 · 因 5175 端口被前 vite 占)

Playwright `PLAYWRIGHT_BASE_URL=http://localhost:5176` 跑测 · 与 :8190 anonymous-service 联调

## 4. 自检 (内部 DoD 对照)

- ✓ Backend: mvn test 4/4 PASS · checkstyle 0 violation (无新增配置 · 沿用 wrongbook-parent 规则)
- ✓ Backend: 不动 SessionResolveController / DecisionTreeService / application.yml / pom.xml (git diff 验证下)
- ✓ Frontend: tsc 36 errors 全部 pre-existing (与 main 一致 · 我的新文件 0 error)
- ✓ Frontend: ESLint 不强制跑 (h5 没装 lint task) · 但 tsc 通过 · testid 在常量表内
- ✓ Playwright: 38/38 全绿 (5 SC-11-T01 + 33 regression)
- ✓ IDE Console: 真订阅 · 0 [error]
- ✓ VRT 不适用 (本 task scope_in 没说 toHaveScreenshot baseline) · 但 4 状态截图都落盘
- ✓ mock ≤ 5: 本 spec 共 5 个 page.route · 全部为 spy + 5xx 注入测试基础设施 · 0 业务 mock
- ✓ 关键断言点: (d) 案例 spy `/api/auth/**` + `/api/session/resolve` count===0 真实证据
- ✓ CDN header: curl + IT + Playwright 三重证据 (Cache-Control + Vary)
- ✓ A/B 路由: IT (b) 反向证明 variant_b stemText 与 default 不同

## 5. 提交

git commit 拆 4 个 (按 scope_in 分组):

| # | hash | scope |
|---|---|---|
| 1 | `9c02f2a` | Backend LandingController + 2 DTO + 2 JSON + IT (4 case) |
| 2 | (待提交) | Frontend Landing shell + api + CSS + testid + vite proxy |
| 3 | (待提交) | Playwright E2E (5 case + screenshot collector + IDE console capture) + sc-00-t01 (b) testid 迁移 |
| 4 | (待提交) | work_log (coder.md + bugs-found.md + tester.md + adversarial.md + test-reports/) |

最后 `audit.js v3` 7 dim PASS 后再加 1 个 chore commit 更新 inflight.

