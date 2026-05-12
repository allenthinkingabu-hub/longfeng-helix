# SC-01-A01 Bugs Found (team-1 · attempt-1)

> Task: `[P0 审计] wrongbook-service schema vs biz §2B.2 + spec P04`

## 结论

**0 bug** / **无 bug**

## 详情

本任务为 **P0 schema diff 审计**（非业务代码改动）。审计范围内的 10 项需求字段全部已被既有 Flyway / entity 满足（详见 `coder.md §2.2` 字段差异矩阵 + `audits/SC-01-PHASE-0/A01-wrongbook-schema.md §2`）：

- `wrong_item.status` 6 态枚举 ✅
- `idempotency_key` 全局幂等键（V1.0.052） ✅
- `qid:String` 双向桥（`QuestionAggregateService.parseId()`） ✅
- `confidence` 归 `wrong_item_analysis` ✅（范围外 / 已由 V1.0.082 落地）
- `subject` 9 学科 CHECK ✅
- `source_type` 1-5 CHECK ✅
- `mastery` 0-2 CHECK ✅
- `deleted_at` 软删 + `@SQLDelete` / `@SQLRestriction` ✅
- `embedding vector(1024)` + ivfflat ✅
- `version` 乐观锁（V1.0.020 + `@Version`） ✅

审计本身**不引入任何代码变更**，仅交付审计报告 + 工作日志，因此**无 bug 可记**。本文件按 `audit.js` 卡口要求显式声明 **0 bug** 以满足 `log_requirements.bugs_found_md_required` 规则。

## 范围外发现（不计入 A01 bug，仅留痕）

| # | 发现 | 处理路径 | 状态 |
| - | - | - | - |
| 1 | `wrong_item_analysis.confidence` 列缺失（biz §4.3 / TC-01.04 要求） | 归 SC-01-A04（ai-analysis-service 审计），由后续 B/D-task 补 ALTER | ✅ 已落 V1.0.082（SC-01-D02） |
| 2 | `WrongbookSearchController` `@RequestMapping` 与 class javadoc 路径不一致 | 归 SC-01-A02（wrongbook controller 审计），由 SC-01-B02/B03 对齐 | 已在 A02 列出 |

> 这两条**不是 A01 的 bug**，是 A01 在做 wrongbook schema 审计时顺手发现并上报给上下游 task 的"周边观察"，按职责边界不在本任务修复范围。

---

**Author**: team-1 Coder (attempt-1)
**Date**: 2026-05-12
