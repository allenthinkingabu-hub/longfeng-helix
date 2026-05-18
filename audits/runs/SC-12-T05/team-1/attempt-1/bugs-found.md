# SC-12-T05 · Bugs Found · attempt-1

**Task**: SC-12-T05 · `POST /api/anon/questions`
**Phase**: 3 (Coder)
**Attempt**: 1

---

## 显式声明: **0 bug** in coder Phase 3 implementation.

本 attempt 是绿地开发 (4 个全新文件 + 1 个全新 IT 文件) · 没有"修了既有 bug"这一类记录.

但本文记录 2 类**真实工程发现** · 在 IT 编写时主动 surface 并锁住:

---

## Finding-1 · Compile-time symbol resolution · 锁内嵌枚举的限定名

**Type**: 内部 self-catch · pre-commit · 不算 production bug
**Detection point**: `mvn -q -DskipTests compile` after 第一稿 `AnonQuestionService.java`
**Symptom**: `cannot find symbol · variable Kind · location: class AnonQuestionService` × 4 处 (line 83/91/101/110)

**Root cause**: 第一稿在 `record()` 方法体内写了 `new QuestionOutcome(Kind.NOT_FOUND, ...)`. 但 `Kind` enum 是嵌套在 `QuestionOutcome` 内部类内 · 编译器在 `AnonQuestionService` 外层 scope 找不到 `Kind` · 必须用限定名 `QuestionOutcome.Kind.NOT_FOUND`.

**Fix**: 一次 sed `Kind.<X>` → `QuestionOutcome.Kind.<X>` × 4 处.

**Why this matters going forward**: 标杆模板 `AnonSessionConsentService.java` (T02) 把 `Kind` enum 嵌在 `ConsentOutcome` 内部类里 · 但 service method 体内用 `ConsentOutcome.Kind.NOT_FOUND` 长形式. 我第一稿试图简写 (`Kind.NOT_FOUND`) 没参考标杆 = 违反 CLAUDE.md Rule 11 (Match the codebase's conventions, even if you disagree). **已修正** · 编码 phase 中段就 compile 验过.

**Fix commit**: 包含在 `1038beb` (本 attempt 第一稿就 squash 进 feat commit · 没单独 commit fix).

---

## Finding-2 · jakarta-validation `@RequestHeader` `required=true` 默认行为对空白值不生效 · 需要业务层 isBlank 显式 gate

**Type**: 设计选择 · 不算 bug · 但是潜在 silent-pass 风险点 · 主动 surface + IT 锁住
**Detection point**: 写 IT (h) `questions_blank_idempotency_key_returns_400` 时主动思考的边界

**Root cause / 风险**: `@RequestHeader(value = "X-Idempotency-Key", required = false)` 不验非空 · `@RequestHeader(required = true)` 也只验 "header 存在" · 不验 "header 值非空白". 客户端 SDK bug / 中间代理压缩 / 用户手动 PoSTman 都可能发出 `X-Idempotency-Key: ` (空值) · 这种**变形**绕过 require check.

**Decision**: P0 用 `required = false` + 自己 `if (key == null || key.isBlank())` 显式 gate · 显式 LOG.info("anon_question_create idempotency_key_required") · 返 400 + code "IDEMPOTENCY_KEY_REQUIRED". 比 Spring `required=true` 抛 `MissingRequestHeaderException` 经全局/局部 ExceptionHandler 转换更可控 · 不需要再加 `@ExceptionHandler(MissingRequestHeaderException.class)`.

**Locked by**:
- IT (d) `questions_without_idempotency_key_returns_400` · 无 header → 400 IDEMPOTENCY_KEY_REQUIRED
- IT (h) `questions_blank_idempotency_key_returns_400` · header 值 "   " (3 空格) → 400 IDEMPOTENCY_KEY_REQUIRED

**Why this matters**: 未来若有人重构 controller 用 `@RequestHeader(required=true)` 替代手动 isBlank · 或写成 `if (key == null)` (没 isBlank) · IT (h) 直接抓住. 这是 CLAUDE.md Rule 9 (Tests verify intent) 的实例 — IT 不只是 verify happy path · 而是锁住"为什么这样写"的设计决策.

**Fix commit**: 写在 `1038beb` (controller 第一稿就用 isBlank · IT 在 `bccaa45` 锁住).

---

## Spec drift 关注 (T01 surface · T05 沿用 · 不算 bug · 但 IT 锁住防回归)

**P-GUEST-CAPTURE §6 状态机**: 提 UPLOADED→ANALYZING 边
**DDL `guest_session.status`**: 0 CREATED · 1 ANALYZING · 2 RESULT_READY · 3 FAILED · 4 CLAIMED · 9 EXPIRED · **无 UPLOADED 中间态**

T01 attempt-N 已 surface 此 drift · 当时决策: DDL 是 source of truth · spec 未来若修就修 spec · T01 / T02 / T05 一律不动 status.

T05 沿用此决策:
- `AnonQuestionService.record()` SUCCESS 路径**故意**只调 `setImageTmpUrl()` 不调 `setStatus()` · class javadoc 显式注释为什么
- IT (g) `questions_status_unchanged_at_zero` 严格 SELECT `g.status == 0 (short)` · 任何未来"silent bump status here"的 refactor 都会被这个 IT 抓住
- IT (a) 也额外 SELECT `status` 验仍为 0 · 双保险

---

## Tester 关注的潜在边界 (建议探索方向)

供 Tester adversarial phase 参考 (不强制 · Tester 自决):

1. **Idem key 大小写**: 当前实现 `@RequestHeader(value = "X-Idempotency-Key", ...)` · Spring 默认 case-insensitive · 但有 IT (h) 已锁 blank · 若 Tester 要试 `x-idempotency-key` lowercase 可加 testcase
2. **objectKey 同 sessionId 但路径含 `..`**: 当前 `startsWith` 严格 prefix check · `guest-tmp/{id}/../foo.jpg` 仍 startsWith 通过 · 但 MinIO 那边 T04 sanitizeExt 已防 · T05 不重复防 (responsibility 在 T04)
2. **Concurrent overwrite**: 两个并发 POST 同 sessionId 写不同 objectKey · last-writer-wins · class javadoc 说明 · 若需要 idempotency lock 留 T06+
3. **consentAt body 字段是否被信任**: 当前实现**故意不信** · 只看 DB consent_at · Tester 可发个带 `"consentAt": "1970-01-01T00:00:00Z"` 但 DB consent_at IS NULL 的请求 · 应仍 412 (DB 才是权威)

---

## 结论

- **0 production bug** in this Coder phase
- 1 个 self-caught compile error (Finding-1) 已在第一稿后立即修
- 1 个设计决策 (Finding-2) 显式 surface 并 IT 锁住
- 1 个 T01-inherited spec drift (status enum) 沿用 + IT 锁住
- 9 个 IT 一次跑过 · 0 failure 0 error
- mvn verify 全量 regression · 62 IT (T05 9 + prior 53) 全绿 · BUILD SUCCESS exit=0
