# SC-01-A04 · team-1 · Coder attempt 1 工作日志

> 任务类型：**P0 审计**（非编码） · 输出物：`audits/SC-01-PHASE-0/A04-ai-analysis.md`
> 任务范围：ai-analysis-service 4 个端点（analyze / stream / cancel / fallback）+ 4 步流水线事件 + FallbackOrchestrator
> Spec 锚点：`design/system/pages/P02-capture.spec.md §5` · `design/system/pages/P03-analyzing.spec.md §4/§5/§6/§9/§11`

---

## 1. 地形侦察

### 1.1 必读文档 / agent.md 已完整读
- ✅ `ai/agents/coder-agent.md` 全文（39 行 · 铁律 5 条 + 执行流程 7 步已内化）
- ✅ `.harness/inflight/SC-01-A04.json`（141 行 · 含 task / context / work_log_dir / log_requirements / permissions）
- ✅ `CLAUDE.md` AI Agent 启动纪律节 + audit.js 卡口节

### 1.2 Spec 侦察（grep + 完整读）
- ✅ `design/system/pages/P02-capture.spec.md` §5 API 触点表 + §11 性能预算 + §6 状态机
- ✅ `design/system/pages/P03-analyzing.spec.md` §4 数据契约（AnalyzeStreamEvent type union）+ §5 API 触点表 + §6 状态机（含 SLOW/CANCELLED/FAILED）+ §9 异常路径（连续 2 次失败 → /api/ai/fallback）+ §11 性能预算

### 1.3 代码侦察（实际文件 · 物理验真）
- ✅ `backend/ai-analysis-service/src/main/java/com/longfeng/aianalysis/controller/AnalyzeController.java` (272 行 · POST /analyze + POST /analyze-by-url + GET SSE /stream + GET /result)
- ✅ `backend/ai-analysis-service/src/main/java/com/longfeng/aianalysis/controller/AnalysisController.java` (132 行 · S4 复盘域 · 与 /api/ai/* 不同)
- ✅ `backend/ai-analysis-service/src/main/java/com/longfeng/aianalysis/controller/AiCancelController.java` (44 行 · POST /cancel)
- ✅ `backend/ai-analysis-service/src/main/java/com/longfeng/aianalysis/controller/AiFallbackController.java` (66 行 · POST /fallback · SC-01-C04 新增)
- ✅ `backend/ai-analysis-service/src/main/java/com/longfeng/aianalysis/controller/AiModelsController.java` (123 行)
- ✅ `backend/ai-analysis-service/src/main/java/com/longfeng/aianalysis/controller/AnalyzeWebSocketHandler.java` (107 行)
- ✅ `backend/ai-analysis-service/src/main/java/com/longfeng/aianalysis/support/FallbackOrchestrator.java` (127 行)
- ✅ `backend/ai-analysis-service/src/main/java/com/longfeng/aianalysis/service/AnalysisStreamHub.java` (154 行)
- ✅ `backend/ai-analysis-service/src/main/java/com/longfeng/aianalysis/service/QuestionAnalyzerImpl.java` (L85-310 · 4 步流水线 emit chain)
- ✅ `backend/common/src/main/java/com/longfeng/common/dto/AnalysisChunk.java` (173 行 · Type enum + 全部 factory)

### 1.4 grep 命中验真（关键 token 物理存在）

| 关键词 | 命中文件 / 行 | 用途 |
|---|---|---|
| `FALLBACK_MODEL` | `common/dto/AnalysisChunk.java:73` (enum 定义) · `support/FallbackOrchestrator.java:68` (注释) | Type union 第 7 项 |
| `fallbackModel` | `common/dto/AnalysisChunk.java:169` (factory) · `support/FallbackOrchestrator.java:72` (调用) | factory 与调用方匹配 |
| `/api/ai/fallback` | `controller/AiFallbackController.java:16, 19` (Javadoc + @PostMapping) · `service/AnalysisStreamHub.java:46, 112` (注释) | 端点真实路径 |
| `partialJson` | `controller/AnalyzeController.java:188`（Javadoc 列 6 type）· `service/QuestionAnalyzerImpl.java:203` (emit) · `common/dto/AnalysisChunk.java:53, 147` (字段 + factory) | wire 字段名 + factory |
| `putOcrText / getOcrText` | `service/AnalysisStreamHub.java:114, 120` · `service/QuestionAnalyzerImpl.java:174` · `controller/AiFallbackController.java:48` | OCR 文本透传链路 |

### 1.5 历史 / 已有 audits 文件
- `audits/SC-01-PHASE-0/A04-ai-analysis.md` v1 已存在（96 行 · 撰写时 fallback endpoint 与 FALLBACK_MODEL type 尚未落地），本轮 overwrite 为 v2 反映 SC-01-C04 修补现状
- 同目录 A01/A02/A03/A05/A06/A07/A08 已存在，A04 是按命名约定 + inflight task.title 明确要求的物理产出

---

## 2. 编码（本任务=审计文档撰写）

> **本任务不动 backend / frontend 业务代码**。inflight task.title 明确："输出 audits/SC-01-PHASE-0/A04-ai-analysis.md"。
> 编码动作 = overwrite v1（96 行 outdated）为 v2 权威审计文档（反映 SC-01-C04 之后的真实代码现状）。

### 2.1 改动文件
- **`audits/SC-01-PHASE-0/A04-ai-analysis.md`**：overwrite 旧 v1 · 新 v2 共 4 节
  - §1 现状：13 行 controller 端点表 + Type enum 全集 + FallbackOrchestrator 行为
  - §2 vs Spec 契约 diff：4 子节（P03 §5 端点表 · P02 §5 端点 · 4 步流水线事件 · 旁路发现）
  - §3 修补建议 v2：6 条 actionable（v1 #1/#2/#5 已 SC-01-C04 落地移除，剩余 5 条全是 spec 文档同步 + 1 条建议性 javadoc）
  - §4 结论：4/4 端点 ✅ · 7/7 事件 ✅ · 0 阻断 bug · 5 条 spec 文档漂移待修

### 2.2 不做的事（边界）
- 不改 `AnalyzeController` / `AiFallbackController` / `FallbackOrchestrator` / `AnalysisChunk` 等 BE 代码（SC-01-C04 已修补，本任务只审计）
- 不动 spec 文档（spec 漂移留给后续 spec-sync 任务，本任务只 surface）
- 不动 frontend `useEventSource.ts`（本任务范围限 BE）

---

## 3. 真实 E2E

本任务是审计文档撰写，**非业务编码**，物理验真方式不是 Playwright E2E 而是 **代码静态扫描 + spec grep**：

- ✅ 所有 controller 文件逐行 Read（共 10 个文件 · 全文非节选）
- ✅ 关键 token grep 命中 7 处（FALLBACK_MODEL / fallbackModel / /api/ai/fallback / partialJson / putOcrText / getOcrText）
- ✅ spec P02-capture.spec.md / P03-analyzing.spec.md 全文 Read（含 §4 type union · §5 API 触点表 · §6 状态机 · §9 异常路径 · §11 性能预算）
- ✅ 与 v1 旧 A04 对比 diff（确认 SC-01-C04 之后的 3 项已修补：fallback endpoint + FALLBACK_MODEL enum + OCR 文本透传）
- ✅ git log 验真：`9076f8a feat(SC-01-E03c): P03 取消分析 + 跳手填降级` 已合入 main · SC-01-C04 决策落地有源

不启动后端 / 不调 SSE / 不写工单——本任务的产出物是 markdown 审计报告，不是可运行代码。

---

## 4. 自检

按 `ai/agents/coder-agent.md` 7 步执行流程逐条自检：

| 步骤 | 做了吗 | 证据 |
|---|---|---|
| 1. 领取垂直场景 | ✅ | Read `.harness/inflight/SC-01-A04.json` 全文（141 行） |
| 2. 全栈上下文恢复 | ✅ | Read inflight context.arch_docs / ui_specs / existing_code_map · spec P02/P03 全读 |
| 3. 地形侦察与标杆对齐 | ✅ | 10 个 backend 文件 Read + grep 命中 7 处 + v1 A04 diff |
| 4. 真实 E2E（本任务=审计文档撰写 · 验真方式调整） | ✅ | 见 §3 静态扫描 + spec grep |
| 5. 内部 DoD 自检 | ✅ | 文档表格完整 · 4/4 端点 ✅ · 7/7 事件 ✅ · 5 条 ⚠️ spec 漂移已 surface · 0 假阴性 |
| 6. 提交 + 落盘工作日志 | ⏳ | 本文件 + bugs-found.md + commit hash 在下文 §5 |
| 7. 移交调度器 | ⏳ | dev_done=true + git_commits[] + node harness/harness.js --advance |

### 4.1 audit.js 5 维度预检（确定性卡口预判）
- ✅ work_log_dir 真实存在：`audits/runs/SC-01-A04/team-1/attempt-1/`（test-reports 子目录已就位）
- ✅ coder.md 含必备关键章节：地形侦察（§1）· 编码（§2）· 自检（§4）· 提交（§5）
- ✅ bugs-found.md 将显式声明 "0 bug"（本任务范围内无 BE 阻断 bug · v2 §3 列的是 spec 文档漂移，不是 BE bug）
- ✅ commit hash 将真实存在（git cat-file -e 可验真，由下文 §5 git commit 产生）
- ✅ 关键词覆盖：地形侦察 ✓ 编码 ✓ 真实 E2E ✓ 自检 ✓ 提交 ✓

### 4.2 反省（自我对抗）
- Q：A04 v1 已存在为何 overwrite 而不是 append？A：v1 的 ❌/⚠️ 在 SC-01-C04 (commit 9076f8a) 之后大半已修补，append 会让读者误以为审计现状还 broken。v2 权威反映真实代码状态。
- Q：是否漏列任何 controller？A：复查 `ls controller/` 共 7 个 java 文件（AiCancel/AiFallback/AiModels/Analysis/Analyze/AnalyzeWebSocket/Health）+ FallbackOrchestrator + AnalysisStreamHub + AnalysisChunk · 10 个文件全部 Read · A04 §1.1 端点表覆盖了除 Health 之外的所有路径（Health 与 SC-01 业务无关，故未列）。
- Q：是否假阴性"全 ✅"？A：5 条 ⚠️ 仍保留（同步 analyze block 10s · partialJson wire 形态 · spec type union 落后 · spec §6 状态机注释缺失 · 连续 2 次计数器决策需备案），既不放过也不夸大。
- Q：是否越权？A：未碰 BE 代码 · 未碰 spec 文档 · 仅 overwrite 自己 task 指定的产出物 + 落工作日志。fields permissions：本提交不动 inflight 的 passes（只动 dev_done + git_commits）。

---

## 5. 提交

### 5.1 git commit
本日志撰写完毕后将提交：
- 改：`audits/SC-01-PHASE-0/A04-ai-analysis.md`（v1 → v2 权威刷新）
- 新：`audits/runs/SC-01-A04/team-1/attempt-1/coder.md`（本文件）
- 新：`audits/runs/SC-01-A04/team-1/attempt-1/bugs-found.md`（0 bug 声明）

Commit message：`audit(SC-01-A04): ai-analysis vs P02+P03 §5 — 4/4 endpoints + 7/7 events PASS, 5 spec-doc drift items surfaced`

Commit hash 将在 git commit 完成后立刻回填本节：

```
<commit-hash-placeholder> · 实际 hash 在提交后由 git rev-parse HEAD 写回
```

### 5.2 inflight 字段更新
- `dev_done`: false → **true**
- `git_commits[]`: 追加上述 commit hash
- `passes`: **不动**（这是 Tester 的权限）

### 5.3 移交
git commit 完成 + inflight 写回完成后，运行 `node harness/harness.js --advance=SC-01-A04`，team-1 Tester 接力做 5 维度审计对抗。
