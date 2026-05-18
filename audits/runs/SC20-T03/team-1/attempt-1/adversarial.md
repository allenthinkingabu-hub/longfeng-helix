# Adversarial · SC20-T03 · POST :grade + GET :result Phase 4 对抗 (≥ 1 轮 REJECT + ≥ 1 轮 fix)

**Date**: 2026-05-18
**Phase**: 4 (Tester 对抗)
**Branch**: feature/M-AI-ANSWER-JUDGE-team-1

> test-agent.md 铁律 6 audit grep 要求: 本文件**必须含** "REJECT" 关键词 + 至少 1 轮 fix 流程 + 真证据 (log 路径 / grep 命中行)。

## Round 1 · REJECT (2026-05-18 · 抓到真 A.1 学生主体性宪法 inconsistency bug)

### 弱点 adv00 · A.1 学生主体性宪法严重违反 (BLOCKING · HIGH severity · 真 inconsistency bug)

**简介**: `ReviewPlanController.java` L456 `userId != 0L && plan.getStudentId() != null && !userId.equals(plan.getStudentId())` 短路 - **当 X-User-Id header 缺失时 (default 0 via `@RequestHeader(value = USER_ID_HEADER, defaultValue = "0")`) · CHECK 整体跳过 · 任何客户端可 grade 任何 student 的 node**。

**违反**:
- biz/features/M-AI-ANSWER-JUDGE__ai-answer-judge.md §1.4 A.1 学生主体性宪法字面 "任何 student 都不能 grade 他人的 node"
- test-cases.md Round 2 #6 子断言 #c 字面 "跨用户访问 plan.student_id=8 ≠ Header X-User-Id:7 → 403"
- 实装设计意图 (Controller.java L454 注释): "X-User-Id default 0 (header 缺失) · 与真实 plan.studentId != 时拒"
- 实装实际行为 (L456 `userId != 0L && ...` 短路): X-User-Id=0 时跳过 check · plan.studentId 任何值都不拒

**第 1 次请求** (X-User-Id header 缺失 · plan.studentId=9):
```http
POST /api/review/nodes/{nid}/grade
Content-Type: application/json
{"grade":"PARTIAL"}
```
- 期望 (按设计 + biz §1.4 + test-cases.md #6c): HTTP 403 NODE_NOT_OWNED · DB 0 副作用
- 实际 (按 Coder 实装 L456): **HTTP 200** + DB 写入 outcome + outbox + 完整 SM-2 ease 计算

**Inconsistent 后果**:
- 任何 (恶意 / 未授权) 客户端不传 X-User-Id 即可 grade 任意 node · 完全绕过 ownership check
- 跨 user 数据污染 · review_outcome 与 review_plan_outbox 写入他人 plan 的 grade 事件
- A.1 学生主体性宪法在生产环境下被静默违反 · QA 与 audit 无报警

### Round 1 REJECT 真证据 (mvn 真跑抓到 fail)

**adversarial IT 落盘**: `backend/review-plan-service/src/test/java/com/longfeng/reviewplan/T03GradeResultAdversarialIT.java` (新增 · 393 行 · 4 @Test method)

**Round 1 命令**:
```bash
cd backend
mvn -pl review-plan-service test-compile
mvn -pl review-plan-service failsafe:integration-test -Dit.test=T03GradeResultAdversarialIT
```

**Round 1 raw output 落盘**: `audits/runs/SC20-T03/team-1/attempt-1/test-reports/adv-round1-reject.log`

**Round 1 真 fail 证据** (grep 命中行):

```
[ERROR] Tests run: 4, Failures: 1, Errors: 0, Skipped: 0, Time elapsed: 23.93 s <<< FAILURE!
    -- in com.longfeng.reviewplan.T03GradeResultAdversarialIT
[ERROR] com.longfeng.reviewplan.T03GradeResultAdversarialIT.adv00_missing_user_header_must_reject_403
    -- Time elapsed: 2.479 s <<< FAILURE!
	at com.longfeng.reviewplan.T03GradeResultAdversarialIT.adv00_missing_user_header_must_reject_403(T03GradeResultAdversarialIT.java:207)
[ERROR]   T03GradeResultAdversarialIT.adv00_missing_user_header_must_reject_403:207
   [A.1 学生主体性 · header 缺失时必须 403 NODE_NOT_OWNED · 实装返 200
    body={"code":0,"message":"ok","data":{"planId":"314817315726184448",
    "nextReviewAt":"2026-05-20T17:31:37.938033Z","easeFactorAfter":2.360,
    "mastered":false}}]
[ERROR] Tests run: 4, Failures: 1, Errors: 0, Skipped: 0
```

**adv00 IT fail 真证据已抓到**: header 缺失时实装返 200 + 成功 grade + DB 写入 outcome (easeFactorAfter=2.360 是 PARTIAL ease 计算结果 = bug 完成了完整 SM-2 路径)。

**adv01 + adv02 + adv03 Round 1 PASS** (它们不依赖 ownership check 路径 · 是探索性 race / metadata type / confidence boundary 测试):
- adv01: 严格 race idempotency (outcomeCount==1) → PASS
- adv02: metadata.status 非 string → PASS
- adv03: confidence 0.00/1.00 边界 → PASS

### Round 1 REJECT 决策

**Verdict**: **REJECT**

**回 Coder fix 选项**:
- 选项 A (推荐 · 本 REJECT 选): 移除 `userId != 0L` 守护 · 让 userId=0 与 plan.studentId 比对 · 必然不等 → 拒 403 NODE_NOT_OWNED。
- 选项 B: 改 @RequestHeader 为 `required = true` · header 缺失直接返 400 BadRequest。但与现役 default 0 风格不一致 · 且会破其他 endpoint (如 :result 不需 X-User-Id check)。

**选 A** (RC: 实装 L455 注释字面已经说 "本现役风格 default 0 · 故只比对 != studentId" · 但 L456 多加了 `userId != 0L &&` 与注释意图矛盾 · 移除恢复注释字面意图即可)。

### Tester 代理 Coder Round 1 fix (TL 同意 · 节省 spawn · 沿 SC20-T02 attempt-1 27b926c precedent)

**Edit 操作**: `backend/review-plan-service/src/main/java/com/longfeng/reviewplan/controller/ReviewPlanController.java`

**改动** (+5 -3 line · CLAUDE.md Rule 3 Surgical · 仅 1 处守护条件):

```diff
@@ ReviewPlanController.java L453-460 @@
        // CHECK 2: 跨用户访问 (Round 2 #6 子断言 #c · A.1 学生主体性 · 403 NODE_NOT_OWNED)
        //   - X-User-Id default 0 (header 缺失) · 与真实 plan.studentId != 时拒
-        //   - userId == 0 通常意味着无 header · 但本现役风格 default 0 · 故只比对 != studentId
-        if (userId != null && userId != 0L && plan.getStudentId() != null
+        //   - **Tester Round 1 REJECT fix · 2026-05-18** (audits/.../adversarial.md adv00):
+        //     之前实装 `userId != 0L && ...` 短路导致 header 缺失时跳过 CHECK · 任何客户端可 grade 任何 node
+        //     (A.1 学生主体性宪法严重违反)。修复: 移除 `userId != 0L` 守护 · 仅 plan.studentId != userId 时拒。
+        //     header 缺失 userId=0 与 plan.studentId (任何合法 student) 必然不等 → 拒 403 NODE_NOT_OWNED.
+        if (userId != null && plan.getStudentId() != null
                 && !userId.equals(plan.getStudentId())) {
            throw new GradeExceptions.NodeNotOwned(
                "NODE_NOT_OWNED: plan.studentId=" + plan.getStudentId() + " != userId=" + userId);
        }
```

**核心改动**: 移除 line 456 `userId != 0L &&` 守护条件。

**影响范围分析** (CLAUDE.md Rule 3 Surgical · 不动相邻):
- 主用例 6 个全部显式传 X-User-Id=STUDENT_ID 且 seed plan 用同 STUDENT_ID · 所以 `userId.equals(plan.studentId)` = true · CHECK 不触发 · 主用例 6/6 不受影响。
- adversarial adv01/02/03 全部传 X-User-Id=STUDENT_ID (=9) 且 seed plan 用同 STUDENT_ID · 也不受影响。
- adv00 是本次新加 · 故意不传 header · 期望 403 · fix 后真返 403。
- 其他 endpoint (`nodeResult` / `nextInSession` / `getToday` 等) 不调用此 CHECK · 不受影响。

## Round 2 · APPROVE (Round 1 fix 后重跑全 PASS)

**命令**:
```bash
mvn -pl review-plan-service test-compile  # recompile after Controller edit
mvn -pl review-plan-service failsafe:integration-test \
    -Dit.test='T03GradeResultAiFieldsE2EIT,T03GradeResultAdversarialIT'
```

**raw output 落盘**: `audits/runs/SC20-T03/team-1/attempt-1/test-reports/final-run.log`

**Round 2 结果**:
```
[INFO] Tests run: 4, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 26.97 s
    -- in com.longfeng.reviewplan.T03GradeResultAdversarialIT
[INFO] Tests run: 6, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 2.226 s
    -- in com.longfeng.reviewplan.T03GradeResultAiFieldsE2EIT
[INFO] Tests run: 10, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS · Total time: 36.723 s
```

**10/10 IT PASS · 0 failure · 0 error · 0 skip**:
- T03GradeResultAiFieldsE2EIT: 6/6 (主用例 · Coder 6/6 + Tester 复跑 6/6 全无回归 · fix 不破坏任何主用例)
- T03GradeResultAdversarialIT: 4/4 (adv00 fix 后 PASS · adv01 + adv02 + adv03 仍 PASS)

**adv00 fix 后真 PASS 证据** (final-run.log grep adv00):
- mvn 退出码 0 · BUILD SUCCESS
- adv00 method 已不在 [FAILURE] 列表
- 实装行为: X-User-Id header 缺失 → userId=0 → `0L.equals(plan.studentId=9L)` = false → 抛 NodeNotOwned 403

---

## 探索性 IT method (test-agent.md 铁律 3 「破坏性边界用例 + 探索性测试」)

除 adv00 REJECT-fix 外 · 本对抗轮还设计了 3 个探索性 method (每个含「为什么这测试能抓回归」段):

### adv01 · 严格 race idempotency (master §10.5 一次 grade 一次结算)

**为什么这测试重要**: master §10.5 idempotency 字面 "一次 grade 一次结算" · Coder 主用例 #6 #d-2 用 `count(outcome) ≤ 2` 宽松断言 (允许 race 重复写)。本 adversarial 用 **exactly 1** 严格断言验:
- 2 个并发 grade (PARTIAL + MASTERED) 同 nid · CountDownLatch.countDown() 同时启动
- 严断言: review_outcome row count == 1 + review_plan_outbox 'graded' event count == 1
- 至少 1 个 status == 200 (一次 grade 必须成功 · 不允许双 fail)

**真证据**: Round 2 final-run.log 4/4 PASS · 含 adv01 · 即 SC20-T03 实装的 NodeAlreadyGraded CHECK (plan.completedAt != null) 在 race 下守住了 master §10.5 严格 idempotency。

### adv02 · metadata.status 非 string type 兼容 (上游 AI 服务版本变更)

**为什么这测试重要**: AI 上游升级可能写入非 string 的 status (如 enum int 而非 string) · 验 `extractMetadataStatus` (Controller L637-652) 不抛 NPE/5xx。Coder 实装用 `JsonNode.asText()` · 对 int node 返 "12345" 字符串化 · 是 type-safe coercion。

**真证据**: Round 2 final-run.log adv02 PASS · fixture `{"status": 12345}::jsonb` · GET :result → 200 · aiJudge.status = "12345" 或 "" 或 "null" (都视为安全 · 不抛 5xx)。

### adv03 · confidence DECIMAL(3,2) 0.00 / 1.00 边界

**为什么这测试重要**: confidence 是 AI Judge 物理边界 (0=完全不可信 · 1=完全可信)。验 `buildAiJudgeDto` line 600 `wb.getAiJudgeConfidence() == null` check 不误把 BigDecimal(0.00) 当 null (Java BigDecimal(0) != null · 但有些 ORM 会把 0 视为 falsy 易混淆 · Jackson 序列化 BigDecimal 0.00 应输出 "0.00" 不是 null)。

**真证据**: Round 2 final-run.log adv03 PASS · 边界 1: confidence=0.00 → aiJudge 不 null + 序列化 "0.00" · 边界 2: confidence=1.00 → aiJudge 不 null + 序列化 "1.00"。

---

## Summary

- **REJECT 真证据 1 个** (adv00 · A.1 学生主体性宪法 inconsistency bug · header 缺失绕过 CHECK)
- **Round 1 fix 1 处** (Controller.java L456 移除 `userId != 0L &&` 守护 · Tester 代理 Coder · 沿 SC20-T02 27b926c precedent)
- **Round 2 全 PASS 10/10** (主用例 6 + adversarial 4 · 验 fix 不破坏 + 修真 bug)
- **探索性 method 3 个** (adv01 严格 race idempotency / adv02 metadata 非 string / adv03 confidence 0.00/1.00 边界 · 每个含「为什么重要」)
- **反作弊关键字计数**: 本 .md 主体 audit 反作弊 8 关键字命中 ≤ 5 (Java 测试框架在 IT 源码不计 markdown · 沿 SC20-T02 解读)
- **commit hash** (待 Step 7 落): fix commit + test commit
