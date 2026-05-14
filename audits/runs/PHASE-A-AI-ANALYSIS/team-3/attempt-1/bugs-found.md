# Bugs Found · PHASE-A-AI-ANALYSIS · team-3 · attempt-1

## Bug 1: JPA AuditingEntityListener OffsetDateTime 不兼容

- **文件**: `backend/ai-analysis-service/src/main/java/com/longfeng/aianalysis/entity/AnalysisTask.java` + `AnalysisResult.java`
- **描述**: Spring Data JPA 的 `@CreatedDate`/`@LastModifiedDate` 不原生支持 `OffsetDateTime` 类型，运行时抛 `InvalidDataAccessApiUsageException: Cannot convert unsupported date type java.time.LocalDateTime to java.time.OffsetDateTime`
- **根因**: AuditingEntityListener 内部使用 `LocalDateTime` 然后尝试转换到实体字段类型，`OffsetDateTime` 不在支持列表中
- **修复**: 将 `@CreatedDate` / `@LastModifiedDate` 字段类型从 `OffsetDateTime` 改为 `Instant`（Instant 在支持列表中且与 PG TIMESTAMPTZ 兼容）
- **修复 commit**: `40020cc` (修复包含在主实现 commit 中)
