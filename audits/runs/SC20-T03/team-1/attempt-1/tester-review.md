# Tester Review · TestDesigner 提交的用例

reviewer: Tester agent (claude opus 4.7 · top-level spawn · 2026-05-18)
date: 2026-05-18
test_cases.md ref: audits/runs/SC20-T03/team-1/attempt-1/test-cases.md (Round 1 · 6 用例 · 1ee60ee)

## Round 1

### 视角
覆盖度 (happy + edge + negative · 含 race / Authorization / final_grade_source 枚举边界) · Then 列断言强度 (HTTP status / DB SELECT 后效 / transaction rollback 真切性 / JSON null vs missing 严密性) · JSONB 提取严密性 (aiJudge.status ← ai_judge_metadata.status) · 反作弊红线 (mock 计数 / partial-write 物理验证) · master sibling 跨模块 IT 测试运行的真实可执行性 (IT 名字 hardcode 风险)

### 覆盖度审查 (AC1-5 + TI1-3 + KI 2 对照)

- happy path (用例 #1 #5): cover AC1 ai_accepted POST + AC3/AC4 aiJudge object 完整字面拼装 · 字面映射规则清晰 (verdict ← ai_judge_verdict / status ← ai_judge_metadata.status JSONB 提取)
- edge (用例 #2 旧客户端兼容 / 用例 #4 ai_overridden / 用例 #6 aiJudge=null 降级): cover TI1 + AC5 ai_overridden 路径 + AC4 null 降级
- negative (用例 #3): cover AC5 ai_accepted CHECK 违反返 422 + 落库回滚物理验证
- console-clean 探针: n/a (纯 backend · 取 Spring Boot log 0 [ERROR] + Surefire 0 failure 替代 · TestDesigner 在 format hard 约束顶上已说明 · 符合 backend task 性质 · 不强求 IDE Console)
- perf 探针: **缺** · §10.17 SLA "P95 ≤ 8s" 是 :judge endpoint 的 · :grade / :result 不在本 task 性能边界内 · 但用例 #2 "同时跑 master sibling 3 IT 套件" 应有 wall-clock budget 防止 mvn verify 跑出 > 30 min 卡住 CI · 未约束
- i18n / 边界 (final_grade_source 枚举 / 大小写 / 长度): **重大漏覆盖** · 详见下节

### 逐用例 review

- **用例 #1 (happy POST + GET 串联)**: 够严 ⚠
  - Then 列 easeAfter 字面 "以 master §10.5 现役实现为准" 不锁数值 — **判定可接受**: 我读 backend `SM2Algorithm.java` L17-25 字面公式 `EF' = EF + (0.1 - (5-q)*(0.08 + (5-q)*0.02))` · 对 q=3 (PARTIAL) 算出 delta=-0.14 (不是 biz §2B.20 笔误的 "-0.2") · TestDesigner 选不锁是对的避免 lock 错的字面值 · KI1 "改 grade 不破坏 master §7 SM-2 任何分支" 在用例 #2 跨模块 IT 真跑覆盖 · 此处放过合理。但 easeBefore=2.50 字面应锁 (Given 已设 ease_factor=2.5 init · Then 列必须验 easeBefore=2.50 否则不能证明 SM-2 引擎读到正确前值)
  - Then 列字面 "nextDueAt 严格非空" 没说"等于 now()+intervalAfter 天" — 防 Coder 写 0 / null / 1970 epoch 假数据
  - aiJudge.final_grade_source ← wb_review_node.final_grade_source 列 拼接映射规则**与 §10.19 字面差异**: §10.19 字面 "aiJudge 对象 含 final_grade_source 字段" · 但 §10.18 字面 final_grade_source 是 :grade body 的 req 字段 · 业务语义不矛盾 (DB 落同一列) · TestDesigner 写法正确

- **用例 #2 (旧客户端 + 跨模块 IT 套件)**: 够严 ⚠⚠ (**brittle 风险高**)
  - 跨模块 IT 名字 hardcode `T06QuestionCreatedE2EIT,T11RevealE2EIT,HomeTodayIT` — **brittle**: 若这三个文件被改名 / 删除 / 与本 service module 不在同一 mvn module 下 · 测试运行直接 0 testcase / exit 1 false negative · 应改 surefire pattern `'T*MasterSiblingIT.java'` 或在 test-cases.md 注 "if 找不到 IT 文件 → REJECT 回 TestDesigner 重对齐 master IT 命名"
  - "wb_review_node 行**不前置 INSERT** · 但 :grade 改造后是否要 UPSERT" → "二选一不能两态共存" — **缺关键反作弊断言**: TestDesigner 把"二选一"留给 Coder 但只约束"不允许两态" · 未约束 Coder 必须**在 `coder.md` 显式声明选哪态**。Tester 没有 grep 锚 (e.g. "Coder Step 4 字面声明" · 但实际抓什么字符串?) · audit.js 无法机械检查 · 我会**手动 grep coder.md** 但应在用例字面给出锚 `grep -E "UPSERT|INSERT-only|wb_review_node-row-not-created" coder.md`
  - 用例 #2 没传 final_grade_source 字段时 · Then 列只检 (a) 响应 200 + (b) 跨模块 IT 全绿 · **漏检 DB SELECT final_grade_source**: 如果 wb_review_node 行不存在 (Coder 选 INSERT-only) · "返 'self'" 这个 default 值压根没真验过 (因为根本没 row 让你 SELECT) · TI1 "落 'self'" 字面要求其实未被严格满足 · 但语义上无 row 等价于"无 ai 判 = 不需要 final_grade_source 列归因" — TestDesigner 应在 Then 列对二态写**两条 OR 分支断言** (a) wb_review_node 行存在 → SELECT 返 'self' · (b) wb_review_node 行不存在 → count(*)=0 + master §10.5 现役行为 100% 一致

- **用例 #3 (ai_accepted CHECK 违反 → 422)**: 够严 ✓
  - Then 列 transaction rollback 物理验证非常强 · 3 个 DB SELECT 字面: final_grade_source 仍 'self' / review_plan.status 仍 ACTIVE / review_outcome 0 行 / outbox 0 行 — 满足 §1.4 A.2 "脏数据池禁止" 宪法
  - HTTP 422 + msg 关键字 'GRADE_SOURCE_MISMATCH' OR 'mismatch' 二选一足够鲁棒
  - **Spring Boot log 期望 "WARN/INFO 含 GRADE_SOURCE_MISMATCH · 不含 ERROR / Exception stack"** 这一条断言强 — 我手动加分 (防 Coder 用 RuntimeException 抛 422 反而留 ERROR stack 误导)
  - **缺**: 422 fail-fast 时序问题 — 应在用例 Given 加 "review_plan 行 fixture ease_factor=2.50" 然后 Then 列加 "review_plan.ease_factor 仍 2.50 (未被 :grade transaction 中间状态污染)" 防 Coder 在 SM-2 算完后才检查 final_grade_source CHECK 导致 plan.ease 被改了又回滚但事务隔离级别不严

- **用例 #4 (ai_overridden 合法 + KI2 RLHF 溯源)**: 够严 ✓
  - Then 列 "SELECT ai_judge_verdict FROM wb_review_node WHERE id=N4 仍返 'MASTERED' (前置 fixture 未被本 request 修改 · :grade 不允许动 ai_judge_* 5 列)" — 这是 A.1 学生主体性宪法的物理验证 · 强
  - FORGOT 路径 ease reset · TestDesigner 选不锁数值 — 我 grep `ReviewPlanService.java` L161-172 字面 `quality==0 → nextEase = cfg.easeInit() (2.5)` · 不锁是对的 (避免 KI1 误触发 REJECT) · 但用例 #4 Then 列应锁 "easeBefore=2.50 (fixture init)" + "intervalAfter=1 (FORGOT 现役字面)" — 见 ReviewPlanService L167 `nextIntervalDays=1` · 这是 master 字面真切现役
  - **缺**: 用例 #4 没验 `consecutive_good_count 重置 0` (ReviewPlanService L186 字面) — FORGOT 路径 mastered_score 也会被影响 (L207-209 字面 forget*-15 clamp) · 但这越界到 master §7 不在本 task 范围 · 可放过

- **用例 #5 (GET happy · aiJudge 完整 object)**: 够严 ⚠
  - aiJudge.status ← ai_judge_metadata.status (JSONB 字段提取) — **严密性中等**: TestDesigner 在 Round 1 changelog 自标 "字面映射规则未在 §10.19 显式写 · 推论可接受" · 但**未约束 Coder 写哪条 SQL 提取语法** (e.g. PostgreSQL `metadata->>'status'` vs Spring Data `@JsonProperty("status")`) · 不同写法在不同 JSONB 字段 missing 时返字面不同: `->>` 返 SQL NULL · Java map.get 返 Java null · 但 Coder 也可选预先反序列为 Map<String,String> 然后 get("status") → 若 metadata 整个为 null 会抛 NPE · 应在 Then 列加 "若 fixture 改为 ai_judge_metadata=NULL 则 aiJudge.status=null 不抛 NPE" — 但本用例 fixture 已给完整 metadata · 这个 edge 不在本用例覆盖范围 · 应**新增** edge case
  - "matched_steps + missed_steps 可选字段缺省 (空数组或不返均符 §10.19 `?` 标记 · TestDesigner 不强约束)" — **HTTP/JSON 兼容性盲点**: 旧客户端如果 destructure `const { matched_steps } = aiJudge` · 不返字段时 matched_steps=undefined · 返空数组时 matched_steps=[] · 两态行为差异大 (`if (matched_steps.length)` 会抛 TypeError) · TestDesigner 应**强制锁二选一** · 与 Round 1 自标"reviewer 可能挑应锁二选一"对齐 · 这个我必挑

- **用例 #6 (GET aiJudge=null 降级)**: 够严 ⚠
  - "`"aiJudge":null` 严格字面字符串 (反作弊 grep)" — 物理验证强
  - "JSON null vs missing key 区别" 在 changelog 字面解释清楚 — TestDesigner 已挑明 · 满足 §10.19 字面 "为 null"
  - **缺**: AC4 "5 列任一为 null 时返 aiJudge=null" — TestDesigner 只验了 ai_judge_verdict 列为 NULL 的 case · **没验** ai_judge_confidence / ai_judge_reason / ai_judge_metadata 列单独为 NULL 时是否都触发 aiJudge=null 降级 · 5 列每一列都可能 null · 用例 #6 只覆盖 1/5 = 20% 边界 · Coder 可能写 `if (ai_judge_verdict == null) aiJudge=null` 漏判其它 4 列 · 实际现网 wb_review_node 行可能因迁移 / SC20-T04 拍照路径中断留下 partial row · 用例 #6 fixture 选 "ai_judge_verdict 列显式 NULL" 但其它 4 列任意 · 没覆盖 "verdict 非 null + confidence 列 NULL" 这种 partial row
  - fixture 三选一 (AI 超时 / 异步未完成 / 学生纯自评但仍有 wb_review_node 行) — TestDesigner 自标 fixture C 现实存在性低 · 我同意 · 但仍可保留作 "未来 SC20-T04 路径打开后的覆盖位"

### 反馈给 TestDesigner (≥ 3 漏覆盖 + ≥ 2 断言强度 · 不与 Coder review 雷同)

**漏覆盖 (≥ 3 必加)**:

1. **final_grade_source 枚举/边界覆盖盲区**: 当前 6 用例 final_grade_source 只取 'self' / 'ai_accepted' / 'ai_overridden' 三合法值 · 没有用例覆盖**非法枚举值**:
   - 传 `final_grade_source: 'ai_partial'` (字面 fabricate · 不在三合法值内) — 应返 400 或 422 (字段枚举校验失败)
   - 传 `final_grade_source: 'AI_ACCEPTED'` (大小写错) — 应返 400/422 (枚举严格区分大小写)
   - 传 `final_grade_source: ''` (空串) — 应返 400/422 不 fallback 'self' (空串 != 缺省 · §10.18 字面 "缺省 'self'" 指字段不存在 · 不指空串)
   - 传 `final_grade_source: 'self_with_super_long_string_exceeding_16_chars'` (长度超 VARCHAR(16)) — 应返 400/422 (在 service 层 reject 不让 PostgreSQL string-too-long error 50x 暴露)
   
   TestDesigner Round 1 changelog "不验 final_grade_source 应用层枚举校验 · 视为 Coder Step 4 默认会做 enum check" — **这正是漏覆盖**: "默认会做" 不是"必然会做" · Tester 视角必须把 happy + null + 422 mismatch 之外的**字段格式边界**单独立用例验。建议**新增用例 #7**: 4 个 non-happy 枚举值 各跑一次 POST · 各返 400/422 不 500 · DB 0 行落库

2. **aiJudge.status JSONB null/missing 边界**: 用例 #5 fixture 锁了 `ai_judge_metadata='{"status":"DONE"}'::jsonb` · 但**未验** metadata.status 字段缺失或 metadata 整体为 NULL 时 aiJudge.status 字面是 null / undefined / 抛 NPE? 实际 fixture 现网可能因 AI 服务版本升级 / metadata schema 漂移留下 metadata={} 或 metadata=NULL · Coder 用 `metadata.get("status")` Java 写法在 metadata=NULL 时直接 NPE 5xx · 建议**新增用例 #8** edge: `ai_judge_metadata=NULL` 但其它 5 列非空 → GET 返 `aiJudge` 是 object 还是 null? · 走 AC4 严格 "5 列任一 null 时返 aiJudge=null" 应返 null · 这个用例 #6 没覆盖 (它选了 ai_judge_verdict=NULL 不是 metadata=NULL)

3. **Authorization / 跨用户 grade race 缺失**: 6 用例**全部** Header `X-User-Id:7` · 没用例验:
   - 用户 A (X-User-Id:7) 调 :grade 但 review_plan.student_id=8 (跨用户访问) — 应返 403 NODE_NOT_OWNED 或 404 NODE_NOT_FOUND (查不到自己的节点 · 走 master §10.5 现役授权语义)
   - 用户 7 已 grade 节点 N1 (review_plan.status=COMPLETED) 后**再次** POST :grade body{grade:'PARTIAL'} — 应返 409 NODE_ALREADY_GRADED (master §10.5 现役行为 · :grade 不允许重复 grade) · §10.18 字面"加 1 字段 · 向后兼容"明示不破坏现役 · 这条 race 必须验
   - 用户 7 同时 (race) 2 个并发请求 POST :grade body{grade:'PARTIAL'} body{grade:'MASTERED'} on 同 nid=N1 — 应 1 成 1 失 (409) · 不允许两个 outcome 行写入 · master §10.5 idempotency-key 现役已有 · 但本 task 加 final_grade_source 列后是否破坏 idempotency? 没验
   
   建议**新增用例 #9** negative: 至少 cover (a) 跨用户 :grade 返 403/404 + (b) 重复 :grade 返 409 + DB final_grade_source 列未被覆盖

**断言强度不足 (≥ 2 必改)**:

1. **用例 #2 跨模块 IT 名字 hardcode brittle**: 把 `T06QuestionCreatedE2EIT,T11RevealE2EIT,HomeTodayIT` 改成 `mvn -pl backend/review-plan-service verify -Dtest='*MasterSiblingIT'` (pattern 匹配) · 或在 test-cases.md 字面加 "运行前 grep 验证这三个 IT 文件存在 · 否则 REJECT 回 TestDesigner 重对齐" · 防 master IT 重命名后 false negative · 同时建议在 fixture/setup 里**真切 wire 上 IntegrationTestBase 15436 端口**而不只 import (有些 IT 类靠 base class context 启动 · 单跑 -Dtest='X' 可能跳 context init)

2. **用例 #5 matched_steps/missed_steps 二态强约束**: TestDesigner 字面 "空数组或不返均符 §10.19 `?` 标记 · TestDesigner 不强约束" · 这放给 Coder 太宽 · 建议**强制锁: 缺省语义 → 不返字段 (key 不存在)** vs **空数组语义 → 返 `[]`** · 二选一 · Coder 在 coder.md 字面声明选哪态 · Tester 在 spec.ts 字面 assert `expect(aiJudge).not.toHaveProperty('matched_steps')` 或 `expect(aiJudge.matched_steps).toEqual([])` · 否则 mp 端 destructure 会两态行为差异 (TypeError 风险)

### verdict

verdict: REJECT

reason: Round 1 强制 REJECT (audit dim_test_cases_alignment.review_has_ge_1_reject_round 卡口 · 防 AI 互相批准)。Tester 视角找到 3 大类漏覆盖 (枚举边界 / JSONB null 边界 / Authorization+race) + 2 处断言强度不足 (跨模块 IT brittle / matched_steps 二态未锁) · 与 Coder review 视角差异维持 (我看覆盖度 · Coder 看可实现) · 建议 TestDesigner Round 2 新增 3 用例 (#7 枚举 / #8 metadata=NULL / #9 跨用户+race) · 改 2 用例 Then 列 (#2 IT pattern · #5 二态强锁)。
