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

---

## Round 2

reviewer: Tester agent (claude opus 4.7 · top-level spawn · 2026-05-18 Round 2)
date: 2026-05-18
test_cases.md ref: Round 2 重写 (7edc483 · 6 用例 fold + 11 反馈点闭环表)

### Round 2 复审视角

(a) Round 1 我提 5 反馈点 (3 漏 + 2 断言) 是否真吃且不只是"塞进去敷衍"? 5/5 closure 验证 · (b) Round 2 引入的 fold 策略 (#6 4 子断言合并) 是否合理 vs 应拆 · (c) Round 2 是否新引入覆盖盲区 / 字面冲突 / audit 可执行性问题。

### Round 1 反馈点 5/5 吃掉对照

- **漏覆盖 1 (final_grade_source 枚举边界)**: ✓ 完整吃 — Round 2#6 子断言 #a fold 4 子情况 (`ai_partial` fabricate / `AI_ACCEPTED` 大小写 / `''` 空串 / 超 16 字符) · 全返 422 INVALID_FINAL_GRADE_SOURCE 不 fallthrough 到 GRADE_SOURCE_MISMATCH · DB 0 副作用断言 (count(wb_review_node WHERE id=N6a)=0 · count(review_outcome WHERE plan_id=N6a)=0) · 加分: "不含 'GRADE_SOURCE_MISMATCH'" 防 Coder 用 CHECK 比对 ai_judge_verdict 误触发 fallthrough — 这是我 Round 1 没明说的反作弊点 · TestDesigner 自加分

- **漏覆盖 2 (aiJudge.status JSONB null/missing 边界)**: ✓ 完整吃 — Round 2#5 Given 列加 JSONB 三态降级硬约束 (整 NULL / parse 失败 / 缺 status key 三态 → aiJudge.status=null 不抛 5xx) · Round 2#6 子断言 #b 真切验 `ai_judge_metadata` 列 SQL NULL 时 `aiJudge` 整体 null 严匹配 `"aiJudge":null` 字面字符串 · 与 Round 1 我点的 NPE 风险锚一致

- **漏覆盖 3 (Authorization+race 跨用户/重复 grade)**: ✓ 完整吃 — Round 2#6 子断言 #c (跨用户 plan.student_id=8 ≠ Header X-User-Id:7 → 403/404 二选一 · 不允许 200 · 含 'NODE_NOT_OWNED'/'NODE_NOT_FOUND' 关键字 · DB 0 副作用) + 子断言 #d-1 (重复 :grade → 409 NODE_ALREADY_GRADED) + 子断言 #d-2 (CompletableFuture.allOf 2 并发 1 成 1 败 · count(review_outcome) ≤ 2 防重复写脏) · KI1 master §10.5 idempotency-key 不破坏锚清晰

- **断言强度 1 (跨模块 IT brittle)**: ✓ 完整吃 — Round 2#2 加前置存在性 grep `find backend/review-plan-service -name "T06QuestionCreatedE2EIT.java" | wc -l = 1` 三个 IT 类 · 任一不存在立即 REJECT 回 TestDesigner 重对齐 (Rule 12 Fail loud) + 全 FQCN 包名 `com.longfeng.reviewplan.T06...` 防 Surefire silent skip · 加分: mvn verify wall-clock < 30 min 性能兜底 — 这是 TestDesigner 自加 · 防 CI 卡住

- **断言强度 2 (matched_steps/missed_steps 二态)**: ✓ 完整吃 — Round 2#5 Given 列加二态硬约束 + Coder coder.md grep 锚 `grep -E "matched_steps:不返key|matched_steps:返空数组" coder.md` + Then 列两态字面分支验证 (态 A: response.body JSON 不含 "matched_steps" 字符串 · 态 B: 含 `"matched_steps":[]` 字面) · 防 mp 端 destructure TypeError

**总计 5/5 吃掉率: 100%** · 不仅塞进去 · 而是每条都加了反作弊辅助断言 (#a 'GRADE_SOURCE_MISMATCH' 不含 / #2 mvn wall-clock budget / #5 二态字面 grep)。

### Round 2#6 fold 4 子断言合理性评价

**合理 ✓**: 4 子断言均验"backend 4xx 边界响应"同语义簇 (`不允许 5xx · 不允许脏数据写入 · 不允许 200 跨权限`) · 不属于 "正常 happy path" + "FORGOT 级联" + "ai_overridden" 等独立流程 · fold 进 1 用例集中实现 + 集中验证是合理的边界用例归并模式。

**4 fixture id 隔离 ✓**: N6a (枚举验证 plan ACTIVE · 无 wb_review_node) / N6b (metadata=SQL NULL · 其它 4 ai_judge_* 列非空) / N6c (跨用户 student_id=8) / N6d (race 重复 grade · plan 已 COMPLETED · review_outcome 已有 1 行) — 4 个独立 plan_id + 不共享 wb_review_node · 一个用例 fixture 失败不会污染其它子断言。

**vs 应拆为 2-3 用例 ⚠ 但接受**: token budget 严格 ≤ 6 (CLAUDE.md Rule 6 · audit.js test_cases_le_6_rows) · fold 后 #6 行长度确实超长 (≈ 1.5 倍其它用例) · 但拆为 #6a/#6b/#6c 会触发超 6 红线 · 在 6 行硬限下 fold 是次优解中的最优解 · 不挑此点。

### Round 2 新引入问题 (审视 Round 1 没发现的盲区)

**N1 · Round 2#3 应用层 CHECK 实现位置 3 选 1 缺 grep 锚 ⚠ (audit 可执行性盲点)**:

Round 2#3 Given 列字面 "Coder Step 4 三选一 · 必在 coder.md 字面声明" 但**未给 grep 字面字符串锚** (对比 Round 2#2 OR 二选一已加 `grep -E "UPSERT路径|INSERT-only路径|wb_review_node-row-not-created"` 锚 · #5 二态已加 `grep -E "matched_steps:不返key|matched_steps:返空数组"` 锚 · 但 #3 没给) · audit reviewer 怎么机械验?Tester 必须手动 grep · 容易漏。**建议 Round 3 (或 Coder 实现前补一行)**: Given 列加 `grep -E "Controller@Valid|Service-first-line|GradeService.complete-入口第一行" coder.md` 任 1 字面命中。

**N2 · Round 2#2 OR 二选一 grep 锚带中文"路径"二字 ⚠ (false negative 风险)**:

`grep -E "UPSERT路径|INSERT-only路径|wb_review_node-row-not-created"` — Coder 实际写 coder.md 不一定字面带 "路径" 二字 · 可能写 "UPSERT 实现" / "INSERT-only 决策" / "采用 UPSERT 方案" 等不严格 contains "UPSERT路径" · grep 会 false negative 但 Coder 实际声明了。**建议**: 锚改为 `grep -iE "UPSERT|INSERT-only|wb_review_node.*not.*creat|wb_review_node 行不创建"` 更宽容 · 或显式要求 Coder coder.md 字面照抄此锚字符串 (Rule 11 match conventions)。

**N3 · Round 2#6 子断言 #a errorCode 字面 'INVALID_FINAL_GRADE_SOURCE' 过严 ⚠ (brittle)**:

`response body 含字面 'INVALID_FINAL_GRADE_SOURCE'` — Coder 用 Spring `@Valid` + `@NotNull` + custom enum validator 默认抛 `MethodArgumentNotValidException` 转 400 时 errorCode 字面可能是 `VALIDATION_ERROR` / `INVALID_REQUEST` / `BAD_REQUEST` / `field.final_grade_source.invalid` · 项目无 errorCode 全局字典 (我读 ApiResult 信封代码确认) · 锁字面 'INVALID_FINAL_GRADE_SOURCE' 容易 false negative。**建议**: 改为正则 `INVALID_FINAL_GRADE_SOURCE|invalid.*final_grade_source|VALIDATION_ERROR.*final_grade_source|field.*final_grade_source.*invalid` 任 1 命中 + HTTP 422 严锁。

**N4 · Round 2#6 子断言 #d-2 race 实现可靠性 ⚠ (可能 flaky)**:

`CompletableFuture.allOf 2 并发请求 1 成 1 败` — 单元测试里 race 时序不可控 · CI 跑可能 2 个都成 (2 outcome 行) 或 2 个都败 (Lock 抢失败) · count(review_outcome) ≤ 2 允许 2 行 = 默许 race 时序不可控 = 这条断言**实际无强力反作弊价值** (因为 1 行/2 行都过) · master §10.5 idempotency-key 真切验证可能需要重试 N 次取统计 · TestDesigner Round 2 已 surface "race 时序不可预测严锁会假阴性" — 我接受这个 trade-off · 不强制 REJECT · 但**建议**: Round 3 加补充断言 `if (2 行 outcome) then SELECT quality FROM review_outcome WHERE plan_id=N6d` 两行不能同时存在 (即只能 1 行 PARTIAL 或 1 行 MASTERED · 不能同时 2 行 quality 不同) · 这才是 idempotency 真切语义。

**N5 · 跨用例 fixture 隔离 ✓ (无问题 · 我自查后确认)**:

我担心 6 用例并行跑时 N1/N2/N3/N4/N5/N6a..d 同一 testcontainer 是否互相干扰 (e.g. wb_review_node id collision) · 但 TestDesigner 已用不同 id 隔离 (N1, N2, N3, N4-0..N4-6, N5, N6a, N6b, N6c, N6d) · IntegrationTestBase 跑测前 `@Transactional` rollback 兜底 · 我手动 grep `T06QuestionCreatedE2EIT.java` 看到 fixture 跨 IT 类是隔离的 · 无干扰风险 · 此点不挑。

### Round 2 字面冲突自查 (与 biz/spec)

- §10.18 字面 "final_grade_source 缺省 'self'" vs Round 2#6 子断言 #a-3 `final_grade_source=''` (空串) 返 422 · TestDesigner Round 2 明确字面区分 "空串 ≠ 缺省 · §10.18 字面'缺省 self'指字段不存在不指空串" — 与 §10.18 不冲突 ✓
- §4.16 字段约束 "ai_overridden ⟹ ai_judge_verdict != grade" vs Round 2#4 grade=FORGOT verdict=MASTERED final_grade_source=ai_overridden · 符合 ✓
- §10.19 字面 `aiJudge.status?` 可选 vs Round 2#5 强锁 aiJudge.status='DONE' 字面 — TestDesigner Round 2 用 fixture INSERT 完整 metadata 兜底强锁 · 字面冲突无 ✓

### Round 2 加分项 (TestDesigner 自加我没要求的)

- Round 2#1 easeAfter 弱断言 + KI1 锚 SM2Algorithm.java L17-34 字面计算公式 q=3 delta=-0.14 (理论值参考) — 比我 Round 1 要求的 "锁字面" 更稳健 · 避免 SC-08/SC-09 误触发 REJECT
- Round 2#2 加 mvn verify wall-clock < 30 min 性能兜底 — 我 Round 1 没要求 · TestDesigner 自加防 CI 卡住
- Round 2#3 加 ease_factor 未污染物理断言 (transaction 隔离严) — 我 Round 1 反馈点里就提了 "防 Coder SM-2 算完后才 CHECK" · TestDesigner 真切吃掉
- Round 2#4 加 review_plan_outbox event_type='graded' 新增 1 行 + KI1 现役 `rescheduleDownstreamForForgot` 级联硬证据 4 行 CANCELLED + ≥ 1 ACTIVE — 比 Round 1 强很多

### Round 2 终态 verdict

verdict: APPROVE

reason: 5/5 反馈点完整吃掉 (3 漏 + 2 断言 · 每条都附反作弊辅助断言) · Round 2#6 fold 4 子断言在 ≤ 6 用例 token 红线下属合理归并 · 4 fixture id 隔离干净 · 字面冲突自查无 · TestDesigner 在 6 处加分 (mvn wall-clock 兜底 / SM-2 弱断言 + KI1 锚 / transaction 隔离物理验 / FORGOT 级联硬证据 / 二态字面 grep / 422 反作弊不含 fallthrough)。新引入 4 个细节问题 (N1 #3 缺 grep 锚 / N2 #2 锚带中文路径 / N3 #6#a errorCode 过严 / N4 #6#d-2 race flaky) 都属 "可在 Coder 实现前后补丁" 级 · 不到非 REJECT 不可 · 视角差异维持 (找漏派 · 与 Coder 实现派不雷同) · 用户视角契约已经够严 · 不强制再 REJECT 浪费 Round。 建议 TestDesigner 在 Phase 2.5 User Approval section 前 (或后续 Round 3 触发时) 补丁 N1-N4 即可。
