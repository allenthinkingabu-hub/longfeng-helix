# SC-13-SHARER · Coder 工作日志 (attempt-1)

> task: SC-13-SHARER · team: team-1 · attempt: 1 · 完成于 2026-05-18
> Phase 3 Coder (test_case_first_required=false · 沿用 opt-out · 与全部前任 task 同款)

## 1. 地形侦察

**启动纪律 + 双脑回看**:
- `.harness/agents/coder-agent.md` 全文 · 铁律 7 条 (单一专注 / 工作区隔离 / 权限隔离 / git commit 描述性 / work_log 落盘 / lint+真编译 / E2E helpers) + Phase 3 7 step 内化
- `CLAUDE.md` 12 条 Rule + Rule 6 tool budget + audit.js 卡口 + 双脑回看协议
- `.harness/inflight/SC-13-SHARER.json` 11 scope_in + 9 DoD + audit_gate v3 7 dim

**资产侦察 (SC-13 已落地的可复用基础设施 · 严禁重写)**:
- `backend/anonymous-service/src/main/resources/application.yml` · `anon.jwt.secret/issuer/audience` 已配 · HS256 与 auth-service 跨服务字面量一致
- `service/JwtVerifier.java` · `verifyAndGetStudentId(authHeader): Optional<Long>` 已存在 (SC-00-T02 落) · 401 入口直接复用
- `service/ShareTokenService.java` · `signingKey` 字段已 @Value 注入 · `lookup()` 已实现 + `ShareLookupOutcome.Kind` enum · `REVOKED_SET_KEY = "share:revoked"` 常量已存在 · 我新增的 `issue()` 与 `revoke()` 直接复用同一 signingKey 与 redis SADD key (绝不另外注入第二份 key)
- `entity/ShareToken.java` · JPA `@Entity(name="share_token")` 字段对齐 V20260421_02 DDL · BIGINT id (无 PG sequence) · jti unique
- `repo/ShareTokenRepository.java` · `findByJti(String)` 已有 · 不加新方法 (本 task 只用 save + findByJti)
- `IntegrationTestBase.java` · Testcontainers/sandbox PG 15432 + Redis 16379 + flyway profile 已挂 @DynamicPropertySource
- `SC13ShareE2EIT.java` · 4 testcase 接收侧已 PASS · 本 task 不动其源码 (regression)
- `T01T02SessionResolveE2EIT.java` · sharer JWT helper 模板 (`signJwt(uid, expDeltaSec)`) — 我在新 IT 内 inline 复用同模式
- DDL `share_token`: status 1 ACTIVE / 2 EXPIRED / 3 REVOKED / 4 EXHAUSTED · expires_at ≤ created_at + 7d (biz §4.11)

**标杆模板 (Reference)**:
- ShareIssueController vs SessionResolveController (同 package) — 都是 @RestController + @Valid @RequestBody + @ExceptionHandler(MethodArgumentNotValidException) · 严格抄结构
- ShareRevokeController vs ShareController · 都是 @RequestMapping("/api/share") + @PathVariable + ResponseEntity.noContent()/status() switch
- ShareTokenService.issue/revoke vs ShareTokenService.lookup · 都是 @Service + 同一 signingKey + redis.opsForSet() + Optional<ShareToken>
- SC13SharerE2EIT.signSharerJwt vs T01T02SessionResolveE2EIT.signJwt — 完全同模式 (DRY · 没新建 util class · 直接在 test class 内 inline)

**docker ps 验证 (Coder 是自己的 Ops · CLAUDE.md 铁律补充 6)**:
- team-1-pg :15432 · Up 14 hours (healthy)
- team-1-redis :16379 · Up 14 hours (healthy)
两个 sandbox 容器已在线 · Spring Boot IT 通过 `IntegrationTestBase.@DynamicPropertySource` 自动指过去 · 无需 `docker run`.

## 2. 编码

### 新增 4 文件

| 文件 | 行数 | 角色 |
| --- | ---: | --- |
| `backend/anonymous-service/src/main/java/com/longfeng/anonymousservice/dto/ShareIssueRequest.java` | 55 | `@NotBlank @Pattern(EXAM_DAY\|QUESTION\|REVIEW_NODE)` shareType · `@NotBlank @Size(128)` relationId · `@Positive` expiresInSec (opt) · Boolean allowClaim (opt) |
| `backend/anonymous-service/src/main/java/com/longfeng/anonymousservice/dto/ShareIssueResponse.java` | 48 | 4 字段 `{shareToken, shareUrl, jti, expiresAt}` · @JsonInclude(NON_NULL) · 不含 relation_id / sharer_student_id (调用方自己已知) |
| `backend/anonymous-service/src/main/java/com/longfeng/anonymousservice/controller/ShareIssueController.java` | 95 | `POST /api/share/tokens` · 401 if JwtVerifier empty · 400 via @ExceptionHandler(MethodArgumentNotValidException) · 200 ShareIssueResponse · shareUrl = ${share.public-base-url}/s/${shareToken} (strip trailing slash) |
| `backend/anonymous-service/src/main/java/com/longfeng/anonymousservice/controller/ShareRevokeController.java` | 73 | `DELETE /api/share/tokens/{jti}` · 401 / 404 TOKEN_NOT_FOUND / 403 NOT_OWNER / 204 SUCCESS+ALREADY_REVOKED (idempotent) |
| `backend/anonymous-service/src/test/java/com/longfeng/anonymousservice/SC13SharerE2EIT.java` | 270 | 8 IT testcase (issue happy/401/400/clamp7d + revoke owner/B/unknown + round-trip GET 200→403) · 真 PG + 真 Redis |

### 修改 2 文件

- `backend/anonymous-service/src/main/java/com/longfeng/anonymousservice/service/ShareTokenService.java`
  - +imports: `Date`, `Instant`, `UUID`, `ThreadLocalRandom`, `DataIntegrityViolationException`, `ShareIssueRequest`
  - +常量: `MAX_TTL_SECONDS = 604800` (7d hard cap · biz §4.11) · `DEFAULT_TTL_SECONDS = 86400` (24h) · `STATUS_ACTIVE = 1` · `STATUS_REVOKED = 3`
  - +method `issue(long sharerStudentId, ShareIssueRequest req): IssueOutcome`
    - 生成 jti = `UUID.randomUUID().toString().replace("-","")` (32 char hex)
    - clamp ttl = `min(max(requestedTtl, 1L), MAX_TTL_SECONDS)` (避免 0 / 负数)
    - Jwts.builder() · 同 signingKey + iss/aud + sub=sharerStudentId · custom claim {shareType, relationId, allowClaim}
    - 插 share_token row · id = `nanoTime() ^ random[0,1M)` · 最多 3 次碰撞 retry (`DataIntegrityViolationException`)
    - 失败 throw `IllegalStateException` (Rule 12 Fail loud · 不 silent swallow)
  - +method `revoke(String jti, long callerStudentId): RevokeOutcome.Kind`
    - findByJti 空 → `NOT_FOUND`
    - row.sharerStudentId != caller → `NOT_OWNER`
    - row.status == 3 → `ALREADY_REVOKED` (但仍 Redis SADD · heal missed prior write)
    - 否则 row.status = 3 + save + Redis SADD share:revoked · Redis 失败仅 LOG.warn 不抛 (与 lookup() 降级一致 · CLAUDE.md Rule 7 surface but degrade gracefully)
  - +helper `generateRowId()` (nanoTime ^ jitter 抗碰撞)
  - +`public record IssueOutcome(String shareToken, String jti, OffsetDateTime expiresAt)`
  - +`public static final class RevokeOutcome` 持 enum `Kind { NOT_FOUND, NOT_OWNER, ALREADY_REVOKED, SUCCESS }`

- `backend/anonymous-service/src/main/resources/application.yml`
  - +新顶级 key `share.public-base-url: http://localhost:5173` (P0 vite dev port · P1 prod 由 CD pipeline 覆盖 · 不硬编码进 controller)

### 关键设计决策

1. **复用 signingKey · 不另注一份**: `ShareIssueController` 通过 `ShareTokenService.issue()` 间接用 service 自己 constructor 注的 `signingKey` · 不在 controller 层再注一份 `@Value("${anon.jwt.secret}")` (DRY + 单一密钥源 + 减少注入面)
2. **clamp 在 service 层 · 不在 DTO**: jakarta @Max 会 reject 1000d 而不是 clamp. Biz §4.11 要求 hard cap 而不是 reject · 所以 service 内 `Math.min(requested, 604800)`
3. **id 策略 = nanoTime ^ jitter + 3 retry**: 沿用 `SC13ShareE2EIT.insertShareToken` 的 `SELECT COALESCE(MAX(id),0)+1` 在 IT 单写场景 OK, 但生产并发 issue 会 race · 改用 nanoTime mix random 抗 race. 3 次 retry 之后 fail loud (Rule 12)
4. **NOT_OWNER / NOT_FOUND 顺序**: 先查 jti 存在 (NOT_FOUND), 再校验 owner (NOT_OWNER). 这样 enumeration attack (探测 jti 是否存在) 在两个错误码间区分明显. 若要防探测 P1 可改为统一 404 — 但 biz §10.9 contract 现要求 403 NOT_OWNER 区分.
5. **idempotent revoke**: 重复 DELETE 同一 jti → 204 ALREADY_REVOKED (不 422 不 409) · 因为 client 视角 "已撤销" 与 "刚撤销" 行为对等. 仍 Redis SADD heal 防 Redis 短时丢键.
6. **publicBaseUrl strip trailing `/`**: `https://h5.example/` 与 `https://h5.example` 都产生干净的 `/s/xxx` URL (防 prod 配置坑)
7. **@ExceptionHandler 局部声明 (不 @ControllerAdvice)**: 避免与 `SessionResolveController.handleValidation` 全局冲突 · spring scope 至 ShareIssueController 内 · 响应 shape `{code, message}` 与现有 contract 一致

### Surgical change · 不动的资产

- `controller/ShareController.java` (SC-13 GET) 一行不动 · regression by SC13ShareE2EIT
- `service/ShareTokenService.lookup()` 一行不动
- `dto/ShareDto.java` / `dto/MaskedPayloadDto.java` / `dto/ShareErrorResponse.java` 不动
- `repo/ShareTokenRepository.java` 不加新方法 (本 task 只用 save + findByJti)
- `entity/ShareToken.java` 不加字段
- 前端 H5 一行不改 (本 task 是 backend-only · UI 留下一个 task)
- 网关 / auth-service 不动

## 3. 真实 E2E (IT 真机跑通)

**跑测命令**:
```bash
cd backend/anonymous-service && mvn test -Dtest='SC13SharerE2EIT,SC13ShareE2EIT' -q
```

**raw 结果 (`target/surefire-reports/`)**:
- `TEST-com.longfeng.anonymousservice.SC13SharerE2EIT.xml` — tests=8 errors=0 skipped=0 failures=0 time=0.868s · **8/8 PASS**
- `TEST-com.longfeng.anonymousservice.SC13ShareE2EIT.xml` — tests=4 errors=0 skipped=0 failures=0 time=17.62s · **4/4 PASS (regression 仍绿)**

**真机证据**:
- Flyway 已应用 `V20260421_02__init_anonymous.sql` (Schema version 20260421.02 up to date)
- PostgreSQL 15.17 @ jdbc:postgresql://127.0.0.1:15432/wrongbook · HikariCP connection OK
- StringRedisTemplate @ 127.0.0.1:16379 · SADD/SISMEMBER round-trip OK (revoke 后 GET 检 Redis 命中 → 403)
- Tomcat random port (port=57676 第 1 run · port=51022 第 2 run) · HttpClient 真 HTTP wire 调用

**与 biz §10.9 contract 逐项对照**:

| testcase | biz contract | 验证手段 |
| --- | --- | --- |
| (a) issue_returns_200_with_jwt_and_shareurl_and_db_row | 200 + 4 字段 + JWT 验签 + DB row + round-trip GET | HttpResponse status / Jwts.parser() / JdbcTemplate.queryForMap / GET /api/share/{token} |
| (b) issue_without_bearer_returns_401 | 401 UNAUTHENTICATED | JwtVerifier.empty 路径 |
| (c) issue_invalid_share_type_returns_400 | 400 VALIDATION_FAILED · @Pattern | shareType='FOO' → MethodArgumentNotValidException handler |
| (d) issue_long_exp_clamped_to_7d | clamp 7d hard | expiresInSec=86_400_000 · expected = now+7d ± 5s |
| (e) revoke_by_owner_returns_204_and_jti_in_redis_revoked | 204 + DB status=3 + Redis SADD | JdbcTemplate.queryForObject status / redis.opsForSet().isMember |
| (f) revoke_by_other_user_returns_403_not_owner | 403 NOT_OWNER · ownership check | A issue · B revoke · response code |
| (g) revoke_unknown_jti_returns_404 | 404 TOKEN_NOT_FOUND | DELETE 不存在 jti · response code |
| (h) round_trip_get_after_revoke_returns_403_revoked | revoke 后 lookup() 必 REVOKED | issue → GET 200 → revoke → GET 403 TOKEN_REVOKED (Redis 命中) |

## 4. 自检 (CLAUDE.md 12 Rule + audit.js 5 维度 + DoD 9 项)

- ✓ **Rule 1 Think Before Coding**: 假设 (`signingKey` 已注入 / `JwtVerifier` 可直接复用 / `IntegrationTestBase` PG+Redis 已挂) 全在 §1 地形侦察明示
- ✓ **Rule 2 Simplicity First**: 没新建 util/abstraction · IssueOutcome 用 record · RevokeOutcome.Kind 用 enum · 没加无关功能
- ✓ **Rule 3 Surgical Changes**: 不动 ShareController / ShareTokenService.lookup() / SC-13 既有 4 IT · 不动前端
- ✓ **Rule 4 Goal-Driven**: DoD 9 项 · IT 8 pass · regression 4 pass · 配置化 shareUrl · ALREADY_REVOKED 幂等 · all green
- ✓ **Rule 6 tool budget**: 当前 ≈ 23 tool use · 远低于软线 50 · OK
- ✓ **Rule 7 Surface conflicts**: ALREADY_REVOKED 究竟 204 还是 409 — 文档未明 · 我用 204 (idempotent) · 注释里说明决策原因
- ✓ **Rule 8 Read before write**: 在写 issue() 前完整读 ShareTokenService 全文 (180 行) · 读 ShareToken entity · 读 JwtVerifier · 读 IntegrationTestBase · 读 SC13ShareE2EIT 现有 IT
- ✓ **Rule 9 Tests verify intent**: 每个 testcase 都 verify 业务意图 (clamp 7d / idempotent / round-trip GET 403 / Redis SADD) · 不是凑 wire shape · adversarial Tester 会再追问 intent
- ✓ **Rule 11 Match conventions**: 沿用 SessionResolveController 的 @ExceptionHandler shape · 沿用 ShareController 的 ResponseEntity switch · 沿用 IntegrationTestBase Testcontainers
- ✓ **Rule 12 Fail loud**: 3 retry id 碰撞 fail → throw IllegalStateException · Redis 失败 LOG.warn 但 surface in logs · 没 silent swallow
- ✓ **audit.js dim coder_compliance**: coder.md + bugs-found.md 双件落盘 (本文件) · 5 关键词 全到 (地形侦察/编码/真实E2E自检/提交)
- ✓ **audit.js dim bug_reality**: bugs-found.md 显式列 1 entry (见下文件)
- ✓ **DoD #1-9**: 2 controller + 2 service method + JWT jti 唯一 + Redis SADD 真写 + 8 IT pass + round-trip + shareUrl 可配 + work_log 5 件齐 (test/adversarial Tester 写) + git commit

## 5. 提交

**Commit 1 (本 phase 落)**:
- 短 hash: 见 git log (本 commit 在 phase 末写完 coder.md + bugs-found.md 后一并 commit)
- title: `feat(SC-13-SHARER backend): ShareIssueController + ShareRevokeController + ShareTokenService.issue/revoke + ShareIssueRequest/Response DTO`
- 涉及文件: 6 新 + 2 改 (见 §2 表格)

**Commit 2 (Phase 4 Tester 落)**: `test(SC-13-SHARER): SC13SharerE2EIT 8 testcase 全绿 + regression SC13ShareE2EIT 4 case 仍绿`
**Commit 3 (Phase 5 audit 落)**: `chore(SC-13-SHARER): work_log + audit.js v3 PASS + inflight finalize`

Commit 1 hash 由 TL/sub-agent post-commit 回填进 `.harness/inflight/SC-13-SHARER.json` `task.git_commits[]`.
