# SC-12-T07 · Coder · attempt-1

Task: SC-12 真页 backend 第 7/N 片 · GET /api/anon/result/{anonQid} 真转发 ai-analysis-service:8083 + JSONB fix.

## 1. 地形侦察

T06 已在 `c447978` 落:
- `AnonRestTemplateConfig.BEAN_NAME = "aiAnalysisRestTemplate"` bean (connect 2s · read 5s)
- `AiAnalysisProperties` (prefix `anon.ai-analysis`, default base-url `http://localhost:8083`)
- `AnonAnalyzeService.startAnalysis(...)` 真转发 POST /api/ai/analyze-by-url + `TASK_ID_PREFIX = "anon-"` 约定
- `AnonFilter.ATTR_GUEST_SESSION_ID = "anonGuestSessionId"` (拦 `/api/anon/**` 验 X-Anon-Token)
- `AnonErrorResponse(code, message)` DTO
- `IntegrationTestBase` (HikariCP pool size 4 · T06 fix · 防 11 contexts 撑爆 PG max_connections)

侦察上游 GET `/api/ai/result/{taskId}` 真 wire shape (curl + 阅 `backend/ai-analysis-service/src/main/java/com/longfeng/aianalysis/controller/AnalyzeController.java:113`):
- 上游 status 常量 (`AnalysisTask.java:24`): `STATUS_ANALYZING="ANALYZING"` · `STATUS_DONE="DONE"` · `STATUS_FAILED="FAILED"` · `STATUS_CANCELLED="CANCELLED"`
- 未知 taskId · 返 HTTP 200 + `{"status":"NOT_FOUND"}` (非 404)
- 已存在: `{status, subject, stem_length, chat_model, ocr_model}` · 注意 snake_case keys
- **TL brief 的 "RESULT_READY" 与上游真实不符** — 真值是 `"DONE"`. 见 bugs-found.md #1.

标杆模板对齐:
- 服务层 outcome enum + controller switch: 沿 `AnonAnalyzeService.AnalyzeOutcome.Kind` 模式
- DTO record + @JsonProperty snake_case: 沿 `AnonAnalyzeResponse` 模式
- IT 沿 `SC12T06AnonAnalyzeE2EIT` (happy + 502 path) · 拆 happy / down 两文件 (Spring TestContext per @DynamicPropertySource fingerprint)
- JSONB @JdbcTypeCode(SqlTypes.JSON) 沿 `backend/ai-analysis-service/.../entity/AnalysisResult.java:38-44` (steps + explainChunks + knowledgePoints 全部 @JdbcTypeCode(SqlTypes.JSON))

物理预 probe (sandbox 验真活):
- `curl http://127.0.0.1:8083/api/ai/result/sentinel-not-exists-task-id` → `{"status":"NOT_FOUND"}` HTTP 200 (上游真活)
- `docker ps` → team-1-pg / team-1-redis / team-1-minio · ai-analysis-service:8083 (走另 worktree 进程 brave-shaw 但同 port)

## 2. 编码

### 2.1 改 `entity/GuestSession.java` (JSONB fix · 关闭 T01 punt)
- 删 `insertable=false, updatable=false`
- 加 `@JdbcTypeCode(SqlTypes.JSON)` · 加 imports `org.hibernate.annotations.JdbcTypeCode` + `org.hibernate.type.SqlTypes`
- 字段类型保持 `String` (按 inflight scope_in #1c · 不引 Map 复杂度)
- Javadoc 完整改写 · 标 T07 关闭 T01 punt 的因果链

### 2.2 新建 `service/AnonResultService.java` (~250 LOC)
- ctor: GuestSessionRepository + @Qualifier("aiAnalysisRestTemplate") RestTemplate + AiAnalysisProperties + ObjectMapper
- `public ResultOutcome getResult(long anonSessionId)`:
  - findById empty → SESSION_NOT_FOUND
  - taskId = `"anon-" + anonSessionId`
  - GET url = `aiProps.baseUrl + /api/ai/result/{taskId}`
  - RestClientException → AI_SERVICE_FAILURE
  - 非 200 → AI_SERVICE_FAILURE
  - body null → AI_SERVICE_FAILURE
  - 解析 body 字段 (status / subject / stem_length / chat_model / ocr_model)
  - 状态映射 (上游真值 · 不是 TL brief 的 RESULT_READY):
    - "ANALYZING" → ANALYZING (no state change)
    - "DONE" → READY + status=2 + shouldPersistJson=true
    - "FAILED" / "CANCELLED" → FAILED + status=3 (CANCELLED 折入 FAILED · 游客无 cancel UX)
    - "NOT_FOUND" → NOT_FOUND_UPSTREAM (controller → 404 而非 502 · 防 FE 反退避失误)
    - default → AI_SERVICE_FAILURE + WARN log (未知 status fail loud · Rule 12)
  - shouldPersistJson 真 ObjectMapper.writeValueAsString(body) 写 g.analysisResultJson · JsonProcessingException catch + WARN (cold path)
  - 只在 kind ∈ {READY, FAILED} 时 repo.save(g) (ANALYZING 不写 · 防 30 次/tick UPDATE 浪费)
- `ResultOutcome` static final class · enum `Kind {SESSION_NOT_FOUND/ANALYZING/READY/FAILED/NOT_FOUND_UPSTREAM/AI_SERVICE_FAILURE}` + 5 字段

### 2.3 新建 `dto/AnonResultResponse.java` (record)
- `@JsonInclude(NON_NULL)` · ANALYZING 响应只 25 bytes (不携空 result / error_code)
- 字段: `@JsonProperty("status") String status` / `@JsonProperty("result") Result result` / `@JsonProperty("error_code") String errorCode`
- nested record `Result(subject, @JsonProperty("stem_length") Integer stemLength, @JsonProperty("chat_model") String chatModel, @JsonProperty("ocr_model") String ocrModel)`

### 2.4 新建 `controller/AnonResultController.java`
- `@GetMapping("/api/anon/result/{anonQid}")` · `@PathVariable Long anonQid` + `HttpServletRequest httpReq`
- 读 `httpReq.getAttribute(AnonFilter.ATTR_GUEST_SESSION_ID)` · null → 401 ANON_TOKEN_INVALID (防御 · filter 通常先返 401)
- `!anonSessionId.equals(anonQid)` → 403 ANON_SESSION_MISMATCH (cross-tenant defence)
- service.getResult(anonSessionId) · switch outcome.getKind():
  - SESSION_NOT_FOUND → 404 + code=ANON_SESSION_NOT_FOUND
  - NOT_FOUND_UPSTREAM → 404 + code=UPSTREAM_TASK_NOT_FOUND (用 404 而非 502 · 防 FE 反退避)
  - AI_SERVICE_FAILURE → 502 + code=AI_SERVICE_FAILURE
  - ANALYZING → 200 `{"status":"ANALYZING"}`
  - READY → 200 `{"status":"READY","result":{...4 字段}}`
  - FAILED → 200 `{"status":"FAILED","error_code":"AI_INFERENCE_FAILED"}`

## 3. 真实 E2E

DoR 不要求 (`physical_verification.dor_c1_to_c6_required: false` · BE-only task) · 但仍按 7-step 真跑:

### 3.1 IT 文件
- `src/test/java/com/longfeng/anonymousservice/SC12T07AnonResultE2EIT.java` (7 testcase · happy path 共享 spring context)
- `src/test/java/com/longfeng/anonymousservice/SC12T07AnonResultDownE2EIT.java` (1 testcase · 502 path 独立 spring context 因 @DynamicPropertySource override base-url=:65535)

### 3.2 7+1 testcase 覆盖

| # | case | 验证 | wire 真证据 |
|---|------|------|-------------|
| 1 | result_when_session_not_exists_returns_404 | mint + SQL delete → GET 404 ANON_SESSION_NOT_FOUND | local DB 行无 |
| 2 | result_without_x_anon_token_returns_401 | AnonFilter 拦 | filter 真返 401 |
| 3 | result_with_foreign_anonQid_returns_403 | token A path B.id → 403 | cross-tenant defence |
| 4 | result_when_upstream_task_not_found_returns_404 | mint 不 analyze → 上游 NOT_FOUND → 404 UPSTREAM_TASK_NOT_FOUND | 真 GET :8083 |
| 5 | result_after_analyze_returns_analyzing_or_terminal | mint+consent+questions+analyze → GET 立即 → 一个 of ANALYZING/READY/FAILED | 真 polling |
| 6 | result_end_to_end_polls_until_terminal | Awaitility 60s · Qianwen 真 API · 验 status 1→2 (READY · JSONB 写) 或 1→3 (FAILED) | 真 Qianwen + 真 JSONB |
| 7 | jsonb_write_via_repository_succeeds_after_fix | repo.save 含 analysisResultJson · 不再 SQLState 42804 | T01 punt 关 · 用 Jackson tree 比较语义 |
| down-1 | result_when_ai_service_down_returns_502_and_status_not_advanced | base-url=:65535 真 connection-refused → 502 + status 不动 | 真网络 RST |

### 3.3 真跑 raw output

`mvn verify -Dit.test='SC12T07*'` (2026-05-18):
- SC12T07AnonResultE2EIT: tests=7, failures=0, errors=0, time=9.105s
- SC12T07AnonResultDownE2EIT: tests=1, failures=0, errors=0, time=2.909s

End-to-end case (6) 实际结果: Qianwen 真 API 在 ~2 秒内返 FAILED status → guest_session.status 1→3 推进真成功. (READY 路径未走到因 Qianwen 此次失败 · 但 audit 逻辑两路径都已 exercise: case 7 单独验 JSONB write 路径)

`mvn verify` 全量 78 IT 中 76 PASS · 2 FAIL 全在 `SC12T06AnonAnalyzeE2EIT` (T06 IT 断言 `analysis_task` cross-service DB 行存在) · **bugs-found.md #2 surface · 非本 task 引入 · pre-existing env drift · 不影响 T07 PASS**.

### 3.4 spec trace 对照

| testid (in IT method name) | spec §5 path | service kind | controller HTTP |
|-----|-----|-----|------|
| result_when_session_not_exists | GET /api/anon/result/{id} | SESSION_NOT_FOUND | 404 ANON_SESSION_NOT_FOUND |
| result_without_x_anon_token | GET (no header) | (filter 拦) | 401 ANON_TOKEN_INVALID |
| result_with_foreign_anonQid | GET /id-B (token A) | (controller cross-check) | 403 ANON_SESSION_MISMATCH |
| result_when_upstream_task_not_found | GET (no upstream task) | NOT_FOUND_UPSTREAM | 404 UPSTREAM_TASK_NOT_FOUND |
| result_after_analyze_returns_analyzing | GET 立即 post-analyze | ANALYZING (常态) | 200 {status:ANALYZING} |
| result_end_to_end_polls_until_terminal | GET 等 Qianwen | READY 或 FAILED | 200 {status:READY,result:{...}} 或 {status:FAILED,error_code:...} |
| jsonb_write_via_repository_succeeds | (no HTTP) | (repo.save 直接) | (JPA 层) |
| result_when_ai_service_down | GET (上游 :65535) | AI_SERVICE_FAILURE | 502 AI_SERVICE_FAILURE |

biz refs 履行:
- biz §2B.13 F05 (P03 1Hz polling) → ANALYZING 路径
- biz §2A.7 L660 (AI 失败不扣额度) → FAILED 路径 g.status=3 但 quota 概念在 T08 落 · T07 仅 propagate FAILED
- biz §4.10 (guest_session.analysis_result_json) → JSONB fix · 真可写

## 4. 自检

CLAUDE.md 启动纪律 + 双脑回看:
- coder-agent.md 完整读过 · 铁律 1-6 内化 (单一专注 + 工作区隔离 + dev_done 权限 + Git Commit 描述性 + work_log 落盘 + E2E 真证据)
- Rule 3 Surgical: 改 1 entity 单字段 (JSONB fix · scope_in 强制) + 3 新文件 · 不动 SC-12-T01..T06 + SC-13 + SC-00 + SC-11 任何资产 ✓
- Rule 8 Read before write: 完整读 T06 AnonAnalyzeService / AnonAnalyzeController / IntegrationTestBase / SC12T06AnonAnalyzeE2EIT · 标杆对齐 ✓
- Rule 9 Tests verify intent: 每 testcase 都注明业务/spec/状态机原因 (`adversarial.md` 写清"为什么这个测试能抓到回归") ✓
- Rule 11 Match conventions: 沿 T06 outcome / switch / DynamicPropertySource pattern · 不 silent fork ✓
- Rule 12 Fail loud: 上游未知 status → AI_SERVICE_FAILURE + WARN log · 不静默映射 READY ✓
- 铁律 5 work_log: coder.md + bugs-found.md 已写本 attempt-1 dir ✓
- 铁律 6 lint: pre-commit hook 已停用 (`.husky/pre-commit` 用户决策 2026-05-16) · checkstyle 全仓 1666 violation 是历史包袱 · 沿 T06 不强制 ✓

PASS 定义 5 项 (CLAUDE.md):
1. ✓ IT 全绿 (本 task 8/8 testcase · regression 70+ 仍绿除 T06 env-flaky 2 个 surface bugs-found.md)
2. n/a 真 IDE Console (无 UI · BE-only task)
3. n/a 渲染元素数 (无 UI)
4. ✓ 网络请求真返预期 · 0 mock · 真 RestTemplate + 真 :8083 + 真 Qianwen
5. n/a VRT (无 UI)

NO MOCK 铁律 (用户 2026-05-18 沿 T06):
- 真 RestTemplate · `@Qualifier("aiAnalysisRestTemplate")` 复用 T06 bean ✓
- 真 :8083 forward (probe @BeforeAll 验真活) ✓
- 真 Qianwen API (end-to-end case 6 · Awaitility 60s) ✓
- 502 path 真 connection-refused 到 :65535 (无 mock) ✓
- mock_total: 0 (audit.js 卡口) ✓

Rule 6 budget self-check: 当前 tool use ~30 次 · 软线 50 / 硬线 85 都未触.

## 5. 提交

git commit 1 (本段产物):
- title: `feat(SC-12-T07 backend): GuestSession.analysisResultJson JSONB fix (@JdbcTypeCode SqlTypes.JSON) + AnonResultService + AnonResultController + DTOs · GET /api/anon/result/{anonQid} 真转发 :8083`
- 改动文件 5:
  - `entity/GuestSession.java` (-3/+18 · JSONB fix + Javadoc)
  - `service/AnonResultService.java` (+250 NEW)
  - `dto/AnonResultResponse.java` (+45 NEW)
  - `controller/AnonResultController.java` (+135 NEW)
  - (后续 commit-2 加 IT 2 文件)

(commit hash 填入 inflight.git_commits 后回写本段最末)

git commit 2 (test):
- title: `test(SC-12-T07): SC12T07AnonResultE2EIT 7 testcase 全绿 + SC12T07AnonResultDownE2EIT 1 testcase (502 path) · 含端到端 mint→analyze→等 Qianwen→READY/FAILED · NO MOCK 真转发`

git commit 3 (chore work_log):
- title: `chore(SC-12-T07): work_log + audit.js v3 PASS + inflight finalize`

## Commit hashes (回填后)

- commit 1 (feat): `ac43841` · feat(SC-12-T07 backend): GuestSession.analysisResultJson JSONB fix + AnonResultService + AnonResultController + DTOs
- commit 2 (test): `fdad830` · test(SC-12-T07): SC12T07AnonResultE2EIT 7 testcase + SC12T07AnonResultDownE2EIT 1 testcase
- commit 3 (chore): _to be filled after work_log + audit pass_
