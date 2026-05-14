# P03 · AI 分析中 (Analyzing)

**Status**: Active
**Owner**: design + frontend + backend
**Last-updated**: 2026-05-14
**Mockup**: design/mockups/wrongbook/03_analyzing.html
**Biz refs**: biz/业务与技术解决方案_AI错题本_基于日历系统.md §2A.4 (P03 规格卡 · L485) + §2A.5 状态机 (Question.ANALYZING) + §2A.7 异常矩阵 (AI 超时 / AI 彻底失败) + §2A.8 埋点字典 (wb_ai_stream_*) + §2B.2 SC-01 步 5-7 + §2B.8 SC-07 (连续 2 次超时 → 降级手填)
**Related tasks**: feature_list.json SC-01 T02 (P02→P03 跳转) + T03 (4 步流水线 + fallback + cancel) + T04 (DONE → P04 跳转)
**Phase-0 audit**: audits/SC-01-PHASE-0/A04-ai-analysis.md (字符级 ground truth · 4 端点 + 7 SSE type)

---

## §1 页面目的

让学生在 4–8 秒的 AI 推理等待中保持「被看见」、心态平稳：通过 4 步流水线 (`wait → now → done`) + 右侧 JSON 流式打字机让黑盒变白盒；通过模型 Badge + fallback 黄条让模型切换透明；通过常驻「取消分析」给学生兜底退路。本页是 SC-01 happy path 的"心跳"页 — 任何超过 1.5s 的等待 (presign 也好、AI 也好) 都应有可见进度，否则学生会感觉"卡死"并强退。本页也是 SC-07 降级链路的入口：连续 2 次 AI 失败时，系统从这里自动跳「手填兜底页」。

---

## §2 布局分区 + Wireframe

### 2.1 布局分区 (zone 划分)

```
┌─────────────────────────────────────┐  顶部安全区 (54px)
├─────────────────────────────────────┤  Nav (返回 + 取消文字按钮 + 标题 "AI 正在分析… 3/4")
├─────────────────────────────────────┤  缩略图卡片 (Preview · 72×88 thumb + 题元信息)
├─────────────────────────────────────┤  模型 Badge (qwen-vl-max · 备用 gpt-4o-mini · 平均时延 4.2s)
├─────────────────────────────────────┤  Fallback/Slow Banner (黄/红 · 条件渲染)
├─────────────────────────────────────┤  4 步流水线 (Stages · 每步 wait/now/done 三态 + shimmer)
├─────────────────────────────────────┤  JSON 流式区 (dark 终端风 · 打字机光标)
├─────────────────────────────────────┤  取消分析 sticky 按钮 (50px · 红字 · 始终可点)
└─────────────────────────────────────┘  Tab Bar (84px · 拍题 tab active)
```

来源：biz §2A.4 「布局分区」`[缩略图卡] [模型 Badge] [4 步流水线] [JSON 流式区] [取消按钮]` + mockup 03_analyzing.html 视觉补 nav + tabbar。

### 2.2 关键视觉锚 (mockup HTML 真 selector)

| Zone | DOM selector / class | 用途 |
|---|---|---|
| Root | `[data-testid="p03-root"]` | P03 页面根 |
| StatusBar | `.status` / `[data-testid="p03-statusbar"]` | iOS chrome (mockup) |
| Nav | `.nav` `.row` `.back` + `.x 取消` | 顶部 nav 与文字"取消" |
| Title | `.nav h1` + `.badge "3/4"` | 进度 badge (动态 step) |
| Preview | `.preview` `.thumb` `.meta` / `[data-testid="p03-thumb-card"]` | 缩略图 + 题元 |
| Model Badge | `.model` / `[data-testid="analyzing-pipeline-model-badge"]` | 当前模型 + 备用 |
| Pipeline | `.stages` / `[data-testid="analyzing-pipeline"]` | 4 步容器 (aria-live=polite) |
| Step | `.step.done / .now / .wait` + `.shim` shimmer | 每步圆点 + 标题 + 描述 |
| JSON Stream | `.stream pre` / `[data-testid="analyzing-pipeline-json-stream"]` | dark 终端 + 光标 |
| Cancel sticky | `.cancel` / `[data-testid="analyzing-pipeline-cancel-btn"]` | 红字 sticky 按钮 |
| Fallback banner | `[data-testid="p03-fallback-banner"]` | 黄/红条 (SLOW + FAIL) |

---

## §3 核心组件

| 组件 | 来源 | 接受 props | 说明 |
|---|---|---|---|
| `<AnalyzingPage>` | `frontend/apps/h5/src/pages/Analyzing/index.tsx` | route param `:taskId` + search `?qid&thumb&subject` | 容器组件 · 调 `useEventSource` 拿 status / steps / partialJson / cancel |
| `useEventSource(opts)` | `frontend/apps/h5/src/hooks/useEventSource.ts` | `{taskId, onStep, onDone, onSlow, onFail, onCancelled, onFallbackModel}` | 自定义 hook · 包 SSE `/api/ai/stream/{taskId}` · 内部据 `type` 派发 6+1 个回调 |
| `<ThumbCard>` | inline in Analyzing | `{thumbnailUrl, subjectLabel, model}` | 72×88 thumb + 学科 + 模型 badge |
| `<PipelineSteps>` | inline (4 step map) | `{stepStatuses[1..4], stepDurations[1..4]}` | 4 步圆点 + 标题 + 描述 + shimmer (now 态) |
| `<JsonStream>` | inline `<pre>` | `{partialJson: string}` | 流式打字机 · 兜底渲染 stub |
| `<CancelButton>` | inline `<button>` | `{onClick, disabled}` | sticky 50px · 红字 · `disabled={status==='CANCELLED'}` |
| `<FallbackBanner>` | inline | `{slow: boolean, error: string\|null}` | 黄条 (SLOW) / 红条 (FAIL) · `role="status"` / `"alert"` |

来源：biz §2A.4 「核心组件」+ `frontend/apps/h5/src/pages/Analyzing/index.tsx` + mockup 03_analyzing.html 真 DOM。

---

## §4 数据绑定 (Entity / DTO)

### 4.1 Page-level State 绑定

```typescript
// useEventSource 返回的 hook state
{
  status: 'QUEUED' | 'STREAMING' | 'SLOW' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED',
  stepStatuses: Record<1|2|3|4, 'wait' | 'now' | 'done' | 'fail'>,
  stepDurations: Record<1|2|3|4, number | undefined>,  // 毫秒
  partialJson: string,   // hook API 字段名 (累积拼接 · 实际 SSE wire = chunk · 见 §8 spec drift)
  cancel: () => Promise<void>
}

// 页面级 useState
{
  model: 'qwen-vl-max' | 'gpt-4o-mini',
  slowBanner: boolean,       // 黄条 (SLOW / fallback)
  errorBanner: string | null // 红条 (NETWORK_ERROR / FAIL)
}
```

### 4.2 涉及的后端 Entity / DTO

- `AnalysisChunk` (`backend/common/.../dto/AnalysisChunk.java` 173 行) — SSE 单帧 · `Type` enum 7 项 + factory 9 个
- `AnalysisStreamHub` (`backend/ai-analysis-service/.../AnalysisStreamHub.java` 154 行) — Sinks.Many 单源 · SSE/WS 双通道共享 · `ocrTexts` map 用于 fallback 回吐
- `FallbackOrchestrator` (`backend/ai-analysis-service/.../FallbackOrchestrator.java` 127 行) — `longfeng.ai.fallback-chain` 配置链 (qianwen, openai, zhipu)
- `wb_question` (wrongbook-service) — `status=ANALYZING` (本页期间) · `taskId` 透传

来源：biz §2A.4 「数据绑定」`task = {taskId, model, startedAt, steps[], partialJson}` + A04 audit §1.1 / §1.3 + 控制器代码。

---

## §5 API 触点

> 字符级精准 path + method · 与 audits/SC-01-PHASE-0/A04-ai-analysis.md §1.1 100% 对齐。

| # | Method | Path | Headers (req) | Body (req) | Response | P95 预算 | 失败降级 |
|---|---|---|---|---|---|---|---|
| 1 | GET (SSE) | `/api/ai/stream/{taskId}` | `Accept: text/event-stream` | — | `text/event-stream` · 7 种 event name (见 §8) · 60s 总超时 · 15s chunk 超时 · `X-Accel-Buffering: no` | 首字节 ≤ 3s · 总 ≤ 8s | EventSource onerror → 红 toast「网络中断,请重试」+ 重连 ≤ 3 次 · 2 次累计 FAIL 后跳手填 (T03 AC6) |
| 2 | WS | `/ws/analyze/{taskId}` (小程序) | WS upgrade | 文本 `"CANCEL"` 触发取消 | 同 SSE · 7 种 event 通过共享 `AnalysisStreamHub` sink | 同上 | 30s 心跳 · 60s 总超时 · 同源 sink (单源不重发) |
| 3 | POST | `/api/ai/cancel/{taskId}` | `Content-Type: application/json` | `{}` (空体) | `200 {"status":"CANCELLED"}` · 未知 taskId 幂等返同样 200 | ≤ 200ms | 503 → 保留 PENDING task (不阻塞 UI) · spec §6 状态机 CANCELLED 进入 |
| 4 | POST | `/api/ai/fallback/{taskId}` | — | `{}` (空体) | `200 {"status":"FALLBACK","route":"manual_form","taskId":"...","ocrText":"..."}` · 透传已 OCR 题干 (从 StreamHub `ocrTexts` map) · 幂等 | ≤ 500ms | 任何 5xx 也跳手填页 (FE best-effort · `.catch().finally(nav)`) |
| 5 | POST | `/api/ai/analyze-by-url` (上游 P02→P03) | `X-Idempotency-Key` | `{task_id, subject, image_url}` | `202 {task_id, status:"ANALYZING"}` | ≤ 400ms | T02 AC5 · 5xx 留 P02 (不进 P03) |

> **注**：`POST /api/ai/analyze` (multipart 同步 `.block(10s)`) 仅 IT/debug 保留 · FE 生产路径不走此端点 (A04 audit §2.2 已确认)。
> **注**：`/api/ai/fallback` 的「连续 2 次失败」语义在 **FE retry 计数器**中 (失败 ≥ 2 才调) · BE 端点无状态幂等 · 决策依据 A04 audit §3.5 (建议归档到 C04-decision.md)。

来源：biz §2A.4 「API 触点」(高层) + A04 audit §1.1 4 个 Controller 表 (字符级 path + method) + 控制器代码 (`AnalyzeController.java` / `AiCancelController.java` / `AiFallbackController.java`)。

---

## §6 状态机

```
        ┌──────────┐ EventSource onopen   ┌────────────┐
        │ QUEUED   │─────────────────────▶│ STREAMING  │
        └──────────┘                      └────────────┘
              │                                  │
              │                                  │ STEP_START 1..4 / STEP_DONE
              │                                  │ + PARTIAL_JSON 累积 chunk
              │                                  ▼
              │                          ┌──────────────┐
              │                          │  step 推进   │
              │                          └──────────────┘
              │                                  │
              │       qwen 10s 无 STEP            │
              │       FallbackOrchestrator         │
              │       emit FALLBACK_MODEL          │ DONE  ▶ onDone() ▶ nav P04 (200ms transition)
              │                                  │
              ▼                                  ▼
        ┌──────────┐                        ┌──────────┐         FAIL count<2 → 黄条 + 继续
        │  SLOW    │── fallback 仍跑       │ SUCCEEDED│         FAIL count≥2 → POST /fallback → nav 手填页
        └──────────┘                        └──────────┘
              │                                  
              │ 切换后第二个 provider 也 fail (≥2)
              ▼
        ┌──────────┐  user tap 取消    ┌──────────────┐
        │ FAILED   │                  │  CANCELLED   │
        └──────────┘                  └──────────────┘
              │ POST /api/ai/fallback        │
              ▼                              ▼
        nav /manual-entry?qid&taskId    nav / (P-HOME)
```

### 6.1 状态转移规则

| From | To | Trigger (SSE event / user action) | Side effect |
|---|---|---|---|
| (entry) | QUEUED | route mount + taskId 解析成功 | 4 步全 wait · model badge=qwen-vl-max |
| QUEUED | STREAMING | EventSource onopen | `wb_ai_stream_start{model}` 埋点 |
| STREAMING | STREAMING (step++) | `STEP_START` (step n) → step n=now · `STEP_DONE` (step n, durMs) → step n=done | shimmer 切换 · `wb_ai_stream_step{step,durMs}` |
| STREAMING | STREAMING (json) | `PARTIAL_JSON` (chunk: string) | 流式打字机 append (累计 partialJson) |
| STREAMING | SLOW | `FALLBACK_MODEL` (chunk: "from→to") | 顶部黄条「切换备用模型中」+ model badge 切到 to · `wb_ai_stream_slow{reason:'fallback_model'}` |
| SLOW | STREAMING | 第二个 provider emit STEP_START | 黄条保留 (UX 提示) · 继续流水线 |
| STREAMING / SLOW | SUCCEEDED | `DONE` (含 AnalysisResult) | `onDone()` → 200ms 过渡 → `nav('/question/{qid}/result')` · `wb_ai_stream_done{totalMs,tokens}` |
| STREAMING / SLOW | FAILED | `FAIL` (code) · failCount++ | 红条 errorBanner · `wb_ai_stream_fail{code,count}` · count≥2 → 调 `POST /api/ai/fallback` → `nav /manual-entry` |
| STREAMING / SLOW / FAILED | CANCELLED | user tap 取消 → FE `analyzeClient.cancel(taskId)` → BE `streamHub.dispose` **先 emit `CANCELLED` 帧再 complete sink** · FE 据 `type==='CANCELLED'` 触发 `onCancelled` | `wb_ai_stream_cancel{taskId}` · `nav('/')` (P-HOME) · 取消按钮 disabled |

> **A04 audit §2.4 标注**：BE `AnalysisStreamHub.dispose` (L101-103) 先 emit `cancelled()` 帧后才 complete sink，这是隐式契约 — FE 必须按 `type=CANCELLED` 触发 onCancelled，不能依赖 onerror。本 spec §6 明示此 wire 顺序契约。
> **A04 audit §2.4 标注**：`FallbackOrchestrator` 命中**非主** provider 才 emit `FALLBACK_MODEL` (L67-76) · 主 provider 成功静默 (避免主路径误显示黄条)。

来源：biz §2A.4 「状态集」`QUEUED → STEP_1..4 → SUCCEEDED/FAILED/CANCELLED` + biz §2A.5 Question.ANALYZING + biz §2B.2 步 5-7 + biz §2B.8 SC-07 + A04 audit §2.3 / §2.4 + frontend Analyzing/index.tsx 实际 ref。

---

## §7 跳转

| 入口 | 来源 | 触发条件 |
|---|---|---|
| 路由 push | P02 上传成功 (T02 AC1) | `capture.UPLOADED` + createPending 200 + analyze-by-url 202 · 跳转 ≤ 500ms |
| 深链恢复 | (P1) 推送恢复后台分析 | `wb://analyzing/{taskId}` · 仅当 taskId 仍 ANALYZING 时 |

| 出口 | 目标 | 触发条件 |
|---|---|---|
| 路由 push | P04 (`/question/{qid}/result`) | SSE `DONE` event 到达 + 200ms 过渡 (T04 AC2) |
| 路由 push | `/manual-entry?qid&taskId` | 累计 2 次 FAIL · POST `/api/ai/fallback` 不论成败都跳 (SC-07 步 4) |
| 路由 push | `/` (P-HOME) | user tap 取消 · BE `CANCELLED` 帧到达 |
| 路由 push (游客) | `/guest/capture` | `onDone` 时检测无 `lf:token` (SC-12 游客无 result 页) |

> **biz §2A.4 「禁止行为」**：返回键、左滑返回、系统 Home (小程序) 都不能静默丢任务 — **必须**调 `POST /api/ai/cancel/{taskId}` (T03 AC6 关键不变量)。

来源：biz §2A.4 「跳转」+ biz §2A.4 「禁止行为」+ T02/T03/T04 AC + Analyzing/index.tsx 真实 nav 调用。

---

## §8 Wire format (SSE / WebSocket 事件) **【流式页 · 必填 7 type】**

> SSE event 通过 `Sinks.Many<AnalysisChunk>` 单源同时驱动 SSE (`/api/ai/stream/{taskId}`) + WS (`/ws/analyze/{taskId}`) 双通道。`event:` name 优先 `Type.name()` (`AnalyzeController#stream` L207-211)，data 是 `AnalysisChunk` JSON。`AnalysisChunk` 字段：`type` + `step?` (1..4) + `durationMs?` + `chunk?` (字符串 payload) + `partialJson?` (DONE 时携带完整 AnalysisResult) + `errorCode?`。

| # | Event type | Payload schema (JSON 字段) | 触发条件 (BE → wire) | FE 反应 (useEventSource → 回调) | 来源 |
|---|---|---|---|---|---|
| 1 | `STEP_START` | `{type:"STEP_START", step: 1\|2\|3\|4}` | `QuestionAnalyzerImpl.streamAnalyze` 进入 step n (L149-208) · `AnalysisChunk.stepStart(n)` factory | 该 step 圆点翻 `now` · shimmer 出现 · `aria-busy=true` · 调 `onStep(n,'start')` | A04 §1.2 + §2.3 |
| 2 | `STEP_DONE` | `{type:"STEP_DONE", step: 1\|2\|3\|4, durationMs: number}` | step n 完成 · `AnalysisChunk.stepDone(n, durMs)` factory | 该 step 圆点翻 `done` (绿 √) · shimmer 移除 · `stepMetaText=${dur}ms` · 调 `onStep(n,'done',durMs)` · 埋点 `wb_ai_stream_step{step,durMs}` | A04 §1.2 + §2.3 |
| 3 | `PARTIAL_JSON` | `{type:"PARTIAL_JSON", chunk: string}` ⚠️ **不是** `partialJson` 字段 | step 3 / step 4 流式 chunk 到达 · `AnalysisChunk.partialJson(fragment)` factory (factory **把 fragment 写到 `chunk` field**) | hook 内部累积拼接 → hook 暴露 `partialJson: string` API · 模板字符串 append 到 `<pre>` · 光标 blink | A04 §2.3 (spec drift fix · 文档与代码冲突) |
| 4 | `DONE` | `{type:"DONE", partialJson: AnalysisResult (object)}` (DONE 时 `partialJson` 字段携带**完整** AnalysisResult 对象 · 非 string) | `streamAnalyze` step 4 收尾 · `AnalysisChunk.done(result)` factory | hook 触发 `onDone()` → 200ms 过渡 → `nav('/question/{qid}/result')` · 埋点 `wb_ai_stream_done{totalMs,tokens}` | A04 §1.2 + §2.3 |
| 5 | `FAIL` | `{type:"FAIL", errorCode: string, step?: 1\|2\|3\|4}` | provider 异常 / 超时 · `AnalysisChunk.fail(code)` 或 `failAtStep(n, code)` factory | 红条 errorBanner · `wb_ai_stream_fail{code,count}` · failCount≥2 → 调 `POST /api/ai/fallback/{taskId}` → `nav /manual-entry` | A04 §1.2 |
| 6 | `CANCELLED` | `{type:"CANCELLED"}` (无 payload) | user tap 取消 → `POST /api/ai/cancel/{taskId}` → `streamHub.dispose` **先 emit `cancelled()` 帧** (L101-103) 再 `sink.tryEmitComplete()` (隐式契约) | hook 触发 `onCancelled` · `userCancelledRef=true` · `nav('/')` · disable cancel button | A04 §2.3 + §2.4 (BE 行为契约) |
| 7 | `FALLBACK_MODEL` | `{type:"FALLBACK_MODEL", chunk: "from→to"}` (例 `"qianwen→openai"`) | `FallbackOrchestrator.tryWithFallback` **命中非主 provider 时** (L67-76) · `AnalysisChunk.fallbackModel(from, to)` factory · **主 provider 成功则静默** | hook 触发 `onFallbackModel(fromTo)` · `slowBanner=true` 顶部黄条「切换备用模型中 (gpt-4o-mini)…」· model badge 切换 · 埋点 `wb_ai_stream_slow{reason:'fallback_model',fromTo}` | A04 §1.2 + §2.3 (SC-01-C04 落地 · 任务 prompt 要求的第 7 种) |

### 8.1 弃用字段与兼容

- **历史 Stage enum** (`OCR / ANALYSIS / STEPS / DONE / FAIL / CANCELLED`) 仅 WS + IT 兼容保留 · 通过 `mapStageToType` 映射到 `Type` (A04 §1.2)。**新代码不应再用 Stage**，一律用 `Type`。
- `event:` name 退化顺序：`type.name()` → `stage.name()` → `"MESSAGE"`，FE 始终读 `data` 内的 `type` 字段消歧，不依赖 event name 行。

### 8.2 SSE 通道 HTTP 头

| Header | 值 | 用途 |
|---|---|---|
| `Content-Type` | `text/event-stream` | SSE wire |
| `Cache-Control` | `no-cache` | 防代理缓存 |
| `Connection` | `keep-alive` | 长连 |
| `X-Accel-Buffering` | `no` | 关闭 Nginx 缓冲 (D-SSE 三件套) |

来源：audits/SC-01-PHASE-0/A04-ai-analysis.md §1.1 / §1.2 / §2.3 / §2.4 + `backend/common/.../dto/AnalysisChunk.java` (factory 9 个) + `backend/ai-analysis-service/.../AnalyzeController.java` (L207-211 event name) + `AnalysisStreamHub.java` (L101-103 cancel 顺序契约) + `FallbackOrchestrator.java` (L67-76 fallback emit 条件)。

---

## §9 异常 & 降级

| 异常 | 触发条件 | UI 反馈 | 系统行为 | 关联 TC |
|---|---|---|---|---|
| AI 首次超时 (SLOW) | qwen-vl-max 10s 无 STEP_START 推进 | 顶部**黄条**「切换备用模型中…」+ model badge 切到 gpt-4o-mini | BE `FallbackOrchestrator` emit `FALLBACK_MODEL` chunk · 自动切链路下一 provider · `wb_ai_stream_fail{code=TIMEOUT,model=qwen-vl-max}` + `_start{model=gpt-4o-mini}` | TC-01.03 |
| AI 连续 2 次失败 | failCount ≥ 2 (FE 计数器 · `failCountRef.current`) | 顶部**红条** + 跳手填页 (P03_MANUAL) · Hero「AI 暂时帮不上忙,我们一起手填」· 已 OCR 题干预填 | `POST /api/ai/fallback/{taskId}` → `200 {ocrText}` (从 `streamHub.ocrTexts` 透传) · `wb_ai_stream_dead{taskId}` · `wb_result_manual_open` | TC-07.01 |
| OCR 自身失败 (step 1 崩) | step 1 emit FAIL | 同上 · 手填页题干栏**为空** + 提示「未能识别题目文本,请手动输入」 | streamHub OCR 文本未持久化 · fallback 返 `ocrText=""` | TC-07.03 |
| 网络中断 (EventSource onerror) | TCP 断 / 服务 down | 红 toast「网络中断,请重试」+ 重连 ≤ 3 次 (indicator 提示) | `wb_ai_stream_fail{code=NETWORK_ERROR}` · 仍计入 failCount | T03 TI4 |
| 用户取消 | tap「取消分析」/ tap nav 返回键 | 按钮 disabled · 触觉反馈 · 跳 P-HOME | `POST /api/ai/cancel/{taskId}` 200 → BE 先 emit `CANCELLED` 帧再 complete · FE `onCancelled` 触发 · `wb_ai_stream_cancel` | T03 AC6 |
| 取消 API 5xx | `/api/ai/cancel/` 5xx | 不阻塞 UI · 仍跳 P-HOME (FE `.catch(noop)`) | PENDING task 留 server · 不重复创建 question (idem) | TC-01.06 (内嵌) |
| 路由非法进入 | 直接访问 `/analyzing/:taskId` 但无 PENDING question / 无 taskId | 4 步全 wait · EventSource onerror · 退回 P02 | 路由门禁 (T02 key_invariants) | T02 AC4/AC5 |
| 进入后端口阻塞 (BE `.block(10s)`) | `POST /api/ai/analyze` 同步路径 (FE 不应该走) | — (FE 切到 analyze-by-url 异步) | A04 audit §2.2 ⚠️ 同步 path P95 不可达 · 仅 IT/debug | — |

来源：biz §2A.4 「异常 & 降级」+ biz §2A.7 异常路径 (AI 超时 / AI 彻底失败 / 跨设备并发) + biz §2B.2 TC-01.03 + biz §2B.8 SC-07 全段 + feature_list.json T03 AC5/AC6 + A04 audit §2.2。

---

## §10 验收点 (TC → AC 映射)

| TC ID | 类型 | GIVEN | WHEN | THEN | 关联 task AC |
|---|---|---|---|---|---|
| TC-01.01 | 正常 | 学生新登录 · 网络稳定 · 后端各服务健康 | SC-01 步 5-7 (P02→P03→P04) | P03 4 步全 done · partialJson 累积完整 · `DONE` 后 200ms 跳 P04 · 埋点 `wb_ai_stream_start/_step×4/_done` 齐 | T02 AC1/AC2/AC3 · T03 AC1/AC2/AC3/AC4 · T04 AC1/AC2 |
| TC-01.03 | 异常 | 同 TC-01.01 · 步 6 时 qwen-vl-max 超时 > 10s | 等待 | 顶部黄条「切换备用模型中」· 自动切 gpt-4o-mini · 后续步骤正常完成 · 埋点 `wb_ai_stream_fail{code=TIMEOUT}` 1 条 + `_start{model=gpt-4o-mini}` 1 条 | T03 AC5 |
| TC-01.04 | 异常 | 同 TC-01.01 · 步 7 AI 置信度 conf=0.5 | 正常执行到 DONE | P03 正常跳 P04 · P04 顶部黄条「AI 不太确定」(本页不显示) · DB `analysis_result.confidence=0.5` | T04 AC5 (P04 spec) |
| TC-07.01 | 异常 | ai-analysis mock 两个模型均超时 | SC-07 步 1-6 | 黄条 → 红条 → 跳手填页 · `wb_question.source=MANUAL` · 仍生成 plan + 7 nodes + 7 events | T03 AC5/AC6 |
| TC-07.02 | 异常 | qwen 失败但 gpt 成功 | 走 SC-07 步 1-2 · gpt 10s 内返回 | 流水线继续推进 · 最终走 AI 正常路径 · 埋点 1 条 fail + 1 条 done | T03 AC5 |
| TC-07.03 | 边界 | OCR 自身失败 (STEP_1 崩) | 等待 | 手填页题干栏为空 · 提示「未能识别题目文本」 | T03 AC5 (扩展) |
| TC-07.04 | 安全 | 手填页学生输入含 HTML | 保存 | 后端 sanitize · DB 转义后存 · 前端 `<pre>` 不解析 | (P03_MANUAL 子页) |

来源：biz §2B.2 QA 用例表 (TC-01.01..06) + biz §2B.8 QA 用例表 (TC-07.01..04) + feature_list.json T02/T03/T04 `acceptance_criteria`。

---

## §11 性能预算

| 操作 | P95 budget | 来源 |
|---|---|---|
| P02→P03 路由跳转 | ≤ 500ms | biz §2B.2 步 5 「耗时预算」+ T02 AC1 |
| P03 骨架屏首屏渲染 | ≤ 100ms | T02 AC2 |
| SSE 首字节 (onopen → 第一帧 STEP_START) | ≤ 3s | spec §5 SSE 行 + A04 audit §2.1 |
| 4 步流水线总耗时 | 4–8s | biz §2B.2 步 6 「耗时预算」+ T03 AC4 |
| SSE 总超时 (server side timeout) | 60s | A04 audit §1.1 (chunk 间隔 15s · 总 60s) |
| `POST /api/ai/cancel/{taskId}` | ≤ 200ms | A04 audit §2.1 (P03 §5 spec 行) |
| `POST /api/ai/fallback/{taskId}` | ≤ 500ms | A04 audit §2.1 |
| `DONE` → P04 跳转过渡 | ≤ 300ms | biz §2B.2 步 7 「耗时预算」+ T04 AC2 |

来源：biz §2B.2 步 5-7 「耗时预算」列 + biz §2B.8 步 1-4 + A04 audit §2.1 SLA 列 + feature_list.json T02/T03/T04 AC1-2。

---

## §12 埋点事件

| Event name | When | Properties | 来源 |
|---|---|---|---|
| `wb_ai_stream_start` | EventSource onopen (status: QUEUED → STREAMING) | `{model, taskId}` | biz §2A.4 + §2A.8 + biz §2B.2 步 5 |
| `wb_ai_stream_step` | 每个 `STEP_DONE` event 到达 | `{step: 1..4, durMs, taskId}` | biz §2A.4 + §2B.2 步 6 (× 4 次) |
| `wb_ai_stream_slow` | `FALLBACK_MODEL` event 到达 / qwen 超时 10s | `{reason: 'fallback_model'\|'timeout', fromTo?, taskId}` | biz §2B.8 步 1 (`wb_ai_stream_slow{ms=10000}`) + Analyzing/index.tsx onFallbackModel |
| `wb_ai_stream_fail` | `FAIL` event 到达 (每次 · 多次累加) | `{code: 'TIMEOUT'\|'NETWORK_ERROR'\|...,model?, count, taskId}` | biz §2A.4 + biz §2B.8 步 2/3 (2 个 model 各 1 条) |
| `wb_ai_stream_done` | `DONE` event 到达 | `{totalMs, tokens, model, taskId}` | biz §2A.4 + §2A.8 + biz §2B.2 步 7 |
| `wb_ai_stream_cancel` | user tap 取消 · cancel API 调完 | `{taskId}` | Analyzing/index.tsx L184 |
| `wb_ai_stream_dead` | failCount ≥ 2 触发 fallback 调用 | `{taskId}` | biz §2B.8 步 4 |
| `wb_result_manual_open` | nav 到 `/manual-entry` 后页 mount | `{taskId, hasOcr: boolean}` | biz §2B.8 步 4 |

来源：biz §2A.4 「埋点事件」+ biz §2A.8 埋点字典 (`wb_ai_stream_*` 4 个) + biz §2B.8 SC-07 埋点列 + Analyzing/index.tsx `track(...)` 调用真实。

---

## §13 testid 表

| testid | 用途 | 出现位置 (mockup / 组件) | E2E 引用 |
|---|---|---|---|
| `p03-root` | P03 页面根 | `<div data-testid="p03-root">` (Analyzing/index.tsx L221) | t03-ai-stream-pipeline.spec.ts beforeEach mount |
| `p03-statusbar` | iOS 状态栏 chrome | mockup `.status` | — (chrome only) |
| `p03-thumb-card` | 缩略图卡 | Analyzing/index.tsx L230 | t03/t04 缩略图断言 |
| `p03-thumb-card-image` | 缩略图 `<img>` | L231 | — |
| `p03-thumb-card-title` | 学科 · KP | L243 | — |
| `analyzing-pipeline-model-badge` | 当前模型 + 备用 | L248 + mockup `.model` | t03 AC5 fallback 后 model badge 切换断言 |
| `analyzing-pipeline` | 4 步容器 (aria-live=polite) | L276 | t03 AC1-4 流水线断言 |
| `analyzing-pipeline-step-1` | step 1 (图像预处理) | L287 (map iteration) | t03 STEP_START/DONE 断言 |
| `analyzing-pipeline-step-2` | step 2 (OCR 题干) | 同上 | 同上 |
| `analyzing-pipeline-step-3` | step 3 (错因诊断) | 同上 | 同上 |
| `analyzing-pipeline-step-4` | step 4 (生成解法) | 同上 | 同上 |
| `analyzing-pipeline-json-stream` | JSON 流式区 `<pre>` | L316 | t03 AC3 PARTIAL_JSON append 断言 |
| `analyzing-pipeline-cancel-btn` | 取消分析按钮 | L345 | t03 AC6 取消断言 |
| `p03-fallback-banner` | 黄/红条 (SLOW + FAIL) | L262 | t03 AC5 黄条断言 |
| `p03-slow-banner` | (备用 testid · 同 fallback-banner) | 注册在 testids/index.ts L51 | — |
| `ai-pipeline-step-1..4` (alias) | step alias testid (E03a 增量) | L22-25 (ALIAS_TESTIDS) | t03 兼容查询 |
| `ai-typewriter` (alias) | JSON 流 alias | L313 wrapper | 同上 |
| `ai-fallback-banner` (alias) | banner inner span alias | L267 | 同上 |
| `ai-cancel-btn` (alias) | cancel wrapper alias | L342 | 同上 |

来源：`frontend/packages/testids/src/index.ts` `TEST_IDS.p03.*` L36-52 (15 个 canonical) + `frontend/apps/h5/src/pages/Analyzing/index.tsx` `ALIAS_TESTIDS` (6 个 alias) + mockup 03_analyzing.html。

---

## §14 i18n key

| Key | 中文 | 英文 | 用途 |
|---|---|---|---|
| `analyzing.title` | AI 正在分析… | AI is analyzing… | 顶部 nav 标题 |
| `analyzing.progress.badge` | `{current}/{total}` | `{current}/{total}` | "3/4" badge |
| `analyzing.cancel.text` | 取消 | Cancel | nav 右侧文字按钮 |
| `analyzing.cancel.cta` | 取消分析 | Cancel analysis | 底部 sticky 按钮 |
| `analyzing.cancel.aria` | 取消分析 | Cancel analysis | aria-label |
| `analyzing.model.current` | 已选模型 | Current model | model badge 前缀 |
| `analyzing.model.backup` | 备用 | Backup | model badge 备用前缀 |
| `analyzing.model.latency` | 平均时延 | Avg latency | model badge 时延前缀 |
| `analyzing.step.1` | 图像预处理 | Image preprocessing | step 1 标题 |
| `analyzing.step.2` | OCR 题干 | OCR | step 2 标题 (mockup 用 "OCR 识别题干") |
| `analyzing.step.3` | 错因诊断 | Error analysis | step 3 标题 (mockup "错因分析中…") |
| `analyzing.step.4` | 生成解法 | Generate solution | step 4 标题 |
| `analyzing.step.state.wait` | 等待 | Waiting | meta 文本 |
| `analyzing.step.state.now` | 进行中 | In progress | meta 文本 |
| `analyzing.step.state.done` | 完成 | Done | meta 文本 (后接 `${dur}ms`) |
| `analyzing.step.state.fail` | 失败 | Failed | meta 文本 |
| `analyzing.banner.slow` | 切换备用模型中 (gpt-4o-mini)… | Switching to backup model… | 黄条文案 (SLOW + FALLBACK_MODEL) |
| `analyzing.banner.error.network` | 网络中断,请重试 | Network error, please retry | 红条 (NETWORK_ERROR) |
| `analyzing.banner.error.generic` | AI 暂时帮不上忙,请稍后重试 | AI unavailable, please retry later | 红条 (其它 FAIL) |
| `analyzing.aria.pipeline` | AI 分析进度 | AI analysis progress | `<main>` aria-label |
| `analyzing.aria.json` | AI 流式输出 | AI streaming output | `<pre>` aria-label |

来源：biz §2A.4 P03 卡 (未显式列 i18n key,从 mockup 视觉 + Analyzing/index.tsx 文案抽出) + `frontend/packages/i18n/zh-CN/` (key 前缀 `analyzing.*` 遵循 P02 `capture.*` 同款规范)。

---

## §15 关联与影响

- **上游 spec**: `design/system/pages/P02-capture.spec.md` (`UPLOADED → nav P03`)
- **下游 spec**: `design/system/pages/P04-result.spec.md` (SSE `DONE` → `nav('/question/{qid}/result')`) · P03_MANUAL 手填页 (SC-07 降级 · spec 待补)
- **关联 task**:
  - T02 (P02→P03 跳转 + createPending + analyze 启) — feature_list.json L99-145
  - T03 (4 步流水线 + fallback + cancel) — feature_list.json L147-194 · **本页主任务**
  - T04 (SSE DONE → P03→P04 跳转) — feature_list.json L196-240
- **关联 audit**: `audits/SC-01-PHASE-0/A04-ai-analysis.md` (字符级 ground truth · 7 SSE type + 4 endpoint + FallbackOrchestrator) + 6 处 spec drift 全在 §8 解决
- **关联 mockup**: `design/mockups/wrongbook/03_analyzing.html`
- **关联代码**: `frontend/apps/h5/src/pages/Analyzing/index.tsx` (358 行) + `useEventSource` hook (待落地 · T03) + `backend/ai-analysis-service/.../AnalyzeController.java` (272 行) + `AnalysisStreamHub.java` (154 行) + `FallbackOrchestrator.java` (127 行) + `AnalysisChunk.java` (173 行)
- **跨 SC 影响**: SC-01 happy path 心跳 · SC-07 降级链路入口 · (P1) 推送 deep link 恢复后台 ANALYZING

---

**修订表**

| 版本 | 日期 | owner | 摘要 |
|---|---|---|---|
| v1 | 2026-05-14 | spec.md gen agent | 首版 · 基于 biz §2A.4 P03 卡 + A04 audit §1.1/§2.3/§2.4 字符级 ground truth · §8 wire format 列全 7 个 SSE type · 采纳 A04 audit 的 6 处 spec drift 修正建议 |
