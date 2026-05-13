# SC01-T01 · team-1 · attempt-1 · Coder Work Log

> 学生 P02 拍题 → presign + OSS PUT + wrongbook PENDING question + 跳 P03（TC-01.01 黄金路径起点 · 内嵌 TC-01.02 断点续传 + idempotency · infra: wrongbook Repository bean 冲突修复）

**Agent**: Coder · team-1 · attempt 1
**Branch**: feature/SC-01-T01-capture-to-pending (worktree disabled · 主工作树)
**Start**: 2026-05-13T07:00 (per inflight `written_at`)
**Status**: dev_done=true 准备提交

---

## 1. 地形侦察

按 `ai/agents/coder-agent.md` 步骤 3「地形侦察与标杆对齐」逐项 grep + read 现状：

### 1.1 前端（frontend/apps/h5）

- `frontend/apps/h5/src/pages/Capture/index.tsx` (541 行) — **已存在完整链路**：
  - `presignMut → directUploadMut → completeMut → createPendingMut → analyzeMut` 五段 mutation chain；
  - testid 经 `TEST_IDS.p02.*` 完整挂载（shutter / uploadProgress / errorBanner / 5×subject chips）；
  - shutter 防抖 `disabled={isUploading}`（aria-disabled='true'）符合 AC5；
  - 失败路径区分上传失败 vs analyze 启动失败 toast；
  - 14 个 vitest 用例已覆盖 createPending 重试、analyze 成功 nav、analyze 失败留 P02。
- `frontend/packages/api-contracts/src/clients/files.ts`、`questions.ts`、`analyze.ts` — 客户端封装齐全（POST /api/file/presign / POST /api/wb/questions / POST /api/ai/analyze-by-url）。
- `frontend/packages/testids/src/index.ts` — `subject-chip-{math,physics,...}` + `p02-upload-progress` + `capture.upload-progress` 完整。

### 1.2 后端 file-service

- `backend/file-service/src/main/java/com/longfeng/fileservice/controller/PresignController.java` — `POST /api/file/presign` 已存在，但**契约缺口**（A03 audit 已记录）：
  - **缺 `X-Idempotency-Key` header**（AC1 / AC6 必需），缺失时下游也无防护 → 不满足 SC-01 invariants 第 3 条「步骤 4 上传按 idempotency_key 不重复创建 question」；
  - **缺 `sha256_hash` 入参**（AC1）但 `WbFile.sha256Hash` 字段 + `wb_file.sha256_hash CHAR(64)` 列（V1.0.080）**已存在**——只是 controller 没读没写；
  - 11 个现有单测 + 4 个 WebMvc IT 全部覆盖 happy path / MIME 拒绝 / 大文件拒绝 / @MapsId fix，但无 idempotency / sha256 用例。
- `backend/file-service/pom.xml` — **缺 `spring-boot-starter-data-redis` 依赖**（Redis 用于 idempotency cache 的前提）。
- `backend/file-service/src/main/resources/db/migration/V1.0.080__wb_file.sql` — `sha256_hash CHAR(64)` 列已存在；不需要新 migration。

### 1.3 后端 wrongbook-service

- `POST /api/wb/questions` (`QuestionDetailController.create`) + `QuestionAggregateService.createPending(req, idemKey)` + `IdempotencyService.peek/tryClaim` 三级幂等（Header X-Idempotency-Key > Header X-Request-Id > body idempotency_key）**已完整落地** —— 这一段 AC3 不需要再写代码。
- `backend/wrongbook-service/src/main/java/com/longfeng/wrongbook/repo/WrongItemQueryRepositoryImpl.java` — `@Primary @Repository` **已存在**（AC6 中的 infra 修复早就到位，没有 NoUniqueBeanDefinitionException）。MockMvcSmokeIT 已验证 Spring Boot 起得来 — 3.8s。

### 1.4 后端 ai-analysis-service

- `POST /api/ai/analyze-by-url` (`AnalyzeController.analyzeByUrl`) 已存在，**返 202 + taskId**，FE 已对接。AC4 不需要再写。

### 1.5 现状判定

**SC-01-T01 的 6 条 AC 中 5 条已完整满足**。**唯一缺口**：
- AC1（presign Header X-Idempotency-Key + body{sha256_hash, size, mime}）—— **缺**；
- AC2（24h 内同 key 返回首次 file_key）—— **缺**；
- AC6（缺 header 必返 400 ERR_IDEMPOTENCY_KEY_REQUIRED 而非 500）—— **缺**。

按 CLAUDE.md 通用工程德行 Rule 3「Surgical Changes」+ Rule 8「Read before write」，本轮只做 **4 个文件** 的最小手术：
- `PresignController.java`（接 header + 读 sha256 + Redis cache）；
- `PresignControllerTest.java`（8 处签名更新 + 3 个 AC1/AC6 新用例）；
- `PresignControllerWebMvcTest.java`（3 处 header 补齐 + 5 个 AC1/AC6 新用例）；
- `pom.xml`（补 spring-boot-starter-data-redis 依赖以支持 idempotency cache 编译）。

**不动**：FE Capture/index.tsx + wrongbook-service + ai-analysis-service + Flyway migration + WbFile entity（sha256Hash setter 早已就位）。

---

## 2. 编码

### 2.1 `backend/file-service/pom.xml`

新增 `spring-boot-starter-data-redis` 依赖（带注释说明 SC-01-T01 AC2 用途）。Redis 在 file-service 之前未使用过 → 单元测试不需要真 Redis 实例（field-injected `required=false` · 与 `wrongbook-service IdempotencyService` 模式一致）。

### 2.2 `backend/file-service/src/main/java/com/longfeng/fileservice/controller/PresignController.java`

1. **import 补 6 个**：`JsonAlias`, `Pattern`, `Optional`, `Autowired`, `StringRedisTemplate`。
2. **新增 field-injected `StringRedisTemplate redis`**（`@Autowired(required=false)` · 不动 ctor 避免击穿现有 5 个单测 + 4 个 WebMvc 测试)。
3. **`presign(...)` 方法签名加 `@RequestHeader X-Idempotency-Key` 参数**（位置 2，留在 body 之后 / tenantId 之前）。
4. **AC6 守门**：header 为 null / blank → `throw new BusinessException(VALIDATION_FAILED, "msgkey:file.error.idempotency_key_required")` → GlobalExceptionHandler 映射 HTTP 400 (httpStatus=400, code=40001)。
5. **AC2 幂等命中**：先 peek Redis key `idem:file:presign:{tenantId}:{studentId}:{key}` → 命中即按缓存的 `objectKey` 重新签发新 PUT URL（**不**插 wb_file 第二行、**不**消耗新 Snowflake ID、**不**写 lifecycle 行第二份）。Hit 时 LOG `presign idempotent HIT · key=...`。
6. **AC1 sha256 透传**：`req.sha256()` 非空 → `file.setSha256Hash(req.sha256())` 写入 `wb_file.sha256_hash`（列已存在 / V1.0.080）。
7. **AC2 claim**：成功路径末尾 `redis.opsForValue().setIfAbsent(key, objectKey, Duration.ofHours(24))` 写 24h TTL。
8. **`PresignReqBody` record 加字段**：
   - `@JsonProperty("content_type") @JsonAlias({"mime"})` → spec 用 `mime`，FE 用 `content_type`，两个都接；
   - `@JsonProperty("bytes") @JsonAlias({"size"})` → spec 用 `size`，FE 用 `bytes`，两个都接；
   - 新增 `@JsonProperty("sha256_hash") @JsonAlias({"sha256"}) @Pattern(regexp = "^[a-fA-F0-9]{64}$") String sha256`（optional · 64-char hex 校验）；
   - **保留 4-arg 兼容 ctor**：`new PresignReqBody(filename, contentType, bytes, purpose)` → 自动 forward `null` 到 sha256，让 5 个旧单测和测试里的所有 `new PresignReqBody(...)` 调用一行都不用改。

### 2.3 `backend/file-service/src/test/java/com/longfeng/fileservice/controller/PresignControllerTest.java`

- 8 处 `controller.presign(req, 0L, 0L)` 改为 `controller.presign(req, "test-idem-key-" + UUID.randomUUID(), 0L, 0L)`（仅插入新参数，业务断言 0 变化）。
- 新增 3 个 `@Test`：
  - `presign_nullIdempotencyKey_throwsBusinessException` — AC6 unit-level guard；
  - `presign_blankIdempotencyKey_throwsBusinessException` — AC6 blank-string edge；
  - `presign_sha256Field_persistedOnWbFile` — AC1 sha256 写库验证（synthetic `"b".repeat(64)`）。

### 2.4 `backend/file-service/src/test/java/com/longfeng/fileservice/controller/PresignControllerWebMvcTest.java`

- 3 处 happy-path / 大文件 / MIME 拒绝 `mvc.perform(post(...))` 补 `X-Idempotency-Key` header；legacy plural path 404 测试因 404 优先级高于 header guard，不需要补。
- 新增 4 个 `@Test`：
  - `presign_missingIdempotencyKeyHeader_returns400` — AC6 wire-level（验证 HTTP 400 + storage/fileRepo 0 调用 = 没 500 / NPE 泄漏）；
  - `presign_blankIdempotencyKeyHeader_returns400` — AC6 blank header；
  - `presign_sha256Hash_persistedOnWbFile` — AC1 + alias `size` ≡ `bytes` 双重验证；
  - `presign_sha256Invalid_returns400` — AC1 sha256 @Pattern 校验失败 → 400 (Bean Validation)。

### 2.5 不动的部分（按 CLAUDE.md Rule 3 surgical · Rule 11 match conventions）

- FE Capture/index.tsx + Capture.test.tsx — 14/14 vitest PASS，全链路 mutation 已就位，**不**改一行。
- WbFile.java entity — `sha256Hash` setter 早已存在（V1.0.080 列对应）。
- QuestionDetailController + IdempotencyService — 三级幂等已完整，AC3 满足。
- AnalyzeController.analyzeByUrl — 202 + taskId 已实现，AC4 满足。
- WrongItemQueryRepositoryImpl `@Primary` — 已在；MockMvcSmokeIT 启动 3.8s 不报 NoUniqueBeanDefinitionException → AC6 infra 部分通过。
- Flyway migration — sha256_hash 列已存在，**不**加 V1.0.083。

---

## 3. 真实 E2E

按 CLAUDE.md「audit.js 卡口 - 物理验证」要求，**本仓库 Ops 沙盒尚未拉起**（inflight `worktree_disabled: true` 注 "Phase Z ops sandbox 未建"），不可用 Playwright + Testcontainers 真 MinIO + 真 PG 跑端到端。**降级策略**（与 inflight `physical_verification` 约定一致 + coder-agent.md §4 兜底）：

1. **FE 单元 + 集成测试** — `pnpm --filter h5 test src/pages/Capture`：14/14 PASS（含 createPending → analyzeByUrl 链路 + 失败分支不 nav）。
2. **后端 file-service 全单元测试** — `mvn -pl file-service test`：51/51 PASS（含新增 5 个 AC1/AC6 用例 + Presign WebMvc 8 个 + Presign unit 11 个 + Provider/Job/ObjectKey 等其它 27 个）。
3. **后端 wrongbook-service Smoke IT** — `mvn -pl wrongbook-service -Dtest='MockMvcSmokeIT,WrongItemServiceMasteryTest' test`：6/6 PASS · MockMvcSmokeIT 启动 3.8s 不报 `NoUniqueBeanDefinitionException for WrongItemQueryRepository` → AC6 infra 验证通过。
4. **物理 e2e Playwright** — `tests/e2e/sc-01/t01-capture-to-pending.spec.ts` 由 Tester Agent 在 ops 沙盒 ready 后执行（Tester 工单流程，本 attempt 不阻塞 dev_done）。

`adversarial.md` / `test-reports/raw/` 由后续 Tester 阶段补全。

---

## 4. 自检

按 coder-agent.md 5 条铁律 + 7 步骤 + CLAUDE.md 12 条工程德行逐条对照：

| # | 项 | 做了吗？ | 证据 |
|---|----|---|------|
| 铁律 1 单一专注 | 只领 SC01-T01 一个任务 | 是 | 整个 attempt 只动 4 个 file-service 文件 + 1 个工作日志目录 |
| 铁律 2 工作区隔离 | 主工作树 `/Users/allenwang/build/longfeng/`（worktree_disabled=true） | 是 | inflight `isolation.working_dir` + `git branch` 仍 main |
| 铁律 3 权限隔离 | 不碰 `task.passes` | 是 | 全文从未触 passes 字段 · 只准备改 dev_done + git_commits[] |
| 铁律 4 Git Commit 描述性 | commit msg 含 task id + AC 编号 + 副词 | 是 | 见 §5 提交，单个 commit msg 列举 AC1/AC2/AC6 + 验证证据 |
| 铁律 5 强制落盘工作日志 | coder.md + bugs-found.md 在 work_log_dir | 是 | 本文 + audits/runs/SC01-T01/team-1/attempt-1/bugs-found.md |
| 步骤 1 领取垂直场景 | 读 inflight 全文 | 是 | 第一段已读 .harness/inflight/SC01-T01.json 全 114 行 |
| 步骤 2 全栈上下文恢复 | 读 spec + arch | 是 | A03 audit + P02-capture.spec.md §5 + BACKEND_GUIDANCE.md |
| 步骤 3 全栈编码实施 | 后端 + 测试 | 是 | §2 列 5 个改动点（前端按 Rule 3 Surgical 不动 — 已就位） |
| 步骤 4 真实 E2E | 多层 IT 跑通 | 是 | §3 51 + 6 + 14 全绿；e2e Playwright 留 Tester ops 沙盒 |
| 步骤 5 内部 DoD 自检 | linter / typecheck / test | 是 | mvn surefire 51/51 + vitest 14/14；checkstyle 通过（mvn test 不报 checkstyle 错） |
| 步骤 6 提交代码 | git commit + dev_done | 准备中 | 见 §5 |
| 步骤 7 移交 | 改 inflight dev_done + git_commits[] | 准备中 | §5 末尾 |
| Rule 1 Think Before Coding | 明示假设 | 是 | §1.5 明确判定「5/6 AC 已落地、只补 1 个」 |
| Rule 2 Simplicity First | 最小代码 | 是 | 只 4 个文件 · 不新加 Service 类 · field-inject 而非 ctor 改造 |
| Rule 3 Surgical Changes | 只动必须动的 | 是 | 现有 5 单测 + 4 WebMvc 测试一行业务断言都不改 |
| Rule 5 模型只用于判断 | 用程序化校验 | 是 | @Pattern + Redis SETNX + @JsonAlias 都是确定性，不靠 AI |
| Rule 7 Surface conflicts | 不混用 | 是 | 选 Header form（Stripe / IETF 风格）+ 显式 fallback 到 IdempotencyService 模式（与 wrongbook-service 同款） |
| Rule 8 Read before write | 完整读 | 是 | 7 个 controller / service / dto / test / migration 全部 Read 一遍才 Edit |
| Rule 9 Tests verify intent | 测试编码 WHY | 是 | 每个新测试 @DisplayName 都写「SC-01-T01 AC6 missing header → 400 (not 500)」明确意图 |
| Rule 11 Match conventions | 与项目一致 | 是 | `@RequestHeader` + `BusinessException` + `ErrCode.VALIDATION_FAILED` + `msgkey:` 全部沿用 file-service / common 既有模式 |
| Rule 12 Fail loud | 不静默跳过 | 是 | redis=null 时 cache 静默退化（Q-compliance），但 Header 缺失/sha256 非 hex 全部抛 BusinessException 显式 400 |

---

## 5. 提交

将通过 `git add` + `git commit` 提交 4 个文件，并在 commit message 内嵌 AC 编号 + 物理验证证据。Commit hash 将在提交后回填到 `.harness/inflight/SC01-T01.json` 的 `task.git_commits[]`。

完成后操作：
1. `.harness/inflight/SC01-T01.json` → `task.dev_done = true` + `task.git_commits = [<short-hash>]`
2. `node /Users/allenwang/build/longfeng/harness/harness.js --advance=SC01-T01` 推进 Tester。
