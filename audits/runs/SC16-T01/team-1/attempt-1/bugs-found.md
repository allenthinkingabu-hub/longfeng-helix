# SC-16-T01 · Coder · attempt-1 · bugs-found

本轮共发现 **2 项 spec drift** + **1 项 fixture 自修** · 都已 surface 并 in-place 解决。production code 自身 0 bug。

---

## Spec drift #1 · biz §10.14 字面列名与 master §4.6 schema 漂移 (高优 surface)

**位置**:
- `biz/features/P-WEEKLY-REVIEW__weekly-review.md` §10.14 字段 1/2/3 字面引用 `wb_review_record.reviewed_at` / `grade` / `duration_sec` 列
- `biz/业务与技术解决方案_AI错题本_基于日历系统.md` §4.6 wb_review_record schema 字面定义为 `start_at` / `end_at` / `duration_ms` / `self_rating` (没 `reviewed_at` 也没 `grade` 列)

**症状**: 同一 biz 文档树内 §10.14 (SC-16 satellite) 与 §4.6 (master schema) 列名 drift · Coder 实施时只能选一边。

**决策** (Rule 7 surface conflict): 选择 **biz §10.14 字面列名** 作为实施真相 · 因 §10.14 是 weekly_aggregate 的字面规约 (TestDesigner / Tester / Coder 三方对此字面达成 6 case 用例契约) · §4.6 是更早 schema 草稿 (master 文档未与 satellite §10.14 同步更新 · master §4.6 schema 整体尚未 Flyway 实施 · greenfield)。

**实施**: 新建 `V1.0.082__wb_weekly_aggregate_min.sql` 加 wb_question (id/owner_id/subject_code/kp_id/kp_name/created_at) + wb_review_record (id/student_id/question_id/reviewed_at/grade/duration_sec) **最小列** (仅覆盖 SC-16 weekly_aggregate 4 字段计算 + weakKPs 聚合所需) · 不照搬 master §4.6 全集 (embedding/knowledge_tags/level_code 等 留给后续 P-OBSERVER / wrongbook-service-v2 task)。

**遗留**: master §4.6 schema 与 §10.14 列名漂移**未在本 task 内修复** (改 master schema 会影响多个未实施 task 的 spec drift 链)。Surface 给 TL 决定:
- 选项 A · 把 master §4.6 schema 改成 §10.14 列名 (reviewed_at/grade/duration_sec) · 同步多个未来 task 的契约
- 选项 B · 把 §10.14 改成 §4.6 列名 (start_at/end_at/duration_ms/self_rating) · 反向同步 satellite
- 选项 C · 保持双 schema · 在 V1.0.082 中加视图 / column alias 抹平 · 不改任一 biz

本 attempt 不影响 6 case 通过 (V1.0.082 实施了 §10.14 真相 · 与 test-cases.md 一致)。

---

## Spec drift #2 · master §10.10 weekly_aggregate service 声称"已实现"但实际未实施

**位置**:
- `.harness/feature_list_SC-16.json` tasks[0] key_invariants[0] 字面: "复用 master §10.10 weekly_aggregate SQL · 不 fork"
- 实际 grep `backend/` 全仓: 0 命中 `weekly_aggregate` / `WeeklyAggregate` / `/api/observer/overview` (master §10.10 endpoint)

**症状**: feature_list 假设 master §10.10 P-OBSERVER weekly_aggregate service 已存在 · 本 task 仅"复用"。实际是 greenfield · 整套 service 由本 task 首建。

**决策**: 在本 task 内**首建** WeeklyAggregateService (而非"复用") · 同时遵守 INV-1 字面要求 (单一 SQL 聚合 · 字面只 1 处 · audit grep wb_review_record 在 review-plan-service 仓 main 路径 0+1=1 命中 = `WeeklyAggregateService.java`)。

**遗留**: 当 P-OBSERVER /api/observer/overview.weeklyReport 真实施时 (家长端 · 后续 task) · 应**复用** WeeklyAggregateService 而非 fork。新增脱敏层差异 (家长端 mask 原始 qid · 学生端不含 PII)。

---

## Fixture 自修 #1 · case1_happy_path_full_schema_set_equality · reviewedDurationMin 期望与 Java int div drift

**位置**: `T01WeeklyApiE2EIT.java` Case 1 fixture 周五 record · 初版 6 records × 500/6 秒/条 = 6×83 = 498 秒 (int div 截断 1 秒) · 与其他天 100 秒/条 总和 = 2698 秒 / 60 = 44.97 → int 44。

**症状**: 期望 reviewedDurationMin=45 (Round 2 fixture 描述) 但实际算出 44。

**修复**: 周五 totalDurationSec 从 500 → 600 (6×100 整除) · 总 sum = 500+500+600+600+600 = 2800 秒 = 46 分 (int 整除安全) · 期望值同步从 45 → 46。

**为何不算 production code bug**: 这是 fixture 算术细节 · production code 对任意 int duration sum 都正确 (sum/60 是规约定义)。test-cases.md Round 2 fixture 描述 "duration_sec sum=2700 / 45 分钟" 是 Round 2 TestDesigner 起草时的 approximate · 真实施时 int 截断更严格 · 修 fixture 让测试可重现 (本 modification 不动 production · 不破 Tester adversarial 视角)。

---

## 物理 bug · 无

production code 自身 0 bug。所有 grep audit / 26 测试全过。
