# A01 — wrongbook-service Schema 审计

> 注：本报告由 TL 在 B01 完成后回补，因 harness 测试阶段 SC-01-A01 被伪 commit 标 PASS 导致原报告缺失。结论与 B01-decision.md §1 一致。

- **Task**: SC-01-A01 · `[审计] wrongbook-service schema 是否满足 SC-01 黄金路径`
- **Sources**: biz §2B.2 / §4.2 / §4.3、spec P04、Flyway `V1.0.010` / `.011` / `.012` / `.020` / `.021` / `.022` / `.052`、entity `WrongItem.java`
- **Downstream**: SC-01-B01（结论：无需新增字段，落空操作迁移 `V1.0.064` 留痕）

---

## 1. 现状

### 1.1 `wrong_item` 表字段清单（V1.0.010 + .020 version + .021 difficulty）

| 列                    | 类型             | 约束 / 默认                                            | 备注                                       |
| --------------------- | ---------------- | ------------------------------------------------------ | ------------------------------------------ |
| `id`                  | `BIGINT`         | `PRIMARY KEY`                                          | 应用侧雪花/外发号，String(qid) 由聚合层适配 |
| `student_id`          | `BIGINT`         | `NOT NULL`, FK `user_account(id) ON DELETE RESTRICT`   |                                            |
| `subject`             | `VARCHAR(16)`    | `NOT NULL`, `ck_wrong_subject`                         | 9 学科枚举                                 |
| `grade_code`          | `VARCHAR(16)`    | nullable                                               |                                            |
| `source_type`         | `SMALLINT`       | `NOT NULL`, `ck_wrong_source`                          | 1-5                                        |
| `origin_image_key`    | `VARCHAR(512)`   | nullable                                               | 关联 file_asset 由 A03 管                   |
| `processed_image_key` | `VARCHAR(512)`   | nullable                                               |                                            |
| `ocr_text`            | `TEXT`           | nullable                                               |                                            |
| `stem_text`           | `TEXT`           | nullable                                               |                                            |
| `status`              | `SMALLINT`       | `NOT NULL DEFAULT 0`, `ck_wrong_status IN (0,1,2,3,8,9)` | 6 态机                                  |
| `mastery`             | `SMALLINT`       | `NOT NULL DEFAULT 0`, `ck_wrong_mastery BETWEEN 0 AND 2` |                                          |
| `embedding`           | `vector(1024)`   | nullable, `ivfflat(vector_cosine_ops) lists=100`       | entity 不映射，由 ai-analysis 原生写入       |
| `mastered_at`         | `TIMESTAMPTZ`    | nullable                                               |                                            |
| `created_at`          | `TIMESTAMPTZ`    | `NOT NULL DEFAULT now()`                               | `@CreatedDate`                             |
| `updated_at`          | `TIMESTAMPTZ`    | `NOT NULL DEFAULT now()`                               | `@LastModifiedDate`                        |
| `deleted_at`          | `TIMESTAMPTZ`    | nullable                                               | `@SQLDelete` + `@SQLRestriction` 软删       |
| `difficulty`          | `SMALLINT`       | (V1.0.021) nullable                                    |                                            |
| `version`             | `BIGINT`         | (V1.0.020) `NOT NULL`, `@Version` 乐观锁                |                                            |

索引：`idx_wrong_student_status(student_id, status, created_at DESC) WHERE deleted_at IS NULL`、`idx_wrong_subject(student_id, subject) WHERE deleted_at IS NULL`、`idx_wrong_item_embedding ivfflat`。

### 1.2 枚举值

- `status` ∈ `{0:PENDING, 1:ANALYZING, 2:ANALYZED, 3:CONFIRMED, 8:ARCHIVED, 9:FAILED}` —— 详见 `com.longfeng.wrongbook.domain.WrongItemStatus`。
- `source_type` ∈ `{1, 2, 3, 4, 5}`（biz §4.2 来源枚举）。
- `mastery` ∈ `{0, 1, 2}`（未掌握 / 半掌握 / 已掌握）。
- `subject` ∈ `{math, physics, chinese, english, biology, chemistry, history, geography, politics}`。

### 1.3 协同表（属于 wrongbook bounded context，B01 范围内但本任务无字段缺口）

- `wrong_item_tag` (V1.0.011)、`wrong_item_outbox` (V1.0.019)、`wrong_attempt` (V1.0.022)、`idem_key` (V1.0.052 全局幂等)。

---

## 2. vs biz §2B.2 + spec P04 diff

| #  | 需求字段 / 能力                  | 来源                                       | 现状                                                                                                | 状态        |
| -- | -------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------- | ----------- |
| 1  | `wrong_item.status` 6 态枚举    | biz §4.2 L1445 / spec §5 状态机           | V1.0.010 `ck_wrong_status IN (0,1,2,3,8,9)` + `WrongItemStatus`                                     | ✅ 已满足   |
| 2  | `idempotency_key` 去重（TC-01.02）| biz §2A.4 L708 / TC-01.02 L817             | V1.0.052 `idem_key(scope, idem_key)` 全局表 + `X-Request-Id` header                                  | ✅ 已满足   |
| 3  | `qid:String` 路径变量            | spec P04 / P05 API 触点                    | `wrong_item.id BIGINT` 由 `QuestionAggregateService.parseId()` 双向适配为 String                     | ✅ 已满足   |
| 4  | `confidence` 0-1                 | P04-result.spec L103 / TC-01.04            | 归 `wrong_item_analysis` 表（V1.0.012），由 ai-analysis-service 拥有                                | ❌ 范围外 (A04) |
| 5  | `subject` 9 学科枚举             | spec P04                                   | V1.0.010 `ck_wrong_subject` 9 学科                                                                  | ✅ 已满足   |
| 6  | `source_type` 1-5                | biz §4.2                                   | V1.0.010 `ck_wrong_source CHECK 1-5`                                                                | ✅ 已满足   |
| 7  | `mastery` 0-2                    | biz §4.2 / SC-01 step 18                   | V1.0.010 `ck_wrong_mastery BETWEEN 0 AND 2`                                                         | ✅ 已满足   |
| 8  | `deleted_at` 软删                | S1 A5 漂移                                 | V1.0.010 列 + entity `@SQLDelete` + `@SQLRestriction`                                               | ✅ 已满足   |
| 9  | `embedding vector(1024)` 检索    | biz §4.2 / V-S1-03                         | V1.0.010 列 + ivfflat 索引（entity 不映射，ai-analysis 原生写入）                                    | ✅ 已满足   |
| 10 | `version` 乐观锁                 | JPA `@Version`                             | V1.0.020 列 + entity L82-83 + `@SQLDelete` `WHERE id=? AND version=?`                               | ✅ 已满足   |

**汇总：A01 范围内 10/10 字段已满足，0 字段需补。**

### 范围外发现（不在 A01 落地，留痕给后续 task）

- `wrong_item_analysis.confidence` 缺失 —— `QuestionAggregateService.java:192` 硬编码 `confidence = 0.9` 兜底，Feign payload `AnalysisDetailClient.AnalysisDetailResponse` 与源表 `wrong_item_analysis` (V1.0.012) 均缺该列。应由 **SC-01-A04 (ai-analysis-service)** 出具诊断，后续 B-task 落 `ALTER TABLE wrong_item_analysis ADD COLUMN confidence NUMERIC(3,2)`。
- `WrongbookSearchController.@RequestMapping` 与 class javadoc 路径不一致 —— 归 **SC-01-A02** 已列出，由 B02/B03 控制器对齐处理。

---

## 3. 修补建议

**空。** wrong_item schema 在 B01 范围内已满足 SC-01 黄金路径的全部字段与约束要求，无 DDL 变更。

B01 应输出一条空操作 Flyway 迁移（`V1.0.064__wb_question_sc01_align.sql`，内容为 `SELECT 1 WHERE FALSE` 占位）作为审计标记，防止后续误用版本号并给 schema_version 留痕。实体类（`WrongItem.java` / `WrongAttempt.java` / `WrongItemOutbox.java` / `WrongItemTag.java`）零改动。

---

**Audit signed-off by**: TL (回补) · 与 B01-decision.md §1 互校一致
**Date**: 2026-05-11
