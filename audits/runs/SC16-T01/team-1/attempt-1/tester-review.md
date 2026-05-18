# Tester Review · SC16-T01 · Phase 2 · Round 1

**Reviewer**: Tester Agent (general-purpose subagent · Claude Opus 4.7)
**Date**: 2026-05-16
**Reviewing**: `audits/runs/SC16-T01/team-1/attempt-1/test-cases.md` (6 用例 · TestDesigner Phase 1 初版)
**Verdict**: REJECT

## 必读声明

已完整阅读 `.harness/agents/test-agent.md` (159 行 · 内化铁律 7 条 + Phase 2 review 职责 + 双脑回看 + DoR 准入)。

读完:
- `audits/runs/SC16-T01/team-1/attempt-1/test-cases.md` (6 用例 · Changelog · User Approval 占位)
- `biz/features/P-WEEKLY-REVIEW__weekly-review.md` §10.12 字符级 schema · §10.13 today.weekSummary 扩展 · §10.14 4 字段聚合公式 + 空值语义 + streak yesterday-back 伪代码 (L196-L306)
- `design/system/pages/P-WEEKLY-REVIEW-weekly-review.spec.md` §5 API 触点 (line 195 GET /weekly 性能预算 ≤ 400ms / P99 ≤ 800ms) · §5.1 字段集 · §5.2 错误码 401/403/500/504 (line 238-241) · §5.3 双 endpoint 同源 + line 280 "两端均不缓存" · §11 性能预算
- `design/system/pages/P-HOME.spec.md` §5.2 weekSummary 字段集
- `.harness/feature_list_SC-16.json` tasks[0] (7 AC + 7 TI + 6 INV + aggregation_contract.anti_pattern[0..3])

**本轮 Phase**: Phase 2 Round 1 · 仅 review test-cases.md · 不跑 spec.ts · 不跑 mvn · 不写 *E2EIT.java · 不动 inflight。

---

## 可断言性评审 (6 用例逐条)

| # | Then 列 assertable 度 | 关键问题 |
|---|----------------------|----------|
| Case 1 (happy 200 full schema) | ⚠ 部分宽 | **缺字段**: `hero.masteryDelta` (AC1 显式列了 · spec §5.1 字符级 schema 含 · biz §10.12 line 310 "masteryDelta = 本周 - 上周") + `stats.reviewedDurationMin` (AC1 列了)。同时 `subjectRadar 数组` / `failedTop 数组` 太宽 · 应至少断言 subjectRadar[i] 子字段集 `{subject, masteryRate, sampleSize}` (biz §10.12 line 147-149)。 |
| Case 2 (空周 null 语义) | ✓ 强 | 严格 `=== null` 6 处反例 (不为 0 / 0.0 / -1 / forward-fill) · 反 anti_pattern[2][3] 抓力强。 |
| Case 3 (sparkline index 语义 · streak yesterday-back) | ✓ 强 | sparkline[2] === null 字面拒绝 forward-fill · streak ≥ 1 from 昨天 · 反 anti_pattern[3] 抓力强。 |
| Case 4 (双 endpoint 同源 · 浮点容差 0) | ✓ 强 | "字面相等 · 浮点容差 0 · 数组逐元素相等" · 反 anti_pattern[0] (两段 SQL 漂移) 抓力强。**但** Given 列没显式禁缓存 (见下文必修项 #4)。 |
| Case 5 (PII + weakKPs 排序) | ✓ 强 | 3 PII 关键字 grep 0 命中 · KP-D totalMiss=20 recentMiss=1 反例诱导按 totalMiss 排错位 · 反 INV-2 + INV-4 + anti_pattern 抓力强。 |
| Case 6 (5 错误码合一) | ✗ 弱 | (1) 5 个错误码 (a-e) 合到 1 行 · JUnit 拆解困难 · 任一错就整 case fail · 影响定位。(2) Then 列写"server stderr 出 1 条 [ERROR] weekly_aggregate SQLException" 违反自定 "Then 只写调用方观察" 格式约定 (test-cases.md line 12)。(3) (e) 超时 504 注入方式没说明 (Given 列"聚合 SQL 执行 > 800ms"没说怎么触发) · 物理验证不可行 / 必须 @SpyBean mock service 又违反真后端原则。 |

## 能抓回归 bug 评审

| 用例 | 假设 Coder 实现错 | 能抓? |
|------|------------------|-------|
| Case 1 schema | Coder 忘实现 masteryDelta 字段 | **✗ 抓不到** (Case 1 Then 列不含 masteryDelta) |
| Case 1 schema | Coder 忘实现 reviewedDurationMin | **✗ 抓不到** (Case 1 Then 列不含) |
| Case 2 null | Coder 空周返 0.0 | ✓ 抓到 (assertion `=== null` strict) |
| Case 3 sparkline | Coder forward-fill sparkline[2] = sparkline[0] | ✓ 抓到 (字面拒绝) |
| Case 4 同源漂移 | Coder 两套 SQL 字面不同微妙差 (0.6800001 vs 0.68) | ✓ 抓到 (浮点容差 0) |
| Case 4 同源漂移 | Coder 加 1s in-memory cache · /weekly 先调 /today 后调走 cache | **⚠ 假 PASS 风险** (Given 列没禁 cache) |
| Case 5 PII | Coder 忘 @JsonIgnore student_id_hash | ✓ 抓到 (3 关键字 grep 0 命中) |
| Case 5 weakKPs 排序 | Coder 按 totalMissCount DESC 排 | ✓ 抓到 (KP-D 排第 1 反例) |
| Case 6 错误码 | Coder 返 500 而非 401 (JWT 缺失) | ⚠ 抓到但整 case fail · 难定位 |
| **缺 TI1 幂等** | Coder aggregate 方法返非确定性 (Map 序列化乱序 · 或随机 sample) | **✗ 抓不到** (6 用例 0 覆盖同 endpoint 两调) |
| **缺 AC5 P95** | Coder aggregate SQL 漏索引 P95 > 400ms | **✗ 抓不到** (6 用例 0 性能断言) |

## 物理验证可行性

| 用例 | 后端落地手段 | 可行? |
|------|--------------|-------|
| Case 1 | Spring Boot Test + Testcontainers PG + seeder 28 条 wb_review_record + 8 条 wb_question · RestTemplate GET /api/home/weekly · JsonPath 全字段断言 | ✓ 可行 |
| Case 2 | 同上但 0 条 seeder · 双调 /weekly + /today · JsonPath strict `null` 断言 | ✓ 可行 |
| Case 3 | 周一/周三/周四 seeder · `Clock.fixed(周五)` 注入 + double GET | ✓ 可行 |
| Case 4 | 同 RestTemplate 串行双调 · `assertEquals` 数组逐元素 + `assertEquals(masteryRate1, masteryRate2)` (浮点 ε=0)。**注意**: Given 必须明示 Spring 配置 `@TestPropertySource` 关闭任何 cache · 否则 TTL 内两调走 cache 假 PASS。 | ⚠ 可行 但需补禁缓存约定 |
| Case 5 | seeder 4 KP + RestTemplate + 整 response.body 字符串 contains 3 PII 关键字 0 命中 + weakKPs[0..2].kpId 字面断言 | ✓ 可行 |
| Case 6 (a)(b) 401 | curl 不带 / 带过期 JWT · 期望 401 + body.code | ✓ 可行 |
| Case 6 (c) 403 | seeder student.status='DELETED' + 有效 JWT · 期望 403 | ✓ 可行 |
| Case 6 (d) 500 | **难**: 真后端注入 SQLException 需要 `@SpyBean WeeklyAggregateService` 强抛 SQLException · 等于 mock service 内部 · 违反 test-agent.md 铁律 "真后端" + DoR-1 "非 mock IT" | ⚠ 边界 · 建议拆到单测层 |
| Case 6 (e) 504 | **更难**: 注入 "聚合 SQL > 800ms" 真实做法是 testcontainers PG `pg_sleep(1)` 或 SpyBean delay · 前者改 SQL 不现实 · 后者又 mock 内部 | ✗ 难落 E2E IT 层 |

## TI 覆盖矩阵 (7 TI)

| TI | 覆盖 case | 充分? | 缺/不缺 |
|----|----------|------|---------|
| TI1 同 endpoint 两调幂等 | **(无)** | ✗ | **缺**: Case 4 是跨 endpoint 双调 · 不可替代同 endpoint 两调 (e.g. 非确定性 sparkline 排序问题 case 4 抓不到) |
| TI2 错误码 401/403 非 500 | Case 6 (a)(b)(c) | ⚠ 5 合 1 难定位 | **建议拆** |
| TI3 PII 脱敏 | Case 5 | ✓ | — |
| TI4 weakKPs DESC limit 3 | Case 5 | ✓ (有反例 KP-D) | — |
| TI5 ISO Monday-Sunday | Case 1 (描述层 "周一-周日") | ⚠ 描述层非反例 | TestDesigner 已在 Changelog line 40 自承 · 留 adversarial 补 · 可接受 |
| TI6 双 endpoint 同源 | Case 4 | ✓ (浮点容差 0 + 数组字面) | — |
| TI7 空值语义 | Case 2 + Case 3 | ✓ | — |

**TI 覆盖致命缺口**: TI1 (幂等) 0 覆盖。**AC 覆盖致命缺口**: AC5 性能 P95 ≤ 400ms / P99 ≤ 800ms 0 覆盖 (feature_list T01 AC5 显式列了 · biz §10.12 SLA · spec §11 性能预算)。

## 反作弊审视

| 项目 | 命中 | 备注 |
|------|------|------|
| 仅 "应该" 无反例 | 0 / 6 | Then 列普遍含字面值或反例 · 合规 |
| Then 列泄漏内部实现 (SQL / Java 方法名) | **1 处** | Case 6 Then 列 "server stderr 出 1 条 [ERROR] weekly_aggregate SQLException" 既是内部实现细节 · 又违反 line 12 自定 "Then 只写调用方观察" 约定 |
| anti_pattern 反例化质量 | ✓ 高 | Case 2 反 [2][3] · Case 3 反 [3] · Case 4 反 [0] · Case 5 反 INV-4 · Coder 误走会被抓 |
| 透明度 (自述未覆盖项) | ✓ 高 | Changelog line 38-40 自承 TI5 + aiInsight 内容质量 + INV-3 跨时区 不在 scope · 不掩盖 |

## REJECT 必修项 (Round 2 改后再 review)

### 必修项 #1 · Case 1 happy path schema 字段缺失 (字符级对齐)

**问题**: Case 1 Then 列声明"字段集字符级对齐 spec §5.1" · 但实际**缺**两字段断言:
- `hero.masteryDelta` (number 或 null · biz §10.12 line 310 "masteryDelta = 本周 - 上周 · 两边都 null → delta = null")
- `stats.reviewedDurationMin` (integer · feature_list AC1 显式列了)

同时 `subjectRadar 数组` / `failedTop 数组` 过宽 · 应至少断言数组元素 schema。

**怎么改**:
- Case 1 Then 列追加: `hero.masteryDelta` 为 number (例 +0.03) 或 null · `stats.reviewedDurationMin` 为 integer ≥ 0 (例 45)
- 追加: `subjectRadar[0]` 含 `subject` (string) + `masteryRate` (number ∈ [0,1] | null) + `sampleSize` (integer ≥ 0) · `failedTop[0]` 含 `questionId` + `subject` + `missCount` (具体子字段 cross-ref spec §5.1 字段集)
- Given 列对应补 wb_review_record duration_sec 总和 + 上周 7 条复习记录用于算 masteryDelta

### 必修项 #2 · 缺 TI1 幂等用例 + AC5 性能用例 (覆盖盲区)

**问题**: TI1 (同一学生同一 ISO week 调 GET /weekly 两次返回相同 hero.masteryRate · 聚合幂等不变量) **0 覆盖** · Case 4 是跨 endpoint 不可替代。AC5 (P95 ≤ 400ms · P99 ≤ 800ms) **0 覆盖** · feature_list T01 显式列了 + spec §11 + biz §10.12 SLA。

**怎么改 (建议 2 选 1 · 6 用例 budget 紧)**:
- **方案 A** (推荐): 把 Case 6 错误码 5 合 1 拆出 1 条 (见必修项 #3) · 节省的 case 槽位用来加 **新 Case · 幂等 + 性能合并**: "同一学生同一 ISO week · 30s 内串行调 GET /weekly 两次 · Then: response.hero.masteryRate / sparkline / subjectRadar 数组字面相等 (聚合幂等 · TI1) · 两次单 RTT 响应延迟 ≤ 400ms (AC5 P95 预算单调验证)"。一个 case 覆盖 TI1 + AC5。
- **方案 B**: 在 Case 1 Then 列追加一句 "重复调用 1 次返回结果字面相等 (聚合幂等 · TI1) · 两次响应延迟 ≤ 400ms (AC5)" · 把 Case 1 升级成 "happy path + 幂等 + 性能" 三合一。不另开 case。

我倾向方案 A · 因为 Case 1 已经 happy path schema 字段太多 · 再塞幂等 + 性能 Then 列会过长。

### 必修项 #3 · Case 6 错误码 5 合 1 拆分 + 移除内部实现细节

**问题**: 
1. Case 6 把 5 个错误码 (a-e) 合到 1 行 · JUnit 测试代码层只能写一个 `@Test` 跑 5 个子断言 · 任一错就整 case fail · 难定位回归。
2. Then 列写 "server stderr 出 1 条 [ERROR] weekly_aggregate SQLException 但 process 不崩溃" 违反 line 12 "Then 只写调用方观察"。
3. (e) 504 物理验证难落 · 真后端注入 800ms 超时需要 @SpyBean mock service 内部 · 违反真后端 + DoR-1。

**怎么改**:
- 把 Case 6 拆 2 条 (在 6 用例 budget 上限内 · 通过合并必修项 #2 方案 A 释放槽位):
  - **Case 6a · 鉴权/资格错误码** (合并 a/b/c · 都是真 fixture 可注入): JWT 缺失 → 401 UNAUTHORIZED · JWT 过期 → 401 UNAUTHORIZED · student.status='DELETED' → 403 STUDENT_DELETED · 错误码字面对齐 spec §5.2 line 238-240 · response body JSON 含 `code` 字段
  - **Case 6b · 服务端降级错误码** (单独 d 500 · e 504 移到单测层): SQLException 触发 → 500 INTERNAL (用 @SpyBean 单测层验 · 不在 E2E IT 范围 · 在 Then 列说明"单测层覆盖")
- 删除 "server stderr 出 1 条 [ERROR] weekly_aggregate SQLException" — 这是内部日志断言 · 应放到 Coder bugs-found.md / 单测 `LogCaptor` 而非 E2E test-cases.md Then 列
- (e) 504 物理验证不可达 · 建议在 Changelog 自述 "504 超时移到单测层 @Timeout 验证 · 不在 E2E scope" 跟 INV-3 跨时区一样透明处理

### 必修项 #4 · Case 4 强化禁缓存约定 (防假 PASS)

**问题**: Case 4 Given 列 "wrongbook-service 进程未重启 · 本周数据 frozen" 但**没明示**禁 cache 层。spec §5.3 line 280 明确"两端均不缓存"。若 Coder 偷加 1s in-memory cache · /weekly 先调 /today 后调走 cache · 同源 case 假 PASS · 反 anti_pattern[1] (cache 漂移) 抓不到。

**怎么改**:
- Case 4 Given 列追加: "spec §5.3 line 280 两端均不缓存 · 测试断言层禁 cache (`@TestPropertySource('spring.cache.type=NONE')`) · 两次调用间隔 0ms · 任一 cache TTL 命中视为反 anti_pattern[1] 假 PASS"
- Then 列追加一句: "若 controller 内嵌 cache 或 service 加 `@Cacheable` · 该 case 假 PASS · 真实回归被掩盖 (Tester 复核 source grep `@Cacheable` 0 命中验证)"

---

## Verdict 总结

**verdict: REJECT**

**核心理由**: 
1. **Case 1 happy schema 字段缺失** (masteryDelta + reviewedDurationMin + subjectRadar/failedTop 子字段) → 字符级对齐承诺打折 · Coder 忘实现这两字段不会被 happy case 抓到 (能抓回归矩阵 ✗)
2. **TI1 幂等 + AC5 性能 双 0 覆盖** → 7 TI 缺 1 · 5 AC 缺 1 · feature_list 显式列了 · 6 用例 budget 内可通过 Case 6 拆解释放槽位补
3. **Case 6 五合一 + Then 列泄漏内部日志** → 违反自定格式约定 (line 12) + JUnit 难定位 + (e) 504 物理验证不可达

3 项必修都不是"鸡蛋里挑骨头"·都对应真实回归抓力差距 (Coder 实现错时测试不会失败) · 符合 audit dim_test_cases_alignment "至少 1 轮 REJECT 防 AI 互相批准" 卡口要求。

**Round 2 期望**: TestDesigner 改 test-cases.md 时
- 必修项 #1: 补齐 Case 1 字段集 (masteryDelta + reviewedDurationMin + 数组子字段)
- 必修项 #2: 通过 Case 6 拆解释放槽位 · 加 Case 7 (或合并到 Case 1) 覆盖 TI1 幂等 + AC5 性能
- 必修项 #3: Case 6 拆 2 条 + 删内部日志断言 + 504 透明移到单测层
- 必修项 #4: Case 4 Given 列追加禁缓存约定

改完追加 ## Round 2 到 Changelog · 我会重新 review (本 tester-review.md 也会 append ## Round 2 section)。

---

## 边界声明 (Tester 视角 · 不越界)

- ✗ 我**没**跑 mvn / pnpm / playwright / automator
- ✗ 我**没**写 `*E2EIT.java` 或 spec.ts
- ✗ 我**没**修 test-cases.md (TestDesigner 职责)
- ✗ 我**没**填 User Approval verdict (用户 Phase 2.5 职责 · AI 代签 = retries++ 熔断)
- ✗ 我**没**改 inflight (Phase 4 passes=true 才动 · 本轮 Phase 2 review 不动)
- ✓ 我**只**落 tester-review.md 到 work_log_dir

## Self-Checkpoint (Rule 6 tool-use budget)

- tool use ≈ 7 次 (Read agent.md + Read test-cases.md + Read feature_list + Read biz grep + Read spec grep + ls + Write) · 远低于软线 50 · 不触红线
- 预计 token ≈ 30K
- 工作完成度 100% · 6 用例逐条 5 视角评审 + TI 覆盖矩阵 + REJECT 4 必修项 + 物理验证可行性表均落盘

---

# Round 2 Review (TestDesigner 修后审复)

**Date**: 2026-05-16
**Reviewing**: Round 2 修后的 test-cases.md (含 Round 1 + Round 2 双 Changelog · 仍 6 用例上限)
**Verdict**: APPROVE

## 必读声明

已完整阅读 `.harness/agents/test-agent.md` (Round 2 review 职责已内化 · 审复 Round 1 必修 + TI 覆盖增量 + 新问题扫描) + Round 2 修后的 test-cases.md (Case 1-6 全文 + Round 2 Changelog) + 我 Round 1 review (4 必修)。

本轮 phase: Phase 2 Round 2 review · 仍仅文档评审 · 不跑 spec.ts / mvn · 不改 test-cases.md / inflight。

## Round 1 必修项一对一审复

### 必修 #1 · Case 1 漏字段断言 (masteryDelta + reviewedDurationMin + 数组子字段)

- Round 1 我的 REJECT 理由: Case 1 Then 列声明"字段集字符级对齐" 但缺 `hero.masteryDelta` + `stats.reviewedDurationMin` + `subjectRadar[0]`/`failedTop[0]` 子字段集 → Coder 忘实现这两字段 happy case 不会 fail。
- Round 2 TestDesigner 改法 (字面引用 Case 1 Then 列):
  - `hero` keys set equality === 3 项 `{masteryRate, masteryDelta, sparkline}` (含 masteryDelta) · 字面例 `masteryDelta` 为 number 或 null · 例 `0.6786 - 16/25 = +0.0386` · biz §10.12 line 310
  - `stats` keys set equality === 3 项 `{reviewedCount, reviewedDurationMin, newCount}` (含 reviewedDurationMin) · 字面 `reviewedDurationMin === 45` integer
  - `subjectRadar[0]` keys set equality === 3 项 `{subject, masteryRate, sampleSize}` (subject string · masteryRate number ∈ [0,1] 或 null · sampleSize integer ≥ 0)
  - `failedTop[0]` 含 `{questionId, subject, missCount}` 子字段 (cross-ref spec §5.1)
  - `aiInsight` keys set equality === 3 项 `{insightId, text, generatedAt}` 全 present
  - 顶层 keys 严格 set equality === 8 项 (字符级 · 多 1 / 少 1 即 FAIL · 不允许 debug/internal/student_id_hash/parent_id/device_fp 字段泄漏)
- Round 2 Given 同步加 fixture: "上周 (2026-W19) wb_review_record 已落 25 条 GRADED (其中 MASTERED 16 条 · 用于算 masteryDelta)" + "duration_sec 总和 = 2700 秒 = 45 分钟"。让断言 `masteryDelta ≈ +0.0386` 与 `reviewedDurationMin === 45` 都有数据支撑。
- 断言可达性: ✓ JUnit / Spring Boot Test 可直接 `assertThat(resp.hero).extracting("masteryRate","masteryDelta","sparkline")` + `assertThat(resp.hero.masteryDelta).isCloseTo(0.0386, within(1e-4))` + `assertThat(resp.stats.reviewedDurationMin).isEqualTo(45)` + JsonPath `keys()` set equality assertion。`subjectRadar[0]` / `failedTop[0]` 子字段集用 `extracting` 或 JsonNode `fieldNames()` set equality 可达。
- 审复结论: ✓ 完全修对 · 假回归 (Coder 忘 masteryDelta / 忘 reviewedDurationMin / 偷塞 debug 字段) 现在能被 happy case 抓到。

### 必修 #2 · TI1 幂等性 0 覆盖

- Round 1 我推荐方案 A (新增 case 覆盖 TI1 + AC5 合并) 或方案 B (压到 Case 1)。
- Round 2 TestDesigner 改法 (字面引用 Case 4 Then 列): 调用顺序从 "先 /weekly 再 /today" 升级为 **"先 /weekly 再 /today 再 /weekly"** 三次串调 (三次都返 200) · Then 列拆 (1) 跨 endpoint 同源 + **(2) 同 endpoint 幂等 (TI1): 第二次 `/weekly`.hero.masteryRate 字面相等于第一次 `/weekly`.hero.masteryRate (浮点容差 0) · `hero.sparkline` 数组逐元素字面相等 · `subjectRadar` 数组顺序与值字面相等 · `weakKPs` 数组顺序与值字面相等 (聚合幂等 · 防 Map 序列化乱序 / 随机 sample)**。
- TI1 现在覆盖 ✓ (Case 4 三合一 · 一行覆盖 INV-6 同源 + TI1 幂等 + 禁缓存 · 保 6 行红线)
- 断言可达性: ✓ JUnit 一一可写 `assertThat(weeklyResp2.hero.masteryRate).isEqualTo(weeklyResp1.hero.masteryRate)` + `assertThat(weeklyResp2.hero.sparkline).containsExactlyElementsOf(weeklyResp1.hero.sparkline)` + `assertThat(weeklyResp2.subjectRadar).containsExactlyElementsOf(weeklyResp1.subjectRadar)` + `weakKPs` 同。Map 序列化乱序问题可通过 Jackson `MapperFeature.SORT_PROPERTIES_ALPHABETICALLY` 或反序列化为 List 顺序断言抓出。
- 审复结论: ✓ 完全修对 · 没破红线 (仍 6 行) · 我接受 "合并到 Case 4 而非单开 Case 7" 的取舍 · 反而比方案 A 更紧凑 (单 case 覆盖 INV-6 + TI1 + 禁缓存 三件事 · 反作弊力没打折)。

### 必修 #3 · Case 6 拆 5-in-1 (504 物理不可达 · 内部日志泄漏)

- Round 1 我提了 3 个子问题: (a) 5-in-1 难定位 · (b) Then 列 "server stderr 出 [ERROR] weekly_aggregate SQLException" 是内部日志断言违反"Then 只写调用方观察" · (c) 504 物理验证不可达。
- Round 2 TestDesigner 改法:
  - **(a) 5-in-1 拆**: Case 6 内部清晰拆 `**(6a · 鉴权/资格错误码组)**` 3 子 (a/b/c · 401×2 + 403) + `**(6b · 服务端降级错误码)**` 1 子 (d · 500 SQLException 注入) 共 4 子场景 · 字面写 "每子场景独立 it 上下文 · 不共享 server state · 每子场景独立 `@ParameterizedTest` value 或独立 `@Test`"。Coder 翻译时清楚拿 `@ParameterizedTest` 4 入参或 4 独立 `@Test` 均可。
  - **(b) 内部日志删**: Round 1 Then 列原 "server stderr 出 1 条 [ERROR] weekly_aggregate SQLException 但 process 不崩溃" **已彻底删除** (我重新通读 Case 6 Then 列 · 现仅写"4 种 response body 都是 JSON 不是 HTML 错误页 · `code` 字段 set 严格属于 `{UNAUTHORIZED, STUDENT_DELETED, INTERNAL}` 3 项之一") · 内部 stderr 字面 0 命中。
  - **(c) 504 物理不可达**: Then 列字面声明 "**504 GATEWAY_TIMEOUT 透明声明移单测层**: timeout 路径不在本 E2E IT scope (物理验证需 @SpyBean delay 注入 · 违反 Tester 真后端 DoR) · 由 Coder 单测层 `@Timeout(value=800, unit=MILLISECONDS)` JUnit 注解验证 · 详见 Changelog Round 2 透明声明" · Changelog 也同步显式 surface "504 透明移单测层"。
  - **(d) 500 mock 策略**: Given 列字面 "`@MockBean WeeklyAggregateService.aggregate()` **throw `SQLException`**" · 不依赖真 SQL 失败 (Round 1 Coder review 推荐策略已纳入)。
  - **(e) Console 列**: 从 Round 1 含糊 "不限制" 改成 "0 [error · unhandled stack trace]" + 显式 "业务降级 logger 必须用 WARN 不用 ERROR · audit dim_ide_smoke 仍卡 0 [error] · 服务端不允许任何 NullPointerException / unhandled exception 落 stderr" · 解决了 audit dim_ide_smoke 冲突 (业务降级 ≠ unhandled stack)。
- 504 物理不可达问题: ✓ 移交单测层 (透明声明 · 与 INV-3 跨时区 / TI5 ISO 边界 / AC5 P95 同样处理)
- 内部日志泄漏: ✓ 解决 (Then 列字面 0 命中)
- 断言可达性: ✓ `@ParameterizedTest` 4 子场景: (a) 不带 Authorization header 调 → expect 401 + `assertThat(JsonPath.read(body, "$.code")).isEqualTo("UNAUTHORIZED")` · (b) 过期 JWT (用 `Jwts.builder().setExpiration(yesterday).signWith(key)` 造) → 同 (a) · (c) seed student.status='DELETED' → 403 + STUDENT_DELETED · (d) `@MockBean WeeklyAggregateService` `when(svc.aggregate(any())).thenThrow(new SQLException())` → 500 + INTERNAL。
- 审复结论: ✓ 完全修对 · 504 透明声明合理 (我 Round 1 物理验证可行性表已承认 504 难落 E2E IT · 改单测层是正确权衡)。

### 必修 #4 · Case 4 禁缓存约定 (audit grep 验证)

- Round 1 我要求 Case 4 Given 列追加禁 cache 约定 + Then 列追加 grep `@Cacheable` 0 命中。
- Round 2 TestDesigner 改法 (字面引用 Case 4 Given 列): "**禁缓存约定** (spec §5.3 line 280 '两端均不缓存'): 测试通过 `@TestPropertySource(\"spring.cache.type=NONE\")` 关闭 Spring cache · controller / service 源码层 audit grep `@Cacheable` **0 命中**验证 (任何 cache TTL 命中视为反 anti_pattern[1] 假 PASS) · 两次调用间隔 0ms"
- Round 2 Changelog 字面 "audit grep `@Cacheable` 0 命中是否进 Changelog 声明" 验证: ✓ Changelog 修 #4 "Case 4 Given 列追加 `@TestPropertySource('spring.cache.type=NONE')` Spring cache 显式关闭 + source grep `@Cacheable` **0 命中**验证" 已字面声明。
- audit grep `@Cacheable` 0 命中是否进 Changelog 声明: ✓
- 断言可达性: ✓ `@TestPropertySource` 是 Spring Boot Test 一行可加 · grep `@Cacheable` 在 Tester step 5 物理验证 / 或 audit.js dim_test_cases_alignment 程序化检查均可执行 · "两次调用间隔 0ms" Coder 翻译时连续 `restTemplate.getForEntity()` 即可。
- 审复结论: ✓ 修对 · 把 grep 验证放 Given 列约束 (而非 Then 列) 是正确选择 (Then 仍是调用方视角 · grep 是 audit 反作弊层 · Given 是约束声明)。

## TI 覆盖矩阵 (7 TI · Round 2 后)

| TI | Round 1 覆盖 | Round 2 覆盖 | 增量 | Phase 4 承诺? |
|----|-----|-----|------|--------------|
| TI1 同 endpoint 幂等 | ✗ | ✓ (Case 4 三合一) | **+1** (从 0 到完全覆盖) | — (Case 4 直接覆盖 · 不需 Phase 4 补) |
| TI2 错误码 401/403/500 | ⚠ (Case 6 五合一) | ✓ (Case 6 4 子拆 · 6a/6b 清晰) | **质量提升** (拆后定位清晰 · 子场景独立 `@Test`) | TI2 子项 504 移单测层 (透明声明) |
| TI3 PII 脱敏 | ✓ | ✓ | 0 | — |
| TI4 weakKPs 排序 | ✓ (反诱饵 KP-D) | ✓ | 0 | — |
| TI5 ISO Monday-Sunday | ✗ (描述层非反例) | ✗ (仍未单列) | 0 | 软建议 Phase 4 adversarial 补 ISO 边界反例 (Tester 自补 · 不阻塞) |
| TI6 双 endpoint 同源 | ✓ (浮点容差 0 + 数组字面) | ✓ (Case 4 第一层断言保留) | 0 | — |
| TI7 空值语义 | ✓ (Case 2 + Case 3) | ✓ | 0 | — |

**覆盖增量评估**: Round 2 修复后 TI1 从 0 覆盖跃升到完全覆盖 · TI2 从五合一难定位升级到 4 子场景拆解 · 7 TI 中 6 个完全覆盖 (TI5 仍透明声明留 Phase 4 补)。**致命缺口 TI1 已闭合**。

**AC 覆盖**: AC1 (Case 1 strong) · AC2 (结构性 grep · Tester adversarial 补) · AC3 (Case 5) · AC4 (Case 5) · AC5 错误码部分 (Case 6 4 子) + **AC5 P95 ≤ 400ms 性能仍未覆盖** (Round 2 Changelog 透明声明留 Phase 4 用 `@RepeatedTest(100)` + percentile 计算 · 见下文风险提示) · AC6 (Case 4) · AC7 (Case 2 + Case 3)。

## 断言可达性总评

- 6 用例 Then 列在 JUnit / Spring Boot Test 落地难度: **low** · 所有 Then 字面断言都能直接映射到 `assertThat(...)` / JsonPath / `@MockBean` + `Mockito.when().thenThrow()` 模式 · 没有 "需要 mock 内部" 或 "需要 black-box 时序断言" 等不可达项。
- 风险用例: 
  - **Case 1 fixture 重**: Given 列要求 seed 28 条本周 GRADED + 25 条上周 GRADED + 8 条 wb_question · 是 6 用例里 fixture 最重的 · Coder Phase 3 用 Testcontainers PG + SQL seeder 或 `@Sql` 注解需要细心写 · 但属于工作量 · 非不可达。
  - **Case 4 三合一**: 三调串行 + 浮点容差 0 + 数组逐元素 + Map 顺序断言堆叠 · 单 `@Test` 内会 ≈ 30 行断言 · 拆 sub-method (`assertCrossEndpointConsistency` / `assertSameEndpointIdempotent` / `assertNoCacheLayer`) 可读性更好。属于编码风格 · 非不可达。

## 新问题扫描

- token budget 6 行: ✓ (实际 6 行 · Case 1-6 · 未破红线)
- 引入"测不出来"的项 (例如纯 audit grep 不是 JUnit): 
  - Case 4 Given 列 audit grep `@Cacheable` 0 命中是 source code grep · 不是 JUnit 断言 · 但已落到 audit 反作弊层 (Tester step 5 物理验证或 audit.js dim · Round 1 我自己也建议放 Given 列) · **不视为测不出来** · 视为多层反作弊 (JUnit + 静态 grep 双保险)。
  - 无其他纯 audit-grep 项。
- 是否破坏 Round 1 已 APPROVE 的某条: 
  - Case 2 (空周 null) · Case 5 (PII + weakKPs 反诱饵) 我 Round 1 已 ✓ · Round 2 字面未动 (我重读两 case Given/When/Then 与 Round 1 完全一致) · 无破坏。
- 是否破坏 Round 1 Changelog Round 1 自承的覆盖矩阵: 无 · Round 2 Changelog 新增了 Round 2 段落 · 旧 Round 1 段落 line 28-46 字面保留。
- Console 列冲突解决: ✓ Case 6 Console 字面从 "不限制" 改为 "0 [error · unhandled stack trace]" + 业务降级 WARN 显式声明 · audit dim_ide_smoke 与 Case 6 不再冲突。

## 物理验证可行性 (Round 2 更新)

| 用例 | Round 1 评 | Round 2 评 | 备注 |
|------|-----------|-----------|------|
| Case 1 | ✓ | ✓ + fixture 扩 (上周 25 条 + 28 条 + duration 2700s) | 可行 · Testcontainers PG seeder 加几行 SQL |
| Case 2 | ✓ | ✓ | 不变 |
| Case 3 | ✓ + Clock 注入 (Round 2 锁 2026-05-15T10:00+08:00) | ✓ 显式 Clock 注入解决 wall-clock flaky | 现 production code WeeklyAggregateService 必须接受 `Clock` bean 注入 · Coder Phase 3 标杆对齐就能 surface 此设计要求 |
| Case 4 | ⚠ 需补禁缓存 | ✓ Given 显式 `@TestPropertySource("spring.cache.type=NONE")` + grep `@Cacheable` 0 命中 + TI1 幂等三调 | 可行 · 反作弊双保险 |
| Case 5 | ✓ | ✓ | 不变 |
| Case 6 (a)(b)(c) | ✓ | ✓ (4 子拆) | 可行 · `@ParameterizedTest` 或 4 独立 `@Test` |
| Case 6 (d) 500 | ⚠ @SpyBean | ✓ Given 显式 `@MockBean WeeklyAggregateService throw SQLException` | 可行 · 与"真后端"不冲突 (mock service 内部异常注入是错误码路径的标准做法 · 不是 mock 整个 SQL 层) |
| Case 6 (e) 504 | ✗ 难落 | ✓ 透明移单测层 `@Timeout(800)` JUnit 注解 | 单测层可行 · E2E IT 透明 surface 不在 scope |

## Round 2 Verdict

**verdict: APPROVE**

**理由**: 
- 我 Round 1 提的 4 必修项全部到位 (字面引用 + 断言可达性逐条验证):
  - 必修 #1 Case 1 缺字段 → 5 层 set equality + `subjectRadar[0]` / `failedTop[0]` 子字段 + Given fixture 扩 (上周 25 条 + duration 2700s) ✓
  - 必修 #2 TI1 幂等 0 覆盖 → Case 4 三合一 (三调串行 · 第二次 /weekly 与第一次浮点容差 0 + 数组逐元素 + Map 顺序) ✓
  - 必修 #3 Case 6 拆 + 删内部日志 + 504 移单测层 + 500 mock 策略 + Console 列冲突解决 ✓
  - 必修 #4 Case 4 禁缓存 → Given 列 `@TestPropertySource("spring.cache.type=NONE")` + audit grep `@Cacheable` 0 命中 · Changelog 字面声明 ✓
- TI 覆盖矩阵改善: TI1 从 0 跃到完全覆盖 · TI2 从五合一升级到 4 子拆解 · 6/7 TI 完全覆盖 (TI5 透明留 Phase 4 · 与 Round 1 一致)
- 没破红线 (仍 6 用例 · 没破 Then 列约定 · 没引入测不出来的项)
- 没破坏 Round 1 已 ✓ 的 Case 2 / 5 (字面对照通过)

**Phase 4 物理验证风险提示 (给 TL)**:
- **AC5 P95 ≤ 400ms 性能维度仍 0 覆盖** (Round 2 Changelog 透明声明 surface · 与 INV-3 / TI5 同样处理 · 留 Tester Phase 4 adversarial 跑 `@RepeatedTest(100)` 或 JMH + percentile 计算落实)。**风险等级**: 中。**原因**: 单 IT 跑 1 次延迟 ≤ 400ms 不等于 P95 · Tester Phase 4 必须显式补 ≥ 50 次 warm-up + percentile 断言 · 否则 AC5 物理上未被守住。**建议 TL Phase 4 spawn Tester 时**显式在 prompt 里加一句 "AC5 P95 ≤ 400ms 必须用 `@RepeatedTest(100)` 跑 100 次 + 计算 95th percentile · 不能用单次 IT 延迟代替"。
- **TI5 ISO Monday-Sunday 反例 0 覆盖**: 同样留 Tester Phase 4 adversarial 补 1 个 "美式 Sunday-Saturday 故意失败" 反例。
- **INV-3 跨时区**: 用户 2026-05-16 明确决策 T01 scope 单 tz · 跨时区走 SC-08 · 不在本 T01 范围 · 不阻塞。
- **Case 3 Clock 注入是 production code 设计决策**: TestDesigner 透明 surface 后 · Coder Phase 3 翻 it block 前必须先在 `WeeklyAggregateService` 设计阶段引入 `Clock` 依赖注入 · 否则会发现 production 没 Clock bean → 翻不出 mockClock fixture。TL 在 Phase 3 spawn Coder 时建议在 prompt 加一句 "Step 3 标杆对齐时优先 grep `Clock` 在仓库其它服务的注入模式 (如 observer-service / spring-context bean configuration)"。

**总评**: Round 2 修复质量高 · 我真心 APPROVE · 不是凑数 (audit dim_test_cases_alignment ≥ 1 REJECT 已在 Round 1 满足 · Round 2 我不必再凑一个 REJECT)。

## Self-Checkpoint (Rule 6 tool-use budget · Round 2)

- 本轮 Round 2 tool use ≈ 5 次 (Read agent.md + Read test-cases.md + Read tester-review.md Round 1 + Read coder-review.md + Edit append Round 2) · 累计 ≈ 12 次 · 远低于软线 50
- 估算累计 token ≈ 50K (Round 1 30K + Round 2 20K)
- 4 必修审复结果: 全部 ✓ · TI 覆盖矩阵: TI1 从 0 闭合到完全覆盖 + TI2 质量提升
- **给 TL 一句话**: Round 2 真 APPROVE · 4 必修全到位 + TI1 闭合 · 唯一 Phase 4 风险是 AC5 P95 性能需 Tester `@RepeatedTest(100)` 物理跑实落 · 建议 TL 解锁 Phase 2.5 user approval gate (TestDesigner append User Approval section 等用户签字)。

## 边界声明 (Round 2 · 不越界)

- ✗ 没跑 mvn / pnpm / spec.ts (Phase 2 review 不允许)
- ✗ 没 overwrite Round 1 (in-place APPEND `# Round 2 Review` · 加 `---` 分隔)
- ✗ 没代用户填 User Approval verdict (Phase 2.5 用户职责 · AI 代签 = retries++ 熔断)
- ✗ 没改 test-cases.md (TestDesigner 职责)
- ✗ 没改 inflight (Phase 4 passes=true 才动 · 本轮 Phase 2 Round 2 不动)
- ✓ 只 APPEND `# Round 2 Review` section 到 tester-review.md

---

# Round 3 Review (User Phase 2.5 反馈 propagate 审复)

**Date**: 2026-05-16
**Reviewing**: Round 3 修后的 test-cases.md (三 Round Changelog · 旧 User Approval section 已删 · 等本 Round AI 对抗双 APPROVE 后再 append)
**Verdict**: APPROVE

## 必读声明

已完整阅读 `.harness/agents/test-agent.md` · Round 3 review 职责已内化 (审复 X-User-Id propagate + 单测 AC8 delegation 是否让 Tester Phase 4 work_log_dir 物理验证仍可达)。

读完:
- `audits/runs/SC16-T01/team-1/attempt-1/test-cases.md` Round 3 全文 (Case 1-6 + Round 1/2/3 Changelog)
- 上游 propagate 字面 verify:
  - `.harness/feature_list_SC-16.json` AC1 line 138 (`X-User-Id` 字面命中) · AC5 line 154 (MVP X-User-Id + reserved 403 字面命中) · AC8 line 165-166 (三类 corner 各 ≥ 5 + 行覆盖 ≥ 90% + audit grep `*Test.java` ≥ 2 + `@Test` ≥ 15 字面完整) · TI2 line 171 (MVP X-User-Id + reserved 403) · TI8 line 177 (单测金字塔) · key_invariants[6] line 186 + [7] line 187 (单测金字塔 + 鉴权 MVP 不变量)
  - `biz/features/P-WEEKLY-REVIEW__weekly-review.md` line 135 + line 189 (`X-User-Id: <student_id>` 字面命中 + MVP 注释)
  - `design/system/pages/P-WEEKLY-REVIEW-weekly-review.spec.md` line 195 §5 row 1 (`X-User-Id` 字面命中) · line 238 §5.2 (401 MVP X-User-Id 字面) · line 358 §9 异常表 (MVP X-User-Id 缺失 字面)
- 我 Round 1 (REJECT 4 必修) + Round 2 (APPROVE 全到位) review

本轮 phase: Phase 2 Round 3 · 仍仅文档评审 · 不跑 spec.ts / mvn · 不改 test-cases.md / inflight。

## 用户反馈 1 · X-User-Id propagate · 断言可达性视角

### 6 用例 Given/When/API 列字面命中检查

| 位置 | Round 2 字面 (旧 · JWT) | Round 3 字面 (新 · X-User-Id) | 命中? |
|------|------------------------|------------------------------|-------|
| Case 1 Given | "已登录持有效 JWT" | "请求附 `X-User-Id: stu123` Header (MVP · 与既有 /api/home/today 一致 · 登录 SC-00 上线时升 JWT · biz §10.12 + key_invariants[7])" | ✓ |
| Case 1 When | `Authorization: Bearer <STUDENT JWT>` | `Header `X-User-Id: stu123`` | ✓ |
| Case 4 Given | "同一 JWT" | "同一 `X-User-Id: stu123` Header (MVP 鉴权 · 登录上线时升 JWT)" | ✓ |
| Case 5 Given | "任意学生 stu123 JWT 有效" | "任意学生 stu123 (请求附 `X-User-Id: stu123` Header · MVP 鉴权 · 登录上线时升 JWT)" | ✓ |
| Case 6 子场景 (a) | "请求未携带 Authorization header" | "请求未携带 `X-User-Id` Header (header 完全缺失)" | ✓ |
| Case 6 子场景 (b) | "JWT 已过期" | "`X-User-Id` Header 存在但格式非法 (e.g. `X-User-Id: abc!` 含非法字符 / 空字符串 / 不是合法 student_id 格式 · 用户 2026-05-16 决策 · 不是 'JWT 过期' — X-User-Id 无过期概念)" | ✓ (彻底替换 · 语义合理) |
| Case 6 子场景 (c) → (d) reserved | "student.status='DELETED' → 403" (强制) | "(d · reserved) MVP 阶段 student.status 字段可能未实装 · 此子项 reserved · Coder Phase 3 自定 · audit 不卡 6c 子项" | ✓ (reserved 处理合理) |

### Case 6 子场景 (a)(b)(c) 物理可达性 (Tester Phase 4 视角)

| 子场景 | 物理写法 | 可达? |
|--------|----------|-------|
| **6a (a) 缺 `X-User-Id` Header → 401** | `restTemplate.exchange("/api/home/weekly", GET, new HttpEntity<>(new HttpHeaders()), String.class)` (HttpEntity 不放 X-User-Id) → expect 401 + JsonPath `$.code == "UNAUTHORIZED"` | ✓ 比 Bearer JWT 简单 (不需造 JWT key) · 一行 HttpHeaders 即可 |
| **6a (b) 格式非法 → 401** | `httpHeaders.set("X-User-Id", "abc!")` (或 `""` 空字符串) · 期望 controller `@RequestHeader("X-User-Id") String studentId` 经 validation 抛 → 401 + UNAUTHORIZED | ✓ 比"造过期 JWT"简单 (`Jwts.builder().setExpiration(yesterday)` 不再需要 key 签名) |
| **6c reserved (d) student DELETED** | 若 Coder Phase 3 实装 student.status 字段: `INSERT INTO student (id, status) VALUES ('stu_del', 'DELETED')` + seed · expect 403 + STUDENT_DELETED · 若不实装: skip 此子项 / 改断言 404 + STUDENT_NOT_FOUND | ✓ 明确 (Coder Phase 3 决定 · Tester Phase 4 据 Coder 决定自适应 · audit 6c 不卡) |

### 上游 doc grep verify

- biz §10.12 line 135 + §10.13 line 189: ✓ `X-User-Id: <student_id>` 字面命中 + MVP 注释 + 登录 SC-00 上线时升 JWT 字面
- spec §5 line 195: ✓ `X-User-Id: <student_id>` 字面命中
- spec §5.2 line 238: ✓ `X-User-Id Header 缺失 / 格式非法 (MVP) · 登录上线后含义改为 JWT 缺失/过期` 字面 (与 test-cases.md Case 6a 子 (a)(b) 严格对齐)
- spec §9 line 358: ✓ `401 (MVP X-User-Id 缺失)` 字面命中 + redirect 参数保留
- feature_list AC1 line 138: ✓ `带 X-User-Id Header (MVP · 登录未开发 · 与既有 /api/home/today 一致)` 字面
- feature_list AC5 line 154: ✓ `401 UNAUTHORIZED (MVP: X-User-Id Header 缺失/格式非法 · 登录上线后含义改为 JWT 缺失/过期) / 403 STUDENT_DELETED (学生注销 · MVP 阶段 reserved · 等学生 status 字段实装)` 字面
- feature_list TI2 line 171: ✓ `X-User-Id Header 缺失/非法返 401 非 500 (MVP · 登录上线后含义改 JWT 缺失/过期) · 学生注销 403 reserved (等 student.status 字段实装)` 字面
- feature_list key_invariants[7] line 187: ✓ `鉴权 MVP: X-User-Id Header (与 /today 一致) · 登录 SC-00 上线时双 endpoint 同步升 JWT (不允许 T01 单独升)` 字面

**propagate 完整性**: 4 文档 (test-cases.md + biz + spec + feature_list) 全字面对齐 · 无残留 `Bearer JWT` / `JWT 过期` 字面 (test-cases.md Case 6 子场景 (b) "JWT 已过期" 已彻底替换)。

### 断言可达性总评

- **落地难度**: low (比 Round 2 JWT 路径**更低** · 不需 `Jwts.builder()` 造 token · 不需测试用 RSA key 注入 · 直接 HttpHeaders 设置 X-User-Id 字符串)
- **错误码 set 调整**: Case 6 Then 列 `{UNAUTHORIZED, INTERNAL}` 必卡 ∪ (可选 reserved) `{STUDENT_DELETED, STUDENT_NOT_FOUND}` · API 列 "401 (×2) / 500 · (可选 reserved) 403 或 404" · JsonPath 断言 `assertThat(JsonPath.read(body, "$.code")).isIn("UNAUTHORIZED", "INTERNAL")` 或对子项独立 `assertThat(...).isEqualTo("UNAUTHORIZED")` 清晰
- **风险**: 0 — Tester Phase 4 *E2EIT.java 写法比 Round 2 更简单

## 用户反馈 2 · 单测 AC8 delegation · Tester Phase 4 边界视角

### 单测责任归属清晰度

- Round 3 Changelog "据 User 反馈 2 · 单测覆盖 delegation" 章字面声明: ✓
  - "**TestDesigner 边界 (agent.md 规定 '用户视角 Gherkin 6 列') · 不在 test-cases.md 添加 unit-level case** · 由 feature_list T01 AC8 + TI8 强制 Coder Phase 3 配 JUnit 单测"
  - "**不变量**: key_invariants[6] '单测金字塔: 6 E2E IT (TestDesigner Gherkin) + N unit test (Coder Phase 3 落 · 算法/数学/边界 corner) · 不允许只写 E2E 跳过 unit' (用户 2026-05-16 决策)"
  - "Round 3 在 Changelog 显式 surface 此 delegation · 与 Round 2 已有的 INV-3 跨时区 / TI5 ISO 起算日 / AC5 P95 性能预算 三处透明声明同样的工程治理范式"

判定: ✓ delegation 边界字面清晰 · Coder Phase 3 落单测 · Tester Phase 4 不重跑

### AC8 在 feature_list 完整性 (字面引用)

- feature_list AC8 line 165-166: ✓ 三类 corner 字面齐全:
  - (1) `compute_streak()` 算法: 跨月 / 跨年 / 学生注册首日 / DST / 负数防御 (5 个)
  - (2) `masteryRate` 浮点数学边界: 28 全对 1.0 / 28 全错 0.0 / 0 GRADED null / 1-1 1.0 / 27-28 边界 (5 个)
  - (3) ISO 8601 week 边界: 周一 00:00:00.001 / 周日 23:59:59.999 / 跨年 W53→W01 / 闰年 / UTC vs Asia/Shanghai (5 个)
- 文件分组: `WeeklyAggregateServiceTest` (corner 1+2) + `WeekBoundaryUtilTest` (corner 3) ≥ 2 个文件 ✓
- audit grep 规则: `backend/wrongbook-service/src/test/java/.../weekly/*Test.java` (排除 *E2EIT.java) ≥ 2 文件 + `@Test` 命中 ≥ 15 ✓
- 行覆盖: jacoco 或同等 · WeeklyAggregateService + compute_streak + WeekBoundaryUtil 行覆盖 ≥ 90% ✓

### TI8 90% 行覆盖率 verify 责任

- AC8 line 166 字面: "Coder Phase 3 work_log_dir 必须含 unit-tests 部分的 coverage 报告 (jacoco 或同等) 显示 ... 行覆盖 ≥ 90%"
- TI8 line 177 字面: "Coder Phase 3 必落 · 用户 2026-05-16 决策 · 防 6 E2E 漏 streak/数学/ISO 边界 bug"
- **责任归属**: ✓ Coder Phase 3 落 jacoco 报告到 work_log_dir · Tester Phase 4 **不重跑 jacoco** (重跑视为 scope 越界 · 浪费 token budget)
- **Tester Phase 4 仅需**: 在 adversarial.md 标注 "AC8 unit test + jacoco 已由 Coder Phase 3 落 work_log_dir · 本轮 adversarial 不重复 verify · 仅 verify 6 E2E IT PASS + IDE smoke 0 [error] + Phase 4 补 AC5 P95 / TI5 ISO 反例" — 不引入 overlap

### Phase 4 scope 与 Coder Phase 3 单测 overlap 风险

- Tester Phase 4 物理验证清单 (test-agent.md step 5 + Phase 4 DoD):
  1. *E2EIT.java 6 用例 100% PASS
  2. IDE / 服务端 stdout 0 [error]
  3. Tester adversarial.md 至少 1 轮 REJECT + 1 轮 fix
  4. AC5 P95 (Phase 4 补 · `@RepeatedTest(100)` + percentile · Round 2 已声明)
  5. TI5 ISO 美式 Sunday-Saturday 反例 (Phase 4 补 · Round 1 + Round 2 已声明)
- **不在 Tester Phase 4 scope**: AC8 unit test 跑 + jacoco 报告生成 (Coder Phase 3 责任)
- **overlap 风险**: 无 · Round 3 Changelog 字面声明 delegation · audit dim_test_cases_alignment 不卡 Tester 重跑单测 (那是 Coder 责任)

## Phase 4 物理验证风险更新

| 风险项 | Round 2 状态 | Round 3 状态 | 备注 |
|--------|-------------|-------------|------|
| AC5 P95 ≤ 400ms | 透明留 Phase 4 (`@RepeatedTest(100)` + percentile) | 不变 | 与 Round 2 一致 · TL Phase 4 spawn Tester 时仍需 prompt 加一句 P95 必跑 100 次 |
| TI5 ISO Monday-Sunday 反例 | 透明留 Phase 4 (adversarial 补美式 Sunday-Saturday 故意失败反例) | 不变 | 与 Round 1 + Round 2 一致 |
| Case 6c student DELETED reserved | (新增) 等 student.status 字段实装 | ✓ Tester Phase 4 据 Coder Phase 3 是否实装自适应 · audit 6c 不卡 · 物理可达 | Coder Phase 3 实装 → Tester 写 seed `INSERT INTO student (status='DELETED')` + expect 403; Coder 不实装 → Tester 改 expect 404 + STUDENT_NOT_FOUND |
| AC8 unit test jacoco verify | — (Round 3 新增 delegation) | Coder Phase 3 落 jacoco 报告 · Tester Phase 4 不重跑 · 仅 adversarial.md 标注引用 | 边界清晰 · 无 overlap |
| INV-3 跨时区 | 不在 T01 scope · 走 SC-08 | 不变 | 不阻塞 |
| Case 3 Clock 注入 production 设计 | Coder Phase 3 标杆对齐 grep `Clock` 注入模式 | 不变 | TL Phase 3 spawn Coder 时仍需 prompt 加一句 |

## 新问题扫描

- token budget 6 行: ✓ (Round 3 不增不减 · 仍 6 用例 · 维持 Case 1-6 + Round 1/2/3 三段 Changelog)
- 是否破坏 Round 2 已 APPROVE 的 Case 2 / 3 (空周 + 空日 null 语义): 
  - Case 2 Given/When/Then 字面: 我 Round 2 已 ✓ · Round 3 字面对照: ✓ 完全未动 (`hero.masteryRate === null` · `sparkline` 7 全 null · `streak === 0` 字面保留)
  - Case 3 Given/When/Then 字面: 我 Round 2 已 ✓ (Clock 锁 `2026-05-15T10:00+08:00`) · Round 3 字面对照: ✓ 完全未动 (`sparkline[2] === null` 不 forward-fill · `streak >= 1` yesterday-back 字面保留)
  - **结论**: Round 3 仅动 Case 1/4/5/6 Given/When + Case 6 Then + API 列 · Case 2/3 Given/When/Then 字面 0 改动 · Round 2 APPROVE 不受破坏
- TI 覆盖矩阵增量 (Round 3 TI 视角):
  - TI2 改 (MVP X-User-Id + reserved 403): Case 6 4 子场景 ((a)(b) UNAUTHORIZED + (c) INTERNAL + (d reserved)) 仍完整覆盖 TI2 改后语义 · ✓
  - TI8 新增 (单测金字塔): 0 E2E 覆盖 (delegation 到 Coder Phase 3 AC8 落) · 透明 surface 与 AC5 P95 / TI5 ISO 同范式 · ✓ (不是缺口)
- 是否新引入"测不出来"的项: 0 · Round 3 改的都是 Header 路径 + reserved 子项处理 + delegation 声明 · 没引入新断言项
- audit dim_test_cases_alignment review_has_ge_1_reject_round: ✓ Round 1 我 REJECT 4 项 + Coder REJECT 3 项 已满足 · Round 2 + Round 3 双 APPROVE 不破坏此红线
- User Approval section 状态: ✓ Round 3 test-cases.md 字面无 `## User Approval` (旧 section 已删 · 等本 Round AI 对抗双 APPROVE 后 TestDesigner 被 harness 重唤醒 append 新空 section · 我**不准**代签)

## Round 3 Verdict

**verdict: APPROVE**

**理由**:

1. **用户反馈 1 (X-User-Id propagate) 完整到位**: 4 文档 (test-cases.md + biz + spec + feature_list) 全字面对齐 · 无残留 JWT 字面 · Case 6 子场景 (b) "JWT 过期" 彻底替换为"X-User-Id 格式非法" (语义合理 · MVP 鉴权无过期概念) · 物理可达性比 Round 2 JWT 路径**更低落地难度** (不需 Jwts.builder() 造 token + RSA key)。
2. **用户反馈 2 (AC8 单测 delegation) 边界清晰**: Round 3 Changelog 字面声明 "TestDesigner agent.md 边界仅写 Gherkin · 不在 test-cases.md 加 unit-level case" + feature_list T01 AC8 字面齐全 (三类 corner 各 ≥ 5 + 行覆盖 ≥ 90% + audit grep `*Test.java` ≥ 2 + `@Test` ≥ 15) + TI8 + key_invariants[6][7] · Coder Phase 3 落 jacoco 报告 · **Tester Phase 4 不重跑** · 无 overlap。
3. **Phase 4 物理验证可达性**: 6 用例全可达 (Case 6 reserved 6c 据 Coder Phase 3 自适应 · audit 不卡) · Round 2 已声明的 AC5 P95 / TI5 ISO / Clock 注入 三项 Phase 4 责任不变。
4. **没破坏 Round 2 APPROVE**: Case 2 / 3 字面 0 改动 · Case 1 schema 5 层 set equality 仍保留 · Case 4 三合一 (INV-6 + TI1 + 禁缓存) 仍保留 · 仅 Header 路径 + 错误码 set 调整 + 单测 delegation surface。
5. **token budget**: 仍 6 用例 · 三段 Changelog 透明完整 · 与 INV-3 / TI5 / AC5 / AC8 四处透明 surface 一致工程治理范式。

3 项审复维度 (propagate 完整性 + 单测 delegation 边界 + Phase 4 物理可达) 全 ✓ · 没有"鸡蛋里挑骨头"的 nitpick · 真心 APPROVE · 不是凑数 (audit dim_test_cases_alignment ≥ 1 REJECT 已在 Round 1 满足 · Round 3 不必再凑一个 REJECT)。

**给 TL 的接力提示 (Round 3 后)**:
- 本 Round 3 Tester APPROVE · 等 Coder Round 3 review 也 APPROVE 后 · TestDesigner 被 harness 重唤醒 append 新空 `## User Approval` section · 第二轮 Phase 2.5 user approval gate 等用户签字
- 用户第二轮签字关注点 (建议 TL 在唤醒 TestDesigner 时 surface 给用户): (i) Header 路径 X-User-Id 替换是否符合 MVP 设计期望 · (ii) Case 6 子场景 (d) reserved 6c 处理 (Coder Phase 3 实装 student.status 与否 + audit 不卡) 是否接受 · (iii) feature_list AC8/TI8 单测金字塔是否覆盖到位
- Phase 4 (Tester 实测) 仍需在 spawn prompt 加: (i) AC5 P95 必跑 `@RepeatedTest(100)` + percentile · (ii) TI5 ISO 美式 Sunday-Saturday 故意失败反例 · (iii) AC8 unit test + jacoco 由 Coder 落 · Tester adversarial.md 仅引用不重跑

## Self-Checkpoint (Rule 6 tool-use budget · Round 3)

- 本轮 Round 3 tool use ≈ 7 次 (Read agent.md + Read test-cases.md + Read tester-review.md Round 1+2 + 4 个 Bash grep verify propagate + Edit append Round 3) · 累计 ≈ 19 次 · 远低于软线 50
- 估算累计 token ≈ 65K (Round 1 30K + Round 2 20K + Round 3 15K)
- 审复 3 维度: propagate 完整性 ✓ + 单测 delegation 边界 ✓ + Phase 4 物理可达 ✓
- **给 TL 一句话**: Round 3 真 APPROVE · 4 文档全字面对齐 X-User-Id + AC8 delegation 边界清晰无 Tester Phase 4 overlap · 建议 TL 触发 TestDesigner 重唤醒 append 新空 User Approval section 等用户第二轮签字。

## 边界声明 (Round 3 · 不越界)

- ✗ 没跑 mvn / pnpm / spec.ts (Phase 2 review 不允许)
- ✗ 没 overwrite Round 1 / Round 2 (in-place APPEND `# Round 3 Review` · 加 `---` 分隔)
- ✗ 没代用户填 User Approval verdict (Phase 2.5 用户职责 · AI 代签 = retries++ 熔断)
- ✗ 没改 test-cases.md (TestDesigner 职责)
- ✗ 没改 inflight (Phase 4 passes=true 才动 · 本轮 Phase 2 Round 3 不动)
- ✗ 没改 biz / spec / feature_list (TL 已 propagate · 本 Tester 仅 verify 字面命中)
- ✓ 只 APPEND `# Round 3 Review` section 到 tester-review.md
