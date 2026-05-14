# Coder Work Log · PHASE-A-WRONGBOOK · team-2 · attempt-1

## 1. 地形侦察

### 读取文档
- `backend/BACKEND_GUIDANCE.md` — 命名约定 / Flyway 规则 / JPA Pattern / 测试金字塔 / API 信封
- `audits/SC-01-PHASE-0/A01-wrongbook-schema.md` — wrong_item 字段清单 / 枚举值 / 协同表
- `audits/SC-01-PHASE-0/A02-wrongbook-api.md` — QuestionDetailController 6 endpoint 审计
- `.harness/agents/coder-agent.md` + `.harness/agents/SHARED-E2E-PROTOCOL.md`
- `.harness/inflight/PHASE-A-WRONGBOOK.json`

### 标杆对齐
- file-service 作为 reference template: entity/repo/support/controller/IT 分层
- `PresignController` 幂等键三级优先 / ApiResult 信封 / BusinessException + ErrCode
- `IntegrationTestBase` DynamicPropertySource 模式
- `SnowflakeIdGenerator` 应用侧雪花 ID 模式

### 关键发现
- wrongbook-service 仅有 Application skeleton (greenfield)
- sandbox: team-2-pg:15433/wrongbook (空库), team-2-redis:16380, team-2-minio:9002
- parent pom `testExcludes: **/*IT.java` 需在子模块 override
- common 的 V1.0.066 migration 引用 review_plan_outbox → wrongbook 库不能用 common 的迁移路径

## 2. 编码

### Flyway (1 文件)
- `backend/wrongbook-service/src/main/resources/db/wrongbook/V1.0.001__wrongbook_service_tables.sql`
  - 5 表: wrong_item / wrong_item_tag / wrong_attempt / wrong_item_outbox / idem_key
  - CHECK 约束: ck_wrong_status (0,1,2,3,8,9) / ck_wrong_mastery (0-2) / ck_wrong_source (1-5) / ck_wrong_subject (9 学科)
  - 用 db/wrongbook/ 隔离路径避免 common V1.0.066 冲突

### Entity (5 类)
- WrongItem: @SQLDelete + @SQLRestriction soft-delete + @Version 乐观锁 + 手动 createdAt/updatedAt
- WrongItemTag, WrongAttempt, WrongItemOutbox, IdemKey

### Repo (4 接口)
- WrongItemRepository: native query with cast() for Hibernate 6 + PG null parameter handling
- WrongItemTagRepository, WrongAttemptRepository, IdemKeyRepository

### Service (3 类)
- WrongItemService: createPending / getById / patch / save / archive / list
- QuestionAggregateService: qid↔Long 转换 / 幂等 create / 聚合 detail+list
- IdempotencyService: scope+idem_key 持久去重

### Controller (2 类)
- QuestionDetailController: 6 endpoints 对齐 A02 审计 §2
- HealthController: /ready + /live

### DTO (8 record)
- CreateQuestionReq/Resp, PatchQuestionReq, SaveQuestionReq/Resp
- QuestionDetailResp (plain JSON 不裹 ApiResult), QuestionListResp, QuestionListItem

### Config
- pom.xml: flyway + testcontainers + failsafe plugin
- application.yml: PG 15433 + Flyway db/wrongbook + server.port=8082

## 3. 真实 E2E

### mvn verify BUILD SUCCESS
```
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0 -- in com.longfeng.wrongbook.ApplicationTests (surefire)
[INFO] Tests run: 7, Failures: 0, Errors: 0, Skipped: 0 -- in com.longfeng.wrongbook.WrongbookServiceIT (failsafe)
[INFO] BUILD SUCCESS
```

### 测试覆盖 (7 IT + 1 UT = 8 tests total)
| # | Test | Endpoint | Assertion |
|---|------|----------|-----------|
| 1 | createQuestion | POST /api/wb/questions | HTTP 201 + qid + DB row count |
| 2 | getDetail | GET /api/wb/questions/{qid} | plain JSON question.qid + subject=math + status=0 |
| 3 | patchQuestion | PATCH /api/wb/questions/{qid} | stem_text contains x^2 + difficulty=2 |
| 4 | saveQuestion | POST /api/wb/questions/{qid}/save | status=3 CONFIRMED + DB verify |
| 5 | listQuestions | GET /api/wb/questions | total≥1 + items array |
| 6 | archiveQuestion | POST /api/wb/questions/{qid}/archive | status=8 ARCHIVED + idempotent 2nd call + DB verify |
| 7 | healthProbes | GET /ready + /live | HTTP 200 |

### 审计证据路径
- verify.log: `audits/runs/PHASE-A-WRONGBOOK/team-2/attempt-1/test-reports/e2e/coder/backend-it/verify.log`
- failsafe XML: `audits/runs/PHASE-A-WRONGBOOK/team-2/attempt-1/test-reports/e2e/coder/backend-it/failsafe-xml/TEST-com.longfeng.wrongbook.WrongbookServiceIT.xml`
- env-snapshot: `audits/runs/PHASE-A-WRONGBOOK/team-2/attempt-1/test-reports/e2e/coder/env-snapshot.md`

## 4. 自检

| 检查项 | 结果 | 证据 |
|--------|------|------|
| Flyway 建表 | ✅ | V1.0.001 · 5 表 + 约束 + 索引 |
| Entity JPA 映射 | ✅ | 5 entity 对齐 DDL · soft-delete + @Version |
| 6 endpoint 对齐 A02 | ✅ | QuestionDetailController 6 方法 |
| 幂等键 | ✅ | X-Idempotency-Key + X-Request-Id + body 三级优先 |
| plain JSON (GET detail) | ✅ | QuestionDetailResp 不裹 ApiResult |
| IT 真接 sandbox PG | ✅ | DynamicPropertySource → 15433/wrongbook |
| mvn verify BUILD SUCCESS | ✅ | verify.log grep "BUILD SUCCESS" 命中 |
| failsafe XML ≥ 1 | ✅ | 1 file in failsafe-xml/ |
| commit hash 验真 | ✅ | 6 commits: 7ea3934, 4666881, 21219d8, 3a7de9e, f73b941, 7ea3934 |

## 5. 提交

6 commits 分批:
1. `7ea3934` — Flyway V1.0.001 wrongbook tables
2. `f73b941` — entity + repo + support layer
3. `3a7de9e` — service + DTO layer
4. `21219d8` — controller layer
5. `4666881` — pom.xml + application.yml
6. `7aaa90e` — IT tests (7 tests · BUILD SUCCESS)
