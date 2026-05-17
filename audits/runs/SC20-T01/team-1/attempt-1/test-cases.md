# Test Cases · SC-20-T01 · DB migration V20260516_03 (wb_review_node 加 6 列 + 2 indexes)

trace: biz/features/M-AI-ANSWER-JUDGE__ai-answer-judge.md §4.16 (6 列 SQL 字面) · §2B.20 SC-20 前置条件 (`wb_review_node` 加 6 列 migration 已 done) · §1.4 A.3 优雅降级宪法 · design/system/pages/P08-review-exec-ai-judge.spec.md §4.2 涉及的后端 Entity (字段约束) · biz/业务与技术解决方案_AI错题本_基于日历系统.md §4.5 wb_review_node 现有 14 列 + 2 indexes (master · L1559-L1580 · 不可破坏)

> **任务性质说明 (audit reviewer 必读)**
>
> SC-20-T01 是 **纯后端 Flyway schema migration 任务** · 无 frontend UI / 无 Console / 无 page state machine。
> - "用户" 视角 = **DBA / backend engineer** 跑 `mvn flyway:migrate` / Spring Boot 启动 / 集成测试容器 PostgreSQL 后观察到的现象 (information_schema 查询 / EXPLAIN 输出 / Flyway schema_version 表)。
> - 多数用例 `Console` = `n/a (无 frontend Console · 纯 backend schema · 取 Flyway log 0 [ERROR] 作 mvn build 等价物)` · `View ≥` = `n/a (无 UI)` · `API` 列大多 `n/a` 但少量填 information_schema SELECT (验证用 · 不是业务 endpoint)。
> - Then 列严格走"DBA 观察到什么" · 不写 "AnswerJudgeService 怎么消费" (那是后续 SC-20-T02+ task · 越界)。
>
> **format hard 约束 (audit.js dim_test_cases_alignment)**:
> - 表头严匹配: `# | Given | When | Then | Console | View ≥ | API` (7 列名 · 6 分隔)
> - 用例 ≥ 3 ≤ 6 行
> - 首行用例必 happy · 第 2-3 必含 edge (向后兼容 / 幂等)

| # | Given | When | Then | Console | View ≥ | API |
|---|-------|------|------|---------|--------|-----|
| 1 | PostgreSQL 测试容器 (testcontainers / docker-compose) 已起 · `wb_review_node` 表存在且为 master §4.5 原始 14 列 schema (id/plan_id/student_id/level/level_code/due_at/window_end_at/ready_at/status/pushed_at/reviewed_at/effect/calendar_event_id/created_at) · Flyway baseline 已建到 V20260516_02 · 当前 schema_version 不含 V20260516_03 · review-plan-service 模块 Spring Boot 应用启动配置 spring.flyway.enabled=true | backend engineer 跑 `mvn -pl backend/review-plan-service flyway:migrate` (或启 Spring Boot 应用触发 Flyway auto-migrate) · 执行新增 V20260516_03__wb_review_node_add_ai_judge_columns.sql | DBA 在 Flyway schema_version 表观察到 1 条新行 version=`20260516.03` · success=true · 然后跑 `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name='wb_review_node' ORDER BY ordinal_position` 返回 **20 列** (14 原 + 6 新) · 6 新列字面严匹配 satellite §4.16: user_answer_image_key=VARCHAR(512)/NULLABLE/no default · ai_judge_verdict=VARCHAR(16)/NULLABLE/no default · ai_judge_confidence=DECIMAL(3,2)/NULLABLE/no default · ai_judge_reason=TEXT/NULLABLE/no default · ai_judge_metadata=JSONB/NULLABLE/no default · final_grade_source=VARCHAR(16)/NOT NULL/DEFAULT 'self' · Spring Boot 应用启动 logs 0 [ERROR] / 0 Flyway exception | n/a (无 frontend Console · 纯 backend · 等价于 Flyway log 0 [ERROR] + mvn build SUCCESS) | n/a (无 UI · 纯 backend schema) | SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name='wb_review_node' → 返 20 行 (14+6) |
| 2 | migration V20260516_03 已成功跑 (用例 #1 PASS 状态) · `wb_review_node` 表内已有 N≥1 条来自 master SC-01/02/03/04 流程产生的现存行 (例: T0-T6 7 行复习节点 · 由 EbbinghausEngine 生成) · 这些现存行在 migration 跑之前 6 新列**不存在** | backend engineer 跑 `SELECT id, final_grade_source, user_answer_image_key, ai_judge_verdict, ai_judge_confidence, ai_judge_reason, ai_judge_metadata FROM wb_review_node WHERE id IN (现存 N 行 ID)` · 再跑 master SC-01 / SC-02 / SC-03 / SC-04 的现有集成测试 (复习计划生成 / 卡片读取 / grade 接口主流程 / 日历重排) 验证 100% PASS | 现存 N 行查询结果: final_grade_source 列 = `'self'` (来自 NOT NULL DEFAULT 'self' · 满足宪法 A.3 优雅降级 + satellite §2B.20 TC-20.02 "与 master 现状 100% 一致") · 其他 5 新列 (user_answer_image_key / ai_judge_verdict / ai_judge_confidence / ai_judge_reason / ai_judge_metadata) **全部 NULL** · master SC-01/02/03/04 现有集成测试 0 失败 0 跳过 · 现存行 status/level/due_at 等 14 原列**未被任何方式 mutate** | n/a (无 frontend Console · 纯 backend · 等价于 master sibling IT 全 PASS) | n/a (无 UI · 纯 backend schema · 现存行查询 + 现有 IT 套件) | SELECT final_grade_source, user_answer_image_key, ai_judge_verdict FROM wb_review_node WHERE id=<existing_id> → final_grade_source='self' · 其他 NULL |
| 3 | migration V20260516_03 已成功跑过 1 次 (用例 #1 PASS) · Flyway schema_version 表已含 1 条 version=`20260516.03` 行 (含 checksum) · V20260516_03 sql 文件**未被修改** (checksum 仍一致) | backend engineer 再次跑 `mvn -pl backend/review-plan-service flyway:migrate` (模拟 CI 重启 / 多副本 Pod 同时起 / dev 环境多次 flyway:migrate 误触发) | Flyway 输出 "No migration necessary" 或等价 "Schema is up to date" · schema_version 表**仍只有 1 条** V20260516_03 行 (不重复插入) · 不抛 FlywayException / SQLException · `wb_review_node` schema 列数仍是 20 (不重复 ALTER 加列报 "column already exists" 错) · 满足 TI1 幂等保证 | n/a (无 frontend Console · 纯 backend · 等价于 Flyway log "No migration necessary" + 0 [ERROR]) | n/a (无 UI · 纯 backend schema) | n/a (纯 Flyway checksum 校验 · 无 endpoint · 无业务 SELECT) |
| 4 | migration V20260516_03 已 PASS (用例 #1) · `wb_review_node` 表内已有混合数据: M 条 final_grade_source='self' (来自 master 现存行 + 学生自评路径) · K 条 final_grade_source='ai_accepted' / 'ai_overridden' (来自后续 SC-20/21 流程模拟数据 · 测试 fixture 注入) · 同时含 X 条 ai_judge_confidence<0.5 的低置信记录 | DBA 跑 `EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM wb_review_node WHERE final_grade_source != 'self'` · 再跑 `EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM wb_review_node WHERE ai_judge_confidence < 0.5` (两个 partial index 各自的命中查询) | 第 1 个 EXPLAIN 输出包含 `Index Scan using idx_wrn_judge_source on wb_review_node` (或 Bitmap Index Scan 等价 index 命中关键词) · **不是** Seq Scan · 第 2 个 EXPLAIN 输出包含 `Index Scan using idx_wrn_low_confidence on wb_review_node` (或 Bitmap Index Scan) · **不是** Seq Scan · 满足 AC2 + TI3 (两个 partial index 创建后 EXPLAIN 命中 · 后续 SC-21/22 OPS dashboard 查"AI 非自评分布"/"AI 低置信题型分布"性能可接受) | n/a (无 frontend Console · 纯 backend · 等价于 EXPLAIN 输出包含 "Index Scan using idx_wrn_*") | n/a (无 UI · 纯 backend schema) | EXPLAIN (ANALYZE) SELECT ... WHERE final_grade_source != 'self' → 含 "Index Scan using idx_wrn_judge_source" |
| 5 | PostgreSQL 测试容器 (建议 PG 15+ · 满足 §4.16 metadata-only ALTER 行为) · `wb_review_node` 已有大量历史数据 (建议 ≥ 100K 行 · 模拟生产规模 · 测试 fixture batch insert) · migration V20260516_03 尚未跑 | backend engineer 在跑 V20260516_03 migration 的同时 · 用第 2 个 psql session 跑 `SELECT pg_blocking_pids(pid), state, wait_event_type, query FROM pg_stat_activity WHERE query LIKE '%wb_review_node%' AND pid != pg_backend_pid()` 观察锁等待 · migration 完成后再跑 `SELECT relname, n_tup_ins FROM pg_stat_user_tables WHERE relname='wb_review_node'` 看是否触发全表 rewrite | migration 跑通耗时 ≤ 5s (即使 100K 行 · 因 PG 11+ 的 ALTER ADD COLUMN with default 'self' 是 metadata-only · 不重写已有行) · pg_stat_activity 观察期内**未出现** AccessExclusiveLock 持续 ≥ 1s 的等待 · 其他读写 query 不被长时间阻塞 · pg_stat_user_tables 的 n_tup_ins 计数不增 (即未发生 N 行 rewrite) · 满足 TI2 (加列不锁表 · 关键大表 wb_review_node 上线安全) | n/a (无 frontend Console · 纯 backend · 等价于 migration 耗时 ≤ 5s + 0 长锁) | n/a (无 UI · 纯 backend schema) | SELECT * FROM pg_stat_activity WHERE query LIKE '%wb_review_node%' → 不出现长时间 AccessExclusiveLock |

## Changelog (TestDesigner 每轮 review 后追加)

<!-- 每轮 review 后追加 ## Round N · 改了什么 -->

## Round 1 · 初版

- TestDesigner agent (SC20-T01 attempt-1) 起草 · 5 用例
- 覆盖: AC1 (6 ALTER COLUMN 字面 · 用例 #1) · AC2 (2 partial index · 用例 #4) · AC3 (向后兼容 · 用例 #2) · AC4 (PG 容器 + information_schema 验证 · 用例 #1) · TI1 (幂等 · 用例 #3) · TI2 (加列不锁表 · 用例 #5) · TI3 (EXPLAIN 命中 · 用例 #4) · 宪法 A.3 优雅降级 (用例 #2)
- 设计要点:
  - 用例 #1 happy 把 AC1+AC4 合并 (1 次 migration + 1 次 information_schema 验证) · 避免拆 6 个用例超 budget
  - 用例 #2 edge 把 AC3 (向后兼容) + 宪法 A.3 + satellite §2B.20 TC-20.02 (master 现状 100% 一致) 合并 · 跑现有 IT 套件 0 失败是 "fail loud" 保险栓
  - 用例 #3 幂等单列 · 模拟 CI 重启 / 多 Pod 同起 / dev 误触发 · 必须不抛 FlywayException
  - 用例 #4 两个 partial index 各自验证命中 (不是只验 1 个) · 因 §4.16 字面 2 indexes 满足 master §10.5 grade 路径后期 dashboard 查询性能
  - 用例 #5 是关键大表保护 · 100K 行规模 · 验证 ALTER ADD with default 'self' 是 metadata-only (PG 11+ 行为) · 不锁表 / 不 rewrite · 上线安全
- 故意可挑刺的点 (鼓励 Coder / Tester REJECT 真发生作用 · 不出"无可挑剔"的安全用例):
  - 用例 #1 Then 列写得很长 · 可能被 reviewer 嫌"信息密度过高" · 但是为了证据完整 (字段名 + 类型 + nullable + default 4 维都验)
  - 用例 #4 假定 PostgreSQL planner 一定走 index (受 statistics 与数据量影响 · reviewer 可能挑"小数据量下 planner 会跳 index 直接 Seq Scan")
  - 用例 #5 100K 行规模阈值是经验值 · reviewer 可能挑"何不 10K 或 1M · 这个数怎么定"
  - 用例 #3 没显式验证 "重跑 sql 内容不被修改" · reviewer 可能挑"如果 sql 改过 checksum mismatch 是否在范围内"
- 故意不做 (越界 / 留给后续 task):
  - 不验 AnswerJudgeService 真消费 ai_judge_* 5 列 (那是 SC-20-T02+ 业务逻辑 task)
  - 不验 POST :grade body 加 final_grade_source 字段语义 (那是 SC-20-T0X API 改造 task)
  - 不验前端 `<AiJudgeBanner>` 渲染逻辑 (那是 SC-20-T0Y frontend task)
  - 不验 RocketMQ `ai-judge.overridden` outbox 推送 (那是 SC-21-T0X task)
