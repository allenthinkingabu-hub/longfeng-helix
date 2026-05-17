# Coder Review · TestDesigner 提交的用例

reviewer: Coder agent (claude opus 4.7 · top-level spawn · 2026-05-18)
date: 2026-05-18
test_cases.md ref: audits/runs/SC20-T01/team-1/attempt-1/test-cases.md (Round 1 · 5 用例 · TestDesigner commit 0c5bcf5)

## 视角

Coder = 实现派 · 检查 **可实现性 / Flyway+PostgreSQL 语法真假 / 前提条件是否成立 / 现有代码状态对齐** · 不是"挑文字毛病"。本轮核心质疑 = 前提断裂 (`wb_review_node` 表在当前 backend 根本不存在) + Flyway 文件命名/路径/触发模块全部偏离仓库现状。

## 逐用例 review

- **用例 #1 (happy · AC1+AC4)**: 不可实现 ❌ — Given **多处假设与仓库现状矛盾**。
  - **致命 1 · 表不存在**: `wb_review_node` 表在整个 `backend/common/src/main/resources/db/migration/*.sql` 中**从未被 CREATE TABLE 过** (`grep -rln wb_review_node backend → 0 hit`)。现存复习相关表实名是 `review_plan` (V1.0.050) + `review_outcome` (V1.0.051)。master biz §4.5 `wb_review_node` 是规划层 future-table 而非已落地 schema · `ALTER TABLE wb_review_node ADD COLUMN ...` 在测试容器跑 → 直接 `ERROR: relation "wb_review_node" does not exist` · migration 失败。
  - **致命 2 · Flyway 模块路径错**: Given 写 `mvn -pl backend/review-plan-service flyway:migrate` · 但 review-plan-service 模块下**根本不存在** `src/main/resources/db/migration/` 目录 (验证: `ls backend/review-plan-service/src/main/resources/db/migration → No such file or directory`)。仓库所有 Flyway migration 集中在 `backend/common/src/main/resources/db/migration/` (含 13 个 V1.0.0XX 文件 · 由 common 模块 owner)。
  - **致命 3 · 文件名命名规范偏离**: Given 引用 `V20260516_03__wb_review_node_add_ai_judge_columns.sql` 日期式命名 · 但现存 13 个 migration 全部用语义版本 `V1.0.XXX__xxx.sql` (e.g. V1.0.050 / V1.0.066 / V1.0.083)。两套不混 — Flyway version compare 按 dot-numeric 排序 · `V20260516.03` 数值远大于 `V1.0.083` · 会被强制最后执行 · 但跨命名风格 baseline 校验未必兼容 · 至少违 Rule 11 "Match the codebase's conventions"。
  - **致命 4 · spring.flyway.enabled 假设错挂模块**: review-plan-service 模块下无 migration · 该模块的 `spring.flyway.enabled=true` 触发的是 common 模块的 migration (跨模块 classpath 扫描) · 不是直接消费 V20260516_03。Given 写 "review-plan-service Spring Boot 应用启动配置" 是误导的归属。
  - **次级 1 · "原始 14 列"实际是 13 列**: 数 master §4.5 SQL (L1562-L1577) `id/plan_id/student_id/level/level_code/due_at/window_end_at/ready_at/status/pushed_at/reviewed_at/effect/calendar_event_id/created_at` = **14** 列 (test-cases #1 写对) · 但**没把 `UNIQUE(plan_id, level)` 约束放在前提里** · 而 ALTER ADD COLUMN with default 在有 UNIQUE 约束的表上行为需明示。
  - **次级 2 · Then 列 information_schema 查询不含 default value**: Given 末 SELECT 写 `column_name, data_type, is_nullable, column_default` 但 Then 列里只口头说 "no default / DEFAULT 'self'" · 未给出 information_schema 实际怎么 join 拿 column_default (PG `information_schema.columns.column_default` 列名/类型) · Tester 跑断言时不可机器执行。

- **用例 #2 (edge 向后兼容 · AC3 + 宪法 A.3)**: 不可实现 ❌ — 直接依赖用例 #1 (表不存在) · 故跑不通; 此外 **"跑 master SC-01/02/03/04 现有集成测试"** 这个保护网在仓库**不存在以 SC-01..04 命名的 IT 套件**。
  - 实际 review-plan-service 下 IT 是 `T06QuestionCreatedE2EIT` / `T11RevealE2EIT` / `HomeTodayIT` / `service/CalendarBatchCreateIT` · 而非 "SC-01/02/03/04 集成测试"。Then 列断言 "master SC-01/02/03/04 现有集成测试 0 失败 0 跳过" → Tester 拿不到具体 mvn `-Dtest=...` 参数清单 · **不可机器执行**。
  - 修复方向: Given 必须列出 review-plan-service 现存 4 个真 IT 的全限定类名 (而非业务 SC 编号) · Then 改成 `mvn -pl backend/review-plan-service verify` 退出码 0 + JUnit XML 总 PASS。
  - **次级 · "N≥1 条来自 master SC-01/02/03/04 流程产生的现存行"** — 在新跑 Flyway baseline 的 testcontainer 里 · master 业务流程**默认不会自动产生数据** · 需要测试 fixture 显式 INSERT。Given 没说 fixture 来自哪 · Tester 无法准备数据。

- **用例 #3 (edge 幂等 · TI1)**: 需调整 ⚠ — 用例本身概念可实现 (Flyway 文件名 + checksum 是 Flyway 的核心机制 · 重跑必然 "No migration necessary") · 但**仍依赖用例 #1** (表创建前提) 且**没显式让 Tester 验"sql 文件二次跑前/后 checksum 一致"**。
  - 修复方向: Then 列加 "schema_version 表的 checksum 列查 V20260516_03 行 · 重跑前后 checksum 值二进制一致 (snapshot 落 work_log)"。
  - 次级 · 用例自己 surface 的 "如果 sql 改过 checksum mismatch 是否在范围内" — 这是 Flyway 的 negative case · 该用例**没必要扩到此** · 但应明确"本用例只验 happy 幂等 · 不验 checksum mismatch · 那是 Flyway 自带机制不需重测"。

- **用例 #4 (interaction · AC2+TI3)**: 需调整 ⚠ — partial index PG 语法本身可实现 (PG 自 8.0 起支持 partial index · `CREATE INDEX ... WHERE` 子句 · 与 PG 11+/15+ 都兼容) · 但 **EXPLAIN 命中假设过强** + **Given 缺数据规模 + 缺 ANALYZE**。
  - **可实现性疑点**: PG planner 是否走 index 受表统计信息 (pg_class.reltuples / pg_stats) 影响 · 小数据量下 (< 几千行) planner 会跳 index 直接 Seq Scan (cost 估算 Seq Scan 更便宜)。Given 写 "M 条/K 条/X 条" 没给具体下界 · 且**未要求 migration 完成后跑 ANALYZE wb_review_node** 更新统计信息 · 否则 EXPLAIN 输出极可能是 Seq Scan 而非 Index Scan · 用例 Then 直接 fail。
  - **partial index 与 EXPLAIN 命中关系**: idx_wrn_low_confidence WHERE ai_judge_confidence < 0.5 是 partial index · 查询 `WHERE ai_judge_confidence < 0.5` 要命中此 partial index · 必须满足 partial predicate match · 这里满足。但 idx_wrn_judge_source WHERE final_grade_source != 'self' 是 inequality partial · PG planner 对 `!=` partial 的命中判定相对保守 · 需要查询 predicate **同样写 `!= 'self'`** (Given 是 `!= 'self'` · 满足) 但仍受 enable_seqscan 等 GUC 影响。
  - 修复方向: Given 加 "至少 fixture 1000 行 + 完成 migration 后跑 `ANALYZE wb_review_node` · SET enable_seqscan = off 强制走 index (隔离 planner 决策 · 不只验"通常会用 index"而是"语法+索引存在保证可用")"。或 Then 放宽到"PG planner 至少把 idx_wrn_* 列入候选 (查询 EXPLAIN 输出 plan tree 含 Index 关键字 · 不要求一定为 chosen plan)"。

- **用例 #5 (interaction · TI2 大表保护)**: 不可实现 ❌ — 用例自己 surface 的 "100K 行阈值经验值" 问题之外 · 还有 3 个 reviewer 抓到的硬伤。
  - **致命 1 · PG 版本断言冲突**: Given 写"建议 PG 15+" · 但 §4.16 字面只要求 "PG 11+" (metadata-only ALTER ADD with constant default 是 PG 11 引入)。Tester 拿不到准确的测试容器版本约束 (有可能 testcontainer 默认拉 postgres:13 / postgres:16) · 版本浮动 → 锁等待行为不一致 · 用例不可重现。
  - **致命 2 · 5s 阈值无证据**: Then 列写 "migration 跑通耗时 ≤ 5s (即使 100K 行 · 因 PG 11+ metadata-only)" · 100K 行 metadata-only ALTER 实际耗时**远低于** 5s 上限 (毫秒级) · 5s 阈值过宽 · 容易掩盖 PG 版本错配 (PG 10 走 N 行 rewrite 就会超 30s)。建议改 "≤ 500ms" 更敏感。
  - **致命 3 · pg_blocking_pids 时序竞争**: Given 写 "用第 2 个 psql session 跑 SELECT pg_blocking_pids ... 观察锁等待" · 但 metadata-only ALTER 持锁时间极短 (毫秒级) · 第 2 个 session 跑查询的时机窗口几乎不可能捕获到锁 (即使有锁也已释放) · 该 Then "未出现 AccessExclusiveLock 持续 ≥ 1s" 在 happy path 上**永远 trivially PASS** 不能证伪 (即使发生了锁也观察不到) — 违反 CLAUDE.md Rule 9 "Tests verify intent, not just behavior"。
  - 修复方向: Given 改用 `LOCK wb_review_node IN ACCESS EXCLUSIVE MODE` 在第 1 个 txn 里手动持锁 + 第 2 个 session 跑 SELECT (验证 pg_blocking_pids 真能观察到锁) · 然后第 3 个测试再跑真 migration · 这样能区分 "测试本身能捕获锁吗" vs "migration 是否触发锁"。

## 反馈给 TestDesigner

- **修复建议** (实现派必修 · 不允许 Round 2 仍带这些硬伤):
  1. **表前提必须明示 wb_review_node 是新建还是已存在**: 当前 backend 没有 wb_review_node 表 · TestDesigner 必须澄清: (a) 本 task 是否暗含"先跑 V20260516_02 建 wb_review_node 表" 这步? 还是 (b) 把 master §4.5 的 14 列 CREATE TABLE 合进 V20260516_03? 还是 (c) test fixture 在 testcontainer initdb 阶段手动 CREATE TABLE 当 baseline? 三选一 · 缺则 SC-20-T01 不可独立跑通 · 必须并入 SC-19-T0X 或新前置 task。
  2. **Flyway 文件命名 + 路径必须与现仓约定对齐**: V20260516_03 命名风格在仓库内**无先例** · 现仓全 V1.0.0XX · 若要保留日期式命名必须先与用户/TL 拿到 ADR (架构决策记录) · 否则改成 V1.0.084__wb_review_node_add_ai_judge_columns.sql 并放 `backend/common/src/main/resources/db/migration/` (与现存 V1.0.083 同目录)。Given 所有 mvn 命令的 `-pl <module>` 必须改成实际 owner 模块 (common · 或顶层 mvn 全模块跑)。
  3. **现有 IT 套件命名必须用真类名**: 用例 #2 "master SC-01/02/03/04 现有集成测试" → 改成枚举 `T06QuestionCreatedE2EIT, T11RevealE2EIT, HomeTodayIT, service.CalendarBatchCreateIT` 等真存在的 IT · Then 列改 `mvn -pl backend/review-plan-service verify` 退出码 0 + Surefire/Failsafe 报告统计 0 failure 0 error。
  4. **EXPLAIN 命中前置 ANALYZE + 数据下界**: 用例 #4 Given 必须加 "fixture 至少 1000 行 (PG planner 走 index 的最小经验值) + migration 后跑 `ANALYZE wb_review_node` 更新 pg_stats" · 否则 Then "Index Scan" 在小表上随机性 fail。
  5. **PG 版本锁定**: 用例 #5 Given 改 "testcontainer image = postgres:15.4 (主版本 ≥ 11 满足 metadata-only ALTER · minor 锁定避免行为漂移)" · 不留 "建议 PG 15+" 这种弹性表述 · audit reviewer 抓 Rule 12 "Fail loud" 反例。
  6. **EXPLAIN 命中改"语法 + 索引存在"而非"planner 一定选用"**: 用例 #4 Then 改写 "(a) `SELECT indexname FROM pg_indexes WHERE tablename='wb_review_node'` 返回包含 idx_wrn_judge_source + idx_wrn_low_confidence 两行 (索引真创建) · (b) `SET enable_seqscan=off; EXPLAIN SELECT ...` 强制 planner 走 index · 输出含 'Index Scan using idx_wrn_*'" · 这样把 "索引建出来" 与 "planner 选用" 解耦 · 抗 PG 版本/统计信息漂移。

- **漏覆盖** (Coder 独立思考找出 · 不重复 TestDesigner 自己 surface 的 4 个故意可挑剔点):
  1. **缺 final_grade_source 字符串域 CHECK 验证**: AC1 字面写 `final_grade_source VARCHAR(16) NOT NULL DEFAULT 'self'` · 但 biz §4.16 字段约束写 "final_grade_source ∈ {'self', 'ai_accepted', 'ai_overridden'}" · 应用层校验 — 用例没验"DB schema 层是否额外加 CHECK 约束 (e.g. `CHECK (final_grade_source IN ('self','ai_accepted','ai_overridden'))`)"。若没加 CHECK 则后续 SC-20-T0X 业务代码若误写 'invalid' 字符串 DB 会接受 · 破坏 §4.16 字段约束 — 用例 #1 应补一条 Then "或显式声明本 task 不加 DB CHECK · 仅靠应用层" 让 audit 留痕。
  2. **缺 ai_judge_metadata JSONB 列 validity 验证**: biz §4.16 字面 `ai_judge_metadata JSONB` 注释 `{model_used, prompt_version, token_cost_usd, latency_ms, status}` 期望 5 keys · 用例没验"JSONB 列空值是 NULL 而非 '{}' 字面" · 也没验"插入合法 JSON 后能 SELECT ->> 'model_used' 取值" · 留下后续 SC-20-T0X Service 层落数据时遇 JSON cast 错的隐患。
  3. **缺 ai_judge_confidence DECIMAL(3,2) 精度边界验证**: DECIMAL(3,2) 上限 9.99 但语义域 0.00-1.00 · 用例没验"插入 1.50 是否被截 / 报错 / 强制 NUMERIC OVERFLOW" · 也没验小数精度 (0.755 是否被四舍五入到 0.76)。partial index `WHERE ai_judge_confidence < 0.5` 命中阈值与精度直接相关。

- **其他** (建议但非阻塞):
  - 任务性质说明段落写得很清楚 (DBA 视角 / no Console / no UI) · 这是好的 surface · 保留。
  - 5 用例覆盖了 4 AC + 3 TI + 1 宪法 · trace 完整 · 不需要补/砍用例数 (≤ 6 token budget 内)。
  - "独立验证 TestDesigner 已 surface 的可挑剔点": 用例 #4 EXPLAIN 命中问题 + 用例 #5 100K 阈值问题 · 我独立挖到 (见用例 #4/#5 review 段) 且把根因深挖到 partial index planner 行为 + pg_blocking_pids 时序竞争 · 不是简单照搬。用例 #3 checksum mismatch 与本用例无关 · 我同意 TestDesigner 不扩展。

## verdict

verdict: REJECT

reason: 用例 #1 + #2 + #5 的 Given 前提与仓库现状矛盾 (wb_review_node 表不存在 / Flyway 路径错模块 / 文件命名违反 V1.0.0XX 现仓约定 / "master SC-01/02/03/04 IT" 套件不存在 · 改用真类名) · 用例 #4 EXPLAIN 命中假设过强未做 ANALYZE 防御 · 用例 #5 锁观察时序不可重现 — 5 用例中 3 用例不可实现 1 用例需重大调整 · 必须 Round 2 修复后才能进入 Phase 2.5 用户审批。本轮也满足 audit dim_test_cases_alignment.review_has_ge_1_reject_round 红线 (Coder 第 1 轮明确 REJECT)。
