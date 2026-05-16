# PHASE-A-LOGIN-H5 · team-1 · attempt-1 · coder.md

**Task**: P00 邮箱+密码 登录全栈链路（h5 端）· auth-service backend 新建 + 1:1 mirror mockup + Playwright e2e + 后端 IT 全绿
**Coder**: Coder agent (Opus 4.7 1M-ctx)
**Branch**: `claude/nifty-kepler-3deb2c`
**Parent commit**: `e369cdb`
**Commits this attempt**:
- `3cdb81d` — feat(PHASE-A-LOGIN-H5): auth-service backend (Maven module, controller, service, IT)
- `ce93117` — feat(PHASE-A-LOGIN-H5): P00 login page (h5) + Playwright e2e (4/4 PASS)

---

## 1. 地形侦察

读了下列文档作为 SoT（顺序按依赖）:

1. `.harness/agents/coder-agent.md`（铁律 6 条 + 7 步骤 + 5 维 PASS 定义 + Phase 2 评审解释）
2. `.harness/inflight/PHASE-A-LOGIN-H5.json`（16 scope_in + 12 DoD + sandbox PG:15432 / Redis:16379 + scope_out 9 项）
3. `CLAUDE.md`（Rule 6 tool-use budget + audit.js 卡口 + 双脑回看）
4. `design/system/pages/P00-login.spec.md` §1-§15（页面 SoT 规格）
5. `design/mockups/wrongbook/00_login.html`（视觉 SoT · 1:1 mirror target）

标杆模板（参考样板）：

- **Maven 模块结构**：`backend/file-service/`（pom inherit `wrongbook-parent`、application.yml 端口配 + sandbox 数据源、`@SpringBootApplication(scanBasePackages = ...)`、Failsafe 跑 `*IT.java`、IntegrationTestBase + DynamicPropertySource 接 sandbox 容器）
- **公共 envelope/error**：`backend/common/`（`ApiResult.fail` 模式 · 但 P00 我故意走 dedicated `AuthErrorResponse {code, message, lockedUntil?}` 而非 `ApiResult`，因为 spec §9 异常表里 `INVALID_CREDENTIALS` / `ACCOUNT_LOCKED` / `lockedUntil` 字段需要顶层透明，不被 ApiResult.data 包装。已在 controller 用 local `@ExceptionHandler` 落地这一决策）
- **DDL 风格**：`backend/common/src/main/resources/db/migration/V1.0.001__user_account.sql`（用 `IF NOT EXISTS` + 简单字段 + 注释）
- **前端 Page**：`frontend/apps/h5/src/pages/Home/index.tsx`（`TEST_IDS.pHome.root` + CSS module + functional component）
- **Playwright spec**：`frontend/apps/h5/tests/e2e/sc-01/t01-capture-to-pending.spec.ts`（trace 头注释三方真实理解 + 业务剧本 + TID const + describe + page.getByTestId）

侦察结论：
- `backend/auth-service/` 不存在 → 全新建
- `frontend/apps/h5/src/pages/Auth/` 不存在 → 全新建
- testids `p00.*` 已有 10 个（root/statusbar/logo/wechat/...）· 缺 7 个（email/password/remember/forget/login-submit/apple/redirect-banner）+ 我补了 2 个 helper（errorInline/toast）
- sandbox PG/Redis/MinIO 全部 healthy（`docker ps` 显示 team-1-* 已 up 2 天）
- 现有 vite.config.ts 没有 `/api/auth` 代理，我加了一条

## 2. 编码

### 2.1 后端 auth-service（commit `3cdb81d`）

新建 17 个文件：

| 文件 | 作用 |
|---|---|
| `backend/auth-service/pom.xml` | inherit wrongbook-parent，引入 jjwt 0.12.5、spring-security-crypto、jpa+redis+flyway+postgres、testcontainers 测试范围 |
| `backend/pom.xml` (modified) | 在 `<modules>` 加 `<module>auth-service</module>` |
| `src/main/java/.../AuthServiceApplication.java` | 端口 8091 · scanBasePackages 包括 common · 单一 `@SpringBootApplication` |
| `src/main/resources/application.yml` | spring.datasource → PG:15432 · redis:16379 · flyway.locations=`classpath:db/auth` · flyway.table=`flyway_schema_history_auth`（避免和 common 的 `flyway_schema_history` 冲突）· jpa.ddl-auto=validate · jwt secret + iss + aud + ttl + lockout 配置 |
| `src/main/resources/db/auth/V20260516_01__auth_user.sql` | 1 张 `auth_user` 表（id BIGSERIAL · email UNIQUE · password_hash VARCHAR(72) · status CHECK ACTIVE/LOCKED/DELETED · failed_attempts · locked_until · last_login_at · created_at）· idx_auth_user_email · 插 fixture (`test@example.com` / `Test@1234` bcrypt hash) |
| `src/main/java/.../entity/AuthUser.java` | JPA entity 映射 auth_user · 字段 + getter/setter |
| `src/main/java/.../repo/AuthUserRepository.java` | JpaRepository + `findByEmail(...)` |
| `src/main/java/.../dto/LoginRequest.java` | `{provider, email, password, rememberMe, consentAt}` · @Email + @Size validation |
| `src/main/java/.../dto/LoginResponse.java` | `{jwt, refreshToken, expiresIn, student:{id, nickMasked}}` |
| `src/main/java/.../dto/RefreshResponse.java` | stub 输出 |
| `src/main/java/.../dto/AuthErrorResponse.java` | `{code, message, lockedUntil?}` · spec §9 wire format |
| `src/main/java/.../service/JwtService.java` | HS256 签发 · sub=userId, iss=longfeng, aud=h5, exp 7d · jjwt 0.12 API |
| `src/main/java/.../service/RefreshTokenService.java` | UUID v4 → Redis `auth:refresh:{token}` 30d TTL |
| `src/main/java/.../service/LoginService.java` | **核心状态机**：findByEmail → 锁定窗内反 → 自动解锁 expired lock → bcrypt.matches → 失败 attempts++ → 第 5 次 SET LOCKED + locked_until=now+5min。**关键**：`@Transactional(noRollbackFor = {InvalidCredentialsException.class, AccountLockedException.class})` — 不加这个会被默认 rollback 把 failed_attempts++ 撤回 |
| `src/main/java/.../controller/AuthController.java` | `POST /api/auth/login` + `POST /api/auth/refresh` stub + local `@ExceptionHandler` 把 InvalidCredentialsException → 401 + ACCOUNT_LOCKED → 423 |
| `src/test/java/.../IntegrationTestBase.java` | `@DynamicPropertySource` 接 sandbox PG/Redis |
| `src/test/java/.../AuthServiceLoginE2EIT.java` | **4 testcases**: happy / wrong_password / non_existent_email / 5_strike_lockout · `@SpringBootTest` + `java.net.http.HttpClient`（不用 TestRestTemplate · 它在 401 + streaming POST 下挂 HttpRetryException）· @BeforeEach 重置 fixture 状态 |

**关键设计 / 踩坑**：

- **Bcrypt fixture hash**：用 python `bcrypt.hashpw(b'Test@1234', bcrypt.gensalt(rounds=10))` 真生成 `$2b$10$LwxS2PKlU/1UQdXR47es/Obqj9DOz/sBNHuPMwpwdtp5U5inJa8oK`（len=60）· `bcrypt.checkpw` 已 verify。**不 fabricate**。Java `BCryptPasswordEncoder` 的 `$2a$` 和 `$2b$` 兼容（同算法）· spring-security-crypto 验证通过（IT happy case 200 OK）。
- **Flyway location 冲突**：first run 时把 `db/migration` 当 location，把 common 的 V1.0.001/V1.0.002 也写进了 `flyway_schema_history_auth` 表，第二次 run 时把 location 改成 `db/auth`，Flyway 检测到 "applied but not resolved locally" 报错。Fix: drop `flyway_schema_history_auth` + `auth_user` 表，重跑。下游 attempt 不会再碰到（migration location 已固定到 `db/auth`）。
- **TestRestTemplate 在 401/423 + streaming body 下抛 `HttpRetryException: cannot retry due to server authentication, in streaming mode`**。改用 `java.net.http.HttpClient`（JDK 11+ 内置）后干净通过。
- **`@Transactional` rollback**：默认 RuntimeException 触发 rollback。我 throw `InvalidCredentialsException`（RuntimeException 子类）后，`failed_attempts++` 被回滚 → lockout 永远触不到。加 `noRollbackFor = {...}` 后 OK。
- **Lockout 第 5 次直接返 423**（不是先 401 再下一次才 423）。因为第 5 次失败既增加计数也触发锁定，UI 应当立刻看到 lockout banner。IT 已 cover 这个语义（`five_strike_lockout_returns_423`）。
- **Unified 401 防 enumeration**：邮箱不存在和密码错误都返同一 `INVALID_CREDENTIALS` 文案（spec §9 + 行业最佳实践）。IT `non_existent_email_returns_401_unified` 锁这个不变量。

### 2.2 前端 H5 P00 login（commit `ce93117`）

新建 / 改动 6 个文件：

| 文件 | 作用 |
|---|---|
| `frontend/apps/h5/src/pages/Auth/Login.tsx` | 1:1 mirror mockup 视觉 · Logo + 凭据卡 + email/password input + 记住我 + 忘记密码 + 主 CTA + divider + Apple + 微信 + ConsentBar |
| `frontend/apps/h5/src/pages/Auth/Login.module.css` | 视觉 ports：blue gradient logo (135deg #3BA6FF → #0A84FF → #0060DF) · 凭据卡 22px radius + blur(30px) saturate(180%) · 333px width 锁定 · 主 CTA 50px 蓝渐变 |
| `frontend/apps/h5/src/App.tsx` (modified) | 加 `/auth/login` + `/home` 两条 route |
| `frontend/apps/h5/vite.config.ts` (modified) | `/api/auth` proxy → localhost:8091 (auth-service) · 排在 `/api/file` / `/api/wb` 之前 (longest-prefix-first) |
| `frontend/packages/testids/src/index.ts` (modified) | `TEST_IDS.p00.*` 加 9 个新 testid (email/password/rememberMe/forget/login-submit/apple/redirect-banner + 我加的 errorInline/toast 各 1) |
| `frontend/apps/h5/tests/e2e/auth/login.spec.ts` | Playwright 4 case：happy / wrong_password / wrong_email / 5-strike lockout |

**关键设计 / 踩坑**：

- **redirect 白名单 + default `/home`**：spec §7.2 + inflight #10/#11 要求 default → `/home`，外部 origin / 非白名单前缀 → downgrade 到 `/home`。初版我 default 用了 `/`，e2e 失败后修正到 `/home`。banner 只在 `?redirect=` 存在且不等于默认时显示。
- **Consent 必勾**：CTA disabled 同时显示 opacity 50%；未勾时点 CTA toast「请先同意服务条款与隐私政策」。E2E `tickConsent` helper 通过 `data-testid=p00-consent-bar-checkbox` 点击。
- **Apple / 微信 / 忘记密码三个未实装按钮**：DOM 完整、点击不报错、统一 toast「功能开发中 · 暂请用邮箱密码登录」（这部分 spec §13 testid 表 + §9 已要求 visual 兼容）。
- **State machine**：useState `AuthState = 'IDLE' | 'VERIFYING' | 'SUCCESS' | 'FAILED'`。VERIFYING 时主 CTA 显示 spinner + 文案「登录中...」。404/无 envelope fallback 到「登录失败，请重试」。网络异常 → 「网络不可用，请检查后重试」。
- **JWT 持久化**：成功后 `localStorage.setItem('jwt', ...)` + `refreshToken` + `expiresAt`（now + expiresIn*1000）· e2e happy case 主张 `localStorage.getItem('jwt')` 三段式 (header.payload.signature)。
- **Vite proxy 需重启才生效**：vite 启动后改 vite.config.ts 不会热重载 server config。初次 curl 返 404，pkill vite 重启后 OK。

## 3. 真实 E2E

### 3.1 后端 IT (Maven Failsafe)

**命令**：`mvn -pl auth-service verify`
**结果**：`BUILD SUCCESS`
**JUnit XML**：`audits/runs/PHASE-A-LOGIN-H5/team-1/attempt-1/test-reports/backend-it/failsafe-reports/TEST-com.longfeng.authservice.AuthServiceLoginE2EIT.xml` · `<testcase>` 4 个 · failures=0 · errors=0

```
[INFO] Tests run: 4, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 16.11 s
[INFO]   -- in com.longfeng.authservice.AuthServiceLoginE2EIT
[INFO] BUILD SUCCESS
```

4 IT 用例覆盖映射：

| 用例 | DoD 编号 (inflight #15) | spec 锚点 | 真证据 |
|---|---|---|---|
| `happy_login_returns_jwt_and_refresh` | (a) happy | §5 row #2 + §6 状态机 SUCCESS | `body.jwt` 三段式 · `expiresIn=604800` · `student.nickMasked` 含 @example.com · Redis key `auth:refresh:<token>` 存在 |
| `wrong_password_returns_401_invalid_credentials` | (b) wrong_password | §9 INVALID_CREDENTIALS | HTTP 401 · code=INVALID_CREDENTIALS · DB `failed_attempts=1` |
| `non_existent_email_returns_401_unified` | (c) wrong_email | §9 防 enumeration | HTTP 401 · 同一 code=INVALID_CREDENTIALS（不暴露邮箱存在性） |
| `five_strike_lockout_returns_423` | (d) lockout | §9 锁定 5 次 5 分钟 | attempt 1-4 各 401 · 第 5 次直接 423 · code=ACCOUNT_LOCKED · lockedUntil 非空 · 第 6 次（正确密码）仍 423 · DB status=LOCKED |

### 3.2 前端 Playwright

**命令**：`pnpm exec playwright test tests/e2e/auth/login.spec.ts`
**结果**：`4 passed (5.7s)`
**HTML 报告**：`audits/runs/PHASE-A-LOGIN-H5/team-1/attempt-1/test-reports/e2e/playwright-report/index.html`
**JUnit XML**：`audits/runs/PHASE-A-LOGIN-H5/team-1/attempt-1/test-reports/e2e/playwright-report/junit.xml` · `<testsuite tests="4" failures="0" skipped="0" errors="0">`

```
✓ PHASE-A-LOGIN-H5 happy: test@example.com + Test@1234 → /home (1.1s)
✓ PHASE-A-LOGIN-H5 wrong_password → inline 邮箱或密码错误 (826ms)
✓ PHASE-A-LOGIN-H5 wrong_email → same 邮箱或密码错误 (prevent enumeration) (591ms)
✓ PHASE-A-LOGIN-H5 lockout: 5 connectives wrong → 账号已锁定 · 5 分钟后重试 (2.5s)
```

4 E2E 用例 ↔ testid / API path / 状态机分支 trace 表：

| Playwright 用例 | testid 命中 | API path | 状态机分支 |
|---|---|---|---|
| happy | p00-root → p00-consent-bar-checkbox → p00-email-input → p00-password-input → p00-login-submit-btn → p-home-root | POST /api/auth/login → 200 + jwt | IDLE → VERIFYING → SUCCESS (router.replace `/home`) |
| wrong_password | p00-email-input + p00-password-input → p00-error-inline | POST /api/auth/login → 401 INVALID_CREDENTIALS | IDLE → VERIFYING → FAILED |
| wrong_email | p00-email-input + p00-password-input → p00-error-inline (同上文案) | POST /api/auth/login → 401 INVALID_CREDENTIALS | IDLE → VERIFYING → FAILED |
| lockout | 5 次提交 → p00-error-inline 显示 `'账号已锁定 · 5 分钟后重试'` | 第 1-4 次 → 401 · 第 5 次 → 423 + lockedUntil | FAILED 不动；DB 侧 status=LOCKED |

**反作弊红线 checks**：

- ✅ IT 不 mock 后端 · 真接 sandbox PG :15432 + Redis :16379（IntegrationTestBase.java `@DynamicPropertySource` 显式接，未引入 H2/Embedded/Mock 任何依赖）
- ✅ Playwright 不 mock /api/auth · 全程 vite proxy → 真 auth-service（auth-service 在 8091 实跑 spring-boot:run · `/tmp/auth-svc.log` 显示真接 PG · 真签 JWT · 真 Redis 写 refresh token）
- ✅ 4 个 Playwright `<testcase>` ↔ 4 个 Failsafe `<testcase>` ↔ inflight scope_in #14/#15 4 testname · 计数严格对齐
- ✅ Bcrypt hash 真生成、`bcrypt.checkpw('Test@1234')` 真 verify、psql 验长度=60
- ✅ Git commits 全部 `git cat-file -e` 验真（3cdb81d / ce93117 均在）

## 4. 自检

回到 coder-agent.md 7 步骤 / 6 铁律 + CLAUDE.md 12 通用德行 + audit.js 5 维度，逐条核对：

- 铁律 1 单一专注 ✅：只领 PHASE-A-LOGIN-H5 这一个 task
- 铁律 2 工作区隔离 ✅：所有改动在 `claude/nifty-kepler-3deb2c` 分支 + worktree 内，没动 main
- 铁律 3 权限隔离 ✅：只改 `task.dev_done` + `task.git_commits`（在 step 5 落 inflight）· 没碰 `passes`
- 铁律 4 Git commits 描述性 ✅：2 commit 都含 task id + 改了啥 + 为啥（含 ref 行）· 都有 Co-Authored-By
- 铁律 5 工作日志 ✅：本 coder.md 5 段（地形侦察 / 编码 / 真实 E2E / 自检 / 提交）+ bugs-found.md 真 list（见下一文件）
- 铁律 6 lint + 真编译 ✅：`mvn verify` BUILD SUCCESS · `pnpm exec tsc --noEmit` 显示 0 个 Login.tsx 类型错误（37 个错误全部在 pre-existing test 文件 *.test.tsx · 不属本 task scope）· Playwright 4/4 PASS · 无 IDE Console error
- 铁律 7 E2E _helpers.ts 三件套 ⚠️：H5 暂无 `_helpers.ts`（这是 MP 端铁律 · spec 路径是 `frontend/apps/mp/test/e2e/_helpers`）· H5 spec 也未用此 pattern · 本 task 沿用现存 H5 spec 风格（如 t01-capture）保持一致 · 不引入 surgical 范围外的新基础设施

CLAUDE.md 12 通用德行：

- Rule 1 think before coding ✅ 用大段地形侦察后才动手
- Rule 2 simplicity first ✅ 无引入 spring-security filter chain（只 crypto BCrypt）· refresh token 用最简 UUID + Redis 不引入 JWT 嵌套
- Rule 3 surgical ✅ 只动需要的：testids 加新条目，没改老条目；vite.config 加一条 proxy，没改其他
- Rule 4 goal-driven ✅ inflight 12 DoD 全部映射验真
- Rule 5 use model only for judgment ✅ 状态机用代码实现，不靠 LLM 路由
- Rule 6 tool budget ✅ 本步骤估算 ~55 tool use · 软线 50 已过 · 此 self-checkpoint 即合规
- Rule 7 surface conflicts ✅ ErrCode envelope 冲突的决策已上文 explain（用 dedicated AuthErrorResponse）
- Rule 8 read before write ✅ 完整读了 spec/mockup/standalone agent + 标杆 file-service
- Rule 9 tests verify intent ✅ IT 不仅查状态码还查 DB 字段（failed_attempts, status, locked_until）+ Redis 字段
- Rule 10 checkpoint ✅ 本文件即 final checkpoint
- Rule 11 match conventions ✅ 沿用 file-service Maven 风格、Application.java pattern、controller `@RequestMapping`、JsonInclude.Include.NON_NULL DTO
- Rule 12 fail loud ✅ Login.tsx 状态机有 explicit FAILED 状态 · 后端 unified error 不 silent-fall-through

audit.js 5 维度自评：

- dim 1 coder_compliance：coder.md 5 段齐 + bugs-found.md 真 list ✅
- dim 2 tester_compliance：N/A（Tester 阶段才查）
- dim 3 bug_reality：`git_commits[] = [3cdb81d, ce93117]` 两条 `git cat-file -e` 可验真 ✅
- dim 4 test_validity：Playwright junit.xml 4 `<testcase>` + Failsafe TEST-*.xml 4 `<testcase>` · 我 coder.md 声称 4+4 · 严格 1:1 ✅
- dim 5 spec_alignment：IT 用 sandbox PG/Redis 真容器 · 无 H2/embedded/Mock · application.yml + IntegrationTestBase 均无 mock dependency ✅

## 5. 提交

2 commits（HEREDOC 格式 + Co-Authored-By）：

```
3cdb81d feat(PHASE-A-LOGIN-H5): auth-service backend · POST /api/auth/login + JWT + 5-strike lockout
ce93117 feat(PHASE-A-LOGIN-H5): P00 login page (h5) · 1:1 mirror mockup + Playwright e2e (4/4 PASS)
```

落盘工件（这一步之后再写入 inflight）:
- `audits/runs/PHASE-A-LOGIN-H5/team-1/attempt-1/coder.md` (本文件)
- `audits/runs/PHASE-A-LOGIN-H5/team-1/attempt-1/bugs-found.md`
- `audits/runs/PHASE-A-LOGIN-H5/team-1/attempt-1/test-reports/e2e/playwright-report/{index.html,junit.xml}`
- `audits/runs/PHASE-A-LOGIN-H5/team-1/attempt-1/test-reports/backend-it/failsafe-reports/`
- `audits/runs/PHASE-A-LOGIN-H5/team-1/attempt-1/test-reports/backend-it/surefire-reports/`

更新 inflight `task.dev_done=true` + `task.git_commits=[3cdb81d, ce93117]` 后调用 `node .harness/harness.js --advance=PHASE-A-LOGIN-H5` 推 Tester 阶段。
