# SC01-T01 · team-1 · attempt-1 · Bugs Found & Fixed

> Bug list discovered while implementing SC01-T01 (P02 拍题 → presign + PENDING question + 跳 P03). Each entry lists the file path, the bug, the fix, and the commit hash. **0-bug declarations are surfaced explicitly** per audit.js requirement.

---

## Bug 1 · file-service `POST /api/file/presign` 缺 `X-Idempotency-Key` header → SC-01 步骤 4 弱网重试会产生第 2 行 wb_file（违反 TC-01.02 / SC-01-A03 audit P0-1）

- **File**: `backend/file-service/src/main/java/com/longfeng/fileservice/controller/PresignController.java`
- **Severity**: P0 — 阻断 SC-01 步骤 4 黄金路径，FE 端 5MB 抓拍场景任何重传都会 INSERT 第二条 wb_file 行 + 重新挤一个 OSS 对象。
- **Root cause**: `presign(...)` 方法签名只接受 `(@RequestBody PresignReqBody req, @RequestHeader X-Tenant-Id, @RequestHeader X-User-Id)`，**完全无视 `X-Idempotency-Key`**。下游 wrongbook-service 已经做了三级幂等，但 file-service 自己没做，导致重试时 (presigned URL + objectKey + wb_file row) 都会重新生成一份。
- **Fix**: 加 `@RequestHeader(value = "X-Idempotency-Key", required = false) String idempotencyKey`，方法首行：缺/blank 即抛 `BusinessException(ErrCode.VALIDATION_FAILED, "msgkey:file.error.idempotency_key_required")`，让 GlobalExceptionHandler 映射 HTTP 400 (AC6)。然后在 MIME / size 校验后用 Redis `peekIdempotencyCache(tenantId, studentId, key)` 短路：命中 → 复用旧 `objectKey` 重新签发上传 URL + image_url，**不**插 wb_file 第二行（AC2）。
- **Fix commit**: `<pending>` (将在 `git commit` 后回填到本文件)。

## Bug 2 · file-service Redis 依赖缺失 → idempotency cache 无法编译

- **File**: `backend/file-service/pom.xml`
- **Severity**: P0（前置依赖）— Bug 1 的修复需要 `StringRedisTemplate`，但 file-service 此前从未用 Redis（pom 未声明 `spring-boot-starter-data-redis`）。
- **Root cause**: 6 个其它后端模块（wrongbook-service / review-plan-service / auth-service 等）都已声明该依赖，唯独 file-service 没有 —— 因为 callback 流没用 Redis，A03 audit 也只指出 idempotency 缺失，没指出依赖差距。
- **Fix**: 在 `<dependencies>` 区段（`spring-boot-starter-validation` 之后、`org.postgresql` 之前）加 `spring-boot-starter-data-redis`，并写明 SC-01-T01 AC2 + field-injected `required=false` 让单测 + dev 无 Redis 时仍能启动。
- **Fix commit**: `<pending>` (合并在同一 commit)。

## Bug 3 · file-service `wb_file.sha256_hash` 列存在但永远写 null → SC-01-A03 audit §2 P0-2

- **File**: `backend/file-service/src/main/java/com/longfeng/fileservice/controller/PresignController.java`
- **Severity**: P0 — V1.0.080 schema 早已开 `sha256_hash CHAR(64)`，`WbFile.sha256Hash` setter 也早就在，但 `PresignReqBody` 不接受 `sha256_hash` / `sha256` 字段，controller 也从不调 setter，列永远 null → content-addressable dedup 完全失效。
- **Root cause**: 历史代码 + A03 audit 列出但未修。
- **Fix**: 1) `PresignReqBody` record 加 `@JsonProperty("sha256_hash") @JsonAlias({"sha256"}) @Pattern(regexp = "^[a-fA-F0-9]{64}$") String sha256`（optional · @Pattern 校验失败 → 400）；2) `presign(...)` 主路径在写 `WbFile` 前 `if (req.sha256() != null && !req.sha256().isBlank()) file.setSha256Hash(req.sha256())`（**仅 supplied 时写**，FE 未必每次算 hash · 兼容老 GuestCapture 链路不破）；3) 同时给 `content_type` 加 `@JsonAlias({"mime"})`、给 `bytes` 加 `@JsonAlias({"size"})` 对齐 spec wire（Capture FE 新链路用 `size`/`mime` · 老 GuestCapture 用 `bytes`/`content_type` · 两个都接）。
- **Fix commit**: `<pending>` (合并在同一 commit)。

---

## Pre-existing bugs / fixes verified, NOT introduced by this attempt

为防遗漏，记录在 attempt 开始前已修过、本轮不再动的相关问题：

- **wrongbook-service `WrongItemQueryRepository` NoUniqueBeanDefinitionException** — inflight task.title 中提到的 infra bug 在 `WrongItemQueryRepositoryImpl` 上加 `@Primary @Repository`（既有 commit），MockMvcSmokeIT 启动 3.8s 不报错 — 本轮**不重做**。
- **wb_file_lifecycle null identifier (AssertionFailure)** — 历史 commit 已通过 `saveAndFlush` + 去掉 setFileId 解决，PresignRealPgIT 验证过 — 本轮**不动**。
- **POST /api/wb/questions 三级幂等** — `QuestionAggregateService.createPending` + `IdempotencyService.peek/tryClaim` 已落地，本轮**不动**。
- **POST /api/ai/analyze-by-url 202 + taskId** — AnalyzeController 已实现，本轮**不动**。

---

## Tally

- **本轮发现 + 修复**: 3 个 bug（2× P0 契约缺口 + 1× P0 依赖缺失）。
- **本轮 0-bug 声明**: 不适用（≥1 bug 修复）。
