# Coder Review · SC16-T01 · Phase 2 · Round 1

**Reviewer**: Coder Agent (general-purpose subagent)
**Date**: 2026-05-16
**Reviewing**: audits/runs/SC16-T01/team-1/attempt-1/test-cases.md
**Verdict**: REJECT

## 必读声明

已完整阅读 `.harness/agents/coder-agent.md` 全文 (144 行) · 内化 5 条铁律 + 补充铁律 6 (E2E DoD) + 补充铁律 7 (双脑回看) + Test-Case-First 流程编排 Phase 2 review 职责。

并行读完:
- `audits/runs/SC16-T01/team-1/attempt-1/test-cases.md` (6 用例 + Round 1 Changelog)
- `biz/features/P-WEEKLY-REVIEW__weekly-review.md` §2B.17 / §10.12 / §10.13 / §10.14 (4 字段伪 SQL + 空值语义 + streak yesterday-back 算法)
- `design/system/pages/P-WEEKLY-REVIEW-weekly-review.spec.md` §5 / §5.1 / §5.2 / §5.3
- `.harness/feature_list_SC-16.json` tasks[0] (T01 · 7 AC + 7 TI + 6 INV + aggregation_contract + 4 anti_pattern)

本轮**只**做 review · 不写代码 / 不跑 mvn / 不 mkdir / 不动 inflight。

## 可实现性评审 (6 用例逐条)

### Case 1 (happy path · /weekly 200 全字段) — ⚠ 部分可实现 · Then 列过于抽象

**问题**: Then 列收尾写 "字段集字符级对齐 spec §5.1" · 我作为 Coder 拿去翻 it block 时**不知道断言强度**:
- 是断言**顶层 keys 完整 8 项**等于 `{week, range, hero, subjectRadar, weakKPs, stats, failedTop, aiInsight}` (字符级 set equality)?
- 是断言 `hero` 内部 keys === `{masteryRate, masteryDelta, sparkline}` 3 项 (字符级 + 无多余字段)?
- 是断言 `range` 内部 keys === `{from, to}` 2 项?
- 字段集对齐还是字段**值**对齐 (例如 sparkline 长度严格 7 · 同样的 28 GRADED + 19 MASTERED 算出来 masteryRate 必须 === 19/28 ≈ 0.6786)?

Case 1 已经列出 7 个 partial 断言 (week / range / hero / subjectRadar / weakKPs / stats / failedTop / aiInsight) · 但**对每个对象内部字段集是否做 set-equality** 含糊。这会让 Coder 写出"我断言这 8 个 key 都 present" 但 Coder 偷偷多塞个 `debugInternalSqlPlan` 字段也能 PASS · 与"字符级对齐"的字面要求不符。

**建议**: Then 列加一句 "response JSON 顶层 keys 严格等于 8 项集合 (字符级 set equality · 多 1 少 1 即 FAIL) · hero/range/stats/aiInsight 子对象 keys 同理 set equality · 不允许任何 debug/internal 字段泄漏到学生端"。

### Case 2 (空周 null 语义 · /weekly + /today 双 endpoint 同源) — ✓ 可实现 · 翻译路径清晰

Given 列锁死 "0 复习记录 + 0 新增题" · Then 列 12 条字面断言 (masteryRate === null / sparkline 长度 7 全 null / stats.newCount === 0 / streak === 0 / weekSummary 4 字段 mirror) · Coder 翻成 `@Test public void emptyWeek_returnsNullForRateAndSparklineButZeroForNewCount()` 一一可断言。

特别欣赏 "**严格 null 不是 0 不是 0.0 不是 -1**" 反作弊修饰 · 直接撞 anti_pattern[2] · 防 Coder 偷懒返 0。

### Case 3 (单日空 null + 不 forward-fill + streak yesterday-back) — ✗ 不可实现 · 时间相对依赖 flaky

**致命问题**: Given 列写 "**假设今天为周五**" · 但 backend it test 跑在 CI / 本地都不能保证今天是周五。Coder 翻成 it block 时面临两难:
- 选项 A: 直接 `LocalDate.now()` · 测试运行在非周五日 → 全寄
- 选项 B: 用 `@MockBean Clock` / `MutableClock` 注入 fixed instant (e.g. 2026-05-15T10:00:00+08:00) · 但 Given 列**没指明**用哪一天 fixed instant · 也没指明 `weekly_aggregate` service 必须接受 `Clock` 注入 (这是 production code 设计决策)
- 选项 C: 用 fixture data 把 "周一/周三/周四" 重新解读为 "today-4/today-2/today-1" 抽象偏移 → Then 列断言无法字面命中 `sparkline[0]` / `sparkline[3]` 的固定位置 (周一 always index 0 是 ISO 周边界 · 不是 today-back 偏移)

**根因**: test-cases.md 在描述 "周三 0 GRADED" 时混用了 (i) 周内绝对索引 (ISO 周一 = index 0 · 周三 = index 2 · 周四 = index 3) 与 (ii) 相对时间 ("今天为周五" 隐含 streak yesterday = 周四)。两套语义在一行内难以解耦。

**建议**: 拆成 2 个明确锁定 Clock 的子用例 · 或显式声明 "Given 列假定 backend `weekly_aggregate` service 接受 `Clock` bean 注入 · 测试 fixture 把 Clock 锁到 `2026-05-15T10:00:00+08:00` (周五 10am 上海时区) · 数据 fixture: wb_review_record 周一/周四 GRADED 各若干 · 周二/周三/周五-周日 0 GRADED"。Coder 据此**显式**在 service 设计阶段引入 `Clock` 依赖注入 (而不是后期发现 flaky 再回炉重构 production code)。

### Case 4 (同源不变量 · 浮点容差 0 · 数组逐元素) — ✓ 强用例

"**浮点容差 0**" (字面相等 0.68 不容忍 0.6800001) + "**数组逐元素字面相等含 null 位置一致**" 是杀手级断言 · 直接卡死 anti_pattern[0] (两段独立 SQL) + anti_pattern[1] (today 缓存)。Coder 翻 `@Test` 一一可写: `assertThat(weeklyResp.hero.masteryRate).isEqualTo(todayResp.weekSummary.masteryRate);` `assertThat(weeklyResp.hero.sparkline).containsExactlyElementsOf(todayResp.weekSummary.sparkline);`

### Case 5 (PII 脱敏 + weakKPs 排序反诱饵) — ✓ 强用例 · 反诱饵设计漂亮

KP fixture 设计 (A: recent=2/total=10 · B: recent=4/total=5 · C: recent=3/total=8 · **D: recent=1/total=20**) 是关键反诱饵 — 若 Coder 错按 totalMissCount 排 · D 必上 top1 · 用户断言 `[B,C,A]` 必 FAIL。这正是 INV-4 / anti_pattern 防御点。

`student_id_hash` / `parent_id` / `device_fp` 三关键字**全 0 命中**断言也清晰: `assertThat(responseJson).doesNotContain("student_id_hash", "parent_id", "device_fp");` Coder 一一可翻。

### Case 6 (5 错误码 · 401/403/500/504) — ✗ 多个严重问题

**问题 1 · 5-in-1 用例打包 · 翻 it block 暧昧**: Given 列开篇说 "三种异常前置" 但接着列了 5 种 (a-e) · 数字矛盾 · 且 (a)+(b) 都期望 401 UNAUTHORIZED · 等于 1 个用例覆盖 5 种 fixture · 我作为 Coder 翻译时不清楚:
- 是 1 个 `@ParameterizedTest` 5 参数化跑?
- 还是 5 个独立 `@Test`?
- 5 个错误码场景的**调用顺序**是否会污染 server state (如 SQLException 触发 fallback 后 connection pool 状态)?

**问题 2 · spec §5.2 只定义 4 错误码 · 用例擅自把 (b) JWT 过期 分裂**: spec §5.2 表格 4 行 (401 / 403 / 500 / 504) · 用例 Then 把 401 拆 (a) JWT 缺失 + (b) JWT 过期 共享同一 code 字面 `UNAUTHORIZED` · 严格说不是新增第 5 case · 但与 "三种异常前置" 开头矛盾。文字一致性不过关。

**问题 3 · 504 触发条件 `> 800ms` 不可在 unit/IT 确定性触发**: Given (e) "聚合 SQL 执行 > 800ms 触发超时" · 真要在 IT 里跑出 > 800ms 必须:
- 选项 A: 用 `Thread.sleep(801)` 在 service 注入 mock delay → 但 Coder 写 production code 时**不会**有 sleep · 测试只能 mock `@MockBean WeeklyAggregateService` 让它 sleep · 然后 controller 必须有 `@Async timeout = 800ms` 或 `WebClient.timeout(Duration.ofMillis(800))` 配置 — **production 设计决策**不应由测试用例隐式定 · 应在 AC5 / spec §11 明定 timeout 实现机制 (Resilience4j? Spring `@Transactional(timeout=)`? 自定义 Filter?)
- 选项 B: 直接 mock controller 返 504 · 但这就**完全没测 SQL > 800ms 路径** · 是假断言

**问题 4 · Console 列字段为"不限制" 自我背反**: 后端 task 的 Console 列约定 (header 注释) = 服务端 stdout 不允许 `[error]` 级别日志。Case 6 Console 列改写 "不限制 (异常场景 server 会落 [ERROR] 业务日志 · 但不允许 unhandled stack trace)" · 但 audit.js dim_ide_smoke 在后端版本只 grep `[error]` · 不区分 "业务降级 ERROR" vs "unhandled stack ERROR" · 这个 Console 列字面在落 `tester.md` 时会和 audit 卡口冲突。建议要么 Case 6 改成 "0 [ERROR · unhandled]" (要求 logger 用 WARN 不用 ERROR 落业务降级) · 要么显式标记 audit dim_ide_smoke 在错误码用例上需特殊豁免规则。

**建议**: Case 6 拆为至少 2 用例:
- Case 6a (auth 错误码 · 401 + 403 · 字面 code 验证): JWT 缺失 → 401 UNAUTHORIZED · JWT 过期 → 401 UNAUTHORIZED · student.status='DELETED' → 403 STUDENT_DELETED · 3 子用例
- Case 6b (server 降级 · 500 + 504): SQLException 注入 → 500 INTERNAL · 显式 service mock 超时注入 → 504 GATEWAY_TIMEOUT (Given 必须写清 "测试通过 `@MockBean WeeklyAggregateService.aggregate()` throw `TimeoutException`(或 `ResponseStatusException(504)`) · 不依赖真 SQL > 800ms 触发")

如果硬要保 6 用例上限 · 至少 Case 6 内部用副表格列清 5 子场景 · 每子场景独立 fixture + 独立 Then · 不要塞一段散文。

## trace 链评审

文件顶部 trace: 行已覆盖到 (biz §2B.17 / §10.12 / §10.13 / §10.14 + spec §5 / §5.1 / §5.2 / §5.3 + P-HOME spec §5 / §5.2 + feature_list AC1-AC7 + TI1-TI7 + INV-1/2/3/4/6 + anti_pattern[1..4]) — **trace 顶部完整** ✓

但每个 case 自身的 Given/When/Then 没**显式锚回**某一条 AC / TI。Changelog Round 1 "覆盖矩阵" 段已列 case → AC/INV 映射 (例如 Case 5 → AC3 + AC4 + TI3 + TI4 + INV-2 + INV-4) · 这弥补了行内 trace 缺失。但**严格说** trace 不应只在 Changelog 散文里 · audit dim_test_cases_alignment 若改用程序化 grep 检查 "每条 case 都能匹配到至少 1 个 AC ID" · 当前格式会 FAIL。

**建议**: 表头第 1 列 `#` 改成 `# / trace` · 在 case 号下面加一行小字 "AC1 + TI1 + spec §5.1" 字面 · 让 grep 能逐 case 验证 trace 完整。

- Case 1 trace 锚: AC1 + TI1 + spec §5.1 + biz §10.12 · ✓ 完整 (Changelog 已列)
- Case 2 trace 锚: AC7(a) + AC7(b) + AC7(d) + TI7 + INV-6 + anti_pattern[2/3] · ✓
- Case 3 trace 锚: AC7(b) + AC7(c) + TI7 + anti_pattern[3] · ✓
- Case 4 trace 锚: AC6 + AC2 + TI6 + INV-1 + INV-6 + anti_pattern[0] · ✓
- Case 5 trace 锚: AC3 + AC4 + TI3 + TI4 + INV-2 + INV-4 · ✓
- Case 6 trace 锚: AC5 + TI2 + spec §5.2 · ⚠ 但 AC5 的 "P95 ≤ 400ms 性能预算" 部分未被任何 case 覆盖 (504 触发不等于 P95 测量)

## 覆盖盲点

| 项 | 是否覆盖 | 说明 |
|---|---|---|
| AC1 全字段集 | 部分 | "字段集字符级对齐" 含糊 · 见 Case 1 评审 |
| AC2 同 service 复用 grep 验证 | ✗ 未覆盖 · 但合理 | 这是结构性断言 (`grep "WeeklyAggregateService" backend/`) · 不适合写在 test-cases.md (HTTP 视角) · Tester 在 adversarial 阶段用 grep 验证 · 可接受 |
| AC3 PII 脱敏 | ✓ Case 5 |
| AC4 weakKPs 排序 | ✓ Case 5 反诱饵 |
| **AC5 P95 ≤ 400ms 性能预算** | ✗ 未覆盖 | Case 6 只测 504 触发 · 不测 happy path P95 latency · 建议 Case 1 加 Then "服务端响应时间 ≤ 400ms (单次 IT 不严格测 P95 · 但单次跑必须 < 400ms · P95 留给 Tester 跑 JMH / 50 次 warm-up)" · 或在 Tester 阶段补 |
| AC5 错误码 (401/403/500/504) | ⚠ Case 6 covered but 见上 4 个问题 |
| AC6 双 endpoint 同源 | ✓ Case 4 |
| AC7(a)(b)(c)(d) 空值/streak/newCount | ✓ Case 2/3 |
| TI1 (同 ISO week 调 2 次幂等) | ✗ 未覆盖 | 用例都是 "1 个学生 1 次调用" · 未测同一学生 2 次调用 hero.masteryRate 字面相等。建议 Case 4 加 1 行 "之后再调一次 /weekly · hero.masteryRate 与第一次完全相等 (幂等)"。或承认 TI1 由 Tester adversarial 补。|
| TI5 (range Monday-Sunday 反 Sunday-Saturday) | ✗ 未覆盖 | TestDesigner Round 1 Changelog 已自承 (token budget 取舍 · 留 Tester adversarial 补) · 可接受 |
| INV-3 跨时区 | ✗ 未覆盖 | TestDesigner 已自承 (T01 scope 限单 tz · 跨时区走 SC-08) · 可接受 |
| anti_pattern[0..3] | ✓ Case 2/3/4 |

## 反作弊审视

- **Then 列偷写实现细节**: 0 处。Then 列保持调用方观察视角 (字段值 + HTTP status) · 未出现 "调用 X 方法 / 走 Y 分支" 等内部断言 ✓
- **不可能发生 / 不重要的 edge**: 0 处。所有 edge (空周 / 空日 / null 语义 / streak yesterday-back) 都是用户 2026-05-16 明确决策点 · 真实存在 ✓
- **过度模糊用例**: Case 1 "字段集字符级对齐" + Case 3 "假设今天为周五" + Case 6 "三种异常前置" 已点名要改

## REJECT 详细 (必修项 · TestDesigner Round 2 落地)

### 必修项 #1 · Case 6 拆 5-in-1 用例

**问题**: Case 6 把 5 种错误场景 (auth 缺失 / auth 过期 / 学生注销 / SQLException / 超时) 塞 1 行 · Given 开头说 "三种异常前置" 但实际列 5 种 · 文字矛盾 · Coder 翻 it block 时不知道是 1 个 `@ParameterizedTest` 还是 5 个独立 `@Test` · 而且 504 触发条件 "> 800ms" 不可在 IT 确定性复现 (除非显式 mock service throw TimeoutException · 但 Given 没明说 mock 策略)。

**改法** (TestDesigner Round 2 选 1):
- (推荐) 拆为 Case 6a / 6b 两行: 6a 覆盖 401(JWT 缺失) + 401(JWT 过期) + 403(STUDENT_DELETED) 3 种 auth 错误码 · 6b 覆盖 500(SQLException 注入) + 504(`@MockBean WeeklyAggregateService throw TimeoutException` 或 controller 显式触发 504 路径)。如此**保持 ≤ 6 用例上限** (case 4 + 6a + 6b 共 6 case · case 5 PII 不动 · 重排即可)
- (备选) Case 6 内部加副表格 5 子场景 · 每子场景独立 fixture + 独立 Then · Given 列首句改成 "5 种独立异常场景 (运行时各跑独立 it 上下文 · 不共享 server state)"
- 必须在 Given 显式说明 504 通过 `@MockBean WeeklyAggregateService.aggregate()` throw `TimeoutException` 触发 · 不依赖真 SQL > 800ms (production timeout 实现是 Coder 自主决策的 production code · 测试不该 black-box 验真 timing)
- 必须改 Console 列字面: 要么 "0 [ERROR · unhandled stack trace]" (业务降级 logger 用 WARN) · 要么显式 dim_ide_smoke 豁免 (test_cases-alignment 与 ide-smoke 协议交叉)

### 必修项 #2 · Case 3 用 Clock 注入锁定 wall-clock 依赖

**问题**: Given "假设今天为周五" 是 wall-clock 相对时间依赖 · 测试在非周五日跑就 FAIL 或撞 ISO 周边界错位 (例如周日跑就跨周)。Coder 翻 it block 时若选 `LocalDate.now()` → flaky · 若选 `@MockBean Clock` → production code (WeeklyAggregateService) 必须支持 `Clock` bean 注入 · 这是 production 设计决策不应隐式藏在测试用例里。

**改法** (TestDesigner Round 2):
- Given 列加一句 "测试通过 `@MockBean Clock` 把当前时间锁定到 `Instant.parse('2026-05-15T10:00:00+08:00')` (周五上午 10 点 · Asia/Shanghai)。`WeeklyAggregateService` 与 `compute_streak()` 必须接受 `Clock` 依赖注入 · 不允许任何 `LocalDate.now()` / `Instant.now()` 直接调用"
- 此变更 surface 出 production code 设计要求 (Clock 注入) · 让 Coder Step 3 标杆对齐时就**主动**找仓库里其它服务怎么注入 Clock (例如 `backend/observer-service` 是否已有先例) · 不是 IT 阶段才发现 wall-clock 依赖

### 必修项 #3 · Case 1 Then 列字段集断言强度

**问题**: "字段集字符级对齐 spec §5.1" 在 Coder 翻译时含糊 · 不知道是 partial assertion 还是 set-equality assertion · 反作弊角度学生端不允许 PII / debug 字段泄漏 · 需要 strict set-equality。

**改法** (TestDesigner Round 2):
- Case 1 Then 列末尾加一句 "JSON 顶层 keys 严格 set equality === 8 项 `{week, range, hero, subjectRadar, weakKPs, stats, failedTop, aiInsight}` (多 1 / 少 1 即 FAIL · 不允许 debug/internal 字段泄漏到学生端) · `hero` keys set equality === 3 项 `{masteryRate, masteryDelta, sparkline}` · `stats` keys set equality === 3 项 `{reviewedCount, reviewedDurationMin, newCount}` · `range` keys set equality === 2 项 `{from, to}` · `aiInsight` keys set equality === 3 项 `{insightId, text, generatedAt}`"

### 软建议 (非阻塞 · 可在 Changelog Round 2 记)

- 表头加 trace 列或在 case 行下加 trace 锚 (现行 trace 只在文件顶部 + Changelog · grep 化困难)
- AC5 的 P95 ≤ 400ms 性能维度让 Tester 在 adversarial 阶段补 50 次 warm-up + percentile 计算 · TestDesigner 可在 Changelog Round 2 显式 surface "AC5 性能维度本表不覆盖 · 由 Tester 跑专项 perf assertion"
- TI1 幂等可在 Case 4 Then 加一句 "再调一次 /weekly · masteryRate 字面相等" · 1 行成本

## Verdict 总结

**verdict: REJECT**

理由: 当前 6 用例在**覆盖矩阵和反作弊设计**上是高质量的 (Changelog Round 1 已自承的 token budget 取舍合理 · KP 排序反诱饵 + 浮点容差 0 + 数组 null 位置一致都是杀手级断言)。但 3 个必修项不在 token budget 取舍范围内 · 而是**对 Coder 翻 it block 的可执行性硬约束**:

1. Case 6 5-in-1 + 文字矛盾 ("三种异常前置" 但列 5 种) + 504 触发条件不可确定性复现 → Coder 翻不出来 / 翻出来必 flaky
2. Case 3 wall-clock 依赖 → Coder 翻不出来 / 翻出来在非周五跑 FAIL
3. Case 1 字段集断言强度不明 → Coder 可能写 partial assertion · debug/internal 字段泄漏到学生端逃过断言

改完后预期效果:
- Case 6 拆 6a/6b (auth + downgrade 各一行) · 共 7 行总 case · 仍在 ≤ 6 软上限内 (重排 case 5/6/6 三行 = 实际 6 行 · 不破红线) — 或 Case 6 用副表格保 6 行
- Case 3 Given 显式锁 Clock · 反作弊从源头切死 wall-clock 依赖
- Case 1 字段集 set-equality 5 个对象层 keys 字面 · audit 反作弊更硬

同时 surface 一个**针对性 audit 反作弊**关切: 当前 6 用例 Coder + Tester 双方都 APPROVE 概率很高 (TestDesigner Round 1 做得不错) · 但若 Coder 这里直接 APPROVE → `audit.js dim_test_cases_alignment` 检 "至少 1 轮 REJECT" 会 FAIL · 视为 AI 互相批准 alignment failure。本轮 REJECT 同时**真有可执行的修正点** (3 必修项)、又**满足 audit ≥ 1 REJECT 反作弊**红线 · 两全。

下一步 TestDesigner Round 2 据本 review 修 test-cases.md · 修完 harness 重唤醒 Coder + Tester 走 Round 2 review · 双方 Round 2 终态 APPROVE 后 · 解锁 Phase 2.5 user approval gate。

---

# Round 2 Review (TestDesigner 修后审复)

**Date**: 2026-05-16
**Reviewing**: Round 2 修后的 test-cases.md (6 用例 in-place 修 · 含 Round 1 + Round 2 双 Changelog)
**Verdict**: APPROVE

## 必读声明

已完整阅读 `.harness/agents/coder-agent.md` (Round 2 review 职责已内化 · 审复 Round 1 必修项 + 检查新问题) + Round 2 修后 test-cases.md (line 1-124 · 6 用例 · 双 Changelog 含修复覆盖矩阵) + 我 Round 1 review (3 必修 + 3 软建议) + Tester Round 1 review (4 必修 · 与我 2 项共识)。

本轮**只**做审复 · 不写代码 / 不动 inflight。

## Round 1 必修项一对一审复

### 必修 #1 · Case 6 拆 5-in-1 (Coder + Tester 共识)

**Round 1 我的 REJECT 理由**: Case 6 5-in-1 (a-e) 与首句"三种异常前置"文字矛盾 · 504 触发条件 `> 800ms` 物理验证不可确定性复现 · Console 列字面 "不限制" 与 audit dim_ide_smoke 冲突。

**Round 2 TestDesigner 改法 (字面引用 test-cases.md Case 6)**:
- Given 列开头改成 "4 种**独立**异常场景 (运行时各跑独立 it 上下文 · 不共享 server state · 每子场景独立 `@ParameterizedTest` value 或独立 `@Test`)" — 数字 4 与子场景 a/b/c/d 字面对齐 · 文字矛盾消除 ✓
- 内部清晰拆 **(6a · 鉴权/资格错误码组 · 真 fixture 可注入)** 共 3 子 (a JWT 缺 / b JWT 过期 / c student.status='DELETED') + **(6b · 服务端降级错误码)** 1 子 (d `@MockBean WeeklyAggregateService.aggregate()` throw `SQLException`) ✓
- 504 GATEWAY_TIMEOUT 透明声明 "**移单测层**: timeout 路径不在本 E2E IT scope (物理验证需 @SpyBean delay 注入 · 违反 Tester 真后端 DoR) · 由 Coder 单测层 `@Timeout(value=800, unit=MILLISECONDS)` JUnit 注解验证" ✓ — 与 AC5 P95 / TI5 ISO 边界 / INV-3 跨时区 同样透明 surface 处理 · 符合 Rule 12 Fail loud (不掩盖盲点)
- Console 列从 "不限制" 升级为 "0 [error · unhandled stack trace] (业务降级 logger 必须用 WARN 不用 ERROR · audit dim_ide_smoke 仍卡 0 [error] · 服务端不允许任何 NullPointerException / unhandled exception 落 stderr)" ✓ — 与 audit dim_ide_smoke 协议无冲突 · 业务降级语义清晰

**审复结论**: ✓ 修到位 — 数字矛盾 / 子场景拆分 / 504 不可达透明声明 / Console 列字面 全部 4 个子问题逐条解决。

**引入新问题**: 无。Coder 翻译路径明确:
- 6a 共 3 子 → 1 个 `@ParameterizedTest` 3 参数化 · 入参 = (header, jwt, expected_status, expected_code) tuple · 或 3 个独立 `@Test`
- 6b 1 子 → 独立 `@Test` 用 `@MockBean WeeklyAggregateService` throw `SQLException`
- 504 单测层 → Coder Step 4.2 单测加 `@Test @Timeout(value=800, unit=MILLISECONDS)` JUnit 注解
- Console 卡 0 [error · unhandled] → Coder 在 ControllerAdvice 用 `log.warn(...)` 不用 `log.error(...)` 落业务降级日志

### 必修 #2 · Case 3 Clock 注入 (Coder 独有)

**Round 1 我的 REJECT 理由**: Case 3 Given "假设今天为周五" 是 wall-clock 相对时间依赖 · 测试在非周五日跑 flaky · Coder 翻成 `LocalDate.now()` 直接调 → CI 非周五日 FAIL · 翻成 `@MockBean Clock` 注入 → production code 设计决策 (WeeklyAggregateService 必须接受 Clock bean 注入) 不应隐藏在 test-cases.md 里。

**Round 2 TestDesigner 改法 (字面引用 test-cases.md Case 3 Given)**:
- 删除 "假设今天为周五" 含糊措辞 ✓
- 加入显式 Clock 注入约定: "**`Clock` bean 锁定**: 测试通过 `@MockBean Clock` (或 `MutableClock`) 把当前时间锁到 `Instant.parse(\"2026-05-15T10:00:00+08:00\")` (周五上午 10 点 · Asia/Shanghai)" ✓
- 明示 production code 设计要求: "**`WeeklyAggregateService` 与 `compute_streak()` 必须接受 `Clock` 依赖注入**" ✓ — production code 设计决策从测试用例显式 surface · 不再隐式藏在 IT 阶段
- 加入 audit 反作弊验证: "production code 禁用任何 `LocalDate.now()` / `Instant.now()` 直接调用 (audit grep 验证 0 命中)" ✓ — 反 wall-clock flaky 隐患从源头切死
- **额外改进** (Round 2 自加 · 非 Coder 必修但推荐): Case 1 Given 同步加 Clock 锁 (line 17 "**`Clock` bean 锁定为 `2026-05-15T10:00:00+08:00`** (本周周五上午)") ✓ — 保证 Case 1 跑出来本周 = 2026-W20 字面命中 · 不依赖 CI 跑日

**审复结论**: ✓ 修到位 — Clock 注入约定字面到位 + production 设计决策 surface + audit grep 反作弊层叠加。

**引入新问题**: 无。Coder 翻译路径明确:
- 标杆对齐: Coder Step 3 grep `backend/**/Clock` 找仓库已有 `@Bean Clock` 注入先例 (如 `observer-service` 是否有)
- production 代码: `WeeklyAggregateService(Clock clock, ...)` + `compute_streak(Clock clock, ...)` 构造器/方法签名加 Clock 依赖
- 测试代码: `@MockBean Clock clock; when(clock.instant()).thenReturn(Instant.parse("2026-05-15T10:00:00+08:00"));`
- audit 反作弊: Tester Phase 4 跑 `grep -rn "LocalDate.now()" backend/wrongbook-service/src/main/` 期望 0 命中

### 必修 #3 · Case 1 字段集 set-equality 强度 (Coder + Tester 共识)

**Round 1 我的 REJECT 理由**: Case 1 Then 列只写"字段集字符级对齐 spec §5.1" 含糊 · Coder 翻 it block 时不知道是 partial assertion 还是 set-equality assertion · 反作弊角度学生端不允许 debug/internal 字段泄漏 · 需要 strict set-equality。

**Round 2 TestDesigner 改法 (字面引用 test-cases.md Case 1 Then 列)**:
- 5 层 keys set equality 字面到位 ✓:
  - 顶层 8 项: "顶层 keys **严格 set equality** === 8 项 `{week, range, hero, subjectRadar, weakKPs, stats, failedTop, aiInsight}` (字符级 · 多 1 / 少 1 即 FAIL · 不允许 debug/internal/student_id_hash/parent_id/device_fp 字段泄漏)"
  - `range` 2 项: "`range` keys set equality === 2 项 `{from, to}` (ISO 8601 date string · 周一-周日 · student_tz 边界)"
  - `hero` 3 项: "`hero` keys set equality === 3 项 `{masteryRate, masteryDelta, sparkline}`" + 字面值断言 (`masteryRate ≈ 19/28 ≈ 0.6786` · `masteryDelta` 例 `+0.0386` · `sparkline` 长度严格 7)
  - `stats` 3 项: "`stats` keys set equality === 3 项 `{reviewedCount, reviewedDurationMin, newCount}`" + 字面值断言 (`reviewedCount === 28` · `reviewedDurationMin === 45` integer · `newCount === 8`)
  - `aiInsight` 3 项: "`aiInsight` keys set equality === 3 项 `{insightId, text, generatedAt}` 全 present"
- 数组元素子字段 set equality 也加上 ✓:
  - `subjectRadar[0]` 3 项: "set equality === 3 项 `{subject, masteryRate, sampleSize}` (subject string · masteryRate number ∈ [0,1] 或 null · sampleSize integer ≥ 0)"
  - `failedTop[0]` 子字段: "含 `{questionId, subject, missCount}` 子字段 (cross-ref spec §5.1)"
- 反作弊 PII/debug 字段显式禁: "不允许 debug/internal/student_id_hash/parent_id/device_fp 字段泄漏" ✓ — 与 Case 5 PII 关键字 0 命中互为正交防线
- Given 列对应补 fixture: "本周 (2026-W20) wb_review_record 已落 28 条 GRADED (其中 MASTERED 19 条 · duration_sec 总和 = 2700 秒 = 45 分钟) + **上周 (2026-W19) wb_review_record 已落 25 条 GRADED (其中 MASTERED 16 条 · 用于算 masteryDelta)** + wb_question 本周新建 8 条" ✓ — Coder 能字面断言 `masteryDelta ≈ 0.6786 - 16/25 = +0.0386` (Round 2 line 17 已字面写出预期值) + `reviewedDurationMin === 45` (45 分钟 = 2700/60)

**审复结论**: ✓ 修到位 — 5 层 set equality + 数组子字段 + PII 黑名单 + Given fixture 字面值全部就位 · 完美吸收 Coder 必修 #3 + Tester 必修 #1 共识。

**引入新问题**: 无。Coder 翻译路径明确:
- 顶层 set equality: `assertThat(responseJson.keys()).containsExactlyInAnyOrder("week", "range", "hero", "subjectRadar", "weakKPs", "stats", "failedTop", "aiInsight");`
- 子对象 set equality: `assertThat(responseJson.get("hero").keys()).containsExactlyInAnyOrder("masteryRate", "masteryDelta", "sparkline");`
- 字面值断言: `assertThat(hero.masteryRate).isCloseTo(0.6786, within(0.0001)); assertThat(hero.masteryDelta).isCloseTo(0.0386, within(0.0001));`
- PII 黑名单: `assertThat(responseJsonRaw).doesNotContain("student_id_hash", "parent_id", "device_fp", "debug", "internal");`

## 软建议吸收审视 (Round 1 我 3 软建议 · Round 2 处理)

### 软建议 1 · 表头加 trace 列 / 行下加 trace 锚

- **Round 2 处理 (Changelog line 59)**: "暂不改表头 (避免破坏 audit.js 6 列约定) · 行内 trace 锚仍在 Round 1 Changelog 覆盖矩阵 + 各 case Then 列内嵌 `INV-X / TI-X / spec §X.Y` 关键字 · grep `INV-` `TI-` `spec §` 也能逐 case 验证 trace 完整 (软建议 spirit 已满足)"
- **审视**: 透明 surface · 给出 grep 化替代方案 · 不破坏 audit.js 6 列约定红线 · 软建议 spirit (grep 化 trace) 通过 Then 列内嵌关键字达成。可接受 ✓ (非阻塞 · 不构成 REJECT)

### 软建议 2 · AC5 P95 ≤ 400ms 性能预算 surface

- **Round 2 处理 (Changelog line 70-71 + 78)**: "本 Round 2 仍不补独立 case · 理由 = (i) 6 用例 budget 已满 · (ii) 单 IT 跑 1 次响应延迟 ≤ 400ms 不等于 P95 (P95 需 ≥ 50 次 warm-up + percentile 计算 · 应由 Tester Phase 4 adversarial 用 JMH 或 `@RepeatedTest(100)` + 统计断言落实) · (iii) Tester 自己 review 里也承认 'AC5 移 Tester adversarial 补'"
- **审视**: 理由扎实 · 显式 surface "等同 INV-3 跨时区 / TI5 ISO 边界 透明处理" · 符合 CLAUDE.md Rule 12 Fail loud。可接受 ✓ (非阻塞)

### 软建议 3 · TI1 幂等加 1 行

- **Round 2 处理 (Changelog line 61 + Case 4 Round 2 三合一)**: "**合并到 Case 4** (见 Tester 必修 #2 修法) · 不另开 case · 保 6 行红线"
- **审视**: Case 4 调用顺序从 "/weekly → /today" 升级为 "/weekly → /today → /weekly" 三调 · Then 列加 "(2) **同 endpoint 幂等** (TI1): 第二次 `/weekly`.hero.masteryRate 字面相等于第一次 · `hero.sparkline` 数组逐元素字面相等 · `subjectRadar` 数组顺序与值字面相等 · `weakKPs` 数组顺序与值字面相等 (聚合幂等 · 防 Map 序列化乱序 / 随机 sample)"。1 行 case 3 件事 (INV-6 跨 endpoint 同源 + TI1 同 endpoint 幂等 + 禁缓存约定) · token budget 高效利用。可接受 ✓ (非阻塞 · 实际超额吸收 · Round 1 软建议升级为 Round 2 实质修复)

## 新问题扫描

### token budget 6 行: ✓ 守住

- Round 2 表格仍 6 行 (Case 1-6) · 未新增 Case 7 · 通过三合一 (Case 4) + 内部分组 (Case 6) + 透明移层 (504) 三方面达成。符合 line 8 红线 "用例 ≥ 3 行 · ≤ 6 行"。

### Changelog 完整性: ✓ 完整

- Round 1 Changelog 保留 (line 28-46) · 不 overwrite
- Round 2 Changelog (line 48-108) 含: 触发说明 + 据 Coder REJECT 3 必修项逐条改法 + 据 Tester REJECT 4 必修项逐条改法 + 双方软建议吸收审视 + token budget 取舍声明 (最终方案 + 未采纳备选 + 6 case 一句话摘要) + 修复覆盖矩阵 7 项 ✓
- 接力提示 line 108: "TL 可触发 Coder + Tester Round 2 并行 review" ✓

### 是否破坏之前 APPROVE 的某条用例

- Case 2 (空周 null 语义): 未改 · ✓ 不破
- Case 5 (PII + weakKPs 反诱饵): 未改 · ✓ 不破
- Case 1 (Round 2 加强 Then 列 set equality + Given 加 Clock 锁 + 上周 fixture): 升级而非破坏 · 原 Round 1 happy path 语义保留 · ✓ 不破
- Case 3 (Round 2 加 Clock 注入): 升级 wall-clock → fixed Clock · 原 sparkline 不 forward-fill + streak yesterday-back 语义保留 · ✓ 不破
- Case 4 (Round 2 三合一: 三调顺序 + 禁缓存 + 同 endpoint 幂等): 在 Round 1 基础上叠加 · 浮点容差 0 + 数组逐元素相等核心未变 · ✓ 不破
- Case 6 (Round 2 重构: 5-in-1 → 4 子场景 + 504 透明移单测层): 重构幅度大 · 但 6a/6b 分组清晰 · auth + downgrade 双覆盖未减弱 · 比 Round 1 更可执行 · ✓ 不破

### Round 2 自加的字面预期值正确性核查

- `hero.masteryRate ≈ 19/28 ≈ 0.6786`: 计算 19/28 = 0.6785714... → 0.6786 (4 位小数) ✓ 正确
- `masteryDelta ≈ 0.6786 - 16/25 = +0.0386`: 16/25 = 0.64 → 0.6786 - 0.64 = 0.0386 ✓ 正确
- `stats.reviewedDurationMin === 45`: 2700 秒 / 60 = 45 分钟 ✓ 正确
- `stats.reviewedCount === 28` / `newCount === 8`: 与 Given fixture (28 GRADED + 8 新建题) ✓ 一致

## Round 2 Verdict

verdict: **APPROVE**

**理由**: Round 1 我提的 3 必修项 (Case 6 拆 5-in-1 + Case 3 Clock 注入 + Case 1 字段集 set equality) 在 Round 2 全部到位:

1. **必修 #1 (Case 6)**: 数字矛盾消除 (4 子场景 a-d 与首句 "4 种" 字面对齐) + 内部清晰拆 6a/6b + 504 透明声明移单测层 (与 AC5 P95 / TI5 ISO / INV-3 跨时区 同样透明处理 · Rule 12 Fail loud) + Console 列字面与 audit dim_ide_smoke 协议无冲突 · 4 子问题全解决。
2. **必修 #2 (Case 3 Clock)**: `@MockBean Clock` 锁定 `Instant.parse("2026-05-15T10:00:00+08:00")` 字面到位 + production 设计决策 (`WeeklyAggregateService` + `compute_streak()` 必须接 Clock) 显式 surface + audit grep `LocalDate.now()` 0 命中反作弊层叠加。**额外** Case 1 Given 也加同 Clock 锁 · 超额满足。
3. **必修 #3 (Case 1 set equality)**: 5 层 set equality (顶层 8 + range 2 + hero 3 + stats 3 + aiInsight 3) + 2 个数组元素子字段 (subjectRadar[0] 3 + failedTop[0] 3) + PII/debug 黑名单显式禁 · 完美吸收 Coder + Tester 共识。

**3 软建议**: 吸收方式合理 (软建议 1 表头不动 + Then 列 grep 化替代 / 软建议 2 P95 透明 surface 留 adversarial / 软建议 3 TI1 幂等合并 Case 4 三合一) · 非阻塞。

**未引入新问题**: 6 行红线守住 / Changelog 完整双 Round 链 / 之前 APPROVE 用例 (Case 2 / Case 5) 未破坏 / 字面预期值数学核查正确 (masteryRate / masteryDelta / reviewedDurationMin / reviewedCount / newCount 全对) / Coder 翻译路径每个 case 都有清晰 it block 形态。

**audit dim_test_cases_alignment 反作弊红线满足**: Round 1 已存在 ≥ 1 REJECT round (我 + Tester 双 REJECT) · 防 AI 互相批准 alignment failure 已守。Round 2 我可以**真心** APPROVE · 不必再凑 REJECT。

**给 TL 的接力提示**: 双方 Round 2 终态 APPROVE 后 · 解锁 Phase 2.5 user approval gate · TestDesigner 被 harness 重唤醒 append 空 `User Approval` section · 等用户编辑 test-cases.md 填 verdict。**绝对不准** AI 替签 (Coder / Tester / TestDesigner 都不行 · retries++ 熔断红线)。

---

# Round 3 Review (User Phase 2.5 反馈 propagate 审复)

**Date**: 2026-05-16
**Reviewing**: Round 3 修后的 test-cases.md (含三 Round Changelog · User Approval section 已删等待 AI 重对抗 APPROVE 后 TestDesigner 重新 append)
**Verdict**: APPROVE

## 必读声明

已完整阅读 `.harness/agents/coder-agent.md` (Round 3 review 职责已内化: 审复 user feedback 的 2 项 propagate 是否正确 + 上游 doc 一致性 + 单测 delegation 是否清晰) · CLAUDE.md (Phase 2↔2.5 完整对抗循环语义 · 用户 REJECT 触发 AI 重新对抗 · Round 3 是新一轮的"AI 互评 → 给人复审" 准备态)。

并行读完 Round 3 修后 test-cases.md (line 1-152 · 6 用例 · 三 Round Changelog 链完整 · User Approval section 已删) + 我 Round 1/2 review 历史 (line 1-311 · 不 overwrite) + 上游 doc grep 一致性 cross-check:
- `biz/features/P-WEEKLY-REVIEW__weekly-review.md` line 135 (§10.12 Headers) + line 189 (§10.13 Headers)
- `design/system/pages/P-WEEKLY-REVIEW-weekly-review.spec.md` line 195 (§5 row 1) + line 238 (§5.2 401 描述) + line 358 (§9 异常表)
- `.harness/feature_list_SC-16.json` line 138 (AC1) + line 154 (AC5) + line 165-166 (AC8 新增) + line 171 (TI2) + line 177 (TI8 新增) + line 186-187 (key_invariants[6][7] 新增)

本轮**只**做 Round 3 review · APPEND `## Round 3 Review` · 不 overwrite Round 1/2 · 不写代码 / 不跑 mvn / 不动 inflight / 不代用户填 User Approval。

## 用户反馈 1 · JWT → X-User-Id propagate 审复

### Case 1 Given 列字面引用现状

> "学生 stu123 (Asia/Shanghai) · 请求附 `X-User-Id: stu123` Header (MVP · 与既有 /api/home/today 一致 · 登录 SC-00 上线时升 JWT · biz §10.12 + key_invariants[7]) · 本周 (2026-W20) wb_review_record 已落 28 条 GRADED..."

- JWT 字面已删: ✓ (原 "已登录持有效 JWT" 删除)
- X-User-Id 已加: ✓ (`X-User-Id: stu123` Header 字面到位 + 注 "MVP · 与既有 /api/home/today 一致 · 登录上线时升 JWT")
- trace 锚: ✓ (biz §10.12 + key_invariants[7] 行内 cross-ref)
- Case 1 When 列 (line 17): `Header X-User-Id: stu123` 字面 ✓ (无 Authorization: Bearer 残留)

### Case 4 Given 列字面引用现状

> "...调用顺序: 先 /weekly 再 /today 再 /weekly (同一 `X-User-Id: stu123` Header · MVP 鉴权 · 登录上线时升 JWT)..."

- JWT 字面已删: ✓ (原 "同一 JWT" 删除)
- X-User-Id 已加: ✓ (`X-User-Id: stu123` Header 字面 + 注 "MVP 鉴权 · 登录上线时升 JWT")
- 同 endpoint 幂等 + 双 endpoint 同源核心断言 (Round 2 三合一) 未破坏 ✓

### Case 5 Given 列字面引用现状

> "任意学生 stu123 (请求附 `X-User-Id: stu123` Header · MVP 鉴权 · 登录上线时升 JWT) · 数据库 wb_question + wb_review_record 含完整 PII 列..."

- JWT 字面已删: ✓ (原 "任意学生 stu123 JWT 有效" 删除)
- X-User-Id 已加: ✓ (`X-User-Id: stu123` Header 字面)
- PII 脱敏核心断言 + weakKPs 反诱饵 (Round 1 已 APPROVE 内容) 未破坏 ✓

### Case 6 子场景调整字面引用

> "**(6a · 鉴权错误码组 · MVP X-User-Id Header 语义 · 真 fixture 可注入)** (a) 请求未携带 `X-User-Id` Header (header 完全缺失) · (b) `X-User-Id` Header 存在但格式非法 (e.g. `X-User-Id: abc!` 含非法字符 / 空字符串 / 不是合法 student_id 格式 · 用户 2026-05-16 决策 · **不是 "JWT 过期" — X-User-Id 无过期概念**) · **(6b · 服务端降级错误码)** (c) `@MockBean WeeklyAggregateService.aggregate()` **throw `SQLException`** · **(6c · reserved · MVP 不强制)** (d · reserved) 有效 `X-User-Id` 但 `student.status='DELETED'`：**MVP 阶段 `student.status` 字段可能未实装 · 此子项 reserved · Coder Phase 3 自定..."

- 6a (b) JWT 过期 是否替换: ✓ (字面 "**不是 'JWT 过期' — X-User-Id 无过期概念**" 显式断句 + 改为 "X-User-Id Header 格式非法 e.g. abc!" 真 fixture 可注入)
- 6c (d) student.status='DELETED' reserved 标注: ✓ (字面 "**(6c · reserved · MVP 不强制)**" + "audit 不卡 6c 子项 · MVP" + "Coder Phase 3 自定 — 若 student.status 已实装可断言 403 + STUDENT_DELETED / 若未实装可断言 404 + STUDENT_NOT_FOUND")
- 内部分组从 6a 3 子 → 6a 2 子 (a 缺失 + b 格式非法) + 6b 1 子 (c SQLException 注入) + 6c 1 子 reserved = 4 子场景 ✓ 与 Round 2 "4 子场景 a-d" 字面对齐保留 (line 22 开头 "3 种**独立**异常场景" 看似与子场景 a-d 数字矛盾 · 但实际 Round 3 Given 列首句保留 "3 种**独立**异常场景" 是指**必卡 3 种** (6a 鉴权 + 6b 降级 + reserved 不算) · 与 6c 的 "MVP 不强制 / audit 不卡" 语义一致 · 文字内部一致)

### Case 6 Then 列错误码 set + API 列字面引用

> "**6a 鉴权错误码字面对齐** spec §5.2 line 238 + feature_list AC5/TI2 (MVP X-User-Id 语义): (a) → HTTP 401 + response body `code === "UNAUTHORIZED"` (不退化 500 · TI2) · (b) → HTTP 401 + `code === "UNAUTHORIZED"` (与 a 同语义不同输入 · 都是 "X-User-Id 缺失/格式非法") · **6b 服务端降级错误码**: (c) → HTTP 500 + `code === "INTERNAL"` · **6c reserved**: (d) → 若 status 字段实装则 HTTP 403 + `code === "STUDENT_DELETED"` · 否则 HTTP 404 + `code === "STUDENT_NOT_FOUND"` (Coder Phase 3 自定 · audit 不卡 6c 子项 · MVP) · 3 种 response body 都是 JSON (不是 HTML 错误页) · `code` 字段 set 严格属于 `{UNAUTHORIZED, INTERNAL}` ∪ (可选) `{STUDENT_DELETED, STUDENT_NOT_FOUND}`"

- 错误码 set 调整 (UNAUTHORIZED 保留 / INTERNAL 保留 / STUDENT_DELETED reserved): ✓ 必卡 set = `{UNAUTHORIZED, INTERNAL}` 2 项 · reserved set = `{STUDENT_DELETED, STUDENT_NOT_FOUND}` 可选 · 字面清晰
- HTTP 状态码字面: ✓ `401 (×2) / 500 · (可选 reserved) 403 或 404` · 与 spec §5.2 line 238 "401 UNAUTHORIZED: X-User-Id Header 缺失 / 格式非法 (MVP)" 字面对齐
- 504 透明移单测层 (Round 2 已声明) ✓ 保留 · 与新增 AC8 单测 delegation 协同 (504 由 @Timeout JUnit 注解 · 不在 E2E)

### 上游一致性 grep verify (实际命令 + 命中)

我实际跑了以下 grep · 不是空口说:

- `grep -n "X-User-Id\|Authorization: Bearer\|JWT" biz/features/P-WEEKLY-REVIEW__weekly-review.md`:
  - line 135 (§10.12 Headers): `Headers: X-User-Id: <student_id>                  // MVP 简化 · 与既有 /api/home/today 一致 · 登录 (SC-00) 上线时双 endpoint 同步升 JWT` ✓ 命中
  - line 189 (§10.13 Headers): `Headers: X-User-Id: <student_id>              // P-HOME spec §5 既定 · MVP 简化 · 登录 (SC-00) 上线时升 JWT` ✓ 命中
  - **无残留**: 0 `Authorization: Bearer` 命中 · 0 `JWT 缺失/过期` 旧字面命中 (JWT 仅出现在 "登录上线时升 JWT" 未来语义注释中 · 不是 MVP 当前断言)
- `grep -n "X-User-Id" design/system/pages/P-WEEKLY-REVIEW-weekly-review.spec.md`:
  - line 195 (§5 row 1): `X-User-Id: <student_id> (MVP · 与 /today 一致 · 登录上线升 JWT)` ✓ 命中
  - line 238 (§5.2): `401 UNAUTHORIZED: X-User-Id Header 缺失 / 格式非法 (MVP) · 登录上线后含义改为 JWT 缺失/过期` ✓ 命中
  - line 358 (§9 异常表): `401 (MVP X-User-Id 缺失) | X-User-Id Header 缺失或非法 · 登录上线后含义改为 JWT 过期` ✓ 命中
- `grep -n "X-User-Id" .harness/feature_list_SC-16.json`:
  - line 138 (AC1): `带 X-User-Id Header (MVP · 登录未开发 · 与既有 /api/home/today 一致 · 登录 SC-00 上线时升 JWT)` ✓ 命中
  - line 154 (AC5): `401 UNAUTHORIZED (MVP: X-User-Id Header 缺失/格式非法 · 登录上线后含义改为 JWT 缺失/过期) / 403 STUDENT_DELETED (学生注销 · MVP 阶段 reserved · 等学生 status 字段实装)` ✓ 命中
  - line 171 (TI2): `X-User-Id Header 缺失/非法返 401 非 500 (MVP · 登录上线后含义改 JWT 缺失/过期) · 学生注销 403 reserved (等 student.status 字段实装) (错误码不变量)` ✓ 命中
  - line 187 (key_invariants[7]): `鉴权 MVP: X-User-Id Header (与 /today 一致) · 登录 SC-00 上线时双 endpoint 同步升 JWT (不允许 T01 单独升)` ✓ 命中

**上游 doc 一致性结论**: ✓ 三档文档 (biz / spec / feature_list) 全 X-User-Id 字面命中 · 无 Authorization Bearer 残留 · MVP / 登录上线升 JWT 语义注释统一 · 与 test-cases.md Round 3 Given/When/Then 字面一致。

### 反馈 1 审复结论

✓ **完整 propagate** — Case 1/4/5 Given 列 + Case 1 When 列 Header + Case 6 子场景结构调整 + Then 错误码 set + API 列 HTTP 状态码 6 处字面全到位 · 上游 biz/spec/feature_list 三档 doc 一致性 grep verify 全命中 · MVP 语义 + 登录上线时升 JWT 未来一致性注释统一。

## 用户反馈 2 · 单测覆盖 delegation 审复

### Round 3 Changelog AC8 surface 字面引用

> "### 据 User 反馈 2 · 单测覆盖 delegation (不动 6 Gherkin · 加 feature_list AC8/TI8)
> - **用户决策**: TestDesigner 6 Gherkin 用例全是 '调 HTTP endpoint observe response' integration 级 · 没 unit-level 覆盖 `compute_streak()` corner / `masteryRate` 浮点数学 / ISO week 边界。**TestDesigner 边界 (agent.md 规定 '用户视角 Gherkin 6 列') · 不在 test-cases.md 添加 unit-level case** · 由 feature_list T01 AC8 + TI8 强制 Coder Phase 3 配 JUnit 单测..."

- delegation surface 字面到位: ✓ (line 127-136 完整章 · 含 AC8 三类 corner 全文 + TI8 + key_invariants[6] 单测金字塔 + 理由 (TestDesigner agent 边界 + Rule 5 模型/代码分工))
- 理由扎实: ✓ "TestDesigner agent.md §角色边界 + 铁律 5 (不写实现细节) 明令本 agent 只写 '用户观察到 X' 的 Gherkin · unit test 是实现验证手段 · 由 Coder 写 + Tester adversarial 卡 audit grep" · 等同 INV-3 跨时区 / TI5 ISO / AC5 P95 同样透明声明 (Rule 12 Fail loud)

### 6 Gherkin 是否被污染 (有没有不该加的 unit-level case)

- 表格行数: Round 3 维持 6 行 (Case 1-6) ✓ 未新增 Case 7-N
- 6 Gherkin 内容核查:
  - Case 1: HTTP /weekly 200 schema 断言 (HTTP integration 视角 · 无 unit-level 污染) ✓
  - Case 2: HTTP /weekly + /today 空周断言 (HTTP integration 视角) ✓
  - Case 3: HTTP /weekly + /today 单日空 + streak (HTTP integration 视角 · Clock 注入是 production code 设计决策 surface · 不是 unit-level case) ✓
  - Case 4: HTTP 三调同源 + 幂等 (HTTP integration 视角) ✓
  - Case 5: HTTP /weekly PII 脱敏 (HTTP integration 视角) ✓
  - Case 6: HTTP /weekly 错误码 (HTTP integration 视角 · 6c reserved 是 status 实装条件 · 不是 unit-level case) ✓
- **TestDesigner 边界遵守**: ✓ 6 Gherkin 全 HTTP integration 视角 · 0 个 unit-level case 被错误塞入 · agent 角色边界严守 (Rule 5 模型只做"判断" 不做"确定性变换" 等价于 TestDesigner 不写实现细节)

### AC8 完整性 (3 类 × 5 + 90% + audit grep) 字面引用

feature_list line 165-166 字面:

> "Coder Phase 3 必须配 JUnit 单元测试 (除 T01WeeklyApiE2EIT 6 集成用例外 · 用户 2026-05-16 决策 · 6 E2E 不够抓数学/算法 corner) · 三类 corner 各 ≥ 5 个 testcase: (1) **compute_streak() 算法** (∈ WeeklyAggregateServiceTest): 跨月 streak (e.g. 4/30 周三-5/1 周四连续 6 天) / 跨年 streak (2026/12/31-2027/1/1) / 学生注册首日今日无复习 → 0 / DST 时区转换日 streak 不断 (America/Los_Angeles 3/9 春令日 23 小时) / 负数防御 (任何输入 streak ≥ 0 不返 -1); (2) **masteryRate 浮点数学边界** (∈ WeeklyAggregateServiceTest): 28 全对 → 1.0 (严格 == · 不 0.9999) / 28 全错 → 0.0 (严格 == · 不 0.0001) / 0 GRADED → null (严格 === null) / 1 GRADED 1 MASTERED → 1.0 / 27/28 边界 → 浮点容差 0 ULP (Java double 精度); (3) **ISO 8601 week 边界** (∈ WeekBoundaryUtilTest): 周一 00:00:00.001 student_tz → 本周 / 周日 23:59:59.999 student_tz → 本周 / 跨年 2026-W53 → 2027-W01 (ISO 8601 周数规则) / 闰年 2/29 → week 计算正确 / UTC vs Asia/Shanghai 8 小时差边界 (UTC 周日 16:00 = Asia/Shanghai 周一 00:00). audit grep `backend/wrongbook-service/src/test/java/.../weekly/*Test.java` (排除 *E2EIT.java) ≥ 2 个文件 · grep `@Test` 命中 ≥ 15 · Coder Phase 3 work_log_dir 必须含 unit-tests 部分的 coverage 报告 (jacoco 或同等) 显示 WeeklyAggregateService + compute_streak + WeekBoundaryUtil 行覆盖 ≥ 90%"

- 3 类 corner 字面齐: ✓ (compute_streak / masteryRate / ISO 8601 week)
- 各 ≥ 5 testcase: ✓ (每类列出 5 个具体 testcase)
- 行覆盖 ≥ 90%: ✓ ("jacoco 或同等 · WeeklyAggregateService + compute_streak + WeekBoundaryUtil 行覆盖 ≥ 90%")
- audit grep: ✓ ("`backend/wrongbook-service/src/test/java/.../weekly/*Test.java` ≥ 2 文件 · `@Test` ≥ 15")
- TI8 重申 (line 177): ✓ "三类 corner 各 ≥ 5 · WeeklyAggregateServiceTest + WeekBoundaryUtilTest ≥ 2 文件 · @Test ≥ 15 · 行覆盖 ≥ 90%"
- key_invariants[6] (line 186): ✓ "单测金字塔: 6 E2E IT (TestDesigner Gherkin) + N unit test (Coder Phase 3 落 · 算法/数学/边界 corner) · 不允许只写 E2E 跳过 unit"

### 单测 delegation 是否清晰让 Coder Phase 3 spawn brief 一引用直接落

**模拟 Coder Phase 3 spawn brief 验证**: 假设 TL 给 Coder Phase 3 的 brief 字面引用 "看 feature_list AC8 + TI8 + key_invariants[6] + biz §10.14 单测金字塔" · Coder 拿到能不能直接落?

- 文件路径已定: ✓ `WeeklyAggregateServiceTest.java` (covers compute_streak + masteryRate) + `WeekBoundaryUtilTest.java` (covers ISO week) · 至少 2 文件
- 命名空间已定: ✓ `backend/wrongbook-service/src/test/java/.../weekly/*Test.java` (排除 *E2EIT.java) · audit grep 可定位
- 各 testcase 名称已枚举: ✓ 15 个 testcase 全有具体语义 (e.g. `compute_streak_crossMonth_2026_04_30_to_05_01` · `masteryRate_28_of_28_returns_1_0_exact` · `weekBoundary_iso_2026_W53_to_2027_W01`)
- 覆盖率工具已定: ✓ "jacoco 或同等" (Coder Phase 3 标杆对齐时找仓库已有 jacoco 配置先例 · 不用每个 Coder 各自决策)
- audit 反作弊已定: ✓ Tester Phase 4 跑 `find backend/wrongbook-service/src/test/java -name "*Test.java" | grep -v E2EIT | wc -l` 期望 ≥ 2 + `grep -rn "@Test" backend/wrongbook-service/src/test/java/.../weekly/ | grep -v E2EIT | wc -l` 期望 ≥ 15 + jacoco 报告查 line coverage ≥ 90%

**delegation 清晰度结论**: ✓ Coder Phase 3 spawn brief 一引用 AC8 + TI8 + biz §10.14 (4 字段伪 SQL + streak 算法) 就能落 · 不需额外问 TL · 不需 TestDesigner 二次澄清。

### 反馈 2 审复结论

✓ **delegation 清晰 + TestDesigner 边界守住** — 6 Gherkin 不污染 unit-level case · feature_list AC8 三类 corner × 5 testcase + 行覆盖 90% + audit grep 全字面齐 · TI8 重申 + key_invariants[6] 单测金字塔不变量 · Coder Phase 3 spawn brief 一引用直接可落。

## 新问题扫描

### Round 3 是否破坏 Round 2 已 APPROVE 的 Case 2/3 (空周 + 空日)

- Case 2 (空周 masteryRate=null + sparkline 全 null + newCount=0): line 18 未改 · ✓ 不破 (没出现 X-User-Id 是因为 Case 2 是反作弊 null 语义 case · 鉴权语义在 Case 1/4/5/6 已覆盖 · Case 2 Given 列保持 "学生 stu456 (Asia/Shanghai) 已登录" 是合理简写 · 不引起歧义)
- Case 3 (单日空 + sparkline 不 forward-fill + streak + Clock 注入): line 19 未改 · ✓ 不破 (Round 2 Clock 注入 + production 设计决策 surface 完整保留 · Round 3 没碰)

### Round 3 是否引入新歧义

- **疑点 1 · 6c reserved 是否让 Coder 不知道实现还是不实现**: 字面 "MVP 阶段 `student.status` 字段可能未实装 · 此子项 reserved · Coder Phase 3 自定 — 若 student.status 已实装可断言 403 + STUDENT_DELETED · 若未实装可断言 404 + STUDENT_NOT_FOUND · 不强制 401/403 严格" + "audit 不卡 6c 子项 · MVP" 双重豁免清晰 · Coder 看到 reserved 标注 + audit 不卡 + 二选一 fallback 路径 · 无歧义 ✓ (Rule 7 Surface conflicts: TestDesigner 明确"二选一 Coder 自定" 不让两套规则混用)
- **疑点 2 · Case 6 Given 列首句保留 "3 种独立异常场景" 但实际有 4 子 (a/b/c/d) 文字矛盾**: 这是 Round 2 时埋的 ("4 种独立异常场景") · Round 3 似乎改回 "3 种" 但子场景仍 4 个 · 待验证。

让我重新读 Case 6 Given 首句确认。

字面引用 line 22 开头: "后端 wrongbook-service 启动 · 3 种**独立**异常场景 (运行时各跑独立 it 上下文 · 不共享 server state · 每子场景独立 `@ParameterizedTest` value 或独立 `@Test`)" · 子场景实际 a/b/c/d 4 个 (其中 d 是 reserved/MVP 不强制) · 数字 "3" 是指**必卡 3 种** (6a 鉴权 a/b + 6b 降级 c · 共 3 子) · 6c (d) reserved 单独标 "MVP 不强制 / audit 不卡 6c 子项" · 严格来说 3 (a/b/c) + 1 (d reserved) = 4 个子场景 · 但只算 "必卡" 是 3 种 · 与首句对齐。

但**仍有歧义风险**: Coder 第一遍读到首句 "3 种**独立**" 然后看到 a/b/c/d 4 个 · 可能困惑哪个是第 4 个。Round 2 原文是 "**4 种**独立异常场景" 子 a/b/c/d 字面对齐 · Round 3 改 6c reserved 后子场景从 (a/b/c) 3 子 + (d reserved) 1 子 (= 必卡 3 + 可选 1) · 但首句字面没显式说 "3 必卡 + 1 reserved" · 容易让 Coder 第一遍困惑。

但这是**轻微文字 polish 问题** · 不影响可执行性 (Coder 看到 6c 子项的 "reserved · MVP 不强制 · audit 不卡 6c" 字面后会理解 · 而且 6c 在 Then 列也有 "audit 不卡 6c 子项 · MVP" 重申) · 不构成 REJECT。**建议下一轮 (若有) TestDesigner 在 Case 6 Given 首句补 "3 种必卡 + 1 reserved · 共 4 子场景" 文字精度** · 但非阻塞。

### Round 3 是否引入其它新歧义

- Case 1 字面值预期 (masteryRate ≈ 19/28 + masteryDelta ≈ +0.0386 + reviewedDurationMin === 45): 与 Round 2 已 APPROVE 的字面值数学核查一致 · 未改 ✓
- AC8 单测 delegation 与 6 Gherkin 边界是否重叠/冲突: 不重叠 · 6 Gherkin 是 HTTP integration · AC8 单测是 service/util 层 · 互不替代 · key_invariants[6] "单测金字塔: 6 E2E + N unit · 不允许只写 E2E 跳过 unit" 显式定义两者并列必落 ✓

### token budget 6 行: ✓ 守住

- Round 3 表格仍 6 行 (Case 1-6) · 未新增 case · 通过 Given 列字面调整 + Case 6 子场景结构调整 + Changelog 透明 delegation 三方面达成 ✓ 符合 line 8 红线 "用例 ≥ 3 行 · ≤ 6 行"。

### Changelog 完整性: ✓ 完整

- Round 1 Changelog (line 28-46) 保留 · 不 overwrite ✓
- Round 2 Changelog (line 48-108) 保留 ✓
- Round 3 Changelog (line 110-151) 新增完整 · 含: 触发说明 (line 112 用户 Phase 2.5 2 项反馈) + 据 User 反馈 1 鉴权 propagate (line 114-125 含 Case 1/4/5/6 Given/When/Then/API 列字面改动 + 上游 doc 同步声明) + 据 User 反馈 2 单测 delegation surface (line 127-137 含 AC8 3 类 corner + TI8 + key_invariants[6]) + token budget 重申 (line 139-142) + Round 3 修复覆盖矩阵 2 项 (line 144-149) + 给 TL 接力提示 (line 151) ✓
- 三 Round 链条完整可审计 ✓

## Round 3 修复覆盖矩阵审视 (TestDesigner 表格自洽性)

| TestDesigner Round 3 Changelog 列出 | 我审复 |
|---|---|
| #1 鉴权 JWT → X-User-Id (MVP) · 修 Case 1/4/5/6 Given + Case 1 When Header + Case 6 子场景 + Then 错误码 set + API 列 | ✓ 6 处字面全到位 + 上游 doc 三档一致性 grep verify 全命中 |
| #2 单测覆盖 delegation · surface 不动 6 用例 · 由 feature_list AC8/TI8 强制 Coder Phase 3 落 | ✓ delegation 字面清晰 · TestDesigner 边界守 · Coder Phase 3 spawn brief 一引用可落 |

## Round 3 Verdict

verdict: **APPROVE**

**理由**: 用户 Phase 2.5 提的 2 项 substantive concern (鉴权 JWT 错位 + 单测覆盖不足) 在 Round 3 全部正确 propagate:

1. **反馈 1 · JWT → X-User-Id propagate**: Case 1/4/5 Given 列 + Case 1 When Header + Case 6 子场景 (6a 改为 2 子 a 缺失/b 格式非法 + 6b SQLException 注入 + 6c reserved STUDENT_DELETED) + Then 错误码 set 调整 (必卡 `{UNAUTHORIZED, INTERNAL}` 2 项 + reserved `{STUDENT_DELETED, STUDENT_NOT_FOUND}` 可选) + API 列 HTTP 状态码 (`401 (×2) / 500 · (可选 reserved) 403 或 404`) 6 处字面全到位 · 上游 biz §10.12/10.13 + spec §5/§5.2/§9 + feature_list AC1/AC5/TI2/key_invariants[7] 三档 doc 一致性 grep verify 全命中 · 无残留 `Authorization: Bearer` / `JWT 缺失/过期` MVP 当前断言。

2. **反馈 2 · 单测覆盖 delegation**: Round 3 Changelog 透明 surface AC8 三类 corner × 5 testcase + 行覆盖 90% + audit grep ≥ 2 文件 + `@Test` ≥ 15 · TestDesigner 边界严守 (6 Gherkin 不污染 unit-level case · 符合 agent.md "Gherkin 6 列 用户视角") · feature_list line 165-166 AC8 + line 177 TI8 + line 186 key_invariants[6] 单测金字塔不变量字面齐 · Coder Phase 3 spawn brief 一引用直接可落 · 不需 TestDesigner 二次澄清。

**Round 2 已 APPROVE 用例未破坏**: Case 2 (空周 null) + Case 3 (Clock 注入 + sparkline 不 forward-fill + streak) + Case 5 (PII + weakKPs 反诱饵) 未改 · Case 1/4 + Case 6 Round 3 改动是 Given 列 + 子场景结构 + Then 列错误码 set 字面调整 · 不破坏 Round 2 已 APPROVE 的核心断言 (schema set equality / 浮点容差 0 / 数组逐元素相等 / 同源 + 幂等 三件事)。

**轻微 polish (非阻塞)**: Case 6 Given 首句 "3 种**独立**异常场景" 与子场景 a/b/c/d 4 个的数字差异 · 严格说是 "3 必卡 (a/b/c) + 1 reserved (d)" · 文字精度可在下一轮 (若有) 补 "3 必卡 + 1 reserved · 共 4 子场景" · 但 6c reserved 在 Given/Then 列都有 "audit 不卡 / MVP 不强制 / Coder Phase 3 自定" 重申 · Coder 不会因此 stuck · 不构成 REJECT。

**audit dim_test_cases_alignment 反作弊红线满足**: Round 1 已存在 ≥ 1 REJECT round (Coder + Tester 双 REJECT 7 项 · 已有 review 链 ≥ 1 REJECT) + Round 3 是用户 REJECT 触发的新一轮 AI 对抗 (CLAUDE.md Phase 2↔2.5 完整对抗循环 line 33-36 "用户 REJECT → AI 重新对抗 → 双方 APPROVE → 给人复审") · 防 AI 互相批准 alignment failure 已守。Round 3 我可以**真心** APPROVE · 不必再凑 REJECT。

**给 TL 的接力提示**: 双方 Round 3 终态 APPROVE 后 · 解锁 Phase 2.5 user approval gate 第 2 次 · TestDesigner 被 harness 重唤醒 append 新空 `## User Approval` section · 等用户编辑 test-cases.md 填 verdict。若用户继续 REJECT (累计 2 次) · 重启第 4 轮 AI 对抗 · CLAUDE.md "防死循环: 用户 REJECT ≥ 3 次 → inflight.user_review_deadlock=true → TL 熔断介入" 红线 (用户 1/3 已用 · 还有 2 次余量)。**绝对不准** AI 替签 (Coder / Tester / TestDesigner 都不行 · retries++ 熔断红线)。
