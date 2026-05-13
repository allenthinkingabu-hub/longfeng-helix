# SC-01-A04 · team-1 · Coder attempt 1 · Bugs Found

> 任务类型：**P0 审计文档撰写**（非编码） · 范围：ai-analysis-service 4 端点 + 4 步流水线事件 + FallbackOrchestrator

---

## 结论：**0 bug** / 无 bug

### 说明

本任务的产出物是审计文档（`audits/SC-01-PHASE-0/A04-ai-analysis.md`），不修改任何 backend / frontend 业务代码。

针对审计范围内的 ai-analysis-service 代码（10 个 java 文件、含 4 个 controller + FallbackOrchestrator + AnalysisStreamHub + AnalysisChunk），**未发现任何阻断性 BE bug**：

- 4/4 P03 §5 端点全部落地（analyze · stream · cancel · fallback）
- 7/7 流水线事件全部落地（STEP_START / STEP_DONE / PARTIAL_JSON / DONE / FAIL / CANCELLED / FALLBACK_MODEL）
- FallbackOrchestrator chain-of-providers 行为符合 D-AI-Stream 设计
- AnalysisStreamHub 单源 sink（SSE + WS 共享）+ producer disposable + OCR 文本透传 全链路对齐
- cancel 端点幂等性 + dispose 内先 emit CANCELLED 再 complete sink 已对齐 FE useEventSource.ts onCancelled 契约

### v2 §3 列出的 5 条 ⚠️ 不是 bug

A04 v2 §3 列了 5 条 actionable 项，但它们是 **spec 文档与代码之间的描述漂移**（spec 落后于代码），不是代码 bug：

| 项 | 类别 | 范围 | 是否 bug |
|---|---|---|---|
| #1 `partialJson` wire 字段名（spec 写 partialJson，code+FE 用 chunk） | spec doc drift | spec P03 §4 1 行改名 | ❌ 不是 bug |
| #2 spec P03 §4 type union 缺 FALLBACK_MODEL | spec doc drift | spec 1 行新增 | ❌ 不是 bug |
| #3 spec §6 状态机未注释 BE 的 cancelled-emit-then-complete + fallback-model-emit 行为 | spec doc drift | spec 2 行注释 | ❌ 不是 bug |
| #4 spec P02 §5 缺 /api/ai/analyze-by-url 行 + 同步 analyze 的 P95 标注例外 | spec doc drift | spec 1-2 行新增 | ❌ 不是 bug |
| #5 "连续 2 次失败"由 FE 计数还是 BE 持久状态 | 决策备案 | C04-decision.md 补一句 | ❌ 不是 bug |
| #6 AnalyzeController 类头补一行 vs /analysis/* 区分的 Javadoc（建议性） | doc tidy | 1 行 Javadoc | ❌ 不是 bug |

这些项的处置在 `audits/SC-01-PHASE-0/A04-ai-analysis.md` v2 §3 中已 surface，将由后续 spec-sync 任务统一处理，不在 SC-01-A04 审计范围内。

---

**最终：本轮 (attempt 1) 0 bug · 无需修复 commit。**
