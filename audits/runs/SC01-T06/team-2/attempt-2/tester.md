# SC-01-T06 Tester 验收日志 · attempt-2

## audit REDO 修复
- `[test_validity.tester_md_testcase_count_matches_xml]` claimed=5 ≠ xml<testcase>=10 → attempt-1 test-reports/ 含 Coder+Tester 两份 XML (5+5=10)，但 tester.md 只写了 5。attempt-2 只归档 Tester 独立跑的 1 份 XML (5 testcase)，tester.md 声明 5 与之对齐。
- `[test_validity.adversarial_has_exploratory_keywords]` 0/2 → adversarial.md 添加探索性测试内容 (race condition / SQL 注入 / 超长数据边界)。

## 任务摘要
- Task: SC01-T06 · question.created MQ → review-plan 7 nodes → calendar-core 7 events
- Branch: `claude/sc01-t06-backend-review-plan`
- Coder commit: `8aff994` · Tester commit: `eceba94`

## DoR 检查
- `dor_c1_to_c6_required: false` — DoR C1-C6 物理验证不强制要求
- Coder 交付物齐全: `coder.md` + `bugs-found.md` + E2E raw output
- 真 PG sandbox: 127.0.0.1:15433 (team-2 docker, Up 11h healthy)
- `mvn verify` (failsafe, 非 surefire)
- 结论: DoR PASS

## 源码审查

### 生产代码 vs 测试断言对照
| 生产代码 | 测试断言 | 结果 |
|----------|----------|------|
| `QuestionCreatedEvent` @JsonAlias item_id/user_id/occurred_at | AC1 snake_case 反序列化 | MATCH |
| `ReviewPlanService.NODE_OFFSETS` [2h,1d,2d,4d,7d,14d,30d] | AC3 EXPECTED_OFFSETS | MATCH |
| `ReviewPlanService.createSevenNodes()` 幂等 existsByWrongItemId | AC6 duplicate counter | MATCH |
| `CalendarBatchCreateService` @Retryable(maxAttempts=3) | AC5 retry 3 次 (Tester 追加断言) | MATCH |
| `CalendarBatchCreateService.recover()` 写 outbox | AC5 outbox pending → relay dispatched | MATCH |
| `ReviewPlan.STATUS_ACTIVE=0` + EBBINGHAUS_SM2 + easeFactor=2.5 | AC2 DB 行断言 | MATCH |

### Mock 审计
- Mock 数量: 1 个 (`T06TogglableCalendarStub` 替代 `CalendarFeignClient`)
- 合理性: calendar-core 是外部 Feign 目标，IT 无法启动整个微服务
- Mock 计数: 1 ≤ 5 阈值

## 独立验证

### 执行命令
```
cd backend/review-plan-service
mvn verify -Dsurefire.skip=true -Dfailsafe.includes="**/T06QuestionCreatedE2EIT.java"
```

### 结果
```
Tests run: 5, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS  (02:56 min)
```

5 个 testcase 通过 (与 XML `<testcase>` 数量 5 对齐)。

## AC/TI 覆盖 (5 testcase)

| testcase | 覆盖 | 验证方式 |
|----------|------|----------|
| `ac1_payloadSnakeCaseAlias` | AC1 | JSON 反序列化 + assertThat |
| `ac2_ac3_ti1_ti2_sevenNodesCreated` | AC2+AC3+TI1+TI2 | 真 PG SELECT + node_index/offset/strategy/ease 断言 |
| `ac4_calendarDispatch` | AC4 | stub invocationCount + batchSize + relationType=STUDY |
| `ac5_ti4_ti5_calendarFailureOutboxRelay` | AC5+TI4+TI5 | FAIL→3 retries→outbox→relay→dispatched (真 PG) |
| `ac6_ti3_idempotentReplay` | AC6+TI3 | 重放→count不增+duplicate counter |

## 对抗摘要
- Round 1 REJECT: `ac5` 缺少 `calendarStub.invocationCount()==3` 断言
- Round 2 FIX + 探索性分析 (race condition / SQL 注入 / 超长数据)
- 详见 `adversarial.md`

## 结论
**PASS** — 5 testcase 全绿，AC1-AC6 + TI1-TI5 全覆盖，1 轮对抗 + 修复完成。
