# Bugs Found · PHASE-A-REVIEW-PLAN · team-5 · attempt-1

## Bug 1: IntegrationTestBase 使用错误的 PG 端口和凭据

- **文件**: `backend/review-plan-service/src/test/java/com/longfeng/reviewplan/IntegrationTestBase.java`
- **描述**: PHASE-0 硬编码 port=15432 / user=postgres / password=wb，但 PHASE-A sandbox 为 port=15436 / user=longfeng / password=longfeng_dev。导致 IT 全部连接失败。
- **修复 commit**: d6e39e3

## Bug 2: Parent POM testExcludes 阻止 *IT.java 编译

- **文件**: `backend/wrongbook-parent/pom.xml` (parent) → `backend/review-plan-service/pom.xml` (override)
- **描述**: PHASE-0 在 parent POM 设置 `<testExclude>**/*IT.java</testExclude>` 防止编译。PHASE-A 需要编译并运行 IT。
- **修复**: 在 module pom.xml 用 `combine.self="override"` 清空 testExcludes。
- **修复 commit**: d6e39e3

## Bug 3: Flyway 迁移文件缺失导致 sandbox 空 DB 无法启动

- **文件**: `backend/common/src/main/resources/db/migration/` (原只有 V1.0.066)
- **描述**: V1.0.066 依赖 review_plan_outbox 表已存在 (ALTER CONSTRAINT)，但 V1.0.050-054 创建基础表的迁移不存在。PHASE-0 时 IT 禁用了 Flyway，依赖预置 DB；PHASE-A sandbox 为空 DB。
- **修复**: 新增 V1.0.001 (user_account), V1.0.002 (wrong_item), V1.0.050 (review_plan), V1.0.051 (review_outcome), V1.0.054 (review_plan_outbox), V1.0.055 (unique indexes)。
- **修复 commit**: 5ab782f

## Bug 4: IntegrationTestBase 禁用 Flyway 导致空 DB 无表

- **文件**: `backend/review-plan-service/src/test/java/com/longfeng/reviewplan/IntegrationTestBase.java`
- **描述**: `spring.flyway.enabled=false` 在 PHASE-0 是为了避免与共享 DB 的 flyway_schema_history 冲突。PHASE-A sandbox 为空 DB，需要启用 Flyway 创建表。
- **修复**: 改为 `spring.flyway.enabled=true`。
- **修复 commit**: d6e39e3
