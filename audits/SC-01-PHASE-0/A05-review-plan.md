# A05 · review-plan-service vs P-HOME/P07/P08/P09 §5 契约审计（refresh）

- **Task**: SC-01-A05（**Phase 0 P0 审计 · 仅输出 markdown · 不改业务代码**）
- **Refresh 触发**：旧版 A05 判定 0/8 端点匹配；SC-01-C05 / C06 / C07 / C08 / D01 已合入主干 → 主干现状与旧版严重不一致，本轮按 ground truth 重写。
- **Scope**: 8 个 `/api/review/*` 端点 + `question.created` 订阅 + 7 节点（T0..T6）生成契约 + `/api/home/today` MVP 子集
- **Spec 锚点**:
  - `design/system/pages/P-HOME.spec.md` §5（POST `/api/review/sessions`、GET `/api/home/today`）
  - `design/system/pages/P07-review-today.spec.md` §5（`/today`、`/sessions`、`/nodes/{nid}` GET、`/nodes/{nid}/open`）
  - `design/system/pages/P08-review-exec.spec.md` §5（`/nodes/{nid}/open|reveal|grade`）
  - `design/system/pages/P09-review-done.spec.md` §5（`/nodes/{nid}/result`、`/sessions/{sid}/next`、`/api/calendar/events/{eid}/subscribe`）
  - `biz/业务与技术解决方案_AI错题本_基于日历系统.md` §SC-01 步 10（`question.created.topic` → review-plan 生成 plan + 7 nodes）
- **Audited files**:
  - `backend/review-plan-service/src/main/java/com/longfeng/reviewplan/controller/ReviewPlanController.java`（512 行）
  - `backend/review-plan-service/src/main/java/com/longfeng/reviewplan/controller/HomeAggregatorController.java`（85 行）
  - `backend/review-plan-service/src/main/java/com/longfeng/reviewplan/controller/CalendarSubscribeController.java`（POST `/api/calendar/events/{eid}/subscribe`）
  - `backend/review-plan-service/src/main/java/com/longfeng/reviewplan/service/ReviewPlanService.java`（447 行）
  - `backend/review-plan-service/src/main/java/com/longfeng/reviewplan/service/ReviewSessionService.java`（119 行 · in-memory session）
  - `backend/review-plan-service/src/main/java/com/longfeng/reviewplan/service/NodeLifecycleTracker.java`（52 行 · opened/revealed timestamps）
  - `backend/review-plan-service/src/main/java/com/longfeng/reviewplan/algo/SM2Algorithm.java` / `AlgorithmConfig.java` / `SM2Result.java`
  - `backend/review-plan-service/src/main/java/com/longfeng/reviewplan/consumer/QuestionCreatedConsumer.java` + `QuestionCreatedEvent.java`
  - `backend/review-plan-service/src/main/java/com/longfeng/reviewplan/consumer/WrongItemAnalyzedConsumer.java` + `WrongItemAnalyzedEvent.java`
  - `backend/review-plan-service/src/main/java/com/longfeng/reviewplan/entity/ReviewPlanOutbox.java`（`EVENT_OPENED` / `EVENT_GRADED` / `EVENT_COMPLETED` / `EVENT_MASTERED` 等）
- **测试现状（覆盖证据 · 文件落盘）**:
  - `SessionFlowIT`、`NodeLifecycleIT`、`NodeResultIT`、`GradeForgotIT`、`Be13EndpointsIT`、`EbbinghausEndToEndIT`、`ForgotResetIT`、`QuestionCreatedConsumerIT`、`HomeTodayIT`、`CalendarSubscribeIT`、`SM2AlgorithmUT`、`CalendarFeignClientFallbackUT`、`ReviewPlanServiceIT`、`PushTaskOrchestratorTest` 已就位 → SC-01-C05/C06/C07/C08/D01 主链均有 IT/UT。

---

## 1. 现状

### 1.1 `ReviewPlanController` 实际 path 清单（精确扫描）

| 方法 | HTTP | 实际 path | 行号 | 说明 |
|---|---|---|---|---|
| `dayView` | GET | `/review-plans?date=&subject=` | L88 | BE-13 日视图（含 calendar 节点 feign + 缓存） |
| `listByCursor` | GET | `/review-plans/list?user_id=&status=&cursor=&limit=` | L127 | BE-13 游标翻页 |
| `getById` | GET | `/review-plans/{id}` | L148 | 单 plan 详情 |
| `complete` | POST | `/review-plans/{id}/complete` body `{quality:0-5}` | L162 | SC-08 复习主循环 · SM-2 + 乐观锁 + Outbox |
| `batchReset` | POST | `/review-plans/batch-reset` | L179 | admin 学期初清空 · `X-Admin: true` |
| `batchResetByIds` | POST | `/review-plans/batch-reset-by-ids` body `{plan_ids:[...]}` | L200 | 按 id 批量软删（BE-13） |
| `reviewStats` | GET | `/review-stats?range=&subject=` | L216 | SC-09 学情聚合 |
| **`createSession`** | **POST** | **`/api/review/sessions`** | **L239** | **SC-01-C05 #1 · 内存 session（B02 决策 A）** |
| **`today`** | **GET** | **`/api/review/today?tz=`** | **L277** | **SC-01-C05 #2 · 今日待复习** |
| **`getNode`** | **GET** | **`/api/review/nodes/{nid}`** | **L300** | **SC-01-C05 #3 · 节点详情** |
| **`openNode`** | **POST** | **`/api/review/nodes/{nid}/open`** | **L315** | **SC-01-C05 #4 · 发 review.node.opened outbox** |
| **`revealNode`** | **POST** | **`/api/review/nodes/{nid}/reveal`** | **L332** | **SC-01-C05 #5 · 记 revealed_at** |
| **`gradeNode`** | **POST** | **`/api/review/nodes/{nid}/grade`** | **L358** | **SC-01-C05 #6 · MASTERED/PARTIAL/FORGOT 三态映射 + 重排** |
| **`nextInSession`** | **POST** | **`/api/review/sessions/{sid}/next`** | **L406** | **SC-01-C05 #7 · 会话翻页** |
| **`nodeResult`** | **GET** | **`/api/review/nodes/{nid}/result`** | **L426** | **SC-01-C05 #8 · 完成结果聚合** |
| 其它（`HomeAggregatorController.homeToday`） | GET | `/api/home/today?tz=` | L48 | **SC-01-D01 · P-HOME MVP 子集** |
| 其它（`CalendarSubscribeController`） | POST | `/api/calendar/events/{eid}/subscribe` | L58 | P09 订阅日历事件（A06 §3 D3） |
| 其它（`HealthController`） | GET | `/ready` / `/live` | — | k8s 探针 |

> 全部 SC-01-C05 / D01 端点已使用 `/api/...` 绝对路径，与 spec §5 路径**字符完全一致**。

### 1.2 算法引擎类

- `algo/SM2Algorithm.java` · 纯函数 `compute(easeFactor, intervalDays, quality, cfg) → SM2Result(nextEase, nextIntervalDays)` · ADR 0013 · Q-C 规则：`quality<3` 时 ease reset 到 `cfg.easeInit` / `intervalDays=1`。
- `algo/AlgorithmConfig.java` · `@ConfigurationProperties("review.sm2")` · 字段 `easeMin/easeMax/easeInit/intervalMaxDays/qualityPenaltyStep` · 默认 `(1.3, 3.0, 2.5, 60, 0.2)`。
- `algo/SM2Result.java` · record `(nextEaseFactor, nextIntervalDays)`。
- **艾宾浩斯 7 节点偏移**仍以常量形式嵌于 `ReviewPlanService.NODE_OFFSETS`：`[Duration.ofHours(2), 1d, 2d, 4d, 7d, 14d, 30d]`（L48-L56 · 与 spec / S5 §A1 完全一致）。
- **MASTERED 触发**：`MASTERED_CONSECUTIVE_COUNT = 3`、`MASTERED_EASE_THRESHOLD = 2.8`，连续 3 次 quality≥3 且 ease≥2.8 → `planRepo.markAllMasteredByWrongItemId(...)` 软删全 7 行（Q-G 聚合根原子性）。

### 1.3 7 节点生成（T0..T6）

`ReviewPlanService.createSevenNodes(wrongItemId, studentId, baseInstant)` L97-L103：

- 幂等防护：`planRepo.existsByWrongItemId(...)` → 已存在直接返空 list；额外有 `DataIntegrityViolationException` catch 兜底唯一索引 `uk_review_plan_item_node (wrong_item_id, node_index) WHERE deleted_at IS NULL`（V1.0.055）。
- 循环 7 次：`node_index=0..6` / `strategyCode=EBBINGHAUS_SM2` / `easeFactor=cfg.easeInit (2.5)` / `status=ACTIVE` / `nextDueAt=baseInstant + NODE_OFFSETS[i]` / `currentLevel=intervalIndex=i`。
- **SC-01-C07 联动**：plan 7 行落库后 `calendarBatchCreate.dispatch(persisted)`（独立事务）批量推 calendar-core，503 走 3 次重试 + outbox 兜底。
- **SC-01-C08 联动**：`forceCreateSevenNodes(...)` 跳过 `existsByWrongItemId` 闸门 · 给 FORGOT 级联重排用（调用方先 soft-delete 旧 7 行，再调本方法重建）。
- ✅ 偏移、初始 ease、幂等三件套与 `design/arch/s5-review-plan.md` §A1 + spec §SC-01.10 完全对齐。
- ✅ B02 决策 A 已落地：`review_plan` 表承担 spec "review_node" 概念（nid ≡ `review_plan.id`），HTTP/DTO 层做命名映射，DB 层不下沉。

### 1.4 `question.created` 订阅器（SC-01-C06）

- `consumer/QuestionCreatedConsumer.java` · `@RocketMQMessageListener(topic="question.created.topic", consumerGroup="review-plan-question-created-cg")` · `@ConditionalOnProperty("review.mq.enabled")`。
- 消费 payload `QuestionCreatedEvent(itemId, userId, subject, topic, action, occurredAt)`（snake_case JsonAlias 容错）。
- 调 `service.createSevenNodes(itemId, userId, occurredAt)`，三个 micrometer counter：`success / duplicate / orphan`，tag `source=question.created`。
- **遗留 `WrongItemAnalyzedConsumer`** 仍订阅 `wrongbook.item.analyzed`（独立 consumerGroup `review-plan-cg`）→ **双源订阅**（事实，非新增设计）：
  - `question.created` = 用户在 P04 Tap 保存即触发（即时 plan 生成）。
  - `wrongbook.item.analyzed` = AI 分析完成后触发（保留以兼容 SC-02 异步通路）。
  - 同一个 `wrong_item_id` 两源任意一条先到都能走 `createSevenNodes`，幂等闸门保证不重复落 7 行。
- ✅ spec §SC-01 步 10 `question.created.topic` 链路已贯通。

### 1.5 Outbox 事件类型

`entity/ReviewPlanOutbox.java` 已定义事件名常量：`EVENT_COMPLETED="completed"` / `EVENT_MASTERED="mastered"` / `EVENT_DUE="due"` / `EVENT_OPENED="opened"` / `EVENT_GRADED="graded"` / `EVENT_CALENDAR_BATCH_CREATE` / `EVENT_CALENDAR_BATCH_DELETE`。
- `openNode` 路径写 `EVENT_OPENED` → 满足 §key_invariants `review.node.opened ≥ 1 条`。
- `gradeNode` 路径调 `writeGradedEvent(...)` 写 `EVENT_GRADED` + plan/wrongItem/quality/grade payload → 满足 `review.node.graded ≥ 1 条`。
- `complete` 路径写 `EVENT_COMPLETED` + 触发 mastered 时再写 `EVENT_MASTERED`。

---

## 2. vs Spec diff

### 2.1 八个端点逐条比对（refresh）

| # | Spec 端点 | 实际实现 | 状态 | 说明 |
|---|---|---|---|---|
| 1 | `POST /api/review/sessions` (P-HOME / P07 "全部开始") | `ReviewPlanController.createSession` L239 → `ReviewSessionService.create()` | ✅ | path/method 字符级一致；body `{date?, node_ids?, tz?}`；返 `{sid, nids[], total}`；in-memory store（B02 决策 A）。 |
| 2 | `GET /api/review/today?tz=` (P07) | `ReviewPlanController.today` L277 → `service.getDayPlans(today window)` | ✅ | path/method 字符级一致；按 `X-User-Id` + tz 解析当日 UTC 窗口；返 `TodayResp{items, total, tz}`。 |
| 3 | `GET /api/review/nodes/{nid}` (P07) | `ReviewPlanController.getNode` L300 → `service.getById(nid)` | ✅ | path/method 字符级一致；DTO `ReviewPlanDto`（含 node_index / next_due_at / ease_factor / status）。 |
| 4 | `POST /api/review/nodes/{nid}/open` (P07 / P08) | `ReviewPlanController.openNode` L315 → `service.openNode(nid)` + `EVENT_OPENED` outbox + `lifecycleTracker.markOpened(nid)` | ✅ | path/method 字符级一致；满足 §key_invariants `review.node.opened ≥ 1 条`；幂等。 |
| 5 | `POST /api/review/nodes/{nid}/reveal` (P08) | `ReviewPlanController.revealNode` L332 → `lifecycleTracker.markRevealed(nid)` | ✅ | path/method 字符级一致；仅记 `revealed_at`（不改 plan / 不发 MQ）。 |
| 6 | `POST /api/review/nodes/{nid}/grade` (P08) | `ReviewPlanController.gradeNode` L358 → `req.toQuality()` 三态映射 + `service.complete()` + `writeGradedEvent()` + `rescheduleDownstreamForForgot()` | ✅ | path/method 字符级一致；MASTERED→5 / PARTIAL→3 / FORGOT→0；FORGOT 路径走 SC-01-C08 级联重排（soft-delete 旧 7 行 + `forceCreateSevenNodes` + calendar 批量删除/重建）；满足 `review.node.graded ≥ 1 条`。 |
| 7 | `POST /api/review/sessions/{sid}/next` (P09) | `ReviewPlanController.nextInSession` L406 → `sessionService.peekNext(sid)` | ✅ | path/method 字符级一致；返 `{next_nid, completed, total, done}`；空时 done=true。 |
| 8 | `GET /api/review/nodes/{nid}/result` (P09) | `ReviewPlanController.nodeResult` L426 → plan + 最近 `ReviewOutcome` + lifecycle 时戳聚合 | ✅ | path/method 字符级一致；返 `NodeResultResp(planId, wrongItemId, nodeIndex, nodeState, quality, easeBefore/After, intervalBefore/After, nextDueAt, durationMs, mastered)`；满足 P09 hero/曲线渲染需求。 |

汇总：**8 ✅ / 0 ⚠️ / 0 ❌**（path/method 100% 字符级一致 · DTO 全部命中 spec 必需字段）。

### 2.2 `question.created` 订阅（refresh）

- 状态：✅ **已订阅**（`QuestionCreatedConsumer.java`，topic `question.created.topic`，consumerGroup `review-plan-question-created-cg`）。
- 双源订阅同时保留 `WrongItemAnalyzedConsumer`（topic `wrongbook.item.analyzed`），任意一源到达即触发 `createSevenNodes`；幂等闸门确保不重复落库。
- 与 spec §SC-01.10 流"`POST /save` → question.created.topic → review-plan"100% 对齐。
- 测试：`QuestionCreatedConsumerIT.java` 已覆盖三路（成功 / 重放 / orphan payload）。

### 2.3 7 节点生成（T0..T6）契约

- 状态：✅ **完全覆盖**。
  - 偏移 `NODE_OFFSETS = [2h, 1d, 2d, 4d, 7d, 14d, 30d]` 与 spec 一致；
  - 写入 `node_index 0..6` + `strategyCode=EBBINGHAUS_SM2` + `ease_factor=easeInit(2.5)` + `status=ACTIVE`；
  - 幂等双保险（`existsByWrongItemId` + 唯一索引 catch）满足 spec §key_invariants "重放不产生重复 plan/nodes/events"；
  - `forceCreateSevenNodes` 给 FORGOT 级联重排（SC-01-C08）跳闸门；
  - plan 落库后自动 `calendarBatchCreate.dispatch(persisted)`（SC-01-C07）→ 7 条 `calendar_event(relation_type=STUDY)`。
- 测试：`EbbinghausEndToEndIT`、`ForgotResetIT`、`GradeForgotIT`、`CalendarBatchCreateIT`、`Be13EndpointsIT` 覆盖正/异常/级联路径。

### 2.4 周边端点（spec 提及但属其它服务/Phase 范围）

| 端点 | 实现 | 状态 |
|---|---|---|
| `GET /api/home/today?tz=` (P-HOME §5) | `HomeAggregatorController.homeToday` L48 → `planRepo.findDueOnDate / countCompletedOnDate` | ✅ MVP 子集（today.{total, done, circleProgress} + resume=null）· Phase 1 再剥离至独立 home-aggregator module（A07 决策）。 |
| `POST /api/calendar/events/{eid}/subscribe` (P09 §5) | `CalendarSubscribeController` L58 | ✅ 落地 |

---

## 3. SC-01 阻塞 / 通行结论

| 维度 | 结论 | 证据 |
|---|---|---|
| 8 个 `/api/review/*` 端点 path/method | ✅ 8/8 字符级一致 | §2.1 |
| `question.created` MQ 订阅 | ✅ 已订阅 + 双源兼容 | §2.2 / `QuestionCreatedConsumer.java` |
| 7 节点生成契约（T0..T6） | ✅ 偏移 + 幂等 + 初始 ease 全对齐 | §2.3 / `NODE_OFFSETS` L48-L56 |
| SM-2 算法引擎 | ✅ ADR 0013 + Q-C 规则 | `SM2Algorithm.java` / `AlgorithmConfig.java` |
| FORGOT 重排（spec §SC-01.18 SC-04 入口） | ✅ `rescheduleDownstreamForForgot` + `forceCreateSevenNodes` + calendar 批删/批建 | `ReviewPlanService.java` L393-L437 / `GradeForgotIT.java` |
| outbox 事件类型 `opened / graded / completed / mastered` | ✅ 全部已定义 + 关键路径已写入 | `ReviewPlanOutbox.java` L22-L43 |
| §key_invariants MQ "≥ 1 条" 三事件 | ✅ `question.created` (上游 wrongbook 发) / `review.node.opened` (open 路径) / `review.node.graded` (grade 路径) | §1.5 |
| 命名分歧（spec `review_node` vs 实表 `review_plan`） | ✅ B02 决策 A：HTTP/DTO 层概念映射（nid ≡ `review_plan.id`） | `audits/SC-01-PHASE-0/B02-decision.md` |

**SC-01 黄金路径 review-plan 侧 0 阻塞**：所有 spec §5 必需端点 + MQ 订阅 + 7 节点生成契约已对齐主干，Tester 可直接走 IT/E2E 联调。

---

## 4. 跟进项（非 SC-01 阻塞 · 落入 Phase 1+ tech debt）

- 🔧 `ReviewSessionService` 内存 store · reboot 后会话丢失。当前依赖前端可重建（黄金路径单次会话内即用即弃，B02 决策已显式接受）。Phase 1+ 可引入 `review_session` 表持久化（含 expires_at）。
- 🔧 `NodeLifecycleTracker` 内存 `opened_at / revealed_at` · 同上 reboot 丢失。可下沉到 `review_outcome` 新增列（`opened_at` / `revealed_at`），本任务范围外。
- 🔧 `HomeAggregatorController` 当前承载于 review-plan-service · A07 计划 Phase 1 剥至独立 module；目前 MVP 子集已覆盖核心字段（today.total/done/circleProgress + resume），其余字段（recents / streak / pendingNotice / nextEvent / cards）留独立 module 实现。
- 🔧 `WrongItemAnalyzedConsumer` 双源订阅 · 建议 Phase 1+ ADR 统一为单源 `question.created`，但短期保留以兼容 SC-02 异步路径；幂等闸门已确保正确性。
- 🔧 OpenAPI 文档 · 当前 `@Tag(name = "review-plans"...)` 与新加的 `/api/review/*` 端点混在一个 controller class 内，可考虑 Phase 1 拆分 `ReviewSessionController` / `ReviewNodeController`（仅形貌优化，不影响 wire）。

---

## 5. 完成证据（grep / Read 全部验真）

- 控制器路径：`grep -n "@RequestMapping\|@GetMapping\|@PostMapping" backend/review-plan-service/src/main/java/com/longfeng/reviewplan/controller/ReviewPlanController.java` → 15 个路由 + 8 个 `/api/review/*` 端点全部命中（L88/L127/L148/L162/L179/L200/L216/L239/L277/L300/L315/L332/L358/L406/L426）。
- 7 节点偏移常量：`grep -n "NODE_OFFSETS" .../service/ReviewPlanService.java` → L48 定义 + L122/L123/L135 使用。
- MQ 订阅：`grep -rn "@RocketMQMessageListener" .../consumer/` → 2 处（`QuestionCreatedConsumer.java:29-31` 订阅 `question.created.topic` + `WrongItemAnalyzedConsumer.java:21-22` 订阅 `wrongbook.item.analyzed`）。
- Outbox 事件类型：`grep -n "EVENT_" .../entity/ReviewPlanOutbox.java` → 7 个常量（`EVENT_COMPLETED / EVENT_MASTERED / EVENT_DUE / EVENT_OPENED / EVENT_GRADED / EVENT_CALENDAR_BATCH_CREATE / EVENT_CALENDAR_BATCH_DELETE`）。
- 测试落盘：`ls backend/review-plan-service/src/test/java/com/longfeng/reviewplan/service/` → 13 个测试文件（含 `SessionFlowIT`、`NodeLifecycleIT`、`NodeResultIT`、`GradeForgotIT`、`EbbinghausEndToEndIT`、`ForgotResetIT`、`Be13EndpointsIT` 等）；`QuestionCreatedConsumerIT.java` 已覆盖三路。
- B02 决策依据：`audits/SC-01-PHASE-0/B02-decision.md` § Decision = A（复用 `review_plan` 表，0 new migration）。
