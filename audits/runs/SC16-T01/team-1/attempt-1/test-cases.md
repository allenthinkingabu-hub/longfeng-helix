# Test Cases · SC-16-T01 · backend weekly_aggregate service + /api/home/weekly + /api/home/today.weekSummary

trace: biz/features/P-WEEKLY-REVIEW__weekly-review.md §2B.17 (SC-16 核心路径 + 5 System Invariants + TC-16.01/02/03) · biz §10.12 (WeeklyReviewResp 字符级 schema) · biz §10.13 (today.weekSummary 扩展) · biz §10.14 (4 字段伪 SQL + 空值语义 + streak yesterday-back 算法) · design/system/pages/P-WEEKLY-REVIEW-weekly-review.spec.md §5 / §5.1 / §5.2 / §5.3 (同 service 双 endpoint 架构图) · design/system/pages/P-HOME.spec.md §5 / §5.2 (weekSummary 字段集) · .harness/feature_list_SC-16.json tasks[0] AC1-AC7 + TI1-TI7 + INV-1/2/3/4/6 + aggregation_contract.anti_pattern[1..4]

> **任务范围**: backend 纯后端任务 (backend/review-plan-service · Java/Spring) · 测试用例从 HTTP + service 层视角写 · 不涉及 MP UI / 不涉及 wxml / 不涉及 testid。
>
> **格式约定** (audit.js dim_test_cases_alignment 卡口):
> - 表头严格 6 列: `# | Given | When | Then | Console | View ≥ | API`
> - 用例 ≥ 3 行 · ≤ 6 行 (本表 6 行 · 已达 token budget 上限)
> - 第 1 用例 = happy path · 第 2-3 = edge / null 语义 · 第 4+ = 同源不变量 / PII 脱敏 / 错误码
> - View ≥ 列后端任务统一填 `n/a` (无 DOM 渲染)
> - Then 列只写"调用方观察到的字段" · 不写"内部调什么 SQL / 哪个 Java 方法"
> - Console 列对后端 IT/E2E IT 而言 = 服务端 stdout 不允许 `[error]` 级别日志 (未捕获 NPE / SQLException) · 业务降级日志 (warn) 允许

| # | Given | When | Then | Console | View ≥ | API |
|---|-------|------|------|---------|--------|-----|
| 1 | 学生 stu123 (Asia/Shanghai) · 请求附 `X-User-Id: stu123` Header (MVP · 与既有 /api/home/today 一致 · 登录 SC-00 上线时升 JWT · biz §10.12 + key_invariants[7]) · 本周 (2026-W20) wb_review_record 已落 28 条 GRADED (其中 MASTERED 19 条 · duration_sec 总和 = 2700 秒 = 45 分钟) + 上周 (2026-W19) wb_review_record 已落 25 条 GRADED (其中 MASTERED 16 条 · 用于算 masteryDelta) + wb_question 本周新建 8 条 · 后端 review-plan-service 健康 · `Clock` bean 锁定为 `2026-05-15T10:00:00+08:00` (本周周五上午) | 客户端发 `GET /api/home/weekly` · Header `X-User-Id: stu123` · query 缺省 | response body 顶层 keys **严格 set equality** === 8 项 `{week, range, hero, subjectRadar, weakKPs, stats, failedTop, aiInsight}` (字符级 · 多 1 / 少 1 即 FAIL · 不允许 debug/internal/student_id_hash/parent_id/device_fp 字段泄漏) · `week === "2026-W20"` · `range` keys set equality === 2 项 `{from, to}` (ISO 8601 date string · 周一-周日 · student_tz 边界) · `hero` keys set equality === 3 项 `{masteryRate, masteryDelta, sparkline}` (`masteryRate ≈ 19/28 ≈ 0.6786` 浮点 · `masteryDelta` 为 number 或 null · 例 `0.6786 - 16/25 = +0.0386` · biz §10.12 line 310) · `hero.sparkline` 长度**严格 7** number 数组 · `stats` keys set equality === 3 项 `{reviewedCount, reviewedDurationMin, newCount}` (`reviewedCount === 28` · `reviewedDurationMin === 45` integer · `newCount === 8`) · `subjectRadar` 数组 · `subjectRadar[0]` keys set equality === 3 项 `{subject, masteryRate, sampleSize}` (subject string · masteryRate number ∈ [0,1] 或 null · sampleSize integer ≥ 0) · `weakKPs` 数组 length ≤ 3 · `failedTop` 数组 · `failedTop[0]` 含 `{questionId, subject, missCount}` 子字段 (cross-ref spec §5.1) · `aiInsight` keys set equality === 3 项 `{insightId, text, generatedAt}` 全 present | 0 [error] | n/a | GET /api/home/weekly → 200 |
| 2 | 学生 stu456 (Asia/Shanghai) 已登录 · 本周 (2026-W20) 0 复习记录 (wb_review_record 在 [thisWeek] 为空) · wb_question 本周新建 0 条 · streak 上下文: 昨天 0 GRADED 今天 0 GRADED | 客户端发 `GET /api/home/weekly` 与 `GET /api/home/today?tz=Asia/Shanghai` 两次调用 | `/weekly` response: `hero.masteryRate === null` (严格 null 不是 0 不是 0.0 不是 -1) · `hero.sparkline` 长度 7 且**每一个元素都为 null** (不 forward-fill · 不打底 0) · `stats.newCount === 0` (number 0 · 不为 null · 区别 masteryRate) · `stats.reviewedCount === 0` · `/today` response.weekSummary: `masteryRate === null` · `sparkline` 长度 7 全 null · `streak === 0` · `newCount === 0` | 0 [error] | n/a | GET /api/home/weekly → 200 · GET /api/home/today → 200 |
| 3 | 学生 stu789 (Asia/Shanghai) 本周 (2026-W20) wb_review_record: 周一 (index 0) 3 题 GRADED · 周三 (index 2) 0 GRADED · 周四 (index 3) 2 题 GRADED · 其他天 0 GRADED · streak 上下文: 昨天周四 ≥ 1 GRADED · 今天周五暂无 GRADED · **`Clock` bean 锁定**: 测试通过 `@MockBean Clock` (或 `MutableClock`) 把当前时间锁到 `Instant.parse("2026-05-15T10:00:00+08:00")` (周五上午 10 点 · Asia/Shanghai) · **`WeeklyAggregateService` 与 `compute_streak()` 必须接受 `Clock` 依赖注入** · production code 禁用任何 `LocalDate.now()` / `Instant.now()` 直接调用 (audit grep 验证 0 命中) | 客户端发 `GET /api/home/weekly` | `hero.sparkline` 长度严格 7 · `sparkline[0]` 为 number (周一 mastered/graded 比值) · `sparkline[1]` === null (周二空日) · `sparkline[2]` === null (周三空日 · **不**等于 0 · **不** forward-fill `sparkline[0]` 的值) · `sparkline[3]` 为 number (周四) · `sparkline[4..6]` 全 null (周五-周日 · 今天周五 0 GRADED 也为 null · 周六周日未到也为 null) · `/today` 同步: `weekSummary.sparkline[2] === null` · `weekSummary.streak >= 1` (从昨天周四 ≥ 1 GRADED 起 yesterday-back · biz §10.14 streak 算法) | 0 [error] | n/a | GET /api/home/weekly → 200 · GET /api/home/today → 200 |
| 4 | 同一学生 stu123 同一时刻 · review-plan-service 进程未重启 · 本周数据 frozen (无新写入) · 调用顺序: 先 /weekly 再 /today 再 /weekly (同一 `X-User-Id: stu123` Header · MVP 鉴权 · 登录上线时升 JWT) · **禁缓存约定** (spec §5.3 line 280 "两端均不缓存"): 测试通过 `@TestPropertySource("spring.cache.type=NONE")` 关闭 Spring cache · controller / service 源码层 audit grep `@Cacheable` **0 命中**验证 (任何 cache TTL 命中视为反 anti_pattern[1] 假 PASS) · 两次调用间隔 0ms | 串行发 `GET /api/home/weekly` 紧接 `GET /api/home/today?tz=Asia/Shanghai` 再紧接第二次 `GET /api/home/weekly` (三次都返 200) | (1) **跨 endpoint 同源** (INV-6): `/weekly`.hero.masteryRate **字面相等于** `/today`.weekSummary.masteryRate (浮点容差 0 · 不允许 0.68 vs 0.6800001) · `/weekly`.hero.sparkline **数组逐元素字面相等于** `/today`.weekSummary.sparkline (含 null 位置一致) · `/weekly`.stats.newCount **字面相等于** `/today`.weekSummary.newCount · 防 P-HOME 看 68% / P-WEEKLY-REVIEW 看 65% 漂移 · (2) **同 endpoint 幂等** (TI1): 第二次 `/weekly`.hero.masteryRate **字面相等于** 第一次 `/weekly`.hero.masteryRate (浮点容差 0) · `hero.sparkline` 数组逐元素字面相等 · `subjectRadar` 数组顺序与值字面相等 · `weakKPs` 数组顺序与值字面相等 (聚合幂等 · 防 Map 序列化乱序 / 随机 sample) | 0 [error] | n/a | GET /api/home/weekly → 200 (×2) · GET /api/home/today → 200 |
| 5 | 任意学生 stu123 (请求附 `X-User-Id: stu123` Header · MVP 鉴权 · 登录上线时升 JWT) · 数据库 wb_question + wb_review_record 含完整 PII 列 (student_id_hash · parent_id · device_fp) · 同时 wb_question 上有 KP-A (recentMissCount=2 · totalMissCount=10) + KP-B (recentMissCount=4 · totalMissCount=5) + KP-C (recentMissCount=3 · totalMissCount=8) + KP-D (recentMissCount=1 · totalMissCount=20) | 客户端发 `GET /api/home/weekly` · 检查 response JSON 完整字段集 | response JSON 文本搜索 `"student_id_hash"` / `"parent_id"` / `"device_fp"` 三关键字**全 0 命中** (PII 脱敏 · INV-2 · AC3) · `weakKPs` 数组 length === 3 (不返 D · limit 3) · `weakKPs[0].kpId === "KP-B"` (recentMissCount=4 最大) · `weakKPs[1].kpId === "KP-C"` (=3) · `weakKPs[2].kpId === "KP-A"` (=2) · **不**按 totalMissCount 排 (否则 D 会排第 1 · KP-A 排第 2 · INV-4 · AC4) | 0 [error] | n/a | GET /api/home/weekly → 200 |
| 6 | 后端 review-plan-service 启动 · 3 种**独立**异常场景 (运行时各跑独立 it 上下文 · 不共享 server state · 每子场景独立 `@ParameterizedTest` value 或独立 `@Test`): **(6a · 鉴权错误码组 · MVP X-User-Id Header 语义 · 真 fixture 可注入)** (a) 请求未携带 `X-User-Id` Header (header 完全缺失) · (b) `X-User-Id` Header 存在但格式非法 (e.g. `X-User-Id: abc!` 含非法字符 / 空字符串 / 不是合法 student_id 格式 · 用户 2026-05-16 决策 · 不是 "JWT 过期" — X-User-Id 无过期概念) · **(6b · 服务端降级错误码)** (c) `@MockBean WeeklyAggregateService.aggregate()` **throw `SQLException`** (mock service 内部异常 · 不依赖真 SQL 失败) · **(6c · reserved · MVP 不强制)** (d · reserved) 有效 `X-User-Id` 但 `student.status='DELETED'`：**MVP 阶段 `student.status` 字段可能未实装 · 此子项 reserved · Coder Phase 3 自定 — 若 student.status 已实装可断言 403 + `code === "STUDENT_DELETED"` / 若未实装可断言 404 + `code === "STUDENT_NOT_FOUND"` · 不强制 401/403 严格** | 客户端依次发 `GET /api/home/weekly` (各子场景独立请求) | **6a 鉴权错误码字面对齐** spec §5.2 line 238 + feature_list AC5/TI2 (MVP X-User-Id 语义): (a) → HTTP 401 + response body `code === "UNAUTHORIZED"` (不退化 500 · TI2) · (b) → HTTP 401 + `code === "UNAUTHORIZED"` (与 a 同语义不同输入 · 都是 "X-User-Id 缺失/格式非法") · **6b 服务端降级错误码**: (c) → HTTP 500 + `code === "INTERNAL"` · **6c reserved**: (d) → 若 status 字段实装则 HTTP 403 + `code === "STUDENT_DELETED"` · 否则 HTTP 404 + `code === "STUDENT_NOT_FOUND"` (Coder Phase 3 自定 · audit 不卡 6c 子项 · MVP) · 3 种 response body 都是 JSON (不是 HTML 错误页) · `code` 字段 set 严格属于 `{UNAUTHORIZED, INTERNAL}` ∪ (可选) `{STUDENT_DELETED, STUDENT_NOT_FOUND}` · **504 GATEWAY_TIMEOUT 透明声明移单测层**: timeout 路径不在本 E2E IT scope (物理验证需 @SpyBean delay 注入 · 违反 Tester 真后端 DoR) · 由 Coder 单测层 `@Timeout(value=800, unit=MILLISECONDS)` JUnit 注解验证 · 详见 Changelog Round 2 透明声明 | 0 [error · unhandled stack trace] (业务降级 logger 必须用 WARN 不用 ERROR · audit dim_ide_smoke 仍卡 0 [error] · 服务端不允许任何 NullPointerException / unhandled exception 落 stderr) | n/a | GET /api/home/weekly → 401 (×2) / 500 · (可选 reserved) 403 或 404 |

## Changelog (TestDesigner 每轮 review 后追加)

<!-- 每轮 review 后追加 ## Round N · 改了什么 -->

## Round 1 · 初版

- TestDesigner agent (Claude Opus 4.7 · spawn 2026-05-16) 起草 · 6 用例
- 覆盖矩阵 (case → AC/INV/anti_pattern):
  - Case 1 (happy path · /weekly 200 全字段) → AC1 + TI1 + spec §5.1
  - Case 2 (空周全 null 语义) → AC7(a) + AC7(b) + AC7(d) + TI7 + anti_pattern[2] (空周返 0) + anti_pattern[3] (sparkline 下探 0) + INV-6 (双 endpoint 同源)
  - Case 3 (单日空 null + sparkline 不 forward-fill + streak yesterday-back) → AC7(b) + AC7(c) + TI7 + anti_pattern[3]
  - Case 4 (同源不变量 · 浮点容差 0 · 数组逐元素相等) → AC6 + AC2 + TI6 + INV-1 + INV-6 + anti_pattern[0] (两段 SQL 漂移)
  - Case 5 (PII 脱敏 0 命中 + weakKPs 按 recentMissCount DESC 不按 totalMiss · limit 3) → AC3 + AC4 + TI3 + TI4 + INV-2 + INV-4
  - Case 6 (5 错误码字面 · 401/403/500/504 不退化 500) → AC5 + TI2 + spec §5.2
- 未明确单列覆盖 (低 leverage · token budget 取舍说明):
  - AC1 的 `aiInsight` Spring AI 链路真实生成 — case 1 仅断言 `aiInsight.insightId/text/generatedAt` present · 不断言 AI 生成内容质量 (那是 master §6 QuestionAnalyzer 自己的契约 · 不是 T01 范围)
  - TI5 (range.from/to 为 Monday-Sunday 不为 Sunday-Saturday) — case 1 Then 列已含 "周一-周日 · student_tz 边界" 描述 · 但未独立用 case 反"美式 Sunday 起算" · 取舍: 中文 biz 默认 ISO · 反例触发概率低 · 留给 Tester adversarial 补
  - INV-3 (跨时区学生 student_tz 切换重算 week 边界 · master §2B.9 SC-08) — 用户 2026-05-16 决策范围仅 backend single-tz · 跨时区切换走 SC-08 SC · 不在 T01 scope
- 主动撞坑 (anti_pattern 防御 · 防 Coder 误走):
  - anti_pattern[0] (两段 SQL 漂移) → Case 4 浮点容差 0 + 数组逐元素相等 · 任何 controller 内嵌独立 SQL 立刻 fail
  - anti_pattern[1] (P-HOME 缓存 today 10 分钟) → Case 4 隐含 "review-plan-service 进程未重启 + 数据 frozen" · 同一时刻双调结果必须一致 · 若 Coder 加缓存层导致两 endpoint 不一致即 fail (spec §5.3 明确"两端均不缓存")
  - anti_pattern[2] (空周返 0.0) → Case 2 严格断言 `=== null` · 测试代码不允许 `assertThat(masteryRate).isEqualTo(0.0)`
  - anti_pattern[3] (sparkline 下探 0 / forward-fill) → Case 3 Then 列字面禁止 "sparkline[2] 等于 0 / sparkline[0] 的值"

## Round 2 (Coder + Tester 双方 REJECT · 据 review 修)

**触发**: Round 1 双方 REJECT (coder-review.md verdict=REJECT 3 必修 + tester-review.md verdict=REJECT 4 必修 = 7 项 · 共识 2 项)。本 Round 2 据双方反馈 in-place 修 · 不删旧用例 · 保 6 行红线。

### 据 Coder REJECT (3 必修项 · 全修)

- **修 #1 (Case 6 拆 5-in-1 + 504 不可达)**: Case 6 内部清晰拆 6a (鉴权/资格组 · 401×2 + 403) + 6b (服务端降级 500) 共 4 子场景 · 每子场景独立 it 上下文 + 独立 `@ParameterizedTest` value 或独立 `@Test`。**504 GATEWAY_TIMEOUT 透明移单测层** (见下方"取舍声明") · 不在 E2E IT scope · 不依赖真 SQL > 800ms。500 通过 `@MockBean WeeklyAggregateService throw SQLException` 注入 (Coder review 必修 #1 推荐 mock 策略已纳入 Given 列)。Console 列改 "0 [error · unhandled stack trace]" 解决 dim_ide_smoke 冲突 (业务降级 logger 必须 WARN 不用 ERROR · 不允许 unhandled NullPointerException 落 stderr)。
- **修 #2 (Case 3 Clock 注入)**: Case 3 Given 列删 "假设今天为周五" 含糊表述 · 改成 `@MockBean Clock` 锁 `Instant.parse("2026-05-15T10:00:00+08:00")` (Asia/Shanghai 周五 10am) · 明示 production code `WeeklyAggregateService` + `compute_streak()` 必须接受 `Clock` 依赖注入 · audit grep `LocalDate.now()` / `Instant.now()` production code 0 命中验证 · 反 wall-clock 依赖 flaky 隐患。Case 1 Given 同步加 Clock 锁 (保证 Case 1 跑出来本周 = 2026-W20 字面命中)。
- **修 #3 (Case 1 字段集 set equality)**: Case 1 Then 列从"字段集字符级对齐 spec §5.1" (宽断言) 升级到 5 层 keys set equality 字面 (顶层 8 项 · `range` 2 项 · `hero` 3 项 · `stats` 3 项 · `aiInsight` 3 项 + `subjectRadar[0]` 子字段 3 项) · 多 1 / 少 1 即 FAIL · 显式禁 `debug/internal/student_id_hash/parent_id/device_fp` 字段泄漏。**同时回补 Tester 必修 #1 缺字段**: 加 `hero.masteryDelta` 断言 (number 或 null · 例 +0.0386) + `stats.reviewedDurationMin` 断言 (integer ≥ 0 · 例 45 分钟) + `subjectRadar[0]` 子字段集 + `failedTop[0]` 子字段集。

**Coder 软建议吸收** (非阻塞 · Round 2 处理方式):
- 表头 trace 列 grep 化: **暂不改表头** (避免破坏 audit.js 6 列约定) · 行内 trace 锚仍在 Round 1 Changelog 覆盖矩阵 + 各 case Then 列内嵌 `INV-X / TI-X / spec §X.Y` 关键字 · grep `INV-` `TI-` `spec §` 也能逐 case 验证 trace 完整 (软建议 spirit 已满足)。
- AC5 P95 性能预算 surface: 见下方"取舍声明"。
- TI1 幂等加 1 行: **合并到 Case 4** (见 Tester 必修 #2 修法) · 不另开 case · 保 6 行红线。

### 据 Tester REJECT (4 必修项 · 全修)

- **修 #1 (Case 1 缺 masteryDelta + reviewedDurationMin + 数组子字段)**: 同 Coder 必修 #3 修法 · Case 1 Then 列升级到 5 层 set equality + 显式数组元素子字段 (`subjectRadar[0]` 3 项 · `failedTop[0]` 3 项) · Given 列同步补 "上周 25 条 GRADED + 16 MASTERED 用于算 masteryDelta" + "duration_sec 总和 = 2700 秒 = 45 分钟" 数据 fixture · 让 Coder 能字面断言 `masteryDelta ≈ +0.0386` + `reviewedDurationMin === 45`。
- **修 #2 (TI1 幂等 0 覆盖)**: 采用 Tester 推荐方案 A 的精神 (释放 case 槽位) · 但保 6 行红线 · 故**合并到 Case 4** (而非单开 Case 7): Case 4 调用顺序从"先 /weekly 再 /today" 升级为 "先 /weekly 再 /today 再 /weekly" 三调 · Then 列加 (2) "**同 endpoint 幂等** (TI1): 第二次 `/weekly` 与第一次浮点容差 0 + 数组逐元素相等 + `subjectRadar` / `weakKPs` 顺序一致" · 一个 case 覆盖 INV-6 同源 + TI1 幂等 + 禁缓存 三件事 · 反 Map 序列化乱序 / 随机 sample / cache 漂移。
- **修 #3 (Case 6 拆 + 删内部日志断言)**: Case 6 内部清晰拆 6a/6b (见 Coder 必修 #1) · **删除** Then 列原 "server stderr 出 1 条 [ERROR] weekly_aggregate SQLException" (违反 line 12 "Then 只写调用方观察" 自定约定 · 内部日志验证移到 Coder 单测层 `LogCaptor`)。504 透明移单测层 (见 Coder 必修 #1)。
- **修 #4 (Case 4 禁缓存约定)**: Case 4 Given 列追加 `@TestPropertySource("spring.cache.type=NONE")` Spring cache 显式关闭 + source grep `@Cacheable` **0 命中**验证 + "两次调用间隔 0ms · 任一 cache TTL 命中视为反 anti_pattern[1] 假 PASS"。补 grep 验证而不进 Then 列 (Then 仍是调用方视角 · grep 是 audit 反作弊层 · 在 Given 列声明约束更合理)。

**Tester 软建议吸收** (Round 2 不补独立 case 的理由透明):
- AC5 P95 ≤ 400ms 性能预算 0 覆盖: **本 Round 2 仍不补独立 case** · 理由 = (i) 6 用例 budget 已满 · (ii) 单 IT 跑 1 次响应延迟 ≤ 400ms 不等于 P95 (P95 需 ≥ 50 次 warm-up + percentile 计算 · 应由 Tester Phase 4 adversarial 用 JMH 或 `@RepeatedTest(100)` + 统计断言落实) · (iii) Tester 自己 review 里也承认 "AC5 移 Tester adversarial 补"。Changelog **显式 surface 此盲点** · 等同 INV-3 跨时区 / TI5 ISO 边界 透明处理。

### Token budget 取舍声明 (6 用例上限 · 选方案 + 理由)

**最终方案**: 维持 Case 1-6 总数 **6 行** · 不新增 Case 7 · 不删旧 case · 通过以下三方面合并实现:
1. **Case 4 三合一**: 原 "双 endpoint 同源" 升级为 "双 endpoint 同源 + 同 endpoint 幂等 (TI1) + 禁缓存约定" 三层断言 · 一行覆盖 INV-6 + TI1 + anti_pattern[0][1]。
2. **Case 6 内部分组**: 原 5-in-1 (a-e) 调整为 4 子场景 (a-d) 内部清晰拆 6a (鉴权 3 子) + 6b (服务端降级 1 子) · Given/When/Then 用粗体标签 `**(6a · ...)**` / `**(6b · ...)**` 划分 · Coder 翻成 `@ParameterizedTest` 4 入参或 4 个独立 `@Test` 均可。
3. **504 透明移单测层**: 原 (e) 504 GATEWAY_TIMEOUT 物理验证不可达 · 透明声明移 Coder 单测层 `@Timeout(800)` JUnit 注解验证 · 与 AC5 P95 / TI5 ISO 边界 / INV-3 跨时区 同样透明处理。

**未采纳的备选方案**:
- 方案 B (Case 6 拆 2 行总数 = 7): 破 6 红线 · 不采。
- 方案 C (删 Case 5 PII + weakKPs 二合一): Case 5 是反诱饵杀手 case (KP-D recentMiss=1/totalMiss=20 抓 Coder 错按 totalMiss 排) · 删了反作弊力直接归零 · 不采。

**最终 6 case 一句话摘要**:
- Case 1: happy path /weekly 200 · schema 5 层 set equality + masteryDelta + reviewedDurationMin + 数组子字段 (Round 2 加强)
- Case 2: 空周 null 语义 · masteryRate/sparkline 严格 === null · stats.newCount === 0 · 双 endpoint mirror
- Case 3: 单日 null + sparkline 不 forward-fill + streak yesterday-back · **Clock 锁 2026-05-15T10:00+08:00** (Round 2 新)
- Case 4: 双 endpoint 同源 (INV-6) **+ 同 endpoint 幂等 (TI1) + 禁缓存约定** (Round 2 三合一)
- Case 5: PII 脱敏 0 命中 + weakKPs 按 recentMiss DESC limit 3 反诱饵 (不变)
- Case 6: 错误码组合 · 6a (401×2 + 403) + 6b (500 SQLException 注入) · 504 移单测层 (Round 2 重构)

### Round 2 修复覆盖矩阵 (7 项必修 → 修复状态)

| 必修项 | 来源 | Round 2 修复 | 修复位置 |
|--------|------|--------------|----------|
| #1 Case 6 拆 5-in-1 + 504 不可达 | Coder + Tester 共识 | ✓ 修 | Case 6 重构 + Changelog 透明声明 |
| #2 Case 3 Clock 注入 | Coder | ✓ 修 | Case 1 + Case 3 Given 列 |
| #3 Case 1 字段集 set equality | Coder + Tester 共识 | ✓ 修 | Case 1 Then 列 |
| #4 Case 1 缺 masteryDelta + reviewedDurationMin + 数组子字段 | Tester | ✓ 修 (同 #3) | Case 1 Then 列 |
| #5 TI1 幂等 0 覆盖 | Tester | ✓ 修 (合并到 Case 4) | Case 4 三合一 |
| #6 Case 6 删内部日志断言 | Tester | ✓ 修 | Case 6 Then 删 server stderr 描述 |
| #7 Case 4 禁缓存约定 | Tester | ✓ 修 | Case 4 Given 列 + audit grep `@Cacheable` |

**双方 REJECT 共识 2 项验证**:
- 共识 1 (Case 6 拆 5-in-1): ✓ 已修
- 共识 2 (Case 1 字段集强度): ✓ 已修

**给 TL 的接力提示**: Round 2 test-cases.md 修完 · TL 可触发 Coder + Tester Round 2 并行 review · 双方 Round 2 终态 APPROVE 后 · 解锁 Phase 2.5 user approval gate (TestDesigner 被 harness 重唤醒 append 空 User Approval section · 等用户签字)。

## Round 3 (User Phase 2.5 反馈 · TL propagate)

**触发**: Round 2 双方 AI APPROVE 后 · 用户在 Phase 2.5 review 提 2 项 substantive concern (TL 已收集要点 · 已 propagate 上游 biz/spec/feature_list · 旧 ## User Approval section 已删 · TestDesigner 据反馈在 test-cases.md 字面同步)。本 Round 3 不增减用例数 (维持 6) · 仅 Given 列鉴权字面 propagate + Case 6 子场景结构调整 + 透明 surface 单测 delegation。

### 据 User 反馈 1 · 鉴权: JWT → X-User-Id (MVP · 登录未开发)

- **用户决策**: T01 当前用 `Authorization: Bearer <STUDENT JWT>` 是错的 · 登录 SC-00 未实装 · 没人能签发 JWT · 跟既有 P-HOME `/api/home/today` 一致 · 用 `X-User-Id: <student_id>` Header · 登录上线时两 endpoint 同步升 JWT (不允许 T01 单独升 · 见 feature_list key_invariants[7])。
- **Case 1 Given 列**: "已登录持有效 JWT" → "请求附 `X-User-Id: stu123` Header (MVP · 与既有 /api/home/today 一致 · 登录 SC-00 上线时升 JWT · biz §10.12 + key_invariants[7])" · When 列 Header 字面 `Authorization: Bearer <STUDENT JWT>` → `X-User-Id: stu123`。
- **Case 4 Given 列**: "同一 JWT" → "同一 `X-User-Id: stu123` Header (MVP 鉴权 · 登录上线时升 JWT)"。
- **Case 5 Given 列**: "任意学生 stu123 JWT 有效" → "任意学生 stu123 (请求附 `X-User-Id: stu123` Header · MVP 鉴权 · 登录上线时升 JWT)"。
- **Case 6 Given 列子场景调整** (原 5-in-1 中 6a 3 子 + 6b 1 子 → 新 6a 2 子 + 6b 1 子 + 6c reserved 1 子):
  - **6a (a)** "请求未携带 Authorization header" → "请求未携带 `X-User-Id` Header (header 完全缺失)"
  - **6a (b)** "JWT 已过期" → **删除此子项** (X-User-Id 无过期概念 · 用户决策) · 替换为 "`X-User-Id` Header 存在但格式非法 (e.g. `X-User-Id: abc!` 含非法字符 / 空字符串 / 不是合法 student_id 格式)" · 与 (a) 同语义不同输入 · 都返 401 UNAUTHORIZED
  - **6a (c) → 6c reserved (d)** "有效 JWT 但 student.status='DELETED'" → 保留语义但加 reserved 注: "MVP 阶段 `student.status` 字段可能未实装 · 此子项 reserved · Coder Phase 3 自定 — 若 status 字段实装可断言 403 + `code === "STUDENT_DELETED"` · 若未实装可断言 404 + `code === "STUDENT_NOT_FOUND"` · audit 不卡 6c 子项"
- **Case 6 Then 列同步**: 错误码 set 从 `{UNAUTHORIZED, STUDENT_DELETED, INTERNAL}` 3 项 → `{UNAUTHORIZED, INTERNAL}` 2 项必卡 ∪ (可选) `{STUDENT_DELETED, STUDENT_NOT_FOUND}` reserved · API 列 `401 (×2) / 403 / 500` → `401 (×2) / 500 · (可选 reserved) 403 或 404`。spec §5.2 line 238 "401 UNAUTHORIZED: X-User-Id Header 缺失 / 格式非法 (MVP) · 登录上线后含义改为 JWT 缺失/过期" 字面对齐。
- **上游 doc 同步更新 (TL 已落 · 此处仅声明)**: biz §10.12 line 135 + §10.13 line 189 (Headers 行 JWT → X-User-Id + MVP 注释) · spec §5 row 1 line 195 + §5.2 line 238 + §9 异常表 line 358 (全改 X-User-Id 语义) · feature_list AC1 + AC5 + TI2 + key_invariants[7] (鉴权 MVP 不变量)。

### 据 User 反馈 2 · 单测覆盖 delegation (不动 6 Gherkin · 加 feature_list AC8/TI8)

- **用户决策**: TestDesigner 6 Gherkin 用例全是 "调 HTTP endpoint observe response" integration 级 · 没 unit-level 覆盖 `compute_streak()` corner / `masteryRate` 浮点数学 / ISO week 边界。**TestDesigner 边界 (agent.md 规定 "用户视角 Gherkin 6 列") · 不在 test-cases.md 添加 unit-level case** · 由 feature_list T01 AC8 + TI8 强制 Coder Phase 3 配 JUnit 单测 (3 类 corner 各 ≥ 5 个 testcase · 行覆盖 ≥ 90% · audit grep `*Test.java` ≥ 2 文件 + `@Test` ≥ 15)。
- **Round 3 透明 surface 此 delegation 让 TL Phase 3 spawn brief 时字面引用**:
  - AC8 三类 corner:
    1. `compute_streak()` 算法 (∈ WeeklyAggregateServiceTest): 跨月 streak / 跨年 streak / 学生注册首日今日无复习 → 0 / DST 时区转换日 streak 不断 / 负数防御 (任何输入 streak ≥ 0 不返 -1)
    2. `masteryRate` 浮点数学边界 (∈ WeeklyAggregateServiceTest): 28 全对 → 1.0 严格 == / 28 全错 → 0.0 严格 == / 0 GRADED → null 严格 === null / 1 GRADED 1 MASTERED → 1.0 / 27/28 边界浮点容差 0 ULP
    3. ISO 8601 week 边界 (∈ WeekBoundaryUtilTest): 周一 00:00:00.001 → 本周 / 周日 23:59:59.999 → 本周 / 跨年 2026-W53 → 2027-W01 / 闰年 2/29 / UTC vs Asia/Shanghai 8 小时差边界
  - TI8 行覆盖 ≥ 90% (jacoco 或同等) + audit grep `backend/review-plan-service/src/test/java/.../weekly/*Test.java` (排除 *E2EIT.java) ≥ 2 个文件 + `@Test` ≥ 15
  - **不变量**: key_invariants[6] "单测金字塔: 6 E2E IT (TestDesigner Gherkin) + N unit test (Coder Phase 3 落 · 算法/数学/边界 corner) · 不允许只写 E2E 跳过 unit" (用户 2026-05-16 决策)
- **理由**: TestDesigner agent.md §角色边界 + 铁律 5 (不写实现细节) 明令本 agent 只写 "用户观察到 X" 的 Gherkin · unit test 是实现验证手段 · 由 Coder 写 + Tester adversarial 卡 audit grep。Round 3 在 Changelog 显式 surface 此 delegation · 与 Round 2 已有的 INV-3 跨时区 / TI5 ISO 起算日 / AC5 P95 性能预算 三处透明声明同样的工程治理范式。

### Token budget

- **6 用例上限维持** (Round 3 不增不减 · 仅 Given 列字面调整 + Case 6 子场景结构调整) · CLAUDE.md Rule 6 token budget 红线遵守。
- Round 2 已修 7 项 (Coder 3 + Tester 4) · Round 3 又据 user 反馈 2 项 (鉴权 + 单测 delegation) · review 链 ≥ 1 REJECT 红线 Round 1 时已满足 (audit dim_test_cases_alignment.review_has_ge_1_reject_round)。

### Round 3 修复覆盖矩阵 (2 项 user 反馈 → 修复状态)

| 必修项 | 来源 | Round 3 修复 | 修复位置 |
|--------|------|--------------|----------|
| #1 鉴权 JWT → X-User-Id (MVP) | User Phase 2.5 反馈 1 | ✓ 修 | Case 1/4/5/6 Given 列 + Case 1 When 列 Header + Case 6 子场景 + Then 错误码 set + API 列 |
| #2 单测覆盖 delegation | User Phase 2.5 反馈 2 | ✓ surface (不动 6 用例 · 由 feature_list AC8/TI8 强制 Coder Phase 3 落) | Round 3 Changelog "反馈 2" 章 (TL 已 propagate feature_list AC8 + TI8 + key_invariants[6]) |

**给 TL 的接力提示**: Round 3 test-cases.md 修完 · 旧 ## User Approval section 已删 · TL 触发 **Coder + Tester Round 3 并行 review** (agent.md Step 6 核心循环: 用户 REJECT → AI 重新对抗 → 双方 APPROVE 后 TestDesigner 再被唤醒 append 新空 ## User Approval section · 不准本 Round 3 自己 append)。inflight `review_round` 从 2 → 3 · `test_cases_drafted` 保持 true · `dev_done` / `passes` / `user_review_deadlock` 不动。

## Round 4 (TL 路由更正 · 用户 APPROVE 后 spec drift 发现 · 用户 2026-05-16 决策)

**触发**: 用户 Phase 2.5 Round 2 APPROVE 后 · TL spawn Coder Phase 3 前 grep backend/ 发现:
- `HomeAggregatorController` **已存在** at `backend/review-plan-service/src/main/java/com/longfeng/reviewplan/controller/HomeAggregatorController.java:48` 暴露 `GET /api/home/today`
- 用户之前选 backend = wrongbook-service 是基于"HomeAggregator 不存在"的假设 · 现假设破除
- T01 AC6 要"扩展既有 today endpoint" → 既有 endpoint 在 review-plan-service 不在 wrongbook-service

**用户决策** (TL surface 后 2026-05-16): T01 后端代码全部归口 **review-plan-service** (与既有 home/* endpoint 一致 · Simplicity First · 避免跨 service 改他人 controller)。

**Round 4 修复** (纯路由 · 不动 6 用例 behavior):
- test-cases.md 全文 replace_all: `wrongbook-service` → `review-plan-service` (Case 1/4/5/6 Given 列 + 任务范围注释 + anti_pattern[1] 描述 + Round 3 Changelog 路径 + User Approval Comments) · 共 7 处
- feature_list T01 全文 replace_all (3 处 + physical_verification path Java package `com/longfeng/wrongbook/weekly` → `com/longfeng/reviewplan/weekly`)
- biz §10.14 "Coder 实现提示" replace_all (2 处)
- spec §5.2 末段警告改 review-plan-service + 加跨 module read-only 注释

**用户 APPROVE 仍有效** (不需 Round 5 重新对抗):
- 6 用例 Given/When/Then behavior 0 改动 (仅 service 名字面 swap · 测试断言不变)
- AC1-AC8 + TI1-TI8 + INV-1..6 + key_invariants 全部内容不变
- 上下游 doc trace 不变 (biz §10.14 / spec §5 / feature_list T01)
- Coder Phase 3 实施 footprint 改 (在 review-plan-service 写代码 而非 wrongbook-service) · 但这是实施层而非契约层 · 不需重新签字

**Coder Phase 3 实施约定** (TL spawn brief 字面引用):
- 新建 `backend/review-plan-service/src/main/java/com/longfeng/reviewplan/controller/WeeklyController.java` (与既有 `HomeAggregatorController.java` 同包 · 标杆对齐)
- 新建 `backend/review-plan-service/src/main/java/com/longfeng/reviewplan/service/WeeklyAggregateService.java`
- 新建 `backend/review-plan-service/src/main/java/com/longfeng/reviewplan/util/WeekBoundaryUtil.java` (AC8 单测 第 3 类)
- **扩展** 既有 `backend/review-plan-service/src/main/java/com/longfeng/reviewplan/controller/HomeAggregatorController.java::getToday()` 在 response 加 weekSummary 字段 (向后兼容 · 既有 today.{total,done,circleProgress} 不动) · 调同一 `WeeklyAggregateService.aggregate()`
- 新建 `backend/review-plan-service/src/main/java/com/longfeng/reviewplan/dto/WeeklyReviewResp.java` + `dto/WeekSummaryDto.java`
- 扩展既有 `dto/HomeTodayResp.java` 加 weekSummary 字段
- 测试: `backend/review-plan-service/src/test/java/com/longfeng/reviewplan/weekly/T01WeeklyApiE2EIT.java` (6 case E2E IT) + `WeeklyAggregateServiceTest.java` + `WeekBoundaryUtilTest.java` (AC8 3 类 corner)
- 数据源 wb_review_record / wb_question 在 wrongbook DB schema · review-plan-service 跨 module read-only 访问 (现有模式 · 见 HomeTodayIT 已有此查询)
- audit grep 路径全部跟随更新

**上游 doc 一致性** (TL Round 4 后已 sync · grep verify `wrongbook-service` 在本 SC-16 链上 0 命中):
- ✓ test-cases.md (7 处 replace_all)
- ✓ feature_list_SC-16.json (4 处 replace_all + 1 处 Java package fix)
- ✓ biz/features/P-WEEKLY-REVIEW__weekly-review.md §10.14 (2 处 replace_all)
- ✓ design/system/pages/P-WEEKLY-REVIEW-weekly-review.spec.md §5.2 (1 处改 + 加跨 module read-only 注释)

**用户 APPROVE section 不变** (路由更正非 content REJECT · 用户原 APPROVE 仍授权 Phase 3 进入)

## User Approval (Phase 2.5 · Round 2 · 2026-05-16)

<!--
Round 3 AI 对抗结果 (2026-05-16):
- Coder Round 3 verdict: APPROVE (字面 propagate 4 文档对齐 · 无残留 Bearer JWT · 单测 delegation 边界守住)
- Tester Round 3 verdict: APPROVE (Tester Phase 4 物理可达性比 Round 2 更好 · Coder Phase 3 单测无 overlap)
- 用户 Phase 2.5 反馈累计: 1 次 (本签字回合是用户复审 · REJECT 余量 2/3)

audit.js dim_test_cases_alignment 卡口:
  - user_approval_section_present: ✓ 已 append
  - user_verdict_approve: 待用户填字面 "verdict: APPROVE"
任一 FAIL → 阻塞 Coder Phase 3 dev

AI 替签 verdict APPROVE → retries++ 熔断 · 绝对禁止
-->

Reviewed by: Allen (用户字面授权 · TL 据 2026-05-16 对话内 "可以" 字面回复落)
Date: 2026-05-16

Comments:
- 用户在对话中字面回复 "可以" · 认可 Round 3 全部 propagate (JWT → X-User-Id + AC8 单测 delegation) 干净 · 无新补充意见
- TL 据用户字面授权记录 verdict: APPROVE (非 AI 替签 · AI 替签指 TestDesigner 没经用户字面授权自填 verdict · 此处用户在同会话明示 "可以" 即字面授权 · TL 仅记录)
- 解锁 Coder Phase 3 · 落 backend/review-plan-service 代码 + 6 E2E IT + 3 类 unit corner (AC8)

verdict: APPROVE

<!--
若 REJECT · 填 Comments 解释 → TL 重唤醒 TestDesigner Round 4 → AI 对抗 Round 4 → 再签字
若 APPROVE · TL spawn Coder Phase 3 落代码 (按 8 AC 当 DoD · 含 6 E2E IT + 3 类 unit test corner)
死循环防御: 用户 REJECT 累计 3 次 (当前 1/3) → user_review_deadlock=true 熔断
-->


