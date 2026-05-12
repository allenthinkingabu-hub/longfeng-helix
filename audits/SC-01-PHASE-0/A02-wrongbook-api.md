# A02 — wrongbook-service Controller API 审计

- **Scope**: SC-01 Phase 0 · 对照 spec P02/P04/P05 §5 API 触点
- **Audit re-run @** 2026-05-12 (attempt-1) by team-2 Coder
- **Source files** (audited):
  - `backend/wrongbook-service/src/main/java/com/longfeng/wrongbook/controller/WrongItemController.java`
  - `backend/wrongbook-service/src/main/java/com/longfeng/wrongbook/controller/QuestionDetailController.java`
  - `backend/wrongbook-service/src/main/java/com/longfeng/wrongbook/controller/WrongAttemptController.java`
  - `backend/wrongbook-service/src/main/java/com/longfeng/wrongbook/controller/WrongbookSearchController.java`
  - `backend/wrongbook-service/src/main/java/com/longfeng/wrongbook/controller/WrongbookTagController.java`
  - `backend/wrongbook-service/src/main/java/com/longfeng/wrongbook/controller/HealthController.java`
- **Spec refs**:
  - `design/system/pages/P02-capture.spec.md` §5（POST `/api/wb/questions`）
  - `design/system/pages/P04-result.spec.md` §5（GET / PATCH / POST `/save`）
  - `design/system/pages/P05-wrongbook-list.spec.md` §5（GET list / POST `/archive`）

---

## 1. 现状（实际暴露的 endpoint）

### 1.1 `QuestionDetailController` — class `@RequestMapping("/api/wb/questions")` · **SC-01 主控制器**

| # | Method | Path | 关键参数 / Body | 备注 |
| --- | --- | --- | --- | --- |
| 1 | POST   | `/api/wb/questions`                  | body `CreateQuestionReq` · header `X-Idempotency-Key` / `X-Request-Id`                                                                              | P02 创 PENDING 占位 · 返回 `CreateQuestionResp{qid}` · HTTP 201 · 幂等键三级优先（header > requestId > body） |
| 2 | GET    | `/api/wb/questions/{qid}`            | path `qid:String`                                                                                                                                   | P04 聚合详情，返 `QuestionDetailResp{question, plannedNodes}` · **plain JSON 不裹 ApiResult**（FE 直接 destructure） |
| 3 | PATCH  | `/api/wb/questions/{qid}`            | body `PatchQuestionReq` · header `X-Request-Id`                                                                                                     | P04 学生编辑（stem/ocr/difficulty/mastery/processed_image_key 全 optional） · 返聚合最新值 |
| 4 | POST   | `/api/wb/questions/{qid}/save`       | body `SaveQuestionReq`（可空 · echo 校验，path 优先） · header `X-Request-Id`                                                                       | P04 触发 SM-2 plan + 6 nodes · 返 `SaveQuestionResp` |
| 5 | GET    | `/api/wb/questions`                  | query `subject, mastery, kp, q, qMode, page(=1), size(=20), sort` · header `X-Student-Id`                                                           | P05 错题列表 · query 参数与 spec §5 完全对齐 · 返 `QuestionListResp` |
| 6 | POST   | `/api/wb/questions/{qid}/archive`    | path `qid:String` · header `X-Request-Id`                                                                                                           | P05 归档错题 · 幂等（二次调用直接返当前快照） · 返 `QuestionListItem` |

### 1.2 `WrongItemController` — class `@RequestMapping("/wrongbook/items")` · **legacy / internal**

| Method | Path | 关键参数 / Body | 备注 |
| --- | --- | --- | --- |
| POST   | `/wrongbook/items`                  | body `CreateWrongItemReq` · header `X-Request-Id`                                                                          | 创建错题（legacy v1 路径 · 非 SC-01 触点） |
| GET    | `/wrongbook/items/{id}`             | path `id:Long`                                                                                                             | 单条查询，返 `WrongItemVO`（**非** 聚合 QuestionDetailResp） |
| GET    | `/wrongbook/items`                  | query `subject, status, tagCode, studentId, cursor, size(=20)`                                                             | 分页列表，**游标式**（cursor），非 spec 触点 |
| PATCH  | `/wrongbook/items/{id}`             | body `UpdateWrongItemReq` · header `X-Request-Id`                                                                          | 通用字段更新 |
| DELETE | `/wrongbook/items/{id}`             | header `X-Request-Id`                                                                                                      | 软删除 |
| PATCH  | `/wrongbook/items/{id}/tags`        | body `BulkTagReq` · header `If-Match, X-Request-Id`                                                                        | 批量替换标签 |
| POST   | `/wrongbook/items/{id}/images`      | body `ConfirmImageReq` · header `X-Request-Id`                                                                             | 确认图片上传（OSS 回写后调用） |
| POST   | `/wrongbook/items/{id}/difficulty`  | body `SetDifficultyReq` · header `X-Request-Id`                                                                            | 设置难度 |

### 1.3 `WrongAttemptController` — class `@RequestMapping("/wrongbook/items/{id}/attempts")`

| Method | Path | 关键参数 / Body | 备注 |
| --- | --- | --- | --- |
| POST   | `/wrongbook/items/{id}/attempts`  | path `id:Long` · body `CreateAttemptReq`                                                                                   | 提交作答（append-only），HTTP 201（**非** SC-01 触点） |
| GET    | `/wrongbook/items/{id}/attempts`  | path `id:Long` · query `size(=20)`                                                                                         | 作答历史（**非** SC-01 触点） |

### 1.4 `WrongbookSearchController` — class `@RequestMapping("/wrongbook/questions/search")`

| Method | Path | 关键参数 / Body | 备注 |
| --- | --- | --- | --- |
| POST   | `/wrongbook/questions/search`     | body `SearchReq{query, queryVector, studentId, subject, topN}`                                                             | RRF 混合检索（pgvector + pg_trgm）·  ⚠️ **class javadoc 声明 `/api/wb/questions/search`，但 `@RequestMapping` 落地是 `/wrongbook/questions/search`，二者不一致** |

### 1.5 `WrongbookTagController` — class `@RequestMapping("/wrongbook")`

| Method | Path | 关键参数 / Body | 备注 |
| --- | --- | --- | --- |
| GET    | `/wrongbook/tags`                 | query `subject?`                                                                                                           | 活跃标签 taxonomy（**非** SC-01 触点，但 P05 chip filter 复用） |

### 1.6 `HealthController` — class `@RequestMapping`（无前缀）

| Method | Path | 备注 |
| --- | --- | --- |
| GET | `/ready` | k8s readiness |
| GET | `/live`  | k8s liveness  |

---

## 2. vs Spec 契约 diff（SC-01 6 触点全量核对）

Spec 要求的 6 个端点（来自 inflight `context.spec_api_contracts.P02/P04/P05` + 3 份 spec.md §5 表格交叉验证）：

| # | Spec 端点 | 实际落地 | 路径 | 方法 | DTO 类型 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `POST /api/wb/questions` （P02 创 PENDING + qid）                                                | `QuestionDetailController.create()` L68 | ✅ 1:1 | ✅ | `CreateQuestionReq → CreateQuestionResp{qid}` · HTTP 201 | ✅ 已实现 |
| 2 | `GET /api/wb/questions/{qid}` （P04 聚合详情）                                                    | `QuestionDetailController.get()` L84    | ✅ 1:1 | ✅ | → `QuestionDetailResp{question, plannedNodes}` · plain JSON | ✅ 已实现 |
| 3 | `PATCH /api/wb/questions/{qid}` （P04 学生编辑）                                                  | `QuestionDetailController.patch()` L99  | ✅ 1:1 | ✅ | `PatchQuestionReq → QuestionDetailResp` | ✅ 已实现 |
| 4 | `POST /api/wb/questions/{qid}/save` （P04 触发 plan/nodes 生成）                                  | `QuestionDetailController.save()` L134  | ✅ 1:1 | ✅ | `SaveQuestionReq → SaveQuestionResp` | ✅ 已实现 |
| 5 | `GET /api/wb/questions?subject=&mastery=&kp=&q=&qMode=&page=&sort=` （P05 list）                  | `QuestionDetailController.list()` L154  | ✅ 1:1 | ✅ | `ListQuestionReq → QuestionListResp` · query 7 参数齐全 | ✅ 已实现 |
| 6 | `POST /api/wb/questions/{qid}/archive` （P05 归档）                                                | `QuestionDetailController.archive()` L187 | ✅ 1:1 | ✅ | → `QuestionListItem` · 幂等 | ✅ 已实现 |

**汇总：6/6 触点全部已落地于 `QuestionDetailController` · class-level `@RequestMapping("/api/wb/questions")` · path/method/DTO 全部 1:1 对齐 spec §5**。

---

## 3. 附加观察（spec 范围外仍需 SC-01 实施阶段对齐）

### 3.1 ⚠️ `WrongbookSearchController` 路径与 javadoc 不一致（**仍未修复**）
- 文件：`backend/wrongbook-service/src/main/java/com/longfeng/wrongbook/controller/WrongbookSearchController.java` L22
- 现状：`@RequestMapping("/wrongbook/questions/search")`
- javadoc L17：`POST /api/wb/questions/search — RRF fusion ... Gateway routes /api/wb/** → wrongbook-service`
- 影响：网关路由表如果按 `/api/wb/**` 转发，搜索端点不会命中（实际路径仍是 `/wrongbook/questions/search`）。SC-01 P05 §5 没有显式触点要求 search（spec 走 `GET /api/wb/questions?q=` 而非 POST search），所以 **SC-01 红线不阻塞**，但仍是 tech debt。
- **建议**：SC-01 范围外的 follow-up — 把 `@RequestMapping` 改成 `/api/wb/questions/search` 与 javadoc + 网关 routing 表对齐，并增加 `WrongbookSearchControllerIT` 验真。

### 3.2 ✅ 两套控制器并存是有意为之（**非 bug**）
- `WrongItemController` (`/wrongbook/items` · path var `id:Long`) ＝ legacy v1，保留兼容已有调用方与 `WrongAttempt`/`Image` 子路径。
- `QuestionDetailController` (`/api/wb/questions` · path var `qid:String`) ＝ SC-01 P02/P04/P05 主线。
- 二者共用 `WrongItemService` / `QuestionAggregateService`（Service 层统一），controller 层"双前缀并存"是为了不动 legacy 调用方且让 spec 路径精确落地。
- **SC-01 范围内不再要求收口/统一**，留作 future cleanup。

### 3.3 ✅ `CreateQuestionReq.idempotencyKey` 字段 + header 三级幂等（**已对齐 TC-01.02**）
- `QuestionDetailController.create()` L72-78 实现幂等键三级优先级：`X-Idempotency-Key` header > `X-Request-Id` header > body `idempotency_key` 字段。
- 满足 SC-01 invariant "步骤 4 上传按 idempotency_key 不重复创建 question"。

### 3.4 ✅ `QuestionDetailResp` plain JSON shape（**已对齐 FE 期望**）
- 不包 `ApiResult` 信封（与 `WrongItemController` 不同）。`QuestionDetailController` class javadoc L34-40 显式声明 "FE destructures top-level data.question + data.plannedNodes, so wrapping in ApiResult would push everything one level deeper and break P04 rendering"。
- 这是 P04 spec § 5 GET 触点对应的契约形状，不要回退到 `ApiResult` 信封。

### 3.5 ✅ `QuestionDetailController.list()` 的 `studentId` header 注入（**需网关协作**）
- L164 `@RequestHeader("X-Student-Id")` 由网关注入，缺失时不按学生过滤（IT 兼容）。
- 生产部署务必由网关注入；该约束应在 SC-01-C03（"feature/SC-01-C03-wb-questions-list-archive"）实施时由 backend + gateway 团队同步验真。

---

## 4. SC-01 阻塞 / 通行结论

| 项 | 结论 |
| --- | --- |
| **SC-01 6 触点 spec 对齐**           | ✅ **6/6 全部已落地** |
| **路径前缀 `/api/wb/questions`**    | ✅ 一致 |
| **DTO 形状（plain JSON · 不包信封）** | ✅ 与 FE Result/index.tsx 期望对齐 |
| **幂等机制（X-Idempotency-Key / X-Request-Id / body）** | ✅ 三级优先链已实现 |
| **SC-01 红线**                       | ✅ **不阻塞**，C01/C03 实施可基于现有 controller 直接开测 |
| **遗留 tech debt（非阻塞）**         | ⚠️ §3.1 `WrongbookSearchController` 路径与 javadoc 不一致，SC-01 范围外 follow-up |

下游 SC-01-C01（`wb-questions-crud-align`）与 SC-01-C03（`wb-questions-list-archive`）任务可直接在 `QuestionDetailController` 上继续完善 service 层细节 + 集成测试，无需再造 controller skeleton。

---

## 5. Audit 完成证据

- 6 个 controller java 文件全部已 `Read`（参见 attempt-1/coder.md §1 地形侦察）。
- 3 份 spec.md（P02/P04/P05）§5 表格已 grep 交叉验证（详 coder.md §1）。
- 落地路径 1:1 比对：所有 6 个 spec 触点的 `method + path + body DTO + response DTO` 三元组与 `QuestionDetailController` 各方法签名逐一对位（详 §2 表格）。
- 与 attempt-1 起始时的 `previous_audit_verdict=null`（首轮，无 REDO history）一致。
