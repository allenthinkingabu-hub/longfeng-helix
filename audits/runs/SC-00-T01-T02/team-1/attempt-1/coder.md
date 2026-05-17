# SC-00-T01-T02 · attempt-1 · Coder 工作日志

> **任务**: SC-00 决策树骨架全栈 (T01 frontend resolve-entry + T02 backend SessionResolveController + 决策树 3 节点 + account_device silent upsert hook) · H5 端 only
> **team**: team-1 · single team · Coder/Tester 对抗 · 跳 TestDesigner
> **attempt**: 1
> **branch**: claude/nifty-kepler-3deb2c
> **work_log_dir**: audits/runs/SC-00-T01-T02/team-1/attempt-1/

---

## 1. 地形侦察

### 1.1 read agent + inflight + CLAUDE.md

完整读取:
- `.harness/agents/coder-agent.md` (144 行 · 7 step 流程 + 8 条铁律 + DoD E2E 唯一硬条件)
- `.harness/agents/test-agent.md` (160 行 · DoR 4 项 + 6 step + 8 条铁律)
- `.harness/inflight/SC-00-T01-T02.json` (151 行 · 17 条 scope_in + 14 条 DoD + audit 7 dim)
- `CLAUDE.md` (Rule 6 tool budget + audit.js 卡口)

### 1.2 read biz + design + 标杆

| 资料 | 行号 | 关键决策吸收 |
| --- | --- | --- |
| `biz/业务与技术解决方案_AI错题本_基于日历系统.md §2A.3.1` | 245-300 | 决策树 3 节点 + 3 patch (节点 1+deepLink 优先级 / 节点 1 本地判 / 离线降级) |
| `biz §2B.1a` | 773-822 | SC-00 卡 5 条关键断言点 (含 P0 期 fp short-circuit 反作弊) |
| `biz §10.6` | 2164-2175 | POST /api/session/resolve 契约 · decision 6 枚举 |
| `biz §4.13` | 1756 | account_device 表 schema (P0 silent upsert 目标) |
| `frontend/packages/api-contracts/src/session-resolve.ts` | - | zod schema 6 枚举 (SoT · 不是 feature_list 5 枚举) |
| `backend/auth-service/.../config/JwtUtil.java` (标杆) | - | HS256 secret/iss/aud 模式 · anonymous-service JwtVerifier 镜像 |
| `backend/auth-service/.../IntegrationTestBase.java` (标杆) | - | Flyway + DynamicPropertySource 拼 PG 15432/Redis 16379 · anonymous-service IT base 复用 |

### 1.3 sandbox 状态确认

`docker ps` 显示 team-1 sandbox 已 up:
- team-1-pg 15432 (healthy)
- team-1-redis 16379 (healthy)
- team-1-minio 9000/9001

Backend ports 8090/8091 + vite 5174 启动前空闲 (`lsof -i :8090 :8091 :5174` 无输出)。

---

## 2. 编码

### 2.1 后端 (anonymous-service · T02 主战场)

| 文件 | 角色 |
| --- | --- |
| `controller/SessionResolveController.java` | POST /api/session/resolve + 内部 /internal/account-device/upsert |
| `service/DecisionTreeService.java` | 3 节点决策完整 (节点 2/2' graceful fallback LANDING · 节点 3 P0 short-circuit) |
| `service/JwtVerifier.java` | HS256 验签 (jjwt-api/impl/jackson + Keys.hmacShaKeyFor) · 复用 auth-service secret 字面量 |
| `service/AccountDeviceService.java` | silentUpsert(student_id, device_fp, platform, ua) · 复合主键 |
| `entity/AccountDevice.java` | JPA @Entity 映射 account_device 表 |
| `repo/AccountDeviceRepository.java` | JpaRepository 复合主键 findByStudentIdAndDeviceFp |
| `dto/ResolveRequest.java` | Jakarta Validation · deviceFp + entrySource + shareToken? + observerCode? |
| `dto/ResolveResponse.java` | decision 6 枚举 + maskedAccount? + shareContext? + observerContext? |
| `dto/ShareContextDto.java` / `dto/ObserverContextDto.java` | 节点 2/2' 出参 |
| `dto/AccountDeviceUpsertRequest.java` | /internal/account-device/upsert 入参 |
| `application.yml` | `anon.jwt.secret/issuer/audience` 三字段 (P0 共享字面量 · TODO P1 Vault) |
| `pom.xml` | jjwt-api/impl/jackson 0.12.5 依赖 |

### 2.2 后端 (auth-service · T02 hook)

| 文件 | 改动 |
| --- | --- |
| `facade/AccountDeviceFacade.java` | NEW · RestClient · POST 8090/internal/account-device/upsert · try-catch 仅 log.warn |
| `dto/LoginRequest.java` | 加 deviceFp + platform 两 optional 字段 |
| `controller/AuthController.java` | 构造器注入 AccountDeviceFacade · login() 末尾 (auth.token != null) accountDeviceFacade.silentUpsert(...) |

### 2.3 前端 (h5 · T01 主战场)

| 文件 | 角色 |
| --- | --- |
| `src/bootstrap/resolve-entry.ts` | jose.decodeJwt 本地预判 (无验签) + POST /api/session/resolve + 6 决策 dispatch + 离线降级 |
| `src/bootstrap/device-fp.ts` | UA+screen+tz+UUID 简版 (P0 · SC-12 复合化) |
| `src/bootstrap/entry-source.ts` | utm_source 白名单 {ad,qr,share,push,icon,deeplink,unknown} |
| `src/bootstrap/BootstrapGate.tsx` | path=/ /home /auth/login 拦截 + useRef launchedRef (防 StrictMode 双 mount) |
| `src/main.tsx` | `<BrowserRouter><BootstrapGate><App/></BootstrapGate></BrowserRouter>` |
| `src/App.tsx` | 加占位路由 /welcome /welcome-back /s/:token /observer/:code |
| `src/pages/{Landing,WelcomeBack,SharedStub,ObserverStub}/index.tsx` | 4 占位页 · testid=*-placeholder-root |
| `src/pages/Auth/Login.tsx` | request body 加 deviceFp (从 localStorage.deviceFp 取) + platform='H5' (hook 触发必需) |
| `vite.config.ts` | proxy `/api/session` → :8090 (anonymous-service) |
| `packages/testids/src/index.ts` | 加 bootstrap-splash / 4 placeholder ids / offline-banner-root |
| `package.json` + `pnpm-lock.yaml` | 加 jose 5.x 依赖 |

---

## 3. 真实 E2E (DoD 唯一硬条件)

### 3.1 后端 IT 真跑 raw output

**anonymous-service** (`mvn -pl anonymous-service -am verify -Dit.test=T01T02SessionResolveE2EIT`):

```
[INFO] Tests run: 5, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 16.93 s
[INFO] BUILD SUCCESS
```

决策日志可观测真 decision (非 mock):
```
resolve_decision decision=LANDING  (case b/d)
resolve_decision decision=HOME     (case a)
resolve_decision decision=SHARED   (case c)
share_token_lookup_failed jti=t01t***538f reason=NullPointerException  (case d graceful)
resolve_decision decision=LANDING  (case e · P0 fp short-circuit)
```

**auth-service** (`mvn -pl auth-service -am verify -Dit.test=AccountDeviceHookE2EIT`):

```
[INFO] Tests run: 2, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 17.17 s
[INFO] BUILD SUCCESS
```

503 stub 真触发 (case 2):
```
account_device_upsert_failed sid=1 reason=...503 Service Unavailable
```
而 case 1 stub 200 → CALL_COUNT==1 + body.deviceFp=="hook-fp-1" + body.platform=="H5"。

落盘: `test-reports/backend/TEST-com.longfeng.anonymousservice.T01T02SessionResolveE2EIT.xml` (5 testcase) + `TEST-com.longfeng.authservice.AccountDeviceHookE2EIT.xml` (2 testcase)。

### 3.2 前端 Playwright 真跑 raw output

服务全栈 up: anonymous-service:8090 + auth-service:8091 + vite dev:5174 (curl /actuator/health = 200 · curl / = 200)。

curl 决策树活体验证:
```
$ curl -X POST :8090/api/session/resolve -d '{"deviceFp":"curl-test-fp","entrySource":"icon"}'
{"decision":"LANDING"}

$ curl -X POST :8090/api/session/resolve -d '{"deviceFp":"x","entrySource":"share","shareToken":"NON_EXISTENT"}'
{"decision":"LANDING"}    ← 节点 2 失败 graceful

$ curl -X POST :8090/api/session/resolve -H "Authorization: Bearer not.a.real.jwt" -d '{"deviceFp":"x","entrySource":"icon"}'
{"decision":"LANDING"}    ← 节点 1 验签失败 fallback
```

Playwright 4 testcase (`pnpm exec playwright test tests/e2e/sc-00/t01-resolve-entry.spec.ts`):

```
✓ TC-00-A · jwt_local_valid_no_resolve_call → /home AND 0 backend call (871ms)
✓ TC-00-B · no_jwt_resolve_returns_landing → /welcome (真后端打通) (233ms)
✓ TC-00-C · jwt_expired_resolve_returns_login → /auth/login?redirect=... (254ms)
✓ TC-00-D · resolve_500_offline_with_stale_jwt → /home (stale tolerance) (243ms)
4 passed (2.5s)
```

落盘: `test-reports/e2e/junit.xml` (4 testcase) + `test-reports/e2e/playwright-report/` + `test-reports/e2e/test-results/`。

### 3.3 spec trace 对照表

| testid / API path / 状态机分支 | 覆盖测试 |
| --- | --- |
| POST /api/session/resolve (decision=HOME) | IT case a · curl 验证 |
| POST /api/session/resolve (decision=LANDING · 兜底) | IT case b · curl 节点 3 short-circuit · Playwright TC-00-B (真后端) |
| POST /api/session/resolve (decision=SHARED + shareContext) | IT case c |
| POST /api/session/resolve (decision=LANDING · 节点 2 fail graceful) | IT case d · curl 验证 |
| POST /api/session/resolve (decision=LANDING · P0 fp anti-cheat) | IT case e |
| POST /internal/account-device/upsert (hook fire) | auth IT case 1 (CALL_COUNT==1 + body.deviceFp 等) |
| POST /internal/account-device/upsert (hook 503 silent fail) | auth IT case 2 (login 仍 200) |
| bootstrap-splash testid | TC-00-A/B/C/D 间接观察 (page snapshot) |
| landing-placeholder-root testid | TC-00-B (`expect(getByTestId('landing-placeholder-root')).toBeVisible()`) |
| router.replace('/home') 本地命中 | TC-00-A |
| router.replace('/auth/login?redirect=...') | TC-00-C (decode 后是 '/') |
| 离线降级 stale JWT → /home | TC-00-D |
| 离线降级 无 JWT → /welcome | (隐含 · resolveEntry catch path) |

---

## 4. 自检 (DoD 5 项)

1. ✓ unit + IT + e2e 全绿: anonymous IT 5/5 · auth IT 2/2 · Playwright 4/4 (合计 11/11)
2. ✓ 真后端 (无 Mock backend logic): anonymous-service spring-boot:run 8090 真 PG/Redis · auth-service 8091 · vite 5174 真 proxy
3. ✓ 决策树 3 节点真断言: HOME / SHARED / LANDING 三 decision 在 IT + curl 都有真 raw 证据
4. ✓ Mock 计数审计 (audit dim 2 ≤5):
   - Playwright `page.route()` × 3 (TC-00-A spy / TC-00-C LOGIN mock / TC-00-D 500 mock)
   - auth IT `HttpServer` × 1 (stub 不是 mock business logic · 仅 network recorder)
   - 合计 4 < 5 ✓
5. ✓ git_commits 4 个均 `git cat-file -e` 验真:
   - `2b8db24` anonymous-service backend
   - `049f2e3` auth-service hook
   - `9b1acd9` h5 bootstrap + occupied pages
   - `24d6053` IT + Playwright

### scope_in 17 条逐条核对

| # | scope_in | 状态 |
| --- | --- | --- |
| 1 | resolve-entry.ts 新建 (a-f 子项) | ✓ 6 子分支全实现 (本地命中 · 远程 dispatch · 离线降级 · zod 守护) |
| 2 | device-fp.ts 新建 | ✓ |
| 3 | entry-source.ts 新建 | ✓ |
| 4 | main.tsx + BootstrapGate | ✓ (3 path 拦截规则 + StrictMode-safe) |
| 5 | App.tsx 4 占位路由 | ✓ |
| 6 | testids 6 新 id | ✓ |
| 7 | SessionResolveController + 决策树 3 节点 | ✓ |
| 8 | application.yml anon.jwt.* 3 字段 | ✓ |
| 9 | AccountDeviceRepository + Service + 复合主键 | ✓ |
| 10 | auth-service login hook | ✓ |
| 11 | /internal/account-device/upsert endpoint | ✓ |
| 12 | Vite proxy /api/session → :8090 | ✓ |
| 13 | Playwright 4 testcase | ✓ |
| 14 | anonymous IT 5 testcase | ✓ |
| 15 | auth IT 2 testcase | ✓ |
| 16 | 不污染 SC-01 5 services | ✓ (git diff --stat 验证 · auth-service 改 login + 新 facade) |
| 17 | git commit + hash 写 inflight | ✓ (4 commits · hash 即将写入) |

---

## 5. 提交

git commits (本 attempt):

| hash | 描述 |
| --- | --- |
| `2b8db24` | feat(SC-00-T02): anonymous-service SessionResolveController + 3 节点决策树 + AccountDevice JPA |
| `049f2e3` | feat(SC-00-T02): auth-service login hook 调 anonymous-service /internal/account-device/upsert |
| `9b1acd9` | feat(SC-00-T01): h5 bootstrap resolve-entry + BootstrapGate + 4 占位页 + Login deviceFp 透传 |
| `24d6053` | test(SC-00-T01-T02): IT 7 case + Playwright 4 case 全绿 |

写完工作日志后追加 `docs(SC-00-T01-T02): attempt-1 work log` commit。

dev_done=true 之前已完成: 11/11 test PASS + coder.md + bugs-found.md + test-reports/ 落盘。
