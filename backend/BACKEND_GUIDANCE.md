# Backend Guidance

> **Status**: Active · 后端工程规范入口
> **Last-updated**: 2026-05-14
> **Owner**: backend
> **Purpose**: 给新贡献者 / AI agent (Coder/Tester) 一个 5 分钟读完的导航 · Coder 7 步流程 step 2「全栈上下文恢复」**必读**

---

## 1 · 项目使命 + 设计哲学

**北极星**：可演进的多模块 Spring Boot 单体 · 业务清晰边界 · 测试金字塔三层闭环 · Coder/Tester sub-agent 能用 grep 找到标杆模板。

**核心原则**（按优先级 · 与 CLAUDE.md 12 条工程德行对齐）：
1. **Pattern-first** — 写任何新代码前先 `grep` 找同类模块当 reference template（CLAUDE.md Rule 11 + Coder Agent 步骤 3 "标杆对齐"）
2. **Common-first** — 公共能力 (DTO / Exception / 工具类) 放 `backend/common/` · 单服务只放该服务专有
3. **Idempotency-first** — 任何写操作必须支持三级幂等键 (Header > requestId > body)
4. **Migration-as-code** — DDL **不允许**手动改 DB · 必须走 Flyway `V1.0.XXX__purpose.sql`
5. **Test-pyramid-mandatory** — 任何 controller/service 至少 1 个 UT + 1 个 IT (`Testcontainers`)

---

## 2 · 项目结构 (Multi-module Maven)

```
backend/
├── common/                         ← 公共模块 (DTO / Exception / 通用工具)
│   └── src/main/
│       ├── java/com/longfeng/common/
│       │   ├── dto/                  ← ApiResult, PageReq, PageResp
│       │   ├── exception/            ← BusinessException, ErrCode, GlobalExceptionHandler
│       │   ├── support/              ← 通用工具类
│       │   └── validation/           ← Bean Validation 扩展
│       └── resources/
│           └── db/migration/         ← Flyway 迁移文件 (V1.0.XXX__*.sql · 跨服务共享 schema)
├── file-service/                   ← S6 · 文件上传 · presign / complete / download · MinIO/OSS · EXIF strip
│   ├── pom.xml                       ← Spring Boot Web + JPA + Validation + Redis + MinIO + Thumbnailator
│   └── src/main/java/com/longfeng/fileservice/
│       ├── controller/                 ← @RestController · path 前缀 /api/file
│       ├── entity/                     ← @Entity wb_file / wb_file_lifecycle
│       ├── repo/                       ← Spring Data JPA Repository
│       ├── provider/                   ← StorageProvider SPI (MinIO impl + OSS impl)
│       ├── support/                    ← SnowflakeIdGenerator / ObjectKeyBuilder
│       └── config/                     ← Spring 配置
└── review-plan-service/            ← S5 · 复习计划 · SM-2 + Ebbinghaus 7 nodes
    └── src/main/java/com/longfeng/reviewplan/
        ├── controller/                 ← path 前缀 /api/review
        ├── algo/                       ← SM2Algorithm.java (纯函数 · ADR 0013)
        ├── consumer/                   ← RocketMQ @RocketMQMessageListener
        ├── feign/                      ← Feign Client (调 calendar-core)
        └── job/                        ← XXL-Job 定时任务

未实施 (各 spec.md §5 spec'd · 等立项):
- auth-service · anonymous-service · wrongbook-service · ai-analysis-service · calendar-core · notification-service
```

**新增 service 模板**：先 `cp -r backend/file-service backend/<new-svc>` + 改 artifactId + 改 controller 包路径 + 改 application.yml port。**不要**从零起。

---

## 3 · 命名约定 (严格遵守)

### 3.1 Java 类命名

| 类型 | 模式 | 真证例 |
|---|---|---|
| Controller | `<Resource>Controller` | `PresignController` · `QuestionDetailController` · `ReviewPlanController` |
| Service (业务) | `<Resource>Service` | `IdempotencyService` · `ReviewPlanService` · `ReviewSessionService` |
| Service (聚合) | `<Resource>AggregateService` | `QuestionAggregateService` |
| Repository | `<Entity>Repository` (Spring Data) 或 `<Entity>QueryRepository` (Custom) | `WbFileRepository` · `WrongItemQueryRepository(Impl)` |
| Entity | `<TableNamePascalCase>` (无 Entity 后缀) | `WbFile` ↔ `wb_file` · `WrongItem` ↔ `wrong_item` |
| Request DTO | `<Action><Resource>Req` | `CreateQuestionReq` · `PatchQuestionReq` |
| Response DTO | `<Action><Resource>Resp` | `QuestionDetailResp` · `SaveQuestionResp` |
| SPI | `<Capability>Provider` | `AttachmentStorage`/`StorageProvider` |
| Support 工具 | `<Purpose>` (名词 · 不加 Util) | `SnowflakeIdGenerator` · `ObjectKeyBuilder` |

### 3.2 包结构 (强约定)

```
com.longfeng.<service-name>/
├── controller/      ← 仅做 HTTP 入口 · 不写业务 · @RestController
├── service/         ← 业务逻辑 · @Service · 调 repo + provider
├── repo/            ← Spring Data Repository · 写 query · 不写 service 逻辑
├── entity/          ← @Entity · JPA 映射 · 只字段 + 关系 + 不变量校验
├── dto/             ← Request/Response · record 优先
├── provider/        ← 外部依赖适配 (Storage / AI / MQ) · SPI 模式
├── support/         ← 工具类 (ID 生成器 / Key 拼装) · 无状态
├── config/          ← @Configuration · @ConfigurationProperties
├── consumer/        ← @RocketMQMessageListener · 消费 MQ
├── job/             ← XXL-Job 定时任务
└── feign/           ← Feign Client + Fallback
```

### 3.3 HTTP path 规约

- 域前缀: `/api/<domain>` · 例 `/api/file` `/api/wb` `/api/review` `/api/ai` `/api/calendar` `/api/auth` `/api/anon`
- 资源用复数 + path variable: `/api/wb/questions/{qid}` · `/api/review/nodes/{nid}`
- 子动作用 RESTful: `POST /{qid}/save` · `POST /{qid}/archive` · `POST /{nid}/grade`
- **legacy path** (`/wrongbook/items`) 保留但已 deprecate · 新代码走 `/api/wb/*`

---

## 4 · Flyway 迁移规则

### 4.1 文件命名

```
backend/common/src/main/resources/db/migration/V1.0.XXX__<purpose>.sql
```

- `V1.0.XXX` 三位数字递增 · 当前最新 `V1.0.066` (review_plan_outbox_calendar_event_type)
- `__<purpose>` 下划线 + 中划线分隔 · 描述这次迁移做了什么 · 例 `__wb_file.sql` / `__review_plan_outbox_calendar_event_type.sql`
- 跨服务共享 schema 的迁移 (含外键 / 公共表) 全部走 `backend/common/` · 单服务私有表也可放该目录 (用 schema 区分)

### 4.2 写迁移的金科玉律

1. **追加式 · 不可改历史**：合并到 main 的迁移**永远**不能改 · 修 bug 用下一个 V 番号
2. **可重放 · 0 副作用**：每个迁移必须可在干净 DB + 已运行过的 DB 上幂等执行 (`IF NOT EXISTS` / `CREATE OR REPLACE`)
3. **空操作迁移有用**：审计性变更不需要 DDL 时，落一个 `SELECT 1 WHERE FALSE` 占位 (例 `V1.0.064__wb_question_sc01_align.sql`)
4. **DDL + DML 分文件**：DDL 一个文件 · 数据回填一个文件 · 不混

### 4.3 索引命名

- 表行索引: `idx_<table>_<columns>` 例 `idx_wrong_student_status`
- 唯一约束: `uk_<table>_<columns>` 例 `uk_review_plan_item_node`
- 外键约束: `fk_<from_table>_<to_table>` 
- Check 约束: `ck_<table>_<column>` 例 `ck_wrong_status`

---

## 5 · JPA Pattern

### 5.1 必须有的字段 / 注解

每个 entity **必须**含：

```java
@Entity
@Table(name = "wrong_item")
@SQLDelete(sql = "UPDATE wrong_item SET deleted_at = now() WHERE id = ? AND version = ?")
@SQLRestriction("deleted_at IS NULL")
@EntityListeners(AuditingEntityListener.class)
public class WrongItem {
  @Id
  private Long id;                          // 应用侧雪花 ID (SnowflakeIdGenerator)

  @Version                                   // 乐观锁 · 防并发覆盖
  private Long version;

  @CreatedDate
  @Column(name = "created_at", updatable = false)
  private OffsetDateTime createdAt;

  @LastModifiedDate
  @Column(name = "updated_at")
  private OffsetDateTime updatedAt;

  @Column(name = "deleted_at")               // 软删
  private OffsetDateTime deletedAt;

  // ... 业务字段
}
```

### 5.2 软删铁律

- **任何 entity 都软删** (`deleted_at TIMESTAMPTZ` + `@SQLDelete` + `@SQLRestriction("deleted_at IS NULL")`)
- 不允许 `delete from <table>` 物理 SQL · 永远用 `entity.setDeletedAt(now())` 或让 `@SQLDelete` 拦截
- 查询如需查软删的 (审计场景) 用 `@SQLRestriction` 之外的原生 SQL

### 5.3 ID 生成

- **不用** DB 自增 (跨分库不友好)
- **用** `SnowflakeIdGenerator` 应用侧外发号 · 雪花 64bit · 同进程线程安全
- HTTP 层把 BIGINT id 适配成 String qid (前端友好 · 防 JS 大数精度丢失) · 由 `QuestionAggregateService.parseId()` 双向转换

---

## 6 · 三级幂等模式

### 6.1 写操作必须支持幂等

任何 `POST` / `PATCH` / `DELETE` (有副作用) 都接受幂等键 · 三级优先：

```java
@PostMapping
public ResponseEntity<CreateQuestionResp> create(
    @RequestBody CreateQuestionReq req,
    @RequestHeader(value = "X-Idempotency-Key", required = false) String headerIdemKey,
    @RequestHeader(value = "X-Request-Id", required = false) String requestId
) {
  // 三级优先: Header > requestId > body
  String idemKey = Optional.ofNullable(headerIdemKey)
      .orElse(Optional.ofNullable(requestId).orElse(req.idempotencyKey()));
  if (idemKey == null || idemKey.isBlank()) {
    throw new BusinessException(ErrCode.VALIDATION_FAILED, "msgkey:common.error.idempotency_key_required");
  }
  return aggregateService.createPending(req, idemKey);
}
```

### 6.2 幂等实现两种 (按场景选)

| 方式 | 适用场景 | 真证例 |
|---|---|---|
| **Redis 24h TTL** (轻量) | presign / 短时窗口幂等 (24h 内重发同 key 返同结果) | `PresignController` field-inject `StringRedisTemplate` · key `idem:file:presign:{tenantId}:{studentId}:{X-Idempotency-Key}` |
| **idem_key 全局表** (持久) | 跨进程 / 长时窗口 / 强一致 | `IdempotencyService.peek/tryClaim` · 表 `idem_key(scope, idem_key)` (V1.0.052) |

### 6.3 缺幂等键的错误码

```java
throw new BusinessException(
    ErrCode.VALIDATION_FAILED,  // → HTTP 400
    "msgkey:file.error.idempotency_key_required"
);
```

**禁止**返 500 / NPE 泄漏 (T01 AC6 红线)。

---

## 7 · API 响应信封

### 7.1 两种信封 · 按场景选 · 不要混用

| 场景 | 信封 | 真证例 |
|---|---|---|
| **默认** | `ApiResult<T>` (`{code, message, data}`) | `WrongItemController` · `PresignController` 全部 |
| **聚合详情** (FE destructure) | **plain JSON** (不裹 ApiResult) | `QuestionDetailController.get(qid)` 返 `QuestionDetailResp{question, plannedNodes}` 直接 (A02 audit §3.4 决策) |

### 7.2 plain JSON 决策依据

`QuestionDetailController` class javadoc L34-40 显式声明：
> FE destructures top-level `data.question + data.plannedNodes`, so wrapping in ApiResult would push everything one level deeper and break P04 rendering.

**这是 P04 spec §5 GET 触点对应的契约形状** · 不要回退到 ApiResult 信封。

### 7.3 错误响应 (无论信封) 统一格式

```json
{
  "code": 40001,
  "message": "幂等键必填",
  "msgkey": "file.error.idempotency_key_required",
  "details": { /* optional · 验证失败时的字段错误列表 */ }
}
```

由 `GlobalExceptionHandler` 拦 `BusinessException` 自动转。

---

## 8 · 错误处理

### 8.1 三件套

```java
// 1. 业务异常
throw new BusinessException(ErrCode.VALIDATION_FAILED, "msgkey:file.error.idempotency_key_required");

// 2. 错误码 enum (定义在 common/exception/ErrCode.java)
public enum ErrCode {
  VALIDATION_FAILED(40001, 400),
  IDEMPOTENCY_CONFLICT(40901, 409),
  RESOURCE_NOT_FOUND(40401, 404),
  INTERNAL_ERROR(50001, 500);
  // code (业务码) + httpStatus
}

// 3. 全局兜底 (common/exception/GlobalExceptionHandler.java)
@ControllerAdvice
public class GlobalExceptionHandler {
  @ExceptionHandler(BusinessException.class)
  public ResponseEntity<ApiResult<?>> handle(BusinessException e) {
    // 映射 ErrCode → HTTP status + msgkey → i18n
  }
}
```

### 8.2 msgkey 国际化

- 错误 message 不写中文/英文 · 写 `msgkey:` 前缀
- 真正翻译由 FE i18n 表 (`frontend/packages/i18n/`) 按 `msgkey` 查表
- 后端只负责给一个稳定的 key · 不负责 locale 选择

---

## 9 · 测试金字塔 (三层闭环)

| 层 | 工具 | 数量比例 | 命名 | 跑命令 |
|---|---|---|---|---|
| **UT** (Unit Test) | JUnit 5 + Mockito + AssertJ | 70% | `<Class>Test.java` 例 `PresignControllerTest` | `mvn -pl <svc> test` (surefire) |
| **IT** (Integration Test · Testcontainers) | Spring `@SpringBootTest` + `@AutoConfigureMockMvc` + Testcontainers (PG + Redis + MinIO) | 25% | `<Feature>IT.java` 例 `PresignRealPgIT` · `MockMvcSmokeIT` | `mvn -pl <svc> verify` (failsafe) |
| **E2E** (跨进程 · 跨服务) | Coder `<Task>E2EIT.java` + Tester `<Task>AdversarialIT.java` (走 `.harness/agents/SHARED-E2E-PROTOCOL.md` 协议) | 5% | `<Task>E2EIT.java` 例 `T01CaptureToPendingE2EIT` | `mvn -pl <svc> verify -Dgroups=e2e` |

**铁律**:
- UT 不依赖任何外部资源 (DB / Redis / MQ / HTTP) · 全部 mock
- IT 依赖 **真容器** · 通过 Testcontainers 起 PG / Redis / MinIO · **绝不 mock**
- E2E 走 SHARED-E2E-PROTOCOL.md DoR C-1..C-6 卡口 · 必须真启动浏览器 + 真后端

---

## 10 · 配置 (Spring profiles)

| Profile | 用途 | 数据库 | 启用方式 |
|---|---|---|---|
| `dev` (默认) | 本地开发 | local Docker compose | `--spring.profiles.active=dev` |
| `test` | UT (Spring Test 自动) | H2 in-memory | `@ActiveProfiles("test")` |
| `it` | IT (Testcontainers) | 临时容器 | `@ActiveProfiles("it")` |
| `sandbox` | 共用 sandbox 环境 (sc01t01-pg-15432 等) | 共享容器 | `--spring.profiles.active=sandbox` |
| `prod` | 生产 | 阿里云 RDS | 由 K8s ConfigMap 注入 |

配置文件命名: `application-<profile>.yml` · 不要把 secret 写进 git · 用 `${ENV_VAR}` 占位。

---

## 11 · 反模式 (不要这么做)

- ❌ **手动改 DB schema** (违反 Migration-as-code · 走 Flyway)
- ❌ **物理 delete** (违反软删铁律 · 用 `@SQLDelete`)
- ❌ **不要 entity 上加 `@Version`** (违反乐观锁铁律 · 并发覆盖会丢数据)
- ❌ **写 POST/PATCH/DELETE 不接幂等键** (违反 Idempotency-first · 重试就重复创建)
- ❌ **混用 ApiResult / plain JSON** 同一 controller 内不同 endpoint 信封不一 (前端无法 destructure)
- ❌ **错误 message 写中文/英文** (违反 i18n · 用 `msgkey:` 前缀)
- ❌ **从零起新 service** (违反 Pattern-first · 必须 cp 标杆 + 改 · 见 §2 模板)
- ❌ **跳过 IT 只写 UT** (违反测试金字塔 · 真容器 IT 是 audit.js 卡口要求)
- ❌ **修历史 Flyway 文件** (违反 Migration-as-code 追加式 · 用下一个 V 番号)
- ❌ **service 层抛 RuntimeException** (用 `BusinessException` + `ErrCode` 让 GlobalExceptionHandler 兜)

---

## 12 · 与其他文档的关系

| 文档 | 作用 | 与本文关系 |
|---|---|---|
| [../CLAUDE.md](../CLAUDE.md) | 项目铁律 (12 工程德行 + AI Agent 启动纪律 + audit.js 卡口) | 本文是后端落地 · CLAUDE.md 是元规范 |
| [../.harness/agents/coder-agent.md](../.harness/agents/coder-agent.md) | Coder Agent 7 步骤 + 5 铁律 | Coder 步骤 2 "全栈上下文恢复" 必读本文 |
| [../.harness/agents/SHARED-E2E-PROTOCOL.md](../.harness/agents/SHARED-E2E-PROTOCOL.md) | E2E 测试协议 DoR C-1..C-6 | §9 测试金字塔 E2E 层走这个协议 |
| [../design/system/pages/](../design/system/pages/) | 19 张 page spec.md | 后端 controller 的 §5 API 触点契约源 |
| [../audits/SC-${N}-PHASE-0/](../audits/SC-01-PHASE-0/) | 后端 Phase-0 审计报告 | 每个 SC 的后端实际 vs spec diff · 落地修补依据 |
| [../.harness/feature_list.json](../.harness/feature_list.json) | SC-01 14 task 拆解 | 后端 task 的入口表 |

---

## 13 · 修订表

| 版本 | 日期 | owner | 摘要 |
|---|---|---|---|
| v1 | 2026-05-14 | user | 首版 · 与 frontend/FRONTEND_GUIDANCE.md 同次会话恢复产出 · 替代历史丢失版本 (audits/runs/SC-01-A01/team-1/attempt-1/coder.md L19 引用 "Flyway / @Version / 软删 / 命名") |
