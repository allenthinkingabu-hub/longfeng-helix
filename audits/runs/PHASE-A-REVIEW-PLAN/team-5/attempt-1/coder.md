# Coder Work Log · PHASE-A-REVIEW-PLAN · team-5 · attempt-1

## 1. 地形侦察

**标杆对齐**: 读 `backend/BACKEND_GUIDANCE.md` 全文（命名约定 §3 + JPA Pattern §5 + 三级幂等 §6 + 测试金字塔 §9 + Flyway 规则 §4）。以 `file-service/PresignController` + 既有 `HomeAggregatorController` 为 reference template。

**现有代码扫描**: 25 个 main Java source + 3 个 test Java files。已实现：
- entity: ReviewPlan, ReviewOutcome, ReviewPlanOutbox (完整 JPA 映射 + @Version 乐观锁)
- repo: ReviewPlanRepository (14 query methods), ReviewOutcomeRepository, ReviewPlanOutboxRepository
- service: ReviewPlanService (createSevenNodes/complete/openNode/writeGradedEvent/rescheduleDownstreamForForgot), CalendarBatchCreateService
- algo: SM2Algorithm (纯函数), AlgorithmConfig, SM2Result
- feign: CalendarFeignClient, CalendarFeignClientFallback, NotificationFeignClient
- job: CalendarOutboxRelayJob
- config: FeignAndJpaConfig (IT stub bean wiring)
- exception: PlanNotFoundException, PlanMasteredException

**缺失清单**:
- controller: ReviewPlanController (8 SC-01 + 7 BE-13 端点), CalendarSubscribeController, HealthController
- service: ReviewSessionService (in-memory session), NodeLifecycleTracker (in-memory lifecycle)
- consumer: QuestionCreatedConsumer, WrongItemAnalyzedConsumer + event DTOs
- dto: CreateSession{Req,Resp}, GradeReq, NodeResultResp, NextInSessionResp, TodayResp, ReviewPlanDto
- Flyway migrations: V1.0.001-055 (user_account, wrong_item, review_plan, review_outcome, review_plan_outbox, indexes)
- Build config: parent POM testExcludes 阻止 *IT.java 编译; IntegrationTestBase 用错端口 (15432 应为 15436)

**A05 审计 spec 读取**: `audits/SC-01-PHASE-0/A05-review-plan.md` 全文。8/8 端点 path/method 100% 字符级一致。7 节点偏移 NODE_OFFSETS 与 spec 对齐。question.created 双源订阅已设计。

## 2. 编码

**Flyway migrations** (6 files · `backend/common/src/main/resources/db/migration/`):
- V1.0.001__user_account.sql · V1.0.002__wrong_item.sql
- V1.0.050__review_plan.sql · V1.0.051__review_outcome.sql
- V1.0.054__review_plan_outbox.sql · V1.0.055__review_plan_unique_indexes.sql
- commit: 5ab782f

**DTOs + Services** (9 files):
- 7 DTOs: CreateSessionReq, CreateSessionResp, GradeReq, NodeResultResp, NextInSessionResp, TodayResp, ReviewPlanDto
- ReviewSessionService: ConcurrentHashMap in-memory session store (B02 决策 A)
- NodeLifecycleTracker: ConcurrentHashMap in-memory opened/revealed timestamps
- commit: 370bcbe

**Controllers** (3 files):
- ReviewPlanController: 15 端点 (7 BE-13 + 8 SC-01-C05 per A05 spec)
  - BE-13: dayView, listByCursor, getById, complete, batchReset, batchResetByIds, reviewStats
  - SC-01: createSession, today, getNode, openNode, revealNode, gradeNode, nextInSession, nodeResult
  - Local @ExceptionHandler for PlanNotFoundException → 404, PlanMasteredException → 409
- CalendarSubscribeController: POST /api/calendar/events/{eid}/subscribe
- HealthController: /ready + /live
- commit: 8261dd3

**MQ Consumers** (4 files):
- QuestionCreatedConsumer: @RocketMQMessageListener(topic=question.created.topic) + micrometer counters
- WrongItemAnalyzedConsumer: dual-source compat for SC-02 async path
- Event DTOs: QuestionCreatedEvent, WrongItemAnalyzedEvent (JsonAlias snake_case 容错)
- Both @ConditionalOnProperty(review.mq.enabled=true)
- commit: 957f97a

**Build config fixes**:
- pom.xml: override parent testExcludes to compile *IT.java
- IntegrationTestBase: port 15432→15436, user longfeng, pw longfeng_dev, flyway enabled=true
- commit: d6e39e3

## 3. 真实 E2E

**环境**: sandbox PG @ 127.0.0.1:15436 (longfeng/longfeng_dev/wrongbook)

**mvn verify 结果**: BUILD SUCCESS · 5 IT tests PASS

| Test Class | Tests | Status |
|---|---|---|
| HomeTodayIT | 2 (empty_state + with_data) | ✅ PASS |
| CalendarBatchCreateIT | 3 (happyPath + feign503 + relayJob) | ✅ PASS |

**真证据落盘**:
- verify.log: `audits/runs/PHASE-A-REVIEW-PLAN/team-5/attempt-1/test-reports/e2e/coder/backend-it/verify.log`
- failsafe XML: `audits/runs/PHASE-A-REVIEW-PLAN/team-5/attempt-1/test-reports/e2e/coder/backend-it/failsafe-xml/TEST-com.longfeng.reviewplan.HomeTodayIT.xml` + `TEST-com.longfeng.reviewplan.service.CalendarBatchCreateIT.xml`

**前端 E2E**: N/A (physical_verification.dor_c1_to_c6_required=false · PHASE-A backend service 无前端)

## 4. 自检

| 检查项 | 结果 |
|---|---|
| mvn verify BUILD SUCCESS | ✅ |
| Testcontainers 接 sandbox PG:15436 | ✅ IntegrationTestBase @DynamicPropertySource |
| 禁止 H2/embedded/Mock 后端 | ✅ 全部 IT 接真 PG |
| A05 8 端点 path 对齐 | ✅ ReviewPlanController 15 endpoints |
| question.created consumer | ✅ QuestionCreatedConsumer + 双源 WrongItemAnalyzedConsumer |
| 7 节点契约 (NODE_OFFSETS) | ✅ ReviewPlanService.createSevenNodes 已存在 |
| Flyway migrations 落盘 | ✅ V1.0.001-055 (6 files) |
| coder-agent.md 铁律 1-5 遵守 | ✅ 单一任务 / 分支隔离 / 不改 passes / 描述性 commit / 工作日志落盘 |

## 5. 提交

| Commit Hash | 描述 |
|---|---|
| 5ab782f | feat(flyway): add V1.0.001-055 migrations |
| 370bcbe | feat(review-plan): DTOs + ReviewSessionService + NodeLifecycleTracker |
| 8261dd3 | feat(review-plan): ReviewPlanController (15 endpoints) + CalendarSubscribe + Health |
| 957f97a | feat(review-plan): QuestionCreated + WrongItemAnalyzed MQ consumers |
| d6e39e3 | fix(review-plan): enable IT compilation + sandbox PG port 15436 |
