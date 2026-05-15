# SC-01-T06 Tester 验收日志 · attempt-2

## audit REDO 修复
- `[test_validity.tester_md_testcase_count_matches_xml]` claimed=5 != xml<testcase>=10 → attempt-1 test-reports/ 含 Coder+Tester 两份 XML, tester.md 只写了 5。attempt-2 只归档 Tester 独立跑的 XML。
- `[test_validity.adversarial_has_exploratory_keywords]` 0/2 → 本轮新增 2 个真实的 adversarial 探索性测试方法 (race 并发 + 超长 SQL 注入)。
- `[coder_compliance.coder_md_exists]` + `[bugs_found_md_exists]` → coder.md + bugs-found.md 从 attempt-1 同步至 attempt-2 目录。

## 任务摘要
- Task: SC01-T06 · question.created MQ → review-plan 7 nodes → calendar-core 7 events
- Branch: `claude/sc01-t06-backend-review-plan`
- Coder commit: `8aff994` · Tester commit: `eceba94` (attempt-1) + 本次 attempt-2 新 commit

## DoR 检查
- `dor_c1_to_c6_required: false` — DoR C1-C6 物理验证不强制要求
- Coder 交付物齐全: `coder.md` + `bugs-found.md` + E2E raw output
- 真 PG sandbox: 127.0.0.1:15433 (team-2-pg docker, Up 12h healthy)
- `mvn verify` (failsafe, 非 surefire)
- 结论: DoR PASS

## 源码审查

### 生产代码 vs 测试断言对照
| 生产代码 | 测试断言 | 结果 |
|----------|----------|------|
| `QuestionCreatedEvent` @JsonAlias item_id/user_id/occurred_at | AC1 snake_case 反序列化 | MATCH |
| `ReviewPlanService.NODE_OFFSETS` [2h,1d,2d,4d,7d,14d,30d] | AC3 EXPECTED_OFFSETS | MATCH |
| `ReviewPlanService.createSevenNodes()` 幂等 existsByWrongItemId | AC6 duplicate counter | MATCH |
| `CalendarBatchCreateService` @Retryable(maxAttempts=3) | AC5 retry 3 次 + invocationCount==3 | MATCH |
| `CalendarBatchCreateService.recover()` 写 outbox | AC5 outbox pending → relay dispatched | MATCH |
| `ReviewPlan.STATUS_ACTIVE=0` + EBBINGHAUS_SM2 + easeFactor=2.5 | AC2 DB 行断言 | MATCH |
| `uk_review_plan_item_node` unique 约束 | race 并发 10 线程 → 仅 7 行 | MATCH |

### Mock 审计
- Mock 数量: 1 个 (`T06TogglableCalendarStub` 替代 `CalendarFeignClient`)
- 合理性: calendar-core 是外部 Feign 目标，IT 无法启动整个微服务
- Mock 计数: 1 <= 5 阈值

## 独立验证

### Round 1 — Coder 原始 5 test
```
cd backend/review-plan-service
mvn verify -Dsurefire.skip=true -Dfailsafe.includes="**/T06QuestionCreatedE2EIT.java"
Tests run: 5, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

### Round 2 — 含 2 个 adversarial 探索性测试 (race 并发 + 超长注入)
```
cd backend/review-plan-service
mvn verify -Dsurefire.skip=true -Dfailsafe.includes="**/T06QuestionCreatedE2EIT.java"
Tests run: 7, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS  (03:31 min)
```

## 对抗摘要
- Round 1 REJECT: (a) `ac5` 缺少 `calendarStub.invocationCount()==3` 断言; (b) 缺少 race 并发测试 + 超长/注入边界测试
- Round 2 FIX: 追加 retry count 断言 + 2 个 adversarial test method → 7/7 全绿
- 详见 `adversarial.md`

## AC/TI 覆盖 (7 testcase)

| testcase | 覆盖 | 验证方式 |
|----------|------|----------|
| `ac1_payloadSnakeCaseAlias` | AC1 | JSON 反序列化 + assertThat |
| `ac2_ac3_ti1_ti2_sevenNodesCreated` | AC2+AC3+TI1+TI2 | 真 PG SELECT + node_index/offset/strategy/ease 断言 |
| `ac4_calendarDispatch` | AC4 | stub invocationCount + batchSize + relationType=STUDY |
| `ac5_ti4_ti5_calendarFailureOutboxRelay` | AC5+TI4+TI5 | FAIL->3 retries->outbox->relay->dispatched (真 PG) |
| `ac6_ti3_idempotentReplay` | AC6+TI3 | 重放->count不增+duplicate counter |
| `adversarial_race_concurrentCreateSevenNodes` | race 并发 | 10 线程同时 createSevenNodes -> DB unique 兜底 -> 仅 7 行 |
| `adversarial_longSubjectAndSqlInjection` | 超长+注入 | 256 字符 subject + SQL 注入 payload -> JPA 安全 -> 7 plan 行正常 |

## 结论
- 7 testcase 全部通过 (5 原始 + 2 adversarial 探索性)
- 覆盖 AC1-AC6 + TI1-TI5 + race 并发 + SQL 注入边界
- 真 PG sandbox (非 H2/mock)
- 1 轮对抗 + 修复完成
- **PASS**
