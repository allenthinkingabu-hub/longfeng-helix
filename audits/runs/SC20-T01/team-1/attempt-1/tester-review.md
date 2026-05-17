# Tester Review · TestDesigner 提交的用例

reviewer: Tester agent (claude opus 4.7 · top-level spawn · 2026-05-18)
date: 2026-05-18
test_cases.md ref: audits/runs/SC20-T01/team-1/attempt-1/test-cases.md (Round 1 · 5 用例 · TestDesigner 0c5bcf5)

## 视角

覆盖度 (happy + edge + negative path) · Then 列断言强度 (具体 SQL / EXPLAIN 关键字 / 阈值字面) · 漏边界 (DECIMAL/VARCHAR 边界值 / partial index WHERE 等号边界 / JSONB NULL 语义 / migration 中断态 / 数据规模约束 / negative path 完全缺失)

任务性质: 纯后端 Flyway schema migration · Tester 视角 = 模拟 DBA / backend engineer 在生产环境会遇到的真实失败场景 · 不止 happy + edge · 必须有 negative path。

---

## 覆盖度审查

### happy path

- 用例 #1 (AC1+AC4 合并): **不够严** ⚠ — Then 列字面要求"VARCHAR(16)/NULLABLE/no default"但 information_schema 实际返列名是 `character_maximum_length` / `is_nullable` / `column_default` · Then 没给出验证表达式 (e.g. `character_maximum_length=16 AND is_nullable='YES' AND column_default IS NULL`) · Coder 可以写一个只验列名存在的弱断言就声称满足 · 假阳性风险高。

### edge cases

- 用例 #2 (AC3 向后兼容 + 宪法 A.3): **不够严** ⚠ — Then 写"master SC-01/02/03/04 现有集成测试 0 失败 0 跳过" · 但**没给具体 IT 文件路径 / 测试类名 / 运行命令**。Tester Phase 4 跑测时面对 "去找 master SC-01/02/03/04 的 IT 套件" 是模糊任务 · 不同人理解可能跑不同的 IT 子集 · 假阳性风险高 (Coder 可以只跑 1 个 happy IT 就声称满足)。
- 用例 #3 (TI1 幂等): **不够严** ⚠ — "再次跑 mvn flyway:migrate" 只覆盖了"立即重跑" · 没覆盖**真正的幂等冲击**: (a) 多副本 Pod **并发**起 Flyway (有 lock 表保护 · 但要验) (b) checksum mismatch 路径 (sql 文件被改 1 字符后重跑应抛 FlywayException · Then 没断言异常类型)。

### interaction / structural

- 用例 #4 (AC2 + TI3 partial index 命中): **不够严 + 假阳性高** ⚠⚠ — (a) Then 列断言"包含 Index Scan using idx_wrn_judge_source"但**未约束 fixture 数据规模 + ANALYZE 是否跑过** · PostgreSQL planner 在小数据量 (< 1000 行) 下倾向 Seq Scan 即使有 index · Coder 可以跑通也可以跑不通取决于 fixture (b) 第 2 个 partial index 条件是 `ai_judge_confidence < 0.5` · 用例 Given 写"X 条 ai_judge_confidence<0.5" 但**未覆盖 confidence=0.5 等号边界行查询是否走 index** (partial index WHERE 是严格小于 · 0.5 行查不走 index · 这是常被踩的坑 · Tester Phase 4 必须验)。
- 用例 #5 (TI2 加列不锁表 + 100K 行规模): **断言不够** ⚠ — Then "未出现 AccessExclusiveLock 持续 ≥ 1s 的等待"但 (a) Flyway ALTER TABLE 本质就拿 AccessExclusiveLock · 区别是 metadata-only 释放快 · 用 "≥ 1s" 这个阈值阻止不了快闪锁瞬间冲击 (b) 没有断言"另一个 psql session 在 migration 期间能正常 SELECT" · TI2 真正想验的是 "在线 DDL 不阻塞业务读" · 该验证缺失。

### console-clean 探针

- 任务性质纯后端 · 无 frontend Console · 等价物是 Flyway log / Spring Boot startup log 0 [ERROR]。用例 #1 Console 列写 "Flyway log 0 [ERROR] + mvn build SUCCESS" 是合理替代。**唯一不全**: 没有任何用例验"Flyway lock 表 (`flyway_schema_history_lock`) 在 migration 结束后 lock 被释放" · 这是生产事故高发点。

### perf 探针

- 用例 #5 给出"migration 耗时 ≤ 5s"是合理性能阈值。
- **缺**: AC2 创建 2 个 partial index 本身的耗时未约束 · CREATE INDEX 在 100K+ 行上不是 metadata-only · 可能数十秒。用例 #5 关注的是 ALTER ADD COLUMN · 没覆盖 CREATE INDEX 的耗时与锁影响。

### i18n / boundary / negative path (Tester 视角最看重 · 当前完全缺失)

- **全缺 negative path** — 5 用例全是 happy + edge + interaction · 0 个 negative。生产 schema migration 真实失败场景: (a) Flyway baseline 错位 (V20260516_03 比 baseline 老 · Flyway 应拒绝) (b) DB 权限不足 (migration 用户无 ALTER TABLE 权限) (c) 磁盘满 / 表锁冲突 (e.g. 有 long-running 事务持表锁导致 ALTER 超时) — 3 类都没覆盖。
- **DECIMAL(3,2) 边界值断言缺**: §4.16 字面 `DECIMAL(3,2)` · 范围 -9.99 到 9.99 · 但 ai_judge_confidence 业务语义 0.00-1.00 · 应在 schema 层 (CHECK constraint) 或文档约定 · 用例 #1 仅断言 "data_type=DECIMAL(3,2)" 没断言任何 CHECK 约束的存在或缺失 (其实 §4.16 没要求 CHECK · 这是 surface 给业务的差距点)。
- **VARCHAR(16) 边界值断言缺**: `final_grade_source` 业务枚举 'self'/'ai_accepted'/'ai_overridden' 长度 4/12/13 字符 · 都 ≤ 16 但 'ai_accepted_override' (虚构) 长 20 会被 PG 截断到 16 还是抛错? PG 行为是抛 `ERROR: value too long for type character varying(16)` · 用例没有任何 negative path 验证此行为。
- **JSONB NULL 语义模糊**: `ai_judge_metadata JSONB` · 用例 #2 Then 写 "其他 5 新列全部 NULL" · 但 JSONB 字段 NULL 有 2 种: SQL NULL (`IS NULL` true) vs JSONB 'null' 字面值 (`= 'null'::jsonb` true) · master 现存行经过 migration 后是 SQL NULL · 但 Then 没显式断言 `IS NULL` (vs 错误地用 `= NULL` 永远 false) · 这是 Coder 写测试时常见踩坑。

---

## 反馈给 TestDesigner

### 漏覆盖 (≥ 3 条 · 必须在 Round 2 补)

1. **negative path 完全缺失**: 至少加 1 个 negative path 用例 · 建议: V20260516_03 sql 文件被改 1 字符后重跑 → 应抛 `FlywayException: Validate failed: Migration checksum mismatch` · Then 断言异常类型 + 异常 message 关键字 · schema_version 表中 V20260516_03 行未被 mutate。这是 TI1 幂等的反面 · 防止"幂等 = 重跑啥都不抛错"的误解。
2. **partial index 等号边界条件查询缺验证**: 用例 #4 应拆或扩 · 加 1 条 `SELECT ... WHERE ai_judge_confidence = 0.5` 的 EXPLAIN · 断言 **不命中** idx_wrn_low_confidence (因 partial index WHERE 是严格小于) · 这是 Coder 写 SC-21/22 dashboard 时若 query 写 `<=` 会踩的坑 · Tester 必须先把这个边界锁死。
3. **migration 期间不阻塞业务读 (TI2 真正语义)**: 用例 #5 扩或新加 1 条 · 在 migration 跑的同时 · 第 2 个 psql session 跑 `SELECT * FROM wb_review_node WHERE id = <existing> LIMIT 1` · 断言**该 SELECT 在 migration 期间能正常返回** (即使 ALTER 拿 AccessExclusiveLock 几毫秒 · SELECT 等几毫秒后能完成 · 不超时) · 这是 "ALTER 加列不锁表" 的用户视角断言 · 当前用例只看 pg_stat_activity 不够直接。
4. **(bonus) Flyway lock 释放断言缺**: 任一用例可加 1 行 Then · migration 结束后 `SELECT * FROM flyway_schema_history` (无 lock 列若用 PG advisory lock 则查 `pg_locks` WHERE locktype='advisory' AND classid 对应 Flyway lock id) · 断言 lock 已释放 · 防止 lock 泄漏导致后续 migration 永久 hang (生产事故高发)。

### 断言强度 (≥ 2 条 · 必须在 Round 2 改)

1. **用例 #1 Then 列必须给可执行 SQL 验证表达式**: 当前 "VARCHAR(16)/NULLABLE/no default" 是描述性自然语言 · 必须改成可由 Coder 直接落到 Java assertion 的字面 · 例如:
   ```sql
   SELECT character_maximum_length, is_nullable, column_default
   FROM information_schema.columns
   WHERE table_name='wb_review_node' AND column_name='final_grade_source'
   -- 期望: character_maximum_length=16 AND is_nullable='NO' AND column_default LIKE '%self%'
   ```
   给 6 列每列都列 1 条期望表达式 · 而不是堆叠在一行让 Coder 自己拆解 (留下假阳性空间)。
2. **用例 #2 Then 列必须列出具体 IT 套件路径 / 测试类名 / 命令**: 当前 "master SC-01/02/03/04 现有集成测试 0 失败" 太空。改成 (举例 · TestDesigner 应查实际仓库):
   ```
   mvn -pl backend/review-plan-service test -Dtest='ReviewPlanGenerationIT,CardReadFlowIT,GradeMainPathIT,CalendarReorderIT'
   期望: Tests run: X, Failures: 0, Errors: 0, Skipped: 0
   ```
   如这些 IT 类不存在 · TestDesigner 应在 trace 行 surface "master 当前无 SC-01/02/03/04 IT 套件 · 本用例改为只验 schema-level 向后兼容" · 而不是模糊带过。
3. **(bonus) 用例 #4 Given 必须显式约束 fixture 数据量 + 是否 ANALYZE**: 加一行 "fixture 写入 ≥ 1000 行 (满足 PG planner index threshold) + 跑 `ANALYZE wb_review_node` 后再 EXPLAIN" · 否则小数据 fixture 下 planner 跳 index 直接 Seq Scan · Coder 可以让该用例时通时不通 (flakey) 也可以谎报 PASS。
4. **(bonus) 用例 #2 JSONB NULL 必须显式断言 IS NULL**: Then 列改 "ai_judge_metadata IS NULL = true" · 而不是写 "全部 NULL" · 防止 Coder 误写 `WHERE ai_judge_metadata = NULL` (永远 false 假 PASS)。

### 其他

- TestDesigner 自标的 5 个"故意可挑剔点" (用例 #1 信息密度 / 用例 #4 planner 走 index 假设 / 用例 #5 100K 阈值 / 用例 #3 sql 修改 checksum) **我独立审查后认同其中 2 个** (#4 planner 假设 · #3 checksum mismatch) · 这 2 个上面我的"漏覆盖 #1, #2"已展开。用例 #5 100K 阈值我**不挑** (经验值合理 · 模拟生产即可)。用例 #1 信息密度问题**实际是断言强度问题** (不是密度本身 · 而是密度堆叠导致可执行性差) · 上面"断言强度 #1"已展开。
- trace 行可补 master §10.5 grade API 引用 · 因为 final_grade_source 字段是给 POST :grade API body 用的 · SC-20-T0X 后续 task 会读这个字段 · trace 给 reviewer 看 "这字段下游是谁" 是好习惯 (非红线 · 可选)。
- 不与 Coder review 视角雷同的把握: Coder 视角看"可实现性 / 能不能写出来" · 我视角看"覆盖度 / 漏什么 / Then 是否能严格判断 PASS" · 上述 4 漏覆盖 + 2 断言强度全是 Tester 视角 (找漏 · 找假阳性 · 找 negative path 缺失) · 不重叠风险低。

---

## verdict

verdict: REJECT

reason: 5 用例全是 happy + edge + interaction · 0 个 negative path · 严重违反 Tester 铁律 3 "严苛对抗 · 找漏" · 且用例 #1/#2/#4 Then 列断言用自然语言堆叠 (无可执行 SQL 表达式 / 无具体 IT 路径 / 无 fixture 规模约束) · Coder 落地时假阳性空间大。Round 2 必须补 1 个 negative path (Flyway checksum mismatch) + 1 个 partial index 等号边界用例 + 1 个 migration 期间不阻塞业务读用例 · 且把用例 #1 #2 Then 列改成可执行 SQL/命令字面。
