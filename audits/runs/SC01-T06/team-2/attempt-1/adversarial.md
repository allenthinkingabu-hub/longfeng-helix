# SC-01-T06 Adversarial Log · attempt-1

## Round 1 — REJECT · retry count 未验证

### 发现
Coder 的 `ac5_ti4_ti5_calendarFailureOutboxRelay` 测试在 `calendarStub.setMode(StubMode.FAIL)` + `consumer.onMessage()` 后，**未断言 `calendarStub.invocationCount() == 3`**。

这意味着如果有人把 `@Retryable(maxAttempts=3)` 改为 `maxAttempts=1`，outbox 行仍会被写入（@Recover 仍触发），测试照样 5/5 全绿 — 但实际行为偏离 AC5 "3 次重试"的要求。

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
功能正确（3 次重试 + outbox 兜底），但时间参数与 spec 不一致。建议 Coder 后续 ADR 确认是否需要对齐。

---

## Round 2 — FIX + 验证通过

### 修复
在 `ac5_ti4_ti5_calendarFailureOutboxRelay` 第 274 行前插入：
```java
// AC5 · @Retryable(maxAttempts=3) 验证：stub 应被调用 3 次后 fallback 到 outbox
assertThat(calendarStub.invocationCount())
    .as("AC5 · Feign batchCreateEvents retried 3 times before outbox fallback")
    .isEqualTo(3);
```

### 再跑结果
```
mvn verify -Dsurefire.skip=true -Dfailsafe.includes="**/T06QuestionCreatedE2EIT.java"
Tests run: 5, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
Total time: 02:56 min
```

新断言 `invocationCount()==3` 通过，证实 `@Retryable` AOP 代理正常工作 — stub 被调 3 次后 `@Recover` 写 outbox。

### 我为什么相信这个修复能抓到回归
如果未来有人改了 `maxAttempts` 或去掉 `@EnableRetry`，这条断言会立即 FAIL，因为 stub 调用次数不再等于 3。这比仅检查 outbox 行存在更有检测力。
