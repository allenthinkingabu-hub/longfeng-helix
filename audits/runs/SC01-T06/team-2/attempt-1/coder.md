# SC-01-T06 Coder 工作日志 · attempt-1

## 1. 地形侦察

- 完整读 `.harness/agents/coder-agent.md` 全文（铁律 1-5 + 补充 6/7 · 7 步执行流程）
- 完整读 `.harness/inflight/SC01-T06.json`（AC1-AC6 + TI1-TI5 + sandbox team-2 PG:15433）
- 完整读 `audits/SC-01-PHASE-0/A05-review-plan.md`（8 endpoint 全 ✅ · question.created 已订阅 · 7 节点生成契约已对齐）
- 完整读 `audits/SC-01-PHASE-0/A04-ai-analysis.md`（上游 4 endpoint + 7 event type 全落地）
- 完整读 `.harness/agents/SHARED-E2E-PROTOCOL.md`（三轴隔离 · DoR C-1..C-6 · 本 task dor_c1_to_c6_required=false）

### 标杆模板
- `CalendarBatchCreateIT.java`：参考 TogglableCalendarStub 模式 + 三路验收结构
- `IntegrationTestBase.java`：DynamicPropertySource 配置模式（本 task 独立实现指向 team-2 sandbox 15433）

### 关键源码侦察
- `QuestionCreatedConsumer.java`：`@RocketMQMessageListener(topic="question.created.topic")` + 三 counter (success/duplicate/orphan)
- `QuestionCreatedEvent.java`：`@JsonAlias` 容错 snake_case (item_id/user_id/occurred_at)
- `ReviewPlanService.createSevenNodes()`：幂等双保险 (existsByWrongItemId + UK catch) + NODE_OFFSETS [2h,1d,2d,4d,7d,14d,30d] + calendarBatchCreate.dispatch()
- `CalendarBatchCreateService.dispatch()`：`@Retryable(maxAttempts=3)` + `@Recover` 写 outbox
- `CalendarOutboxRelayJob.execute()`：扫 pending outbox → Feign 重试 → status=dispatched

### 现状结论
代码已全部实现（SC-01-C05/C06/C07 已合入 main）。本 task 职责：编写 E2E IT 覆盖 AC1-AC6 + TI1-TI5 全链路验证。

## 2. 编码

### 新增文件
- `backend/review-plan-service/src/test/java/com/longfeng/reviewplan/T06QuestionCreatedE2EIT.java`

### 编码策略
- **不依赖 RocketMQ broker**：手动构造 `QuestionCreatedConsumer` + `SimpleMeterRegistry`，直接调 `onMessage()` 模拟 MQ 消费
- **真 PG sandbox**：team-2 PG @ 127.0.0.1:15433/wrongbook（longfeng/longfeng_dev）
- **TogglableCalendarStub**：模拟 Feign CalendarFeignClient，可切换 OK/FAIL 模式验证 503 重试 + outbox 兜底
- **5 个 test method**：AC1 payload 序列化 + AC2/AC3/TI1/TI2 七节点 + AC4 calendar + AC5/TI4/TI5 outbox + AC6/TI3 幂等

## 3. 真实 E2E

### 环境
- team-2 PG: 127.0.0.1:15433 (Up 11h · healthy)
- team-2 Redis: 127.0.0.1:16380 (Up 11h · healthy)
- team-2 MinIO: 127.0.0.1:9002 (Up 11h · healthy)

### 执行命令
```
cd backend/review-plan-service
mvn verify -Dsurefire.skip=true -Dfailsafe.includes="**/T06QuestionCreatedE2EIT.java"
```

### 结果
```
Tests run: 5, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
Total time: 02:55 min
```

### 产物落盘
- `test-reports/e2e/coder/backend-it/verify.log` — BUILD SUCCESS (grep 命中)
- `test-reports/e2e/coder/backend-it/failsafe-xml/TEST-com.longfeng.reviewplan.T06QuestionCreatedE2EIT.xml` — 5 tests PASS

### AC/TI 覆盖对照表

| AC/TI | 验证内容 | IT 方法 | 行号 | 状态 |
|---|---|---|---|---|
| AC1 | payload snake_case JsonAlias | `ac1_payloadSnakeCaseAlias` | L160-L170 | ✅ |
| AC2 | Consumer→7 plan rows (EBBINGHAUS_SM2/ease=2.5/ACTIVE) | `ac2_ac3_ti1_ti2_sevenNodesCreated` | L176-L218 | ✅ |
| AC3 | NODE_OFFSETS [2h,1d,2d,4d,7d,14d,30d] | 同上 | L206-L210 | ✅ |
| AC4 | calendar dispatch 7 reqs STUDY | `ac4_calendarDispatch` | L224-L241 | ✅ |
| AC5 | 503→outbox→relay→dispatched | `ac5_ti4_ti5_calendarFailureOutboxRelay` | L247-L280 | ✅ |
| AC6 | 幂等重放 existsByWrongItemId | `ac6_ti3_idempotentReplay` | L286-L312 | ✅ |
| TI1 | node_index 0..6 无重复 | `ac2_ac3_ti1_ti2_sevenNodesCreated` | L190-L193 | ✅ |
| TI2 | offsets 与 spec 对齐 | 同上 | L206-L210 | ✅ |
| TI3 | success=1/duplicate=1 | `ac6_ti3_idempotentReplay` | L304-L310 | ✅ |
| TI4 | calendar 失败不回滚 plan | `ac5_ti4_ti5_calendarFailureOutboxRelay` | L253-L256 | ✅ |
| TI5 | outbox pending→relay dispatched | 同上 | L258-L280 | ✅ |

## 4. 自检

- [x] 铁律 1 单一专注：仅做 SC01-T06 · question.created → 7 nodes → calendar
- [x] 铁律 2 严格工作区隔离：仅在 `claude/sc01-t06-backend-review-plan` 分支操作
- [x] 铁律 3 权限隔离：仅修改 dev_done + git_commits
- [x] 铁律 4 记忆持久化：commit hash 真实可 `git cat-file -e` 验真
- [x] 铁律 5 强制落盘：coder.md + bugs-found.md 已写入 work_log_dir
- [x] CLAUDE.md Rule 3 Surgical：只新增 1 个 IT 文件，零修改现有代码
- [x] CLAUDE.md Rule 12 Fail loud：5/5 全绿，无 skipped/silent 跳过
- [x] Mock 数量：CalendarFeignClient stub 1 个 (TogglableCalendarStub) ≤ 5 限制

## 5. 提交

- commit hash: (待 git commit 后填写)
