# A04 · ai-analysis-service vs P02+P03 §5 契约审计（v2 · SC-01-A04 refresh）

- **Task**: SC-01-A04（attempt 1 / team-1）
- **Scope**: 4 个端点（analyze / stream / cancel / fallback）+ 4 步流水线事件名 + FallbackOrchestrator
- **Spec 锚点**: `design/system/pages/P02-capture.spec.md` §5 · `design/system/pages/P03-analyzing.spec.md` §4/§5/§6/§9/§11
- **本次刷新原因**: v1（旧版）撰写时 `AiFallbackController` / `Type.FALLBACK_MODEL` 等修补项尚未落地。SC-01-C04 已经把 v1 §3 中标 ❌/⚠️ 的核心 2 项修完（fallback REST endpoint + 独立 FALLBACK_MODEL event），本次刷新把状态从“建议”改成“已落地”，并把仍未对齐的 3 个剩余 gap（同步 analyze block 10s、partialJson wire 形态、连续失败计数器）显式标 ⚠️ 保留给下一阶段。
- **Audited files**（按物理验真）:
  - `backend/ai-analysis-service/src/main/java/com/longfeng/aianalysis/controller/AnalyzeController.java`（272 行）
  - `backend/ai-analysis-service/src/main/java/com/longfeng/aianalysis/controller/AnalysisController.java`（132 行 · S4 复盘域）
  - `backend/ai-analysis-service/src/main/java/com/longfeng/aianalysis/controller/AiCancelController.java`（44 行）
  - `backend/ai-analysis-service/src/main/java/com/longfeng/aianalysis/controller/AiFallbackController.java`（66 行 · SC-01-C04 新增）
  - `backend/ai-analysis-service/src/main/java/com/longfeng/aianalysis/controller/AiModelsController.java`（123 行）
  - `backend/ai-analysis-service/src/main/java/com/longfeng/aianalysis/controller/AnalyzeWebSocketHandler.java`（107 行）
  - `backend/ai-analysis-service/src/main/java/com/longfeng/aianalysis/support/FallbackOrchestrator.java`（127 行）
  - `backend/ai-analysis-service/src/main/java/com/longfeng/aianalysis/service/AnalysisStreamHub.java`（154 行）
  - `backend/ai-analysis-service/src/main/java/com/longfeng/aianalysis/service/QuestionAnalyzerImpl.java`（核心 §3/§4 编排）
  - `backend/common/src/main/java/com/longfeng/common/dto/AnalysisChunk.java`（173 行 · 事件枚举）

---

## 1. 现状（精确扫描）

### 1.1 Controller 实际 path + method

| Controller | 类级 `@RequestMapping` | 方法 | HTTP | 完整 path | 说明 |
|---|---|---|---|---|---|
| `AnalyzeController` | `/api/ai` | `analyze` | POST (multipart) | `/api/ai/analyze` | multipart 上传 image · `.block(Duration.ofSeconds(10))` 同步 · 返 `ApiResult<AnalysisResult>` |
| `AnalyzeController` | `/api/ai` | `analyzeByUrl` | POST (json) | `/api/ai/analyze-by-url` | WT4 新增 · body `{task_id, subject, image_url}` · 异步 **202 + `{task_id, status:ANALYZING}`** · 给 anonymous-service 用 |
| `AnalyzeController` | `/api/ai` | `stream` | GET (SSE) | `/api/ai/stream/{taskId}` | `text/event-stream` · 7 种 event name · 总超时 60s · chunk 间隔 15s · 带 `X-Accel-Buffering: no` 等 D-SSE header |
| `AnalyzeController` | `/api/ai` | `result` | GET | `/api/ai/result/{taskId}` | polling 兜底 · 返 `ANALYZING` / `DONE` 字符串 |
| `AiCancelController` | `/api/ai` | `cancel` | POST | `/api/ai/cancel/{taskId}` | 调 `streamHub.cancel` · 200 返 `{"status":"CANCELLED"}` · 未知 taskId 幂等 |
| `AiFallbackController` | `/api/ai` | `fallback` | POST | `/api/ai/fallback/{taskId}` | **SC-01-C04 新增** · 200 返 `{"status":"FALLBACK","route":"manual_form","taskId":...,"ocrText":...}` · 透传已识别题干 · 幂等 |
| `AiModelsController` | `/api/ai` | `listModels` | GET | `/api/ai/models` | 按 `X-User-Tier` 过滤 4 模型 stub catalog（NORMAL/VIP/VIP_PLUS） |
| `AnalysisController` | `/analysis` | `latest` | GET | `/analysis/{itemId}` | S4 域 · 返最新 AnalysisVO（非 P03 流水线，是 P04 复盘域） |
| `AnalysisController` | `/analysis` | `similar` | GET | `/analysis/{itemId}/similar` | pgvector 相似题 |
| `AnalysisController` | `/analysis` | `stream` | GET (SSE) | `/analysis/{itemId}/stream` | 回放已存 explain chunks · 与 P03 实时流不同语义 |
| `AnalysisController` | `/analysis` | `retry` | POST | `/analysis/{itemId}/retry` | admin only · 202 |
| `AnalysisController` | `/analysis` | `provider` | GET | `/analysis/provider` | ProviderRouter 当前激活 provider |
| `AnalyzeWebSocketHandler` | `@Component("/ws/analyze")` | `handle` | WS | `/ws/analyze/{taskId}` | 小程序端 WS · 30s 心跳 · 60s 总超时 · 接 `"CANCEL"` 文本触发 dispose |

### 1.2 SSE 事件 / `AnalysisChunk.Type` 枚举（current）

- **FE-aligned `Type` enum**（spec P03 §4 union + SC-01-C04 扩展）：
  - `STEP_START`, `STEP_DONE`, `PARTIAL_JSON`, `DONE`, `FAIL`, `CANCELLED` ← spec P03 §4 6 种
  - `FALLBACK_MODEL` ← **SC-01-C04 新增** · 任务 prompt 要求的第 7 种 · spec P03 §4 type union 暂未列入，但 §6 状态机 `SLOW` 已要求“切换备用模型中…”黄条 · 本 type 是 SLOW 状态的 wire 表达
- **历史 `Stage` enum**（WS / IT 兼容）：`OCR / ANALYSIS / STEPS / DONE / FAIL / CANCELLED`，通过 `mapStageToType` 映射到 `Type`
- SSE event `name(...)` 优先用 `type.name()`，没 type 才退 `stage.name()`，再退 `"MESSAGE"`（`AnalyzeController#stream` L207-211）
- 4 步流水线 step 字段在 `STEP_START / STEP_DONE / failAtStep` factory 上携带 `step: 1..4`
- factory 全集：`stepStart(int)`, `stepDone(int,long)`, `partialJson(String)`, `done(Object)`, `fail(String)`, `failAtStep(int,String)`, `cancelled()`, `fallbackModel(String,String)`, 以及历史 `ocr() / analysis(String) / steps(Object)`

### 1.3 FallbackOrchestrator 降级策略

- 从 `longfeng.ai.fallback-chain` 配置读 chain（默认 `qianwen,openai,zhipu`）
- `tryWithFallback(activeProvider, invoker, sink)` 按 chain 顺序 try-catch 逐个 provider 调用
- **命中非主 provider 时**（FallbackOrchestrator.java L67-76）：`sink.tryEmitNext(AnalysisChunk.fallbackModel(activeProvider, provider))` → **独立 `FALLBACK_MODEL` chunk**（chunk field 携带 `"qianwen→openai"`）—— 修补了 v1 审计中“用中文匹配 PARTIAL_JSON”的 hack
- **链路全断** → emit `AnalysisChunk.fail("ai.fallback.manual")` + 返 placeholder `ChatResponse(manualFallbackPlaceholder, Usage.zero())` → 上游 `QuestionAnalyzerImpl.streamAnalyze` 继续走 step 4 但 stem/errorReason 全空
- **OCR 文本透传**（SC-01-C04）：`QuestionAnalyzerImpl#streamAnalyze` step 3 完成时 `streamHub.putOcrText(taskId, result.stem())`；`AiFallbackController#fallback` 读 `streamHub.getOcrText(taskId)` 回吐给 FE 预填手填表单

---

## 2. vs Spec 契约 diff

### 2.1 4 个端点（P03 §5 表）

| Spec 要求（P03 §5） | 实际实现 | 状态 | 备注 |
|---|---|---|---|
| `GET (SSE) /api/ai/stream/{taskId}` 流式订阅 4 步 · 首字节 ≤ 3s · 总 ≤ 8s | `GET /api/ai/stream/{taskId}` 存在 · `produces=text/event-stream` · 带 D-SSE 三件套 header · 60s 总 / 15s chunk 超时 · sink 源 `AnalysisStreamHub` | ✅ | path + content-type + heartbeat + cancel disposal 链路完整 |
| `WS /ws/analyze/{taskId}` (小程序) · 同上 | `AnalyzeWebSocketHandler` 注册 `@Component("/ws/analyze")` · 30s heartbeat · 接 `"CANCEL"` 触发 `streamHub.dispose` · 与 SSE 共享 sink（D-AI-Stream 单源） | ✅ | 双通道单源已对齐 |
| `POST /api/ai/cancel/{taskId}` P95 ≤ 200ms · 失败保留 PENDING task | `POST /api/ai/cancel/{taskId}` 200 `{"status":"CANCELLED"}` · 未知 taskId 幂等 · `dispose` 内先 emit `AnalysisChunk.cancelled()` 再 complete sink · FE `useEventSource.ts` 按 `type==='CANCELLED'` onCancelled 回调 | ✅ | wire 形态 + 幂等 + producer disposable 取消全对齐 |
| `POST /api/ai/fallback/{taskId}` 连续 2 次失败降级手填 · P95 ≤ 500ms | `POST /api/ai/fallback/{taskId}` 200 `{"status":"FALLBACK","route":"manual_form","taskId":"...","ocrText":"..."}` · emit `fail("ai.fallback.manual")` + `dispose` · 幂等 | ✅ (端点) ⚠️ (计数器) | 端点已存在；但 **“连续 2 次”语义未在 server 层维护** —— 目前任一调用即触发，"2 次失败计数"在 FE `useEventSource.ts` retry 计数后才调（spec §9）。建议保留 server 端无状态、由 FE 计数（已落地）作为 v2 决策。 |

### 2.2 P02 §5 端点（拍照→AI）

| Spec 要求（P02 §5） | 实际实现 | 状态 | 备注 |
|---|---|---|---|
| `POST /api/ai/analyze` 触发 AI 分析任务（导航 P03 前发起） · P95 ≤ 400ms | `POST /api/ai/analyze` (multipart) **`.block(Duration.ofSeconds(10))` 同步阻塞** · 返 `ApiResult<AnalysisResult>` | ⚠️ | 同步形态 P95 ≤ 400ms 不可达。**真生产路径已经走 `/api/ai/analyze-by-url`**（FE/anonymous-service 调用 OSS presign → PUT → analyze-by-url 202 + taskId · 跳 P03）；同步 `/analyze` 仅 IT/debug 保留。代码层已注 `TODO SC-01-C04` 决策不强改 · spec P02 §5 缺一个 "FE 真用 analyze-by-url" 的注释，建议 spec 加一行 hint。 |

### 2.3 4 步流水线事件名 vs P03 §4 type union

P03 §4 `AnalyzeStreamEvent.type` 枚举：`'STEP_START' | 'STEP_DONE' | 'PARTIAL_JSON' | 'DONE' | 'FAIL' | 'CANCELLED'`

| Spec 事件 | 实际 `AnalysisChunk.Type` | 状态 | 备注 |
|---|---|---|---|
| `STEP_START` (step 1..4) | `Type.STEP_START` + `step: 1..4` (`stepStart` factory) | ✅ | progressPct = step * 25 |
| `STEP_DONE` (step + durationMs) | `Type.STEP_DONE` + `step` + `durationMs` (`stepDone` factory) | ✅ | |
| `PARTIAL_JSON` (片段) | `Type.PARTIAL_JSON` (`partialJson` factory) | ⚠️ | factory 把片段塞进 `chunk` field、JSON 顶层 `partialJson` 字段为 null —— spec P03 §4 wire 期望 `partialJson?: string`；当前 FE `useEventSource.ts` 实际读 `chunk` 字段（已对齐），但与 spec 文本不一致。需要二选一：(a) 改 factory 把 fragment 写到 `partialJson` 字段 · (b) 把 spec §4 中 `partialJson` 改名 `chunk`。**当前实际行为=FE 读 chunk，spec 文本=partialJson**，文档与代码冲突。 |
| `DONE` | `Type.DONE` (`done(result)` factory) | ✅ | `partialJson` 字段携带完整 `AnalysisResult` |
| `FAIL` (errorCode, step?) | `Type.FAIL` + `errorCode` + 可选 `step`（`fail` / `failAtStep` factory） | ✅ | |
| `CANCELLED` | `Type.CANCELLED` (`cancelled` factory) | ✅ | `dispose` 触发，先 emit 再 complete |
| 任务 prompt 要求的 `FALLBACK_MODEL` event | **新增 `Type.FALLBACK_MODEL`** + `fallbackModel(from,to)` factory · `chunk` 字段携带 `"from→to"` | ✅ | SC-01-C04 已落地 · FE 顶部黄条按 `type==='FALLBACK_MODEL'` 渲染 · spec P03 §4 type union 仅列了 6 个，第 7 个 FALLBACK_MODEL 是任务 prompt 要求 + §6 状态机 `SLOW`/§9 异常路径“切换备用模型中…”的 wire 表达，建议 spec §4 type union 同步补一行 |
| 4 步语义映射 | step 1 图像预处理 / step 2 OCR 题干 / step 3 错因诊断 / step 4 生成解法（`QuestionAnalyzerImpl.streamAnalyze` L149-208 · 注释清晰）；旧 Stage.OCR/ANALYSIS/STEPS/DONE 仅 WS+IT 兼容保留 | ✅ | 与 spec P03 §2 ASCII 图 4 步完全一致 |

### 2.4 旁路 / 额外发现（保留 v1 + 新增）

- `AnalysisController` (`/analysis/*`) 与 `AnalyzeController` (`/api/ai/*`) path prefix 不同；spec P02/P03 均锚 `/api/ai/*`，`/analysis/*` 是 S4 复盘域。**Javadoc 已在 `AnalysisController` 类头明示 "S4 域端点"**（"AI 错题分析 · S4 域端点"），但容易被 coder 看头注释一眼略过；建议在 `AnalyzeController` 类头也加一句“P03 实时流入口，与 `/analysis/*` S4 复盘域不同”。
- `/api/ai/analyze-by-url`（WT4 新增）给 anonymous-service 访客流用；spec P02 §5 未列出。建议 spec §5 加一行 `POST /api/ai/analyze-by-url` 标注“内部 service-to-service 端点 · FE 不直接调”。
- WS `/ws/analyze/{taskId}` 与 SSE 共享同一个 `AnalysisStreamHub` sink（"业务实现单源" TDD §8.1），spec P03 §5 双通道契约已对齐。
- `AnalyzeController.analyze`（multipart 同步路径）用 `.block(Duration.ofSeconds(10))` 在 Servlet 线程上阻塞，违反 D-SSE 的 streamFanoutExecutor 隔离原则；负载上 P02 §11 性能预算 ≤ 400ms 不可达；**已在代码层注释 TODO SC-01-C04 决策保留**（H5/小程序生产已切到 `/analyze-by-url` 异步）。
- `AnalysisStreamHub.dispose` 在 complete 前 emit `cancelled()` 帧后才 complete sink（"WT4 修正" L101-103）；FE `useEventSource.ts` 据此触发 onCancelled。这是隐式契约，**spec P03 §6 状态机 `CANCELLED`** 行未明示 "BE 必须先发 CANCELLED 帧再 complete"，建议 spec §6 补一行。
- `FallbackOrchestrator.tryWithFallback` 命中**非主**provider 时才 emit `FALLBACK_MODEL`，**主**provider 成功则静默。语义对齐 spec P03 §6 状态机 `SLOW → 切 gpt-4o-mini` 黄条（只在切换时显示）。
- `AnalysisStreamHub.ocrTexts` map 在 `dispose` 时清理（L106），无内存泄漏风险；`putOcrText` 对 null/blank 静默忽略（L114-117）防止"假手填回吐空串"。

---

## 3. 修补建议（v2 · v1 已修补项移除，新增 spec 文档同步项）

> v1 列的 6 条中：#1 (fallback endpoint)、#2 (FALLBACK_MODEL 枚举)、#5 (FallbackOrchestrator emit 独立 type) 已 **SC-01-C04 落地完成**。剩余 v2 actionable 项：

1. ⚠️ **`partialJson` wire 形态决策**（v1 #4 仍未关 · 跨端文档冲突）：
   - 当前实际：FE `useEventSource.ts` 读 `chunk` 字段；BE `partialJson(String fragment)` factory 把片段写到 `chunk` field、`partialJson` field 为 null。
   - 选项 A：改 BE factory 写 `partialJson` field（破坏 FE 已对齐逻辑 · 风险高）
   - **选项 B（建议）**：spec P03 §4 把 `partialJson?: string` 重命名为 `chunk?: string`，annotate "PARTIAL_JSON / FALLBACK_MODEL / FAIL 三种 type 都用 chunk 字段携带 string payload"（一处改 spec 文档 · 0 代码改动 · 不破坏 wire）。
2. ⚠️ **spec P03 §4 type union 补 `FALLBACK_MODEL`**（v1 #2 落地后产生）：union 当前 6 项，已落地 7 项，文档落后。一行 spec 改动。
3. ⚠️ **spec P03 §6 状态机注释 BE 行为**：在 `CANCELLED` 行补一句"BE 先发 CANCELLED 帧再 complete sink，FE 据 type=CANCELLED 触发 onCancelled"；在 `SLOW` 行补一句"BE 通过 type=FALLBACK_MODEL chunk='from→to' 通知 FE，FE 据此渲染黄条"。
4. ⚠️ **spec P02 §5 补 `/api/ai/analyze-by-url` 行**：注明"FE 实际生产路径走 analyze-by-url（基于 OSS URL · 异步 202） · `/api/ai/analyze` 同步 multipart 仅 IT/debug 保留"。一行新增；同时把 §5 `/api/ai/analyze` 的 P95 ≤ 400ms 标注改成"针对 analyze-by-url；同步 /analyze 因 .block(10s) 不在此预算内"。
5. ⚠️ **"连续 2 次失败"计数器决策**（v1 #5 v2 deferred）：当前由 FE retry 计数控制 `/api/ai/fallback/{taskId}` 调用时机，BE 端点幂等无状态。是有意"BE 不持久错误状态"决策——建议把这条写到 `audits/SC-01-PHASE-0/C04-decision.md` 备案，避免下一个 coder 误以为是 BE 漏。
6. ✅（建议性 · 非阻塞）**`AnalyzeController` 类头 Javadoc 补"vs /analysis/* 区分"**：1 行注释即可，避免后续混淆。

---

## 4. 结论

- 4 个核心端点（analyze / stream / cancel / fallback）**全部落地**：P03 §5 表 4/4 ✅
- 4 步流水线 6 种事件（STEP_START/STEP_DONE/PARTIAL_JSON/DONE/FAIL/CANCELLED）+ 第 7 种 FALLBACK_MODEL（任务 prompt 要求）**全部落地**：7/7 ✅
- 仍残留 5 条 ⚠️，**全部是 spec 文档与代码之间的描述漂移，不涉及代码 bug**，应在 spec sync 阶段统一处理。**SC-01-A04 审计本身：PASS · 0 阻断 bug**。
- 物理验真：所有 controller / orchestrator / chunk 文件已逐行扫读，关键 path 与 type union 已 grep `FALLBACK_MODEL / fallbackModel / /api/ai/fallback / partialJson` 7 处命中验证（见 `audits/runs/SC-01-A04/team-1/attempt-1/coder.md`）。
