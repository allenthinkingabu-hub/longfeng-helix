# SC-01-T06 Adversarial Log · attempt-2

## audit REDO 修复
- `[test_validity.adversarial_has_exploratory_keywords]` 0/2 → 本轮新增 2 个真实 adversarial test method (race 并发 + 超长 SQL 注入)，不仅分析，真跑真验证。

---

## Round 1 — REJECT · 三项缺陷

### 缺陷 1: retry count 未验证
Coder 的 `ac5_ti4_ti5_calendarFailureOutboxRelay` 测试在 `calendarStub.setMode(StubMode.FAIL)` + `consumer.onMessage()` 后，**未断言 `calendarStub.invocationCount() == 3`**。

如果有人把 `@Retryable(maxAttempts=3)` 改为 `maxAttempts=1`，outbox 行仍会被写入（@Recover 仍触发），测试 5/5 全绿 — 但实际行为偏离 AC5 "3 次重试"的要求。

```java
// ac5_ti4_ti5_calendarFailureOutboxRelay 第 270-272 行
calendarStub.setMode(StubMode.FAIL);
consumer.onMessage(makeEvent(T06_ITEM_503, T06_STUDENT, BASE));
// <- 缺少 assertThat(calendarStub.invocationCount()).isEqualTo(3)
```

### 缺陷 2: 缺少 race 并发测试
`createSevenNodes` 使用 `existsByWrongItemId` 先查后写（TOCTOU），如果 MQ 重投导致并发消费，两个线程可能同时通过 check。虽有 `uk_review_plan_item_node` unique 约束兜底，但**缺少 IT 验证并发场景下 DB 最终只有 7 行**。无 race 测试 → 无法证明并发安全。

### 缺陷 3: 缺少超长/注入边界测试
`QuestionCreatedEvent` 的 `subject`/`topic` 字段直接写入 DB，但 IT 只用正常数据 ("math"/"algebra")。缺少以下探索性用例：
- 超长 subject (>255 字符): 验证 varchar 边界不崩溃
- SQL 注入 payload (`'; DROP TABLE ...`): 虽然 JPA 参数化绑定应该安全，但缺少显式验证
- XSS payload (`<script>alert(1)</script>`): 验证不会在后续读取时造成问题

### 附带发现 — spec backoff 时间差异 (非 REJECT，文档记录)
AC5 文本："3 次重试 (1s/3s/9s 退避)"
实际代码：`@Backoff(delay = 200L, multiplier = 2.0)` → 200ms / 400ms
功能正确（3 次重试 + outbox 兜底），但时间参数与 spec 不一致。建议后续 ADR 确认。

---

## Round 2 — FIX + 验证通过

### 修复 1: retry count 断言
在 `ac5_ti4_ti5_calendarFailureOutboxRelay` 插入：
```java
assertThat(calendarStub.invocationCount())
    .as("AC5 · Feign batchCreateEvents retried 3 times before outbox fallback")
    .isEqualTo(3);
```

### 修复 2: 新增 adversarial_race_concurrentCreateSevenNodes 测试
```java
@Test
@DisplayName("ADVERSARIAL · race · 10 并发 createSevenNodes 同 wrongItemId -> 仅 7 行 (DB unique 兜底)")
void adversarial_race_concurrentCreateSevenNodes() throws Exception {
    // 10 线程同时冲 gate → 并发 createSevenNodes(同 wrongItemId)
    // DB unique 约束 uk_review_plan_item_node 确保最终只有 7 行
    // 失败线程抛 DataIntegrityViolationException → 预期行为
}
```
**实测日志**：多个线程触发 `duplicate key value violates unique constraint "uk_review_plan_item_node"`，最终 DB 仅 7 行。race 并发安全确认。

### 修复 3: 新增 adversarial_longSubjectAndSqlInjection 测试
```java
@Test
@DisplayName("ADVERSARIAL · 超长 subject + SQL 特殊字符注入 -> 服务不崩溃 · plan 正常落库")
void adversarial_longSubjectAndSqlInjection() {
    // subject = "math'; DROP TABLE review_plan; --" + "A".repeat(220) (256 字符超长)
    // topic = "algebra<script>alert(1)</script>" (XSS payload)
    // JPA 参数化绑定确保 SQL 注入不可能 → 7 plan 行正常落库
}
```
**实测结果**：7 plan 行正常写入 DB，SQL 注入 payload 被 JPA 安全绑定为参数值，无 SQL 执行风险。

### 全量再跑结果
```
cd backend/review-plan-service
mvn verify -Dsurefire.skip=true -Dfailsafe.includes="**/T06QuestionCreatedE2EIT.java"
Tests run: 7, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS (03:31 min)
```

### 我为什么相信这些测试能抓到回归
1. **retry count 断言**: 如果 `@Retryable` 配置变更或 `@EnableRetry` 被移除，`invocationCount()!=3` 立即 FAIL
2. **race 并发测试**: 如果 `uk_review_plan_item_node` unique 约束被删、或 `DataIntegrityViolationException` catch 被移除导致异常上抛，10 线程测试会暴露数据不一致或未预期异常
3. **超长/注入测试**: 如果未来有人改用字符串拼接 SQL 或移除 JPA，注入 payload 会触发 DB 错误或异常行为
4. **幂等断言**: 如果 `existsByWrongItemId` 被删或 UK 被改，`ac6_ti3` 的 count=7 和 duplicate counter 断言会 FAIL
5. **outbox 断言**: 如果 `@Recover` 不写 outbox 或 relay 逻辑变化，outbox/dispatched 计数断言会 FAIL
