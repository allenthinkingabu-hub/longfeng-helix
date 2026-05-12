# SC-01-A02 · team-2 · attempt-1 · Bugs Found

**任务类型**：P0 审计任务（只读分析，无业务代码改动）

## 结论

**0 bug** · 无 bug

## 说明

本任务（SC-01-A02）为 Phase 0 审计任务，要求对比 `wrongbook-service` 现有 Controller 路径与 spec P02/P04/P05 §5 API 触点，输出审计报告。audit 是**只读分析**，不修改任何 Java 业务代码、SQL、前端代码或配置；仅重写 markdown 审计文档 `audits/SC-01-PHASE-0/A02-wrongbook-api.md`。

故本轮无 bug 发现，无 bug 修复。

## audit 报告中识别但**不属于本任务 bug**的 SC-01 范围外 tech debt（仅做 follow-up 记录）

| 项 | 文件 | 描述 | 是否阻塞 SC-01 | 处置 |
| --- | --- | --- | --- | --- |
| `WrongbookSearchController` 路径与 javadoc 不一致 | `backend/wrongbook-service/src/main/java/com/longfeng/wrongbook/controller/WrongbookSearchController.java` L17 / L22 | class javadoc 声称 `POST /api/wb/questions/search`，但 `@RequestMapping` 实际是 `/wrongbook/questions/search` | ❌ 不阻塞（SC-01 不依赖 search 端点；P05 用 `GET /api/wb/questions?q=`） | 记入 audit §3.1 作为 SC-01 范围外 follow-up，不在本任务修复范围 |

上述 tech debt 已在审计报告中显式标记为「SC-01 范围外」，由后续 cleanup 任务处理，**不视为 SC-01-A02 本轮的 bug**。

## 关联 commit

- `616c112531ed5c022233a0098296461bd3446b37` — `audit(SC-01-A02): refresh wrongbook-service Controller vs spec §5 — 6/6 触点已 1:1 落地于 QuestionDetailController`
