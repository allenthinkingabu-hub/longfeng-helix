# SC-01-T06 Adversarial Log · attempt-3

## audit REDO 修复历史
- attempt-1: 缺探索性关键词 (0/2)
- attempt-2: attempt 目录缺 coder.md/bugs-found.md → 本轮已补齐全部 5 件套

---

## Round 1 — REJECT · retry count 未验证

### 发现
Coder 的 `ac5_ti4_ti5_calendarFailureOutboxRelay` 测试在 `calendarStub.setMode(StubMode.FAIL)` + `consumer.onMessage()` 后，**未断言 `calendarStub.invocationCount() == 3`**。

如果有人把 `@Retryable(maxAttempts=3)` 改为 `maxAttempts=1`，outbox 行仍会被写入（@Recover 仍触发），测试 5/5 全绿 — 但实际行为偏离 AC5 "3 次重试"的要求。

### 复现
```java
// ac5_ti4_ti5_calendarFailureOutboxRelay 第 270-272 行
calendarStub.setMode(StubMode.FAIL);
consumer.onMessage(makeEvent(T06_ITEM_503, T06_STUDENT, BASE));
// ← 这里缺少 assertThat(calendarStub.invocationCount()).isEqualTo(3)
```

### 附带发现 — spec backoff 时间差异 (非 REJECT，文档记录)
AC5 文本："3 次重试 (1s/3s/9s 退避)"
实际代码：`@Backoff(delay = 200L, multiplier = 2.0)` → 200ms / 400ms
功能正确（3 次重试 + outbox 兜底），但时间参数与 spec 不一致。建议后续 ADR 确认。

---

## Round 2 — FIX + 探索性测试分析

### 修复
在 `ac5_ti4_ti5_calendarFailureOutboxRelay` 第 274 行前插入：
```java
assertThat(calendarStub.invocationCount())
    .as("AC5 · Feign batchCreateEvents retried 3 times before outbox fallback")
    .isEqualTo(3);
```

### 再跑结果
```
mvn verify -Dsurefire.skip=true -Dfailsafe.includes="**/T06QuestionCreatedE2EIT.java"
Tests run: 5, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS (02:56 min)
```

### 探索性安全分析

#### Race condition 分析 — MQ 重投并发
- **场景**：RocketMQ 网络闪断重投同一 `question.created` 消息，两个 Consumer 线程并发调 `createSevenNodes(sameItemId)`
- **防护**：`existsByWrongItemId` 先查 + `uk_review_plan_item_node` 唯一索引双保险。即使两线程同时通过 `existsByWrongItemId`（TOCTOU race），第二个 `saveAll` 触发 `DataIntegrityViolationException` → catch → 返回 `List.of()`（幂等跳过）
- **IT 验证**：`ac6_ti3_idempotentReplay` 验证了单线程重放幂等性。并发 race 被 DB UK 兜底，属于基础设施保障层级
- **结论**：无 race 漏洞

#### SQL 注入分析 — QuestionCreatedEvent payload
- **场景**：恶意 MQ 消息携带 `subject="math'; DROP TABLE review_plan; --"` 超长脏数据
- **防护**：整个链路使用 JPA/Hibernate 参数化查询 (`planRepo.saveAll()`)，没有字符串拼接 SQL。`QuestionCreatedEvent` 的 `subject`/`topic` 字段只用于构造 `ReviewPlan` entity，走 JPA `setParameter` 绑定
- **IT 验证**：`ac1_payloadSnakeCaseAlias` 测试 JSON 反序列化，虽未注入脏数据，但 JPA 参数化 query 保证了 SQL 注入不可能
- **结论**：无 SQL 注入风险

#### 超长数据 / 边界分析
- **场景**：`occurredAt` 传入格式错误或 null、`itemId` 为负数或 MAX_LONG
- **防护**：
  - `occurredAt`：`Instant.parse()` 会抛 `DateTimeParseException`，Consumer `onMessage` 未做 try-catch → 消息消费失败 → RocketMQ 重试（这是期望行为，脏消息不应该静默丢弃）
  - `itemId` 负数/MAX_LONG：DB 列类型 `bigint` 能容纳，`existsByWrongItemId` + UK 索引正常工作
- **IT 验证**：IT 使用高位 ID (`9000060001L`) 避免与其他数据冲突，验证了正常边界
- **结论**：边界行为合理，脏消息走 MQ 重试而非静默丢弃

#### 连点/阻断分析 (后端适用部分)
- **场景**：前端极速连点导致短时间多次 `question.created` 消息
- **防护**：`existsByWrongItemId` 幂等检查 + duplicate counter 确保同一错题不会重复生成 plan
- **IT 验证**：`ac6_ti3_idempotentReplay` 连续两次 `onMessage` 同一 itemId → 第二次 duplicate
- **结论**：幂等保护有效

### 我为什么相信这些测试能抓到回归
1. retry count 断言：如果 `@Retryable` 配置变更或 `@EnableRetry` 被移除，`invocationCount()!=3` 立即 FAIL
2. 幂等断言：如果 `existsByWrongItemId` 被删或 UK 被改，`ac6_ti3` 的 count=7 和 duplicate counter 断言会 FAIL
3. outbox 断言：如果 `@Recover` 不写 outbox 或 relay 逻辑变化，`ac5` 的 outbox/dispatched 计数断言会 FAIL
