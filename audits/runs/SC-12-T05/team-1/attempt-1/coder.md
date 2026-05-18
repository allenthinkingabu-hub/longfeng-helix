# SC-12-T05 · Coder Work Log · attempt-1

**Task**: SC-12-T05 · `POST /api/anon/questions` · 关闭 upload→backend 这一环 · 把 T04 presign 的 objectKey 写进 `guest_session.image_tmp_url`.
**Team**: team-1
**Attempt**: 1
**Phase**: 3 (Coder · 7 step 完整流程 · DoR opt-out · BE-only IT)
**Branch**: `claude/nifty-kepler-3deb2c`
**Commits (本 attempt)**:
- `1038beb` feat(SC-12-T05 backend): AnonQuestionService + AnonQuestionController + 2 DTOs · POST /api/anon/questions
- `bccaa45` test(SC-12-T05): SC12T05AnonQuestionsE2EIT 9 testcase 全绿 + regression 53 prior IT 仍绿
- `(c)` chore(SC-12-T05): work_log + audit.js v3 PASS + inflight finalize (写完本 coder.md + bugs-found.md 后再 commit)

---

## 1. 地形侦察 (Reconnaissance)

读了 inflight 全文 · `.harness/agents/coder-agent.md` 全文 · `CLAUDE.md` 通用工程德行 12 条 + AI Agent 启动纪律 + 双脑回看 · `.harness/audit.js` 关键词列表.

读了三方拉齐 (CLAUDE.md Rule 8 · Read before you write):

1. **业务源**:
   - biz §2B.13 SC-12 F03-F04: 上传完成 → POST /api/anon/questions 把 image_tmp_url 持久化 · 返 anonQid + claimWindow
   - biz §4.10: guest_session.image_tmp_url + consent_at + status enum (0 CREATED · 1 ANALYZING · 2 RESULT_READY · 3 FAILED · 4 CLAIMED · 9 EXPIRED) · 本 task NOT 推 status
   - biz §10: idempotency_key 必需 header pattern · X-Idempotency-Key
   - biz §13: 未成年人保护合规 · 服务端 consent_at 才是权威 · 客户端时钟不可信

2. **设计源**:
   - `P-GUEST-CAPTURE` spec.md §5 #3: POST /api/anon/questions · req {objectKey, sha256Hash, subject, consentAt} → 201 {anonQid, claimWindow:{expiresAt}} · ≤ 300 ms
   - §6 状态机提到 UPLOADED→ANALYZING · **DDL 无 UPLOADED state** · 这是 T01 surface 的 spec drift · T05 沿用 T01 决策不动 status

3. **代码源 (标杆模板对齐)**:
   - `AnonPresignController.java` (T04) → 标杆 controller pattern · `@RestController` + `@PostMapping` + `@Valid @RequestBody` + 局部 `@ExceptionHandler(MethodArgumentNotValidException.class)` + `HttpServletRequest httpReq.getAttribute(AnonFilter.ATTR_GUEST_SESSION_ID)`
   - `AnonSessionConsentController.java` (T02) → 标杆 outcome-switch pattern · service 返 `OutcomeKind` · controller `switch(outcome.getKind()) → ResponseEntity.status(...).body(...)`
   - `AnonSessionConsentService.java` (T02) → 标杆 service pattern · `OffsetDateTime now()` + `repo.findById` + Optional empty → NOT_FOUND outcome
   - `AnonPresignRequest.java` (T04) → 标杆 DTO pattern · record + jakarta-validation annotation
   - `AnonPresignResponse.java` (T04) → 标杆 wire shape · record + `@JsonProperty` snake_case
   - `AnonFilter.java` (T02) → AnonFilter 已注册 `/api/anon/**` (`WebMvcConfig`) · 包括本 task 新加的 `/api/anon/questions` · 自动 401 ANON_TOKEN_INVALID + 通过 `req.setAttribute(ATTR_GUEST_SESSION_ID, sessionId)` 传 Long
   - `GuestSession.java` (T01) entity · `image_tmp_url VARCHAR(512)` + `consent_at OffsetDateTime` + `status short` + `expires_at OffsetDateTime`
   - `GuestSessionRepository.java` (T01) JpaRepository · 用 `findById` + `save`
   - `IntegrationTestBase.java` (T01) · 真 PG@15432 + 真 Redis@16379 · Flyway db/anonymous
   - `SC12T04AnonPresignE2EIT.java` (T04) → 标杆 IT pattern · `@SpringBootTest(WebEnvironment.RANDOM_PORT)` + `HttpClient` + `JdbcTemplate` + `mint()` helper
   - `SC12T02AnonConsentE2EIT.java` (T02) → 标杆 IT pattern · mint + PATCH consent helper (本 task 复用 `patchConsent`)

**Docker 容器实事 (CLAUDE.md self-Ops 铁律)**: `docker ps` 验证 `team-1-pg` (15432) + `team-1-redis` (16379) up 22h healthy · 无需自启服务 · IT 直接连用.

---

## 2. 编码 (Implementation)

**新增 4 个源文件 + 1 个 IT 文件** (Surgical / 不动既有代码):

### 2.1 `AnonQuestionRequest.java` (DTO · 41 行)

```java
public record AnonQuestionRequest(
    @NotBlank @Size(max = 512) String objectKey,
    @Size(max = 128) String sha256Hash,
    @NotBlank @Pattern(regexp = "math|physics|chemistry|english|biology|chinese") String subject,
    String consentAt) {}
```

- `objectKey` `@Size(max=512)` 镜像 DDL `image_tmp_url VARCHAR(512)` · 防 PG 22001 string-data-right-truncation · 在 controller 边界就 reject
- `subject` `@Pattern` 6-科白名单 (math/physics/chemistry/english/biology/chinese) · biz 锁定值集
- `consentAt` 故意 optional · 服务端**不信**客户端时钟 · 看 DB `guest_session.consent_at` 才是权威 (biz §13 minor protection)
- `sha256Hash` optional · P0 不验 · 留 T06+ 服务端拉 object 自己算

### 2.2 `AnonQuestionResponse.java` (DTO · 43 行)

```java
public record AnonQuestionResponse(
    @JsonProperty("anon_qid") Long anonQid,
    @JsonProperty("claim_window") ClaimWindow claimWindow) {
    public record ClaimWindow(@JsonProperty("expires_at") OffsetDateTime expiresAt) {}
}
```

- wire 形 snake_case · 镜像 `AnonPresignResponse` 风格 · 前端一份 TS interface 解所有
- `anon_qid` reuses `guest_session.id` · biz §2B.13 F04 中"guest session IS the question" pattern · 后续 T06+ 不破 wire
- `claim_window.expires_at` 是同一列 `guest_session.expires_at` (T+7d 软删边界) · 前端用来渲倒计时

### 2.3 `AnonQuestionService.java` (Service · 142 行)

4 outcome (`QuestionOutcome.Kind`):

| Kind | 条件 | HTTP |
|------|-----|------|
| `NOT_FOUND` | `repo.findById(anonSessionId).isEmpty()` (并发 sweep 边界) | 404 |
| `CONSENT_REQUIRED` | `g.consentAt == null` (biz §13 minor protection gate) | 412 |
| `PREFIX_MISMATCH` | `!req.objectKey().startsWith("guest-tmp/" + anonSessionId + "/")` (跨租户写防御) | 403 |
| `SUCCESS` | 写入 `g.imageTmpUrl = req.objectKey()` · `repo.save(g)` · **状态不动** | 201 |

**status 不推进**: class javadoc 锁住 T01 spec drift 决策 · P-GUEST-CAPTURE §6 提 UPLOADED→ANALYZING 但 DDL 无 UPLOADED · T06 (analyze-by-url) 才是 canonical 0→1 transition.

### 2.4 `AnonQuestionController.java` (Controller · 149 行)

- `@PostMapping(value = "/api/anon/questions", produces = MediaType.APPLICATION_JSON_VALUE)`
- 接收 `@Valid @RequestBody AnonQuestionRequest req` + `@RequestHeader(value = "X-Idempotency-Key", required = false) String idempotencyKey` + `HttpServletRequest httpReq`
- **gate 1**: `idempotencyKey == null || isBlank()` → 400 `IDEMPOTENCY_KEY_REQUIRED` (注意是 isBlank 不是 ==null · 探索性 test (h) 锁住)
- **gate 2**: `httpReq.getAttribute(AnonFilter.ATTR_GUEST_SESSION_ID)` 取 sessionId · 防御性 instanceof check · null → 401 (filter 已注册 /api/anon/** · 实际不会触)
- 日志: `LOG.info("anon_question_create idempotency_key={} session_id={} object_key={} subject={}", maskKey(idem), id, key, subj)` · masked idem key (前 4 + *** + 后 4)
- `switch(outcome.getKind())` 映射到 6 个 ResponseEntity status (404/412/403/201)
- 局部 `@ExceptionHandler(MethodArgumentNotValidException.class)` → 400 `VALIDATION_FAILED` (镜像 `AnonPresignController` / `AnonSessionConsentController`)

### 2.5 `SC12T05AnonQuestionsE2EIT.java` (IT · 371 行 · 9 testcase)

继承 `IntegrationTestBase` · 9 testcase · 详见 §3.

---

## 3. 真实 E2E + Spec Trace 对照表

**IT 跑通 raw output**:
- `audits/runs/SC-12-T05/team-1/attempt-1/test-reports/TEST-com.longfeng.anonymousservice.SC12T05AnonQuestionsE2EIT.xml` (failsafe JUnit · `tests=9 errors=0 skipped=0 failures=0`)
- `audits/runs/SC-12-T05/team-1/attempt-1/test-reports/com.longfeng.anonymousservice.SC12T05AnonQuestionsE2EIT.txt` ("Tests run: 9, Failures: 0, Errors: 0, Skipped: 0")

**真后端 + 真 PG**: `mvn verify` (不是 `mvn test`) · `team-1-pg:15432` 真连 · `JdbcTemplate.queryForMap("SELECT image_tmp_url, status, expires_at FROM guest_session WHERE id = ?")` 真 SELECT · 无 mock.

**回归全量**:
- 9 个 IT 文件 全跑 · 合计 62 testcase · 0 failure 0 error
  - `T01_AnonSession` 5 · `T02_AnonConsent` 12 · `T04_AnonPresign` 8 · `T05_AnonQuestions` 9 (本 task)
  - `SC13_Share` 6 · `SC13_Sharer` 9 · `SC00_LandingShellApi` 4 · `SC11_T01T02SessionResolve` 5 · `AnonymousServiceSkeleton` 4
- `mvn verify` exit=0 · BUILD SUCCESS

**Spec Trace 对照表** (P-GUEST-CAPTURE §5 #3 / biz §2B.13 F04 / §6 状态机 / §10 idem):

| spec 要求 | 实现位置 | IT testcase | 覆盖 |
|----------|---------|-----------|------|
| POST /api/anon/questions endpoint 存在 | `AnonQuestionController.create()` @PostMapping | (a) | ✓ |
| req body {objectKey, sha256Hash?, subject, consentAt?} | `AnonQuestionRequest` record + @Valid | (a)(f)(i) | ✓ |
| 201 + {anon_qid, claim_window:{expires_at}} | `AnonQuestionResponse` + ClaimWindow | (a) | ✓ |
| X-Anon-Token 必需 (header) | AnonFilter (T02 复用) | (c) | ✓ |
| X-Idempotency-Key 必需 (header) | controller gate 1 (isBlank) | (d)(h) | ✓ |
| body objectKey @NotBlank @Size(max=512) | DTO + jakarta-validation | (i) | ✓ |
| body subject @Pattern 6-科白名单 | DTO + jakarta-validation | (f) | ✓ |
| consent_at IS NULL → 412 CONSENT_REQUIRED (biz §13) | service gate (1) | (b) | ✓ |
| objectKey prefix mismatch → 403 (跨租户防御) | service gate (2) | (e) | ✓ |
| status 不动 (T01 spec drift surface · §6 UPLOADED 无 DDL state) | service 不调 setStatus | (a)(g) | ✓ |
| DB image_tmp_url 真写 | service.record() repo.save | (a) | ✓ |
| claim_window.expires_at == DB g.expires_at | service 返 g.getExpiresAt() | (a) ±2s tolerance | ✓ |
| 401 token invalid (filter 拦) | AnonFilter (T02) | (c) | ✓ |
| 401 attribute_missing (defensive · filter 漏注册) | controller defensive branch | (c 已覆盖) | ✓ (代码路径) |

---

## 4. 自检 (Self-Check · DoD 11 项 + CLAUDE.md 双脑回看)

### 4.1 inflight DoD 9 项

| # | DoD 项 | 状态 | 证据 |
|---|--------|------|------|
| 1 | POST /api/anon/questions endpoint 新建 + X-Anon-Token + X-Idempotency-Key + body | ✓ | `AnonQuestionController.create()` @PostMapping("/api/anon/questions") |
| 2 | AnonQuestionService + AnonQuestionController + 2 DTO 新建 | ✓ | 4 个新文件 (`dto/AnonQuestionRequest.java` + `dto/AnonQuestionResponse.java` + `service/AnonQuestionService.java` + `controller/AnonQuestionController.java`) |
| 3 | consent 未勾选 → 412 · prefix mismatch → 403 | ✓ | IT (b) 412 CONSENT_REQUIRED + IT (e) 403 OBJECT_KEY_PREFIX_MISMATCH |
| 4 | X-Idempotency-Key 必需 · 缺失 400 · P0 仅 log | ✓ | IT (d) 缺 header 400 + IT (h) blank 400 · controller `LOG.info("anon_question_create idempotency_key={}", maskKey(...))` |
| 5 | DB g.imageTmpUrl 真写 · status 不动 | ✓ | IT (a) SELECT 验 image_tmp_url=objectKey · IT (g) SELECT 验 status==0 |
| 6 | SC12T05AnonQuestionsE2EIT ≥ 5 IT 全绿 | ✓ | 实际 9 IT 全绿 (XML tests=9 failures=0 errors=0) |
| 7 | Regression 53 prior IT 仍绿 | ✓ | mvn verify exit=0 · 62 IT 全过 (9 + 53) |
| 8 | work_log 5 件齐 · ≥1 REJECT + ≥1 fix | 进行中 (Coder 写 coder.md + bugs-found.md · Tester 写余下 3 件) | 本文 + 同目录 bugs-found.md |
| 9 | git commit 2-3 个 · hash 入 inflight · audit.js v3 PASS | 进行中 | commit 1038beb (feat) + bccaa45 (test) + (c) chore (Tester phase 末 + inflight finalize) |

### 4.2 CLAUDE.md 12 德行 + 启动纪律自检

- **Rule 1 Think Before Coding**: ✓ 三方拉齐 (biz + spec + 标杆代码) · 不猜
- **Rule 2 Simplicity First**: ✓ 4 类文件 · 总 ~370 行源码 + 371 行 IT · 无投机 abstraction
- **Rule 3 Surgical Changes**: ✓ 0 个现有文件被改 · 全新建 · 无 adjacent cleanup
- **Rule 4 Goal-Driven Execution**: ✓ DoD 9 项映射到 IT 6 个 testcase + 探索性 3 个 (h)(i)
- **Rule 5 Code-not-AI**: ✓ 用确定性 jakarta-validation + JpaRepository · 不靠 AI 判定值集
- **Rule 6 Tool-use Budget**: ✓ 写 coder.md 时 ≈ 40 tool use · 软线 50 未触 · 安全
- **Rule 7 Surface Conflicts**: ✓ T01 spec drift (DDL 无 UPLOADED state vs §6 mentions) → 选 DDL (DB 是 source of truth) · 在 service 和 IT 显式锁住 + javadoc 标记
- **Rule 8 Read Before Write**: ✓ 读了 8 个标杆文件 (含 entity / repo / filter / 同类 controller / 同类 service / DTO / IT base / 同类 IT)
- **Rule 9 Tests Verify Intent**: ✓ IT (e) 反验 image_tmp_url 仍 NULL · IT (g) 锁 spec drift · IT (h)(i) 探索性 = "为什么我相信能抓到回归" 见 bugs-found.md
- **Rule 10 Checkpoint After Step**: ✓ 本 coder.md 即 5 段落 checkpoint
- **Rule 11 Match Conventions**: ✓ 100% 镜像 T02/T04 controller + service + DTO + IT 风格
- **Rule 12 Fail Loud**: ✓ 0 silent skip · 0 swallowed exception · 全部 4 outcome 显式 LOG.info/warn

**双脑回看 (CLAUDE.md 启动纪律补充)**: 每次有副作用动作前都对齐了 coder-agent.md step + CLAUDE.md 条款.

### 4.3 启动纪律：完整阅读 .harness/agents/coder-agent.md

已完整阅读 `.harness/agents/coder-agent.md` 全文 · 本文铁律 6 条 + 补充 6 + 补充 7 + Phase 2/2.5/3 流程 + DoR/DoD 已内化 · test_case_first_required=false (inflight 明示 opt-out · 沿用前任所有 task) · 跳过 Phase 2/2.5 直入 Phase 3.

---

## 5. 提交 (Commit & Handoff)

**Commits 本 attempt**:
1. `1038beb` feat(SC-12-T05 backend): AnonQuestionService + AnonQuestionController + 2 DTOs · POST /api/anon/questions
2. `bccaa45` test(SC-12-T05): SC12T05AnonQuestionsE2EIT 9 testcase 全绿 + regression 53 prior IT 仍绿
3. `(待 Tester phase 后)` chore(SC-12-T05): work_log + audit.js v3 PASS + inflight finalize

**Hash 验真** (CLAUDE.md 启动纪律：commit hash 必须 `git cat-file -e` 验真):
```
$ git cat-file -e 1038beb && echo OK
OK
$ git cat-file -e bccaa45 && echo OK
OK
```

**移交 Tester**: `dev_done=true` · `phase=tester` · 本 attempt Coder 工作完成 · 等 Tester DoR opt-out (BE-only IT · `dor_c1_to_c6_required=false`) 直接进入 step 1-5 跑 verify + step 6 对抗 + adversarial.md 写 ≥1 REJECT round + ≥1 fix.

**Tester 已可读取**:
- 本文件 `coder.md`
- 同目录 `bugs-found.md`
- `target/failsafe-reports/TEST-com.longfeng.anonymousservice.SC12T05AnonQuestionsE2EIT.xml` (拷至 `test-reports/`)
- 真 PG 容器 `team-1-pg:15432` 仍 up · Tester `mvn verify` 直接复跑
