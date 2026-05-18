# P-WEEKLY-REVIEW · 本周回顾详情页 — Satellite Biz Doc

**Status**: Draft
**Owner**: full-stack (frontend + backend)
**Created**: 2026-05-16
**Priority**: P1
**Master ref**: [../业务与技术解决方案_AI错题本_基于日历系统.md](../业务与技术解决方案_AI错题本_基于日历系统.md) (v1.2 · 2026-04-21)
**Mockup**: design/mockups/wrongbook/14_weekly_review.html

---

## §0 TL;DR

补齐 P-HOME 首屏「本周」Bento 区段右上「查看全部 ›」link 的落地页缺口。学生在概览看到 4 个数字（掌握率 / sparkline / Streak / 本周新增）后，点入可看到**完整周复盘**：分学科掌握率曲线 / 本周薄弱 KP top 3 / 本周已复习题数 / 本周失败题 top N / 上周对比 delta / 一句话 AI 复盘。与「本周日程」(未来排期 · 跳 P10) + P10 月视图 (整月排期) 三者职责清晰分离 —— 本页是**过去时 · 成果视图**。

### 0.1 增量摘要表 [REQUIRED]

| 类型 | ID | 名称 | 优先级 | Owner |
|---|---|---|---|---|
| 新页面 | P-WEEKLY-REVIEW | 本周回顾详情页 | P1 | frontend |
| 新 SC | SC-16 | 学生周复盘 → 薄弱 KP 专练入口 | P1 | full-stack |
| 新 API | `GET /api/home/weekly` | 周聚合数据 (掌握率 / KP / 复习耗时 / delta) | P1 | backend |
| 新 mockup | `design/mockups/wrongbook/14_weekly_review.html` | 视觉稿 | P1 | design |
| 复用 | `wb_review_record` + `wb_question` + `wb_review_node` (master §4.5/4.6) | 不新增 DB 表/列 | — | — |
| 复用 | master §10.10 `/api/observer/overview.weeklyReport` 服务端聚合逻辑 | 学生端 + 家长端共享同一 service · 字段脱敏不同 | — | backend |

---

## §1 业务目标增量

### 1.1 涉及角色 (引用 master §2A.1 · 不重新定义)
- **学生** (master §2A.1 行 L54-L57) — 本页的唯一直接用户
- (不涉及 P-OBSERVER · 家长 / 班主任的周报走 master §10.10 `/api/observer/overview`)

### 1.2 MVP 边界 (本次做什么 / 故意不做什么)
- **本次做** (P1):
  - 看"刚过去这一周" (current ISO week · 不支持任意历史周回溯)
  - 6 大数据块: 掌握率折线 / 学科分布雷达 / 薄弱 KP top 3 / 复习耗时 / 上周 delta / AI 一句话复盘
  - 1 个交互出口: Tap 薄弱 KP → 跳 P05 错题列表 (filter by kpId)
- **故意不做** (留 P2):
  - 历史周回溯切换器 (左右切周按钮 + week picker)
  - 月度 / 学期回顾视图
  - 周报 push 推送 (走 master §S6 复用即可 · 不在本 satellite 范围)
  - 家长端联动 (P-OBSERVER 已有独立路径 · master §2B.16 SC-15)

### 1.3 北极星指标贡献 (引用 master §1.4 L84-L96)
- 预计提升**周留存** (D7 / D14 留存) · 通过"看到自己进步"的正反馈循环
- 预计提升**艾宾浩斯掌握率提升曲线** (master §1.4 北极星 #5) · 通过引导薄弱 KP 专练
- 不影响匿名漏斗三条曲线 (master §1.4 v1.2 新增) — 本页是登录态后置场景

---

## §2A.3 IA 增量

### 2A.3.1 新路由行 (插入 master §2A.3 路由表)

插入位置: master §2A.3 路由表 (L217-L237) 第 P13 行后 (L238 之后)

| ID | 页面 | 小程序路径 | H5 路由 | 深链 | 登录态 | 源 HTML 稿 |
|---|---|---|---|---|---|---|
| P-WEEKLY-REVIEW | 本周回顾详情页 | `pages/me/weekly` | `/weekly` | `wb://weekly` | 正式账号 | `14_weekly_review.html` |

### 2A.3.2 深链规则 (新增 wb://)
- `wb://weekly` → P-WEEKLY-REVIEW (默认看 current ISO week · 无参数)
- (P2 预留: `wb://weekly?week=2026-W18` 切换历史周 · 本 satellite 不实现)

---

## §2A.4 新页面卡 [REQUIRED]

#### P-WEEKLY-REVIEW · 本周回顾详情页（Weekly Review）

| 维度 | 内容 |
|---|---|
| **页面目的** | 给学生一个"看自己一周表现"的复盘视图 · 把 P-HOME 首屏「本周」Bento 概览的 4 个数字深挖到 6 个数据块 · 引导学生从"看到薄弱"自然进入"专练薄弱" · 形成"复盘 → 行动"正反馈闭环 (区别于 P10 月视图的"未来排期"心智) |
| **首屏目标 (≤3s 注意力)** | ① 掌握率本周走势是涨是跌一眼看清 (折线 + delta) · ② 本周最薄弱的 1 个 KP 一眼看清 (top 1 卡片高亮) · ③ Tap 薄弱卡 1s 内能进 P05 专练 |
| **布局分区**（从上到下） | `[topbar: 标题 "本周回顾" + 周次 "2026 W20" + 返回 X]` → `[Hero 暗卡: 大数字掌握率 + 折线 sparkline + delta vs 上周]` → `[学科分布雷达图 4-6 学科]` → `[薄弱 KP top 3 卡片列表 (每卡: KP 名 / 错次数 / "立即专练" CTA)]` → `[本周已复习 N 题 + 复习耗时 N 分钟 + 新增 +N 题 三联 stat]` → `[本周失败题 top N 横滑卡片 (每卡: 缩略图 + 学科 + 错次数)]` → `[底部 AI 一句话复盘 (智能体生成 · 30 字内)]` |
| **核心组件** | `<WeeklyHeroCard>` (新 · 复用 P-HOME `<WeeklySparkline>` 样式) · `<SubjectRadar>` (新 · 复用 P-OBSERVER `<SubjectRadar>` 组件 master §2A.3.2 P-OBSERVER) · `<WeakKPCard>` (新) · `<StatTrio>` (新 · 三联 stat) · `<FailedQuestionScroller>` (新 · 横滑) · `<AIInsightBubble>` (新 · 复用 master §6 Spring AI 链路) |
| **数据绑定** | Page state: `{week: 'YYYY-Www', loading, data: {masteryRate, masteryDelta, sparkline[7], subjectRadar[], weakKPs[3], reviewedCount, reviewedDurationMin, newCount, failedTop[], aiInsight}}` · DTO 名: `WeeklyReviewResp` |
| **API 触点** | `GET /api/home/weekly` (新 · §10 增量 · 复用 master §10.10 weekly_aggregate service) |
| **状态集** | `LOADING` → `READY` (data) → `EMPTY` (本周复习数=0) · `LOADING` → `ERROR` (5xx) |
| **跳转** | 入: P-HOME Tap 「本周」Bento「查看全部 ›」(master mockup `design/mockups/wrongbook/01_home_v2.html:291` 已留 placeholder) / 深链 `wb://weekly` · 出: 薄弱 KP 卡 Tap → P05 (filter by kpId · `/wrongbook?kpId=KP-XXX`) / 失败题卡 Tap → P06 (`/wrongbook/:qid`) / 返回 X → 上一页 |
| **异常态** | `EMPTY` (本周复习数=0): 整页换"本周还没开始 · 拍一道题试试" hero + CTA → P02 · `ERROR` (5xx): 骨架屏 + 顶部黄条 "数据加载失败 · retry" + retry button · `数据部分缺失` (例 AI insight 超时): 该模块单独显示 "AI 复盘生成中" + 其他模块正常 |
| **i18n Key** | `weekly.title` ("本周回顾" / "Weekly Review") · `weekly.hero.mastery` · `weekly.hero.delta` · `weekly.weakKP.cta` ("立即专练" / "Practice Now") · `weekly.empty.hint` · `weekly.aiInsight.loading` |
| **埋点事件** | `weekly_view{week, from: 'home-banner'\|'deeplink'}` · `weekly_weak_kp_tap{kpId, rank}` · `weekly_failed_q_tap{qid}` · `weekly_ai_insight_view{insightId}` · `weekly_retry{errorCode}` |
| **可访问性** | 折线图 + 雷达图需带 aria-label 描述 (例 "本周掌握率 68% · 较上周提升 6 分") · 薄弱 KP 卡 tab order 优先 (键盘导航 1-3) · 颜色对比 ≥ 4.5:1 (WCAG AA) · 不允许仅靠颜色传达涨跌 (delta 必须带 ↑/↓ icon) |
| **性能预算** | 首屏 TTI ≤ 1.5s (含 GET /weekly P95 ≤ 400ms + 客户端渲染 ≤ 600ms) · 折线/雷达图渲染 ≤ 300ms · Tap 薄弱 KP → P05 ≤ 500ms |
| **优先级** | P1 (MVP 14 天不做 · 14 天后 P1 启动) |

---

## §2B 新 SC 卡 [REQUIRED]

### 2B.17 SC-16 · 学生周复盘 → 薄弱 KP 专练入口 (优先级: P1)

**场景目的**：验证学生从 P-HOME 首屏「本周」Bento 概览 → 进入 P-WEEKLY-REVIEW 深度复盘 → 自然引导到薄弱 KP 专练 (P05 filter) 的闭环。补齐 master §2A.3.3 P-HOME (L449-L463) 留下的「查看全部 ›」link 落地页缺口 (master mockup `01_home_v2.html:291` href="#")。

**前置条件**：前置 SC: master §2B.1a SC-00 路由分发已落 P-HOME (学生已登录态)；本周学生已完成 ≥ 3 次复习 (确保 data 非 EMPTY)；网络稳定；GET /api/home/weekly P95 ≤ 400ms。

**核心路径编排（happy path）**：

| # | 用户动作 | 页面前台 | 后端/事件 | 前端状态 | 埋点 | 耗时预算 |
|---|---|---|---|---|---|---|
| 1 | 学生在 P-HOME 滑到「本周」Bento 区 (master §2A.3.3 L455) | 本周 Bento 横向滚入视野 | — | `home.READY` | `home_week_section_view` (复用) | — |
| 2 | Tap 「本周」Bento 右上「查看全部 ›」(`01_home_v2.html:291`) | 按钮 active 态 · 路由 push 启动 | — | `home.READY` → `weekly.LOADING` | `home_weekly_review_tap{from='banner'}` | ≤ 100ms |
| 3 | 路由转场 (slide) | P-HOME 淡出 → P-WEEKLY-REVIEW 骨架屏 | `GET /api/home/weekly` (无 query · 默认 current ISO week) | `weekly.LOADING` | `weekly_view{week, from='home-banner'}` | ≤ 400ms |
| 4 | 数据返回 200 渲染 | Hero 大数字 + 折线 + delta · 学科雷达 · 薄弱 KP top 3 · 三联 stat · 失败题横滑 · AI insight 顺序淡入 | (后端: 复用 master §10.10 `weekly_aggregate` service · 学生 token 走学生脱敏规则) | `weekly.LOADING` → `weekly.READY` | `weekly_data_render{ms, masteryRate, weakKPCount}` | ≤ 600ms |
| 5 | 学生浏览数据 (3-10s) · 注意到「薄弱 KP top 1: 韦达定理 · 最近 4 次都错了」 | KP 卡 hover/focus 高亮 | — | `weekly.READY` | `weekly_weak_kp_view{kpId, rank=1}` | — |
| 6 | Tap 薄弱 KP top 1 卡片「立即专练」CTA | CTA loading · 路由 push 启动 | — | `weekly.READY` → `wrongbook.LOADING` | `weekly_weak_kp_tap{kpId='KP-382', rank=1}` | ≤ 100ms |
| 7 | 路由转场到 P05 错题列表 (filter kpId) | P-WEEKLY-REVIEW 淡出 → P05 骨架屏 → 列表渲染 (仅 KP-382 错题) | `GET /api/wb/questions?kpId=KP-382` | `wrongbook.READY` | `wrongbook_view{filter='kpId', count}` | ≤ 500ms |

**关键断言点（System Invariants）**：
- `GET /api/home/weekly` 必须复用 master §10.10 weekly_aggregate service 的同一段 SQL 聚合代码 · 不允许 fork 出独立实现 (防止学生端和家长端数据漂移)
- 学生端响应必须脱敏: 不返回 `student_id_hash` / `parent_id` / `device_fp` 等 PII (与家长端 `/api/observer/overview` 字段集不同)
- 周边界统一用 ISO 8601 week (周一开始 · UTC 转学生 tz) · 不允许混用美式 (周日开始) · 跨时区学生走 master §2B.9 SC-08 时区切换逻辑
- 薄弱 KP top 3 必须按 "最近 N 次错误次数" 降序 · 不允许按总错误次数排 (学生关心"最近正在错"而非"历史已经错")
- Tap 薄弱 KP 跳 P05 必须带 `kpId` query · P05 必须能从 URL filter (不依赖 in-memory state) · 防止用户复制链接 / 分享后 filter 丢失

**QA 用例（GIVEN / WHEN / THEN）**：

| TC ID | 类型 | GIVEN | WHEN | THEN |
|---|---|---|---|---|
| TC-16.01 | 正常 | 学生已登录 · 本周复习 ≥ 3 次 · 网络稳定 · GET /weekly P95 ≤ 400ms | 完成 SC-16 步骤 1-7 | `weekly.READY` 6 数据块全渲染 · 薄弱 KP top 1 卡片可见 · Tap 后落 P05 · URL 含 `?kpId=KP-XXX` · 埋点 `weekly_view` + `weekly_weak_kp_tap` 各 1 条 · 全程 ≤ 2s |
| TC-16.02 | 异常 | 学生已登录 · 但 GET /weekly 返 500 | 完成 SC-16 步骤 1-3 后等待 | `weekly.LOADING` → `weekly.ERROR` · 骨架屏保留 + 顶部黄条 "数据加载失败 · retry" + retry button · Tap retry 重新 GET · 埋点 `weekly_retry{errorCode=500}` 1 条 · 不允许白屏 |
| TC-16.03 | 边界 | 新学生 · 本周复习数 = 0 (从未复习过本周节点) | 完成 SC-16 步骤 1-3 | `weekly.LOADING` → `weekly.EMPTY` · 整页换"本周还没开始 · 拍一道题试试"hero + CTA "去拍题" · Tap CTA → P02 · 埋点 `weekly_view{week,empty=true}` 1 条 · 不渲染薄弱 KP / 失败题等空数据块 |

---

## §10 API 增量 [REQUIRED]

### 10.12 学生周聚合 (P1 · SC-16)

```
GET  /api/home/weekly
Headers: X-User-Id: <student_id>                  // MVP 简化 · 与既有 /api/home/today 一致 · 登录 (SC-00) 上线时双 endpoint 同步升 JWT
         X-User-Timezone: <IANA tz e.g. Asia/Shanghai>  // 可选 · 缺省读 user_setting.timezone
Query:   (none · 默认 current ISO week · P2 预留 ?week=YYYY-Www)
Resp:    200 WeeklyReviewResp
         {
           week: "2026-W20",                          // ISO 8601 week
           range: { from: "2026-05-11", to: "2026-05-17" },  // 学生 tz 边界
           hero: {
             masteryRate: 0.68,                       // 0..1
             masteryDelta: +0.06,                     // vs 上周 · 可负
             sparkline: [0.55, 0.58, 0.60, 0.62, 0.65, 0.66, 0.68]  // 7 天每日掌握率
           },
           subjectRadar: [
             { subject: "math", masteryRate: 0.72, sampleSize: 12 },
             { subject: "physics", masteryRate: 0.58, sampleSize: 8 },
             { subject: "english", masteryRate: 0.80, sampleSize: 5 }
             // ... 4-6 学科
           ],
           weakKPs: [                                 // top 3 · 按"最近 N 次错"降序
             { kpId: "KP-382", kpName: "韦达定理", recentMissCount: 4, totalMissCount: 7 },
             { kpId: "KP-201", kpName: "牛顿第二定律", recentMissCount: 3, totalMissCount: 5 },
             { kpId: "KP-450", kpName: "现在完成时", recentMissCount: 2, totalMissCount: 4 }
           ],
           stats: {
             reviewedCount: 28,                       // 本周已复习题数 (GRADED 总数)
             reviewedDurationMin: 142,                // 本周复习累计分钟
             newCount: 8                              // 本周新增错题
           },
           failedTop: [                               // 本周失败题 top N (最多 5 题)
             { qid: "Q-1024", subject: "math", thumbnail: "https://cdn/..." , missCount: 3 }
             // ...
           ],
           aiInsight: {
             insightId: "WI-2026W20-stu123",
             text: "你这周在韦达定理上反复栽 4 次,建议先把 3 道经典题练熟。",  // ≤ 50 字 · Spring AI 生成
             generatedAt: "2026-05-17T08:00:00Z"
           }
         }
Err:     401 UNAUTHORIZED · 403 STUDENT_DELETED · 500 INTERNAL (走 SC-16 TC-16.02 降级)
SLA:     P95 ≤ 400ms · P99 ≤ 800ms
```

**复用说明**:
- 后端服务复用 master §10.10 P-OBSERVER `weekly_aggregate` service 的同一段 SQL 聚合代码 · 学生端 + 家长端共享 service · **唯一区别在脱敏层**: 学生端不返回 `student_id_hash` / `parent_id` / `device_fp` · 家长端不返回原始 `qid` (master §10.10 已 mask 为 `kpTagsMasked`)
- 复用 master §6 Spring AI 链路生成 `aiInsight.text` · 提示词模板挂 master §6.2 的同一 `QuestionAnalyzer` interface 的兄弟 prompt

### 10.13 P-HOME 共享投影 (P1 · SC-16 关联 · 用户 2026-05-16 决策)

**背景**: master P-HOME spec.md L151 注明 `weekSparkline / streak / newCount / masteryRate` 等 9 字段在 MVP 不下发, 前端 hardcoded。本 satellite 落地时**顺便补齐**其中 4 字段 (`masteryRate / sparkline / streak / newCount`) · 防止学生在 P-HOME 看 hardcoded 68% / Tap 进 P-WEEKLY-REVIEW 看真值 65% 的 spec drift。

**扩展**: 既有 `GET /api/home/today` response 新增 `weekSummary` 对象 (向后兼容 · 既有 today.{total,done,circleProgress} 子集不动):

```
GET  /api/home/today?tz=Asia/Shanghai
Headers: X-User-Id: <student_id>              // P-HOME spec §5 既定 · MVP 简化 · 登录 (SC-00) 上线时升 JWT
         X-User-Timezone: <IANA tz>            // 可选
Resp:    200 (新增 weekSummary 字段)
         {
           tz: "Asia/Shanghai",
           today: { total: 8, done: 3, circleProgress: 0.375 },   // 既有 · 不动
           resume: null,                                          // 既有 · 不动
           weekSummary: {                                         // 新增
             week: "2026-W20",
             masteryRate: 0.68 | null,                            // 空周时 null · 不为 0
             sparkline: [0.55, null, 0.60, 0.62, null, 0.66, 0.68],  // 长度 7 · 空日 null · 不 forward-fill
             streak: 5,                                           // 整数 ≥ 0 · 从昨天起往回数
             newCount: 8                                          // 整数 ≥ 0 · 不为 null
           }
         }
```

**强制约束**:
1. **同源不变量** (System Invariant #6): `GET /api/home/weekly.hero.masteryRate` ≡ `GET /api/home/today.weekSummary.masteryRate` · 同一 `weekly_aggregate` service 投影 · 不允许 controller 内嵌独立 SQL · contract test 双调对比浮点容差 0
2. **P-HOME 不调 /weekly**: P-HOME 不允许调 `GET /api/home/weekly` 拿 hero 子集 (冗余 payload + 重复 RTT · 违反 Simplicity First) · grep `frontend/apps/mp/pages/home/` 0 命中 `/api/home/weekly` 字符串

### 10.14 聚合计算逻辑 (weekly_aggregate service · AI 开发必读)

> 本节是后端 `weekly_aggregate` service 的**确定性规约** · Coder 落 backend/review-plan-service 实现时**字面照此** · TestDesigner 写 test-cases.md 时**字面照此** · Tester 跑 adversarial 时**字面照此**。任何"我觉得应该这样算"的偏离都视为 spec drift。

**公共前提**:
- **数据源**: `wb_review_record` (复习记录 · master §4.6) join `wb_question` (错题 · master §4.2) · join `wb_review_node` (艾宾浩斯节点 · master §4.5)
- **周边界**: ISO 8601 week · 周一 00:00 → 周日 23:59 · 用学生 tz (`user_setting.timezone` · 跨时区走 master §2B.9 SC-08) · UTC 存储 · 学生 tz 转换
- **复用规则**: 同一 service 同一次 SQL 调用 · 投影出 `WeeklyReviewResp.hero` (供 /weekly) + `weekSummary` (供 /today) · **禁止两套 SQL**

#### 字段 1 · `masteryRate` (本周掌握率)

```sql
-- 伪 SQL · 实际由 weekly_aggregate service 拼装
SELECT
  CASE
    WHEN COUNT(*) FILTER (WHERE grade IS NOT NULL) = 0 THEN NULL   -- 空周返 null 不返 0
    ELSE COUNT(*) FILTER (WHERE grade = 'MASTERED')::float
       / COUNT(*) FILTER (WHERE grade IS NOT NULL)
  END AS mastery_rate
FROM wb_review_record
WHERE student_id = :sid
  AND reviewed_at >= :weekStartUtc   -- 周一 00:00 student_tz → UTC
  AND reviewed_at <  :weekEndUtc;    -- 下周一 00:00 student_tz → UTC (左闭右开)
```

**语义**:
- 空周 (0 GRADED 记录) → `null` (不返 0 · "没复习过" ≠ "掌握率 0%" · 用户 2026-05-16 决策)
- 类型 `number | null` · 范围 `[0.0, 1.0]`
- 前端约定: `null` 时 P-HOME 显 "—%" · P-WEEKLY-REVIEW Hero 走 EMPTY 态 (但 EMPTY 触发条件是 `stats.reviewedCount === 0` · 不是 `masteryRate === null` · 两者通常同步但语义独立)

#### 字段 2 · `sparkline[7]` (7 天每日掌握率折线)

```sql
WITH days AS (                                     -- 周内 7 天预生成
  SELECT generate_series(:weekStartUtc, :weekEndUtc - interval '1 day', '1 day'::interval) AS day_utc
),
daily AS (
  SELECT date_trunc('day', reviewed_at AT TIME ZONE :studentTz) AS day_tz,
         COUNT(*) FILTER (WHERE grade IS NOT NULL) AS graded,
         COUNT(*) FILTER (WHERE grade = 'MASTERED') AS mastered
  FROM wb_review_record
  WHERE student_id = :sid AND reviewed_at >= :weekStartUtc AND reviewed_at < :weekEndUtc
  GROUP BY 1
)
SELECT d.day_utc,
       CASE WHEN daily.graded IS NULL OR daily.graded = 0 THEN NULL  -- 空日返 null
            ELSE daily.mastered::float / daily.graded END AS rate
FROM days d LEFT JOIN daily ON daily.day_tz = date_trunc('day', d.day_utc AT TIME ZONE :studentTz)
ORDER BY d.day_utc;                                 -- 索引 0 = 周一 · 索引 6 = 周日
```

**语义**:
- 长度严格 = 7 · 索引 `0..6` 对应**学生 tz** 的**周一到周日** (不是 server tz · 不是 UTC)
- 某天 0 GRADED → `sparkline[i] = null` (不是 0 · 不 forward-fill 前一日值 · 用户 2026-05-16 决策)
- 类型 `Array<number | null>`
- 前端约定: `null` 索引在 SVG path `M/L` 命令处断开 (新 path tag 起笔) · 不允许折线下探到 0 误导学生

#### 字段 3 · `streak` (Streak 天数 · 连续打卡)

```pseudo
def compute_streak(studentId, studentTz):
    # 从昨天起往回数 · 连续 N 天每日 ≥ 1 GRADED (用户 2026-05-16 决策 · Duolingo/Streaks 模式)
    streak = 0
    cursor = yesterday_in_tz(studentTz)            # 关键: 起点是昨天不是今天
    while True:
        graded_count = count(wb_review_record
                             where student_id = studentId
                               and date(reviewed_at AT studentTz) = cursor
                               and grade IS NOT NULL)
        if graded_count == 0: break
        streak += 1
        cursor -= 1 day
    # 今天若也有 GRADED · streak 包含今天 (+1)
    today_graded = count(... where date(reviewed_at AT studentTz) = today_in_tz(studentTz)
                                and grade IS NOT NULL)
    if today_graded > 0:
        streak += 1
    return streak                                  # integer ≥ 0
```

**语义**:
- 起点 = **昨天** · 不是今天 (用户 2026-05-16 决策 · 今天没复习不破坏 streak · 学生上午看不会出 0 沮丧)
- 今天若有 ≥ 1 GRADED · 总 streak 包含今天 (+1 · 学生当天即时获得反馈)
- 类型 `integer ≥ 0` · 学生注册首日且今日无复习 → `streak = 0`
- 前端约定: `streak === 0` 时整个 `.streakchip` 隐藏 · 不显 "Streak 0 天" (UX 兜底)

#### 字段 4 · `newCount` (本周新增错题数)

```sql
SELECT COUNT(*)
FROM wb_question
WHERE owner_id = :sid
  AND created_at >= :weekStartUtc
  AND created_at <  :weekEndUtc;
```

**语义**:
- 类型严格 `integer ≥ 0` · 空周 → `0` (**不**为 null · 计数字段与语义字段语义不同 · 与 masteryRate 区别对待)
- 前端约定: `0` 时显 "+0" · 不隐藏 (区别于 streak=0 的隐藏兜底)

#### `delta` 与 `range` 派生字段

- **`masteryDelta`** = 本周 `masteryRate` - 上周 `masteryRate` · 两边都 null → delta = null · 一边 null → delta = null (无法对比 · 不返回 ±100%) · 仅当两边都有值才返实数
- **`range.from / range.to`**: ISO 8601 date string · `from` = 周一 (student tz) · `to` = 周日 (student tz) · 日期纯字面 (无时区后缀)

#### 投影规则: 同一次聚合 · 两 endpoint

| endpoint | 投影字段 (取自 weekly_aggregate 全集) |
|---|---|
| `GET /api/home/weekly` | `hero.{masteryRate,masteryDelta,sparkline}` + `subjectRadar[]` + `weakKPs[]` + `stats.{reviewedCount,reviewedDurationMin,newCount}` + `failedTop[]` + `aiInsight` (完整集) |
| `GET /api/home/today` (扩展) | `weekSummary.{masteryRate,sparkline,streak,newCount}` (4 字段投影 · 不含 radar / weakKPs / failedTop / aiInsight · 不含 delta · 不含 reviewedDurationMin) |

**Coder 实现提示** (T01):
1. 把聚合做成一次 service 调用 `weeklyAggregateService.aggregate(studentId, weekIso)` → 返回内部 `WeeklyAggregateRaw` POJO 含所有可能字段
2. `WeeklyController.getWeekly()` 把 raw → `WeeklyReviewResp` DTO (含 hero/radar/weakKPs/stats/failedTop/aiInsight)
3. `HomeAggregatorController.getToday()` 已有的 today 子集**不动**, 在 response 中**追加** `weekSummary` 字段 · 也调 `weeklyAggregateService.aggregate(...)` (同一 service 同一参数) · 把 raw → `WeekSummaryDto` (4 字段)
4. **不允许**两个 controller 各拼一段独立 SQL (违反 INV-1 + INV-6) · audit grep 验证 `review-plan-service` 仓库内 weekly 聚合 SQL/JPQL 字面只出现 1 处

---

## §15.4 跨文档对照表 [REQUIRED]

本 satellite ↔ master 的双向引用清单 (skill 落盘时已用 sed ±5 行容差校验):

| satellite §X | master § | 行号 | 关系 |
|---|---|---|---|
| §0.1 增量摘要表 (新页面 P-WEEKLY-REVIEW) | master §2A.3.3 P-HOME 「本周」Bento 区 | L449-L463 | 落地页补缺 · 入口在 P-HOME mockup `01_home_v2.html:291` |
| §1.1 角色 | master §2A.1 用户角色表 | L163-L177 | 复用学生角色定义 |
| §1.3 北极星 | master §1.4 关键业务指标 | L84-L96 | 增量贡献 (周留存 + 掌握率提升) |
| §2A.3.1 新路由行 | master §2A.3 IA 路由表 | L217-L237 | 插入位置 (P13 行后) |
| §2A.4 新页面卡 schema | master §2A.4 P02-P09 卡 schema | L464+ | 完全复用 15 维度 schema |
| §2B SC-16 编排表 schema | master §2B.0 表头图例 + 既有 SC schema | L725-L749 | 完全复用 7 列编排表 + 5 列 QA 表 |
| §10.12 API 增量 | master §10.10 `/api/observer/overview` (weeklyReport) | L2220-L2241 | 共享后端 `weekly_aggregate` service · 脱敏规则不同 |
| 复用组件 `<SubjectRadar>` | master §2A.3.2 P-OBSERVER 卡 (布局分区行) | L439+ | 复用 P-OBSERVER 已有组件 |
| 复用 AI 链路 | master §6 Spring AI 错题分析详设 | L1857-L1934 | aiInsight 生成挂 `QuestionAnalyzer` 兄弟 prompt |

---

## §16 Next Steps

落地本 satellite 后的下游动作 (按优先级排):

- **(立即)** 触发 [gen-page-spec.md](../../.harness/skills/gen-page-spec.md): 执行命令「为 P-WEEKLY-REVIEW 写 spec.md」→ 生成 `design/system/pages/P-WEEKLY-REVIEW-weekly-review.spec.md` (14 节 page-level spec · 含 testid 表 + 状态机 + 性能预算)
- **(立即)** 触发 [gen-feature-list.md](../../.harness/skills/gen-feature-list.md): 执行命令「为 SC-16 生成 feature_list」→ 生成 `.harness/feature_list_SC-16.json` (v3.1 schema · 5-7 T-task · 含 backend service 复用 / frontend 新组件 / E2E spec)
- **(已完成 2026-05-16)** mockup HTML 已落: [design/mockups/wrongbook/14_weekly_review.html](../../design/mockups/wrongbook/14_weekly_review.html) · 14 testid 齐 (`p-weekly-review-root` / `weekly-back` / `weekly-range` / `weekly-hero` / `weekly-delta` / `weekly-sparkline` / `weekly-radar` / `weekly-weak-kp-1/2/3` / `weekly-stats-trio` / `weekly-failed-scroller` / `weekly-ai-insight` / `weekly-empty`) · 风格基准 `01_home_v2.html` · 标记为「AI 一遍稿 · 待设计师 review」
- **(P1 落地前)** 主 biz §15.5 已自动追加 1 行 cross-ref · 用户人工 review · 确认无冲突再合 main 分支
- **(可选 · P2 预留)** 历史周回溯切换器: 加 query `?week=YYYY-Www` 支持 · 加 `<WeekPicker>` 组件 · 不在本 satellite 范围

---

**修订表**

| 版本 | 日期 | owner | 摘要 |
|---|---|---|---|
| v1 | 2026-05-16 | user | 首版 · gen-biz-doc skill 首次实战落地 · 补 P-HOME 本周 Bento「查看全部 ›」link 落地页缺口 |
