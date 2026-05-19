# SC-20-T01 · Coder Phase 3 · attempt-1 · bugs-found

> coder-agent.md 铁律 5: 0 bug 也必须显式声明 · 否则 audit.js REDO。本 attempt 真发现并修复 2 bug · 列在下方。

## Bug 1 · case1 索引数预期不准 · PG 自动 PK + UNIQUE 系统索引未排除

**文件**: `backend/common/src/test/java/com/longfeng/common/db/migration/V1_0_084_WbReviewNodeCreateAiJudgeIT.java`
**症状**: 第 1 次 mvn verify 跑 case1 `assertThat(indexNames).hasSize(4)` FAIL · 实际 pg_indexes 返 6 行:
```
["idx_wb_node_due_status",
    "idx_wb_node_student_due",
    "idx_wrn_judge_source",
    "idx_wrn_low_confidence",
    "wb_review_node_pkey",
    "wb_review_node_plan_id_level_key"]
```
**根因**: PG 为 `PRIMARY KEY` (id) 自动建索引 `wb_review_node_pkey` · 为 `UNIQUE(plan_id, level)` 自动建索引 `wb_review_node_plan_id_level_key` · pg_indexes 显示 4 显式 CREATE INDEX + 2 系统索引 = 6 行。test-cases.md Round 2 用例 #1 字面 "返 4 行" 指**显式 CREATE INDEX 的 4 个 satellite/master 索引** · 不包含系统索引。

**修复**: 改断言 · 用 `startsWith("idx_")` 过滤 · 只验显式 4 个 `idx_*` 索引 (符合 test-cases.md 字面意图) · 同时保留 `contains(4 names)` 验字面准确。系统生成索引 (`wb_review_node_pkey` + `wb_review_node_plan_id_level_key`) 由 case1 末尾 `pg_constraint contype='u'` UNIQUE 约束断言独立覆盖。

**修复 commit**: `5c40811` (本 task 唯一 commit · 含修复)
**re-run 验证**: 第 2 次 mvn verify · case1 PASS

## Bug 2 · case5 fixture INSERT 撞 UNIQUE(plan_id, level)

**文件**: `backend/common/src/test/java/com/longfeng/common/db/migration/V1_0_084_WbReviewNodeCreateAiJudgeIT.java`
**症状**: 第 1 次 mvn verify 跑 case5 抛 `org.postgresql.util.PSQLException: ERROR: duplicate key value violates unique constraint "wb_review_node_plan_id_level_key" Detail: Key (plan_id, level)=(1, 0) already exists.` Batch entry 7 失败。
**根因**: case5 fixture 200 行 INSERT 用 `plan_id=1L` 固定 + `level=(i % 7)` · 当 `i=7` 时 `level=0` 与 `i=0` 时 `plan_id=1, level=0` 冲突 UNIQUE(plan_id, level)。
**修复**: 改 `plan_id=(long) i` · 200 行 plan_id 全唯一 0..199 · UNIQUE(plan_id, level) 不可能撞。同时 session-2 SELECT 从 `WHERE plan_id = 1` 改 `WHERE student_id = 7001` (因 plan_id 不再固定 1 · student_id 仍是 7001 锁定 · 期望返 200 行不变)。
**修复 commit**: `5c40811` (本 task 唯一 commit · 含修复)
**re-run 验证**: 第 2 次 mvn verify · case5 PASS · `session2Read.get(5, TimeUnit.SECONDS).isEqualTo(200)` 满足

---

**总结**: 2 真 bug · 均在内部 self-check 跑第 1 次 mvn verify 时 fail loud 暴露 (符合 CLAUDE.md Rule 12) · 立即修复 · 第 2 次 verify 5/5 IT PASS · BUILD SUCCESS。无 silent skip · 无 hide。两个 bug 都是测试代码本身的 bug · **生产 SQL (V1.0.084__...sql) 未发现任何 bug** · biz §4.16 v1.1 SQL 字面正确。
