# PHASE-A-LOGIN-H5 · team-1 · attempt-3 · bugs-found.md

本轮编码 / 自检过程中**自己发现并立即修复**的 bug（不是 Tester 也不是用户报告），各条都附文件路径 + 简短描述 + 修复 commit hash。

---

## Bug 1 — Flyway 默认 location 把 common 模块的 V*.sql 也扫了进来

**File**: `backend/auth-service/src/main/resources/application.yml`
**Symptom**: First `mvn -pl auth-service verify` 时 IT 启动失败：

```
Caused by: org.flywaydb.core.internal.command.DbMigrate$FlywayMigrateException:
  Script V1.0.050__review_plan.sql failed
  Caused by: org.postgresql.util.PSQLException: ERROR: column "student_id" does not exist
```

**Root cause**: 把 flyway location 设成 `classpath:db/migration`，但 common 模块在同一路径下也有自己的 V*.sql。Flyway 把两个模块的迁移都扫进了 auth-service 的 `flyway_schema_history_auth` 表 → 跑到 review-plan 时它依赖 wrongbook-service 的 student_id 列 → 报错。

**Fix**: 把 auth-service 的迁移移到 `db/auth/` 命名空间，并显式 `spring.flyway.locations: classpath:db/auth`。同时改 IntegrationTestBase 的 DynamicPropertySource 同步。**Plus**: drop `flyway_schema_history_auth` 表清掉脏数据再跑就 OK。

**Commit**: `3cdb81d` (auth-service backend 整体提交里包含此修复)

---

## Bug 2 — TestRestTemplate 在 401/423 + JSON streaming body 下抛 HttpRetryException

**File**: `backend/auth-service/src/test/java/com/longfeng/authservice/AuthServiceLoginE2EIT.java`
**Symptom**: 第二次跑 IT 时（Bug 1 修完之后），4 测里 3 个 wrong/lockout case 报：

```
java.net.HttpRetryException: cannot retry due to server authentication, in streaming mode
  at sun.net.www.protocol.http.HttpURLConnection.getInputStream0(HttpURLConnection.java:1830)
```

**Root cause**: Spring Boot 3.2 的 `TestRestTemplate` 默认用 `SimpleClientHttpRequestFactory`（基于 `HttpURLConnection`），它在 4xx 响应 + 流式上传 body 下会硬抛 HttpRetryException 而不是返回正常的 ResponseEntity。

**Fix**: 替换为 JDK 11+ 自带 `java.net.http.HttpClient` · 不再依赖 TestRestTemplate · 直接 `httpClient.send(req, HttpResponse.BodyHandlers.ofString(...))` · 4xx 返回也只是 statusCode 字段，body 完整可读。

**Commit**: `3cdb81d`

---

## Bug 3 — @Transactional 默认 rollback 把 failed_attempts++ 撤回了

**File**: `backend/auth-service/src/main/java/com/longfeng/authservice/service/LoginService.java`
**Symptom**: Bug 2 修完后再跑 IT，`wrong_password_returns_401_invalid_credentials` 和 `five_strike_lockout_returns_423` 仍 fail：

```
expected: 1
 but was: 0  (failed_attempts after one wrong attempt)

expected: 423
 but was: 401  (5th attempt should trigger lockout)
```

**Root cause**: `verifyCredentials(...)` 用 `@Transactional`，密码不对时 throw `InvalidCredentialsException`（RuntimeException 子类）。Spring 默认 RuntimeException 触发回滚 → `repo.save(user)` 提交前 `failed_attempts++` 被 rollback → 永远停在 0 → 第 5 次也触不到锁定。

**Fix**: 改成 `@Transactional(noRollbackFor = {InvalidCredentialsException.class, AccountLockedException.class})`。这俩都是预期的领域失败，counter 增量必须 commit。

**Commit**: `3cdb81d`

---

## Bug 4 — Vite proxy 改 vite.config.ts 不会热重载 server config

**File**: `frontend/apps/h5/vite.config.ts`
**Symptom**: 加完 `/api/auth` proxy 配置后，curl `http://localhost:5174/api/auth/login` 直接返 404 + `Vary: Origin`。

**Root cause**: Vite 启动时会读 server.proxy 配置一次写进 middleware，运行中改这个字段不触发 HMR。新规则一直没被 dev server 加载。

**Fix**: `pkill -f vite && pnpm dev` 重启 vite，proxy 即时生效。curl 立即返回正常 JSON。

**Commit**: 无 commit（这是开发流程坑，不是代码 bug；防御性已在 `coder.md §2.2` 显式记下来防 Tester / 下次自己再踩）

---

## Bug 5 — Login.tsx 默认 redirect 漏掉 `/home`，与 inflight scope_in #10 不一致

**File**: `frontend/apps/h5/src/pages/Auth/Login.tsx`
**Symptom**: 首次跑 Playwright happy case fail：

```
TimeoutError: page.waitForURL: Timeout 10000ms exceeded.
  waiting for navigation to "**/home" until "load"
  navigated to "http://localhost:5174/"
```

**Root cause**: `sanitizeRedirect(null) → '/'`（我下意识写的 default）。但 inflight scope_in #10 + spec §7.2 出口表都明确 default 是 `/home`，不是 `/`。

**Fix**: 把 `sanitizeRedirect` 的 default 从 `'/'` 改成 `'/home'` · 同时在 App.tsx 加 `/home → HomePage` 路由（之前只有 `/`）· 同时把 banner show 条件改成「有 ?redirect 且不等于 /home」否则默认 case 也会显示 banner 误导。

**Commit**: `ce93117`

---

## 总结

5 个 bug 均在自检阶段（attempt-1 内部循环）发现并修复 · 0 个被 Tester / 用户报告 · 0 个遗留。
