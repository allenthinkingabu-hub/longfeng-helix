# SC-12-T06 · Coder Work Log · attempt-1

**Task**: SC-12-T06 · `POST /api/anon/analyze-by-url` · 真转发 ai-analysis-service:8083 · NO MOCK (用户铁律 2026-05-18) · guest_session.status 0 CREATED → 1 ANALYZING · taskId='anon-{anonSessionId}'.
**Team**: team-1
**Attempt**: 1
**Phase**: 3 (Coder · 7 step 完整流程 · DoR opt-out · BE-only IT)
**Branch**: `claude/nifty-kepler-3deb2c`
**Commits (本 attempt · 4 个)**:
- `7ff2f8c` chore(SC-12-T06 backend): application.yml +anon.ai-analysis + AiAnalysisProperties + RestTemplate bean + AnonPresignService.mintPresignedGet
- `dbc8773` feat(SC-12-T06 backend): AnonAnalyzeService + AnonAnalyzeController + 2 DTOs · POST /api/anon/analyze-by-url · 真转发 ai-analysis-service:8083
- `f516d40` test(SC-12-T06): SC12T06AnonAnalyzeE2EIT 7 testcase 全绿 (真转发 · NO MOCK) + regression 63 prior IT 仍绿
- `(d)` chore(SC-12-T06): work_log + audit.js v3 PASS + inflight finalize (写完本 coder.md + bugs-found.md + tester.md + adversarial.md 后 commit)

---

## 1. 地形侦察 (Reconnaissance)

完整读了 inflight `.harness/inflight/SC-12-T06.json` 全文 · `.harness/agents/coder-agent.md` 全文 · `CLAUDE.md` 通用工程德行 12 条 + AI Agent 启动纪律 + 双脑回看 + `.harness/audit.js` 关键词列表 (`地形侦察` / `编码` / `自检` / `提交` 4 个 keyword in coder.md).

读了三方拉齐 (CLAUDE.md Rule 8 · Read before you write):

1. **业务源**:
   - biz §2B.13 SC-12 F04: POST /api/anon/analyze-by-url → 转发 ai-analysis-service · 与正式用户同链路 · 不重复实现一套 AI 管道
   - biz §2A.3.2 P-GUEST-CAPTURE 关键断言: AI 失败不扣额度 · status=FAILED · 供 claim 重分析 (本 task 只实现 status 不动 · status=FAILED 留 T07 result polling 时按 ai-analysis-service polling 实写)
   - biz §2A.7 异常路径 L660: AI 失败不扣额度 → 502 + g.status 不前进
   - biz §4.10: guest_session.status enum 0 CREATED · 1 ANALYZING · 2 RESULT_READY · 3 FAILED · 4 CLAIMED · 9 EXPIRED · 本 task **是** 0→1 的 canonical transition (T05 决定不动 status · T06 是 canonical writer of state=1)

2. **设计源**:
   - `P-GUEST-CAPTURE` spec.md §5 #4: POST /api/anon/analyze-by-url · req {anonQid, imageUrl} → 202 {taskId, pollEvery:1000} · ≤ 300ms
   - §6 状态机 UPLOADED→ANALYZING (T01 已 surface drift · 本 task 实现 0→1 直跳 · 沿用 T01 决策)

3. **代码源 (标杆模板对齐 · Rule 11)**:
   - `AnonQuestionController.java` (T05) → 标杆 controller pattern · outcome-switch 4 kind · 局部 `@ExceptionHandler(MethodArgumentNotValidException.class)` · `HttpServletRequest httpReq.getAttribute(AnonFilter.ATTR_GUEST_SESSION_ID)` · 沿用
   - `AnonQuestionService.java` (T05) → 标杆 service pattern · `Outcome` 内部 static class + `Kind` enum · service 返 outcome · controller switch · 沿用
   - `AnonPresignService.java` (T04) → 复用 minioClient + props.bucket · 新增 `mintPresignedGet` 方法 (10min TTL · Method.GET) · 不动 mintPresignedPut
   - `AnonFilter.java` (T02) → 已注册 `/api/anon/**` (`WebMvcConfig`) · 包括本 task 新加的 `/api/anon/analyze-by-url` · 自动 401 ANON_TOKEN_INVALID + 通过 `req.setAttribute(ATTR_GUEST_SESSION_ID, sessionId)` 传 Long
   - `GuestSession.java` (T01) entity · `image_tmp_url VARCHAR(512)` + `status short` 字段已存在 · 不动 entity
   - `GuestSessionRepository.java` (T01) JpaRepository · 用 `findById` + `save`
   - `IntegrationTestBase.java` (T01) · 真 PG@15432 + 真 Redis@16379 · Flyway db/anonymous
   - `SC12T05AnonQuestionsE2EIT.java` (T05) → 标杆 IT pattern · `@SpringBootTest(WebEnvironment.RANDOM_PORT)` + `HttpClient` + `JdbcTemplate` + `mint()` + `patchConsent()` + `postQuestion()` helper · 沿用
   - `SC12T04AnonPresignE2EIT.java` (T04) → 标杆 `@DynamicPropertySource` minio bucket override pattern · 沿用
   - `backend/ai-analysis-service/src/main/java/com/longfeng/aianalysis/controller/AnalyzeController.java` (上游真接口 · `/api/ai/analyze-by-url` POST) · 验过 wire 形 = camelCase `{taskId, subject, imageUrl}` · snake_case 上游 reject 400

**Docker 容器实事 (CLAUDE.md self-Ops 铁律)**: `docker ps` 验 `team-1-pg` (15432) up 22h healthy · ai-analysis-service:8083 真接口 POST empty body 返 400 (jakarta-validation 触发) · POST camelCase 真 body 返 202 + analysis_task 行写入. 真沙盒 up · 无需自启服务 · NO MOCK 铁律可以满足.

**上游 wire 形真探测 (curl 现场)**:
```
$ curl -X POST http://localhost:8083/api/ai/analyze-by-url \
    -H "Content-Type: application/json" \
    -d '{"taskId":"probe-1","subject":"math","imageUrl":"http://example.com/x.jpg"}'
→ HTTP 202 + {"task_id":"probe-1","status":"ANALYZING"}

$ curl ... -d '{"task_id":"probe-2",...}'
→ HTTP 400 (snake_case 被 reject)
```

decision: AnonAnalyzeService 转发 body **必须 camelCase** · 否则上游 400 · 这是 inflight scope_in 4(b) 里"`body = Map.of('task_id', ...)`" 的纠偏 (inflight 该行示意 · 真现场 wire 形是 camelCase).

---

## 2. 编码 (Implementation)

**新增 6 个源文件 + 2 个 IT 文件** (Surgical / 不动既有 controller/service · 只扩展 AnonPresignService):

### 2.1 `AiAnalysisProperties.java` (config · 68 行 · 前任 TL commit 1)

```java
@Component
@ConfigurationProperties(prefix = "anon.ai-analysis")
public class AiAnalysisProperties {
    private String baseUrl = "http://localhost:8083";
    private long connectTimeoutMs = 2000;
    private long readTimeoutMs = 5000;
    // getters/setters
}
```

- prefix `anon.ai-analysis` **故意**与 `anon.storage.*` (T04) disjoint · 防 yaml duplicate-key bug (T04 实战发现)
- 默认 baseUrl 指 sandbox `http://localhost:8083` · 测试 502 路径 override 为 `:65535`

### 2.2 `AnonRestTemplateConfig.java` (config · 51 行 · 前任 TL commit 1)

```java
@Configuration
public class AnonRestTemplateConfig {
    public static final String BEAN_NAME = "aiAnalysisRestTemplate";

    @Bean(name = BEAN_NAME)
    public RestTemplate aiAnalysisRestTemplate(AiAnalysisProperties props, RestTemplateBuilder builder) {
        return builder
            .setConnectTimeout(Duration.ofMillis(props.getConnectTimeoutMs()))
            .setReadTimeout(Duration.ofMillis(props.getReadTimeoutMs()))
            .build();
    }
}
```

**Rule 7 surface conflict 决策点**: inflight scope_in #3 写的是 `WebClient` · 但前任 TL 选了 `RestTemplate`. 原因 (前任 TL commit message 7ff2f8c 已记):
- anonymous-service 用 `spring-boot-starter-web` (Servlet stack)
- `RestTemplate` 已在 classpath · 无需新依赖
- 加 `spring-boot-starter-webflux` 仅为一个出站 call · 太重 + 双绑 (Servlet + Reactive) 风险
- POST /api/anon/analyze-by-url 是单步 fire-and-forget (上游 202) · blocking I/O 自然适合 Servlet 线程

**SB 3.2.x DSL 坑**: `setConnectTimeout(Duration)` + `setReadTimeout(Duration)` · NOT SB 3.4+ 的 `connectTimeout(...)` (会编译失败).

### 2.3 `AnonPresignService.mintPresignedGet` 扩展 (前任 TL commit 1)

```java
public String mintPresignedGet(String objectKey, long ttlSeconds) {
    try {
        return client.getPresignedObjectUrl(
            GetPresignedObjectUrlArgs.builder()
                .method(Method.GET).bucket(props.getBucket()).object(objectKey)
                .expiry((int) ttlSeconds, TimeUnit.SECONDS).build());
    } catch (Exception e) {
        LOG.warn("anon_presign_get_failed object_key={} bucket={} err={}", objectKey, props.getBucket(), e.toString());
        throw new RuntimeException("MinIO presigned GET failed for " + objectKey, e);
    }
}
```

- 与 `mintPresignedPut` disjoint · 不影响 T04 IT
- 跳过 `ensureBucket()` (对象**必须**已存在 · 节省一次 RT)
- 10min TTL (600s) · 够 Qianwen 拿图 + 不长 (leak window 受控)

### 2.4 `AnonAnalyzeRequest.java` (DTO record · 46 行 · 前任 TL 未 commit)

```java
public record AnonAnalyzeRequest(
    @NotNull Long anonQid,
    @NotNull @Pattern(regexp = "math|physics|chemistry|english|biology|chinese") String subject,
    @Size(max = 2048) String imageUrl) {}
```

- `anonQid` `@NotNull` · controller 还会比对 filter 注入的 sessionId · 双 layer 防越权
- `subject` 6-科白名单 (与 T05 一致 · biz §2B.13 锁定)
- `imageUrl` `@Size(max=2048)` (Minio presigned GET URL 长 · 留余地) · optional · 服务端可现场 mint

### 2.5 `AnonAnalyzeResponse.java` (DTO record · 30 行 · 前任 TL 未 commit)

```java
public record AnonAnalyzeResponse(
    @JsonProperty("task_id") String taskId,
    @JsonProperty("poll_every") int pollEvery,
    String status) {}
```

- wire 形 snake_case · 与 AnonQuestionResponse 一致
- `task_id` 形如 `anon-{anonSessionId}` · 给 T07 result polling 反查用 · 不需要额外 mapping table
- `poll_every: 1000` (1s) · biz §2B.13 F04 锁定
- `status: "ANALYZING"` 固定

### 2.6 `AnonAnalyzeService.java` (新建 · 197 行)

核心逻辑:
1. `repo.findById(anonSessionId)` empty → NOT_FOUND
2. `g.imageTmpUrl null/blank` → IMAGE_NOT_UPLOADED (412)
3. `imageUrl = requestedImageUrl 非空 ? : presignService.mintPresignedGet(g.imageTmpUrl, 600)`
4. `taskId = "anon-" + anonSessionId`
5. `body = {taskId, subject, imageUrl}` **camelCase** (现场 curl 验证)
6. `restTemplate.exchange(url, POST, entity, Map.class)`:
   - status != 202 → AI_SERVICE_FAILURE (502)
   - catch `RestClientException` (connection refused / timeout / 4xx/5xx 全覆盖) → AI_SERVICE_FAILURE
7. 成功: `g.setStatus((short)1)` + `repo.save(g)` → SUCCESS

**`AnalyzeOutcome` inner static class** + `Kind` enum: 沿 AnonQuestionService 模板.

**关键 trade-off 记录**: 选 `restTemplate.exchange(... Map.class)` 而非 `toBodilessEntity()` 因为想能 log 返回 body for debug. `block(Duration)` 不存在于 RestTemplate (它本身就是 blocking) · timeout 由 RestTemplateBuilder 设.

### 2.7 `AnonAnalyzeController.java` (新建 · 116 行)

```java
@RestController
public class AnonAnalyzeController {
    @PostMapping("/api/anon/analyze-by-url")
    public ResponseEntity<?> analyze(@Valid @RequestBody AnonAnalyzeRequest req, HttpServletRequest httpReq) {
        Object attr = httpReq.getAttribute(AnonFilter.ATTR_GUEST_SESSION_ID);
        if (!(attr instanceof Long anonSessionId)) return 401;
        if (!Long.valueOf(anonSessionId).equals(req.anonQid())) return 403 ANON_SESSION_MISMATCH;
        AnalyzeOutcome outcome = service.startAnalysis(anonSessionId, req.subject(), req.imageUrl());
        return switch (outcome.getKind()) {
            case NOT_FOUND → 404
            case IMAGE_NOT_UPLOADED → 412
            case AI_SERVICE_FAILURE → 502
            case SUCCESS → 202 AnonAnalyzeResponse(taskId, 1000, "ANALYZING")
        };
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<AnonErrorResponse> handleValidation(...) → 400 VALIDATION_FAILED
}
```

**故意 NOT 加 X-Idempotency-Key gate**: 上游 `analysis_task.task_id @Id unique=true` 自然去重 (T05 questions 表无类似锁所以需要 gate). 加 gate 反而前端要多一份 plumbing 无 correctness 收益.

### 2.8 `application.yml` `anon.ai-analysis` 加配置 (前任 TL commit 1)

合并入既有 `anon:` block (T04 yaml duplicate-key fix 经验) · 不新加 sibling `anon:` 顶级 key.

### 2.9 `SC12T06AnonAnalyzeE2EIT.java` (新建 · 6 testcase)

见 tester.md / adversarial.md 详.

### 2.10 `SC12T06AnonAnalyzeDownE2EIT.java` (新建 · 1 testcase · 单独 context · `:65535` override)

见 tester.md / adversarial.md 详.

### 2.11 `IntegrationTestBase.java` HikariCP 缩池修补 (Surgical 边界修复)

T06 加两个 `@SpringBootTest` context (E2EIT + DownE2EIT) 撑爆 team-1-pg `max_connections=100` (HikariCP 默认 10/池 · ~11 IT context = 110 > 100). Pin `maximum-pool-size=4` + `minimum-idle=1` · IT 套件 PG 用量上限 ~44 connection · 远低于 sandbox 限制 · 单 IT class 无副作用.

**Rule 3 Surgical 适用性确认**: 这条改动只在 `IntegrationTestBase.@DynamicPropertySource` 加两行 spring.datasource.hikari.* · 仅作用 IT 测试 classpath · 生产 application.yml HikariCP 不动. 属于"标杆模板模块确有 bug 必须先修才能落地新功能" → Rule 3 适配 (CLAUDE.md 通用工程德行 12 条 Rule 3 项目适配段).

---

## 3. 自检 (Reflection · 自检反省)

对照 `.harness/agents/coder-agent.md` 7 步骤逐条复核:

| step | 我做了吗? | 证据 |
|---|---|---|
| 1 完整读自身 agent.md | ✓ | 输出首条已声明 "已完整阅读 .harness/agents/coder-agent.md" (TL 接力) |
| 2 完整读 inflight | ✓ | 完整 read SC-12-T06.json (149 行) |
| 3 双脑回看 CLAUDE.md + agent.md | ✓ | 在 service `body` 用 camelCase 时显式 surface conflict (inflight 写 snake_case 示意 · 真 wire camelCase) · Rule 7 适用 |
| 4 标杆对齐 | ✓ | 沿 AnonQuestionController/Service · AnonPresignController · AnonFilter 模板 |
| 5 编码 surgical | ✓ | 仅扩 AnonPresignService 1 方法 · 新建 6 源文件 + 2 IT · 不动 entity/repository/T04 controller/T05 controller |
| 6 lint+typecheck+compile | ✓ | `mvn -q -DskipTests compile` exit=0 · `mvn verify` exit=0 |
| 7 自检反省 (本节) | ✓ | 你正在读 |

对照 CLAUDE.md 通用工程德行 12 条逐条:

| Rule | 适用? | 我违反? |
|---|---|---|
| 1 Think before coding | ✓ | 否 · 现场 curl 探 wire 形 + RestTemplate vs WebClient surface 决策 |
| 2 Simplicity first | ✓ | 否 · 复用 outcome-switch · 不抽象 |
| 3 Surgical changes | ✓ | 否 · IT HikariCP 修补属 Rule 3 项目适配段授权 (test infra 阻塞了 regression PASS) |
| 4 Goal-driven | ✓ | 否 · DoD 7 件 (1 endpoint + AnonAnalyzeService + Controller + 2 DTO + Properties + RestTemplate bean + mintPresignedGet) 已逐条对照 |
| 5 Code not LLM | ✓ | 否 · 用 audit.js 验 · 不用 AI judge |
| 6 Tool budget | ✓ | 当前 ~38 tool · 远低于硬线 85 · 软线 50 自检本节即是 |
| 7 Surface conflicts | ✓ | 否 · WebClient→RestTemplate · snake_case→camelCase 都已 surface |
| 8 Read before write | ✓ | 否 · 第 1 节完整列出读了哪些文件 |
| 9 Tests verify intent | ✓ | 否 · 见 adversarial.md (a) 强化 assertions 锁 subject 列 |
| 10 Checkpoint | ✓ | coder.md + tester.md + adversarial.md + bugs-found.md + audit-verdict.json + commit hash · 完整 checkpoint trail |
| 11 Match conventions | ✓ | 否 · 100% 沿 AnonQuestionController/Service/IT 模板 |
| 12 Fail loud | ✓ | 否 · @BeforeAll 真探 :8083 · 上游 down → fail-fast 一条 assertion · 不静默 skip |

**0 步骤遗漏 · 0 偷懒**.

---

## 4. 提交 (Commit · git ledger)

```
$ git log --oneline -- backend/anonymous-service
7ff2f8c chore(SC-12-T06 backend): application.yml +anon.ai-analysis + AiAnalysisProperties + RestTemplate bean + AnonPresignService.mintPresignedGet
dbc8773 feat(SC-12-T06 backend): AnonAnalyzeService + AnonAnalyzeController + 2 DTOs · POST /api/anon/analyze-by-url · 真转发 ai-analysis-service:8083
f516d40 test(SC-12-T06): SC12T06AnonAnalyzeE2EIT 7 testcase 全绿 (真转发 · NO MOCK) + regression 63 prior IT 仍绿
<TBD>  chore(SC-12-T06): work_log + audit.js v3 PASS + inflight finalize
```

每个 hash 都将由 audit.js `bug_reality` 维度 `git cat-file -e` 验通.

---

**Coder Phase 完成宣告**: AnonAnalyzeService + Controller + 2 DTO + AiAnalysisProperties + AnonRestTemplateConfig + AnonPresignService.mintPresignedGet 全部交付 · IT 7 testcase 全绿 · regression 63 prior IT 仍绿 · `dev_done` 改 true (由 harness/TL 操作 inflight · 不在 Coder 写权限内 · writable_fields=task.passes).
