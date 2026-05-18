# P-HOME · 今日聚合首页（Home · Today Aggregator）

**Status**: Active
**Owner**: design + frontend + backend (review-plan-service · home-aggregator)
**Last-updated**: 2026-05-14
**Mockup (canonical)**: `design/mockups/wrongbook/01_home_v2.html`（v2 是当前 canonical · `01_home_apple.html` / `01_home_ios_refined.html` / `01_home.html` 是早期迭代探索 · 视觉规范以 v2 为准 · 旧三版冲突时弃用）
**Biz refs**: biz §2A.3.3（P-HOME 规格卡）+ biz §2B.2 SC-01（步 12-14、步 20）+ biz §2B.4 SC-03（步 1、步 19）
**Related tasks**: feature_list.json SC-01 T08（home-today-counter-tick）/ T09（session-start-all）/ T14（exit-to-home）

---

## §1 页面目的

P-HOME 是登录后第一屏 · 三秒注意力黄金窗内告诉学生：① 今日有多少题要复习、点一下就能开始；② 本周节奏一眼看清；③ 有无新消息 / 弱项提醒。它是方案 β 的核心入口（不再是 P07 直链或 Tab 列表入口），承担"今日聚合 · 一键起做"的转化漏斗顶端。同时也是 SC-01 黄金路径的终点（步 20 回 P-HOME · 大卡数字 -1）和 SC-03"全部开始 + 中途退出 + Resume Banner"的入口/恢复点。

---

## §2 布局分区 + Wireframe

### 2.1 布局分区（从上到下 · 来源：biz §2A.3.3「布局分区」+ 01_home_v2.html 视觉真相）

```
┌──────────────────────────────────────────┐
│ statusbar (54px · ink on warm 米白)       │
├──────────────────────────────────────────┤
│ topbar: 问候 + 日期 · streakchip · avatar │   ← 极光 ambient wash 衬底
├──────────────────────────────────────────┤
│ HERO 大卡 (#0E0E10 暗卡)                  │
│   · 今日复习 N 题 · T 级 chips            │
│   · ring 圆环进度 (78×78 · done/total)    │
│   · 学科 subchips (数学/物理/英语 ...)    │
│   · CTA「开始复习」(白底大按钮) + add (+)│
│   · [SC-03] Resume Banner (条件渲染)      │
├──────────────────────────────────────────┤
│ 本周 (Bento 60/40)                        │
│   · 左大: 掌握率 + sparkline + delta      │
│   · 右堆: Streak 天数 · 本周新增 +N       │
├──────────────────────────────────────────┤
│ 日程 weekcard (7-day strip)               │
│   · Mon..Sun · 今日 d=today 高亮          │
│   · 每格 dots (T 级色) + num badge        │
├──────────────────────────────────────────┤
│ AI 洞察 (暗卡 · 薄弱知识点专练)            │
│   · KP-XXX · 最近 N 次都错 · 立即专练 CTA │
├──────────────────────────────────────────┤
│ 消息 inbox (≤3 条 · 全部 N 条 ›)          │
├──────────────────────────────────────────┤
│ 快捷入口 (2×2 / 4 列): 错题本/拍新题/日历/偏好│
├──────────────────────────────────────────┤
│ tabbar (84px · home active)               │
└──────────────────────────────────────────┘
```

### 2.2 关键视觉锚（mockup 01_home_v2.html 真 selector）

| Zone | DOM selector / class | testid (TEST_IDS.pHome.*) | 用途 |
|---|---|---|---|
| 页面根 | `.phone` | `p-home-root` | 路由 outlet 容器 |
| 问候 | `.topbar .greet` | `greeting-hero` | 日期 + "小 A, 今天继续" |
| Streak chip | `.streakchip` | `streak-bar-fire-icon` / `streak-bar-days-number` | 12 天连续打卡 |
| HERO 大卡 | `.hero` | `today-review-card` | 今日复习暗卡 |
| 圆环 | `.hero .ring svg` | `today-review-card-circle-progress` | done/total stroke-dashoffset |
| 大数字 | `.hero-display .big` | `today-review-card-total` | 8 题 |
| 预计耗时 | `.hero-sub strong` | `today-review-card-est-min` | 25 分钟 |
| 开始 CTA | `.hero-go` | `today-review-card-start-all-btn` | 全部开始 (POST /sessions) |
| Bento sparkline | `.tile.mastery .spark` | `p-home-weekly-sparkline` | 本周掌握率 |
| 7-day strip | `.weekcard .wcrow` | `week-strip` | 周日程条带 |
| AI insight | `.insight` | `p-home-weak-kp` | 薄弱 KP 专练 |
| Inbox | `.msgs` | `p-home-messages` / `p-home-messages-more-link` | 消息聚合 ≤3 |
| 快捷入口 | `.quicks` | `p-home-quick-entries` | 2×2 入口（错题本/拍/日历/偏好）|

---

## §3 核心组件

| 组件 | 来源 | 接受 props | 说明 |
|---|---|---|---|
| `<GreetingHero>` | frontend/packages/ui-kit | `{studentName, date, kicker}` | 顶部问候（米白 + 极光 ambient）|
| `<StreakBar>` | ui-kit | `{days, lastDate}` | 连续打卡 chip + 火焰图标 |
| `<TodayReviewCard>` | ui-kit | `{total, done, circleProgress, estMin, subjectDist[], onStartAll}` | 暗卡 HERO + 圆环 + 学科 subchips + 全部开始 CTA |
| `<ResumeBanner>` | ui-kit | `{sid, nextNid, lastCompletedAt}` | SC-03 中途退出后挂在 HERO 底部（条件渲染 · `resume!=null`）|
| `<WeeklySparkline>` | ui-kit | `{points[7], todayIdx, deltaPts}` | Bento 左大 tile · 掌握率折线 |
| `<MiniStat>` | ui-kit | `{icon, value, label, theme:flame/newadd}` | Bento 右堆两个小卡 |
| `<WeekStrip>` | ui-kit | `{days[7], todayIdx, onTapDay}` | 7 天条带 · 跳 P10 |
| `<WeakKPHint>` | ui-kit | `{kpId, kpName, recentMissCount, onDrill}` | AI 洞察暗卡 |
| `<MessagesList>` | ui-kit | `{items[≤3], totalCount, onTapItem, onMore}` | 消息聚合 |
| `<QuickEntries>` | ui-kit | `{entries:[wrongbook/capture/calendar/settings]}` | 2×2 入口 |
| `<TabBar>` | ui-kit (TabShell) | `{active:'home'}` | 底部 5 Tab · badge=今日复习数 |

来源：biz §2A.3.3「核心组件」 + 01_home_v2.html DOM + frontend/packages/ui-kit。

---

## §4 数据绑定（Entity / DTO）

### 4.1 Page-level state

```typescript
{
  home: {
    state: 'LOADING' | 'READY' | 'EMPTY' | 'ERROR',
    tz: string,                                  // IANA · echo from server
    today: {
      total: number,                             // 今日待复习节点数（含已完成）
      done: number,                              // 今日已完成
      circleProgress: number,                    // 0..1
      // Phase 1+: estMin, subjectDist[], tLevels[]
    } | null,
    resume: { sid: string, nextNid: string } | null,   // SC-03 · null 时隐藏 Resume Banner
    // Phase 1+ 字段（由独立 home-aggregator module 实现，本 MVP 不存在）
    streak?: { days, lastDate },
    weekSparkline?: number[7],
    weekStrip?: Array<{date, reviewCount, examHint, tLevels[]}>,
    messages?: Array<{id, type, refId, title, subtitle, time, unread}>[≤3],
    weakKP?: { kpId, kpName, missCount },
    quickEntries?: Array<{target:'wrongbook'|'capture'|'calendar'|'settings'}>
  },
  session: {                                     // T09 · POST /api/review/sessions 临时态
    sid: string | null,
    total: number,
    nids: string[]
  } | null
}
```

### 4.2 后端 Entity 来源

- **today.total / done**：`review_plan` 表 · `findDueOnDate(userId, [todayStart, todayEnd))` + `countCompletedOnDate(...)`（HomeAggregatorController L60-L61）
- **resume**：B02 决策 A · `ReviewSessionService` 内存 store · 无持久化 → 当前阶段恒返 `null`（A05 §2.4 + HomeTodayResp.java L14-L15）
- **session（T09）**：`ReviewSessionService.create()` · in-memory · 返 `{sid, nids[], total}`（A05 §2.1 #1）

来源：biz §2A.3.3「数据绑定」 + `backend/review-plan-service/.../HomeTodayResp.java` + audits/SC-01-PHASE-0/A05 §2.4。

---

## §5 API 触点

> 字符级精准（与 A05 audit + HomeAggregatorController.java + ReviewPlanController.java 100% 一致）。

| # | Method | Path | Headers (req) | Body (req) | Response (200) | P95 预算 | 失败降级 |
|---|---|---|---|---|---|---|---|
| 1 | GET | `/api/home/today?tz=Asia/Shanghai` | `X-User-Id`, 可选 `X-User-Timezone` | — | `{tz, today:{total, done, circleProgress}, resume:null, weekSummary:{week, masteryRate, sparkline[7], streak, newCount}}` (MVP 子集 + 2026-05-16 SC-16 扩展 weekSummary) | ≤ 400ms (biz §2A.3.3 性能预算) | 服务降级 → 顶部黄条 "部分数据正在同步" + 允许拉下刷新 |
| 2 | POST | `/api/review/sessions` | `X-User-Id`, `X-Idempotency-Key` (可选) | `{date?, node_ids?:[], tz?}` (空 body 时后端默认取 today 全部 ACTIVE 节点) | `{sid, nids:[...], total}` | ≤ 500ms (biz §2B.2 步 14) | sid 创建失败 → 留 P-HOME · toast "稍后再试" |

> **范围说明**：POST `/api/review/sessions` 实现于 `review-plan-service`（A05 §2.1 #1 L239），但**触发入口属 P-HOME 域**（HERO 大卡「全部开始」按钮），故纳入本 spec §5。详细 session 状态机见 P07-review-today.spec.md §6。

来源：biz §2A.3.3「API 触点」（高层）+ audits/SC-01-PHASE-0/A05 §2.1/§2.4（字符级）+ `HomeAggregatorController.java` + `ReviewPlanController.createSession` L239。

### 5.1 Phase 1+ 待补字段（A07 决策 · 独立 home-aggregator module）

**原计划 9 字段** (2025 原始 placeholder): `streak / weekSparkline / weekStrip / messages / weakKP / quickEntries / studentName / estMin / subjectDist`。

**2026-05-16 SC-16 增量交付 4 字段** (✓ 已下发 · 见 §5.2): `masteryRate / sparkline / streak / newCount` (打包进 `weekSummary` 对象 · 复用 `weekly_aggregate` service · 详见 [biz/features/P-WEEKLY-REVIEW__weekly-review.md §10.13-10.14](../../../biz/features/P-WEEKLY-REVIEW__weekly-review.md))

**仍为 placeholder 的 5 字段** (Phase 1+ 再补): `weekStrip / messages / weakKP / quickEntries / studentName / estMin / subjectDist` (注: `weakKP` 与 SC-16 `weakKPs[]` 不同 · P-HOME 是 hint 单条 · P-WEEKLY-REVIEW 是 top 3 列表)。Phase 1 拆独立 module 后扩展 GET `/api/home/today` 响应体（向后兼容 · MVP + SC-16 字段不变）。

### 5.2 weekSummary 字段集 (SC-16 扩展 · 2026-05-16)

> 主源: [biz/features/P-WEEKLY-REVIEW__weekly-review.md §10.13](../../../biz/features/P-WEEKLY-REVIEW__weekly-review.md) (endpoint extension) + §10.14 (聚合计算逻辑 · weekly_aggregate service)。本节是 P-HOME 视角的快查表 · 不重复定义计算公式。

| 字段 | 类型 | 空语义 | 前端约定 (P-HOME) |
|---|---|---|---|
| `weekSummary.week` | string (ISO 8601 e.g. "2026-W20") | 永不为 null | Bento 顶部副标题 (P2 显示 · MVP 可不渲染) |
| `weekSummary.masteryRate` | number \| null | `null` 空周 (0 GRADED 复习 · 不为 0 · "没复习" ≠ "掌握 0%") | `.tile.mastery .big`: null 时显 "—%" 不显 "0%" |
| `weekSummary.sparkline` | Array<number \| null> 长度 7 | `null` 索引 = 该日 0 复习 (不 forward-fill 不打底 0) | `.tile.mastery .spark svg`: null 索引在 path M/L 命令断开 (新 path tag 起笔) · 折线不下探到 0 |
| `weekSummary.streak` | integer ≥ 0 | `0` 表无连续记录 (从昨天起往回数 · 今天没复习不破 streak) | `.streakchip .n`: 0 时整个 `.streakchip` 隐藏 不显 "Streak 0 天" |
| `weekSummary.newCount` | integer ≥ 0 | `0` 表本周 0 新增 (不为 null · 计数字段) | `本周新增 +N`: 0 时显 "+0" 不隐藏 |

**强制不变量** (满足 SC-16 INV-6):
- P-HOME 4 数字 (`.tile.mastery .big` / `.tile.mastery .spark` / `.streakchip .n` / `本周新增`) 必须**仅**从 `today.weekSummary` 字段消费
- **禁止** P-HOME 调用 `GET /api/home/weekly` (违反 INV-6 · audit grep `frontend/apps/mp/pages/home/` 0 命中 `/api/home/weekly`)
- **禁止** P-HOME hardcoded 任何 4 数字 · 包括 mockup 上的 `68% / Streak 7 天 / +8 新增` (这些是 mockup 演示值 · 实际 wire 到 API)
- **同源不变量**: 同一时刻 GET /today.weekSummary 与 GET /weekly.hero 浮点容差 0 一致 (contract test 双调对比 · SC-16 T01 AC6 + TI6)

---

## §6 状态机

```
                      mount        GET /api/home/today
                       │                   │
                       ▼                   ▼
                  ┌─────────┐  200 + today.total=0  ┌──────────────┐
                  │ LOADING │──────────────────────►│ READY(EMPTY) │
                  └─────────┘                       └──────┬───────┘
                       │                                   │
                200 + total>0                              │ tap 拍题 CTA
                       ▼                                   ▼
                  ┌─────────────┐ resume!=null  ┌─────────────────┐
            ┌────►│ READY(LIST) │──────────────►│ READY(+RESUME)  │
            │     └──────┬──────┘               └─────────┬───────┘
            │            │                                │
   pull-refresh          │ tap "全部开始" (T09)            │ tap Resume Banner (SC-03)
   GET /today            │ POST /review/sessions          │ POST /sessions/{sid}:resume
            │            ▼                                ▼
            │      (route → P07)                    (route → P08)
            │
            │      500/timeout
            │            │
            │            ▼
            │     ┌─────────┐
            └─────│  ERROR  │ retry / 顶部黄条
                  └─────────┘
```

### 6.1 状态转移规则

| From | To | Trigger | Side effect |
|---|---|---|---|
| (init) | LOADING | route mount | 骨架屏 (300ms) |
| LOADING | READY(EMPTY) | GET /today 200 · total=0 | HERO 切换为「今天已完成，拍一道新题试试？」hero · CTA 改 Tab 3 拍题 |
| LOADING | READY(LIST) | GET /today 200 · total>0 | 大卡数字 + 圆环 + 学科 chips 渲染 |
| READY(LIST) | READY(+RESUME) | response.resume!=null | HERO 底部挂 Resume Banner（SC-03 步 19）|
| LOADING | ERROR | GET /today 5xx / timeout | 顶部黄条 "部分数据正在同步" · 留旧数据（如有缓存）|
| READY | (导出) | tap 大卡 CTA「全部开始」(T09) | POST /sessions → push P07 · ≤ 500ms |
| READY(+RESUME) | (导出) | tap Resume Banner (SC-03) | POST /sessions/{sid}:resume → push P08 nid=nextNid |
| READY(LIST) | READY(LIST · +1) | 回 P-HOME from P05 (T08) | GET /today 刷新 · 大卡 N→N+1 动画 ≥300ms · 圆环 easeInOut 300ms |
| READY(LIST) | READY(LIST · -1) | 回 P-HOME from P09 (T14) | GET /today 刷新 · 大卡 N→N-1 动画 ≥300ms · 圆环回归 |
| READY(LIST · -1) | READY(EMPTY · ALL_DONE) | done==total | HERO 切「今天已完成」+ Tab 3 高亮（T14 AC5）|

来源：biz §2A.3.3「状态集」+ biz §2B.2 步 12-14、20 + biz §2B.4 步 19。

---

## §7 跳转

| 入口 | 来源 | 触发条件 |
|---|---|---|
| 登录成功 | P00 | 学生 Tap 微信登录 → token 落地 → 路由 push `/` |
| 深链 | `wb://home` | 任意页通过 deeplink |
| Tab 1 | TabShell tab-home | 学生 Tap 首页 Tab |
| P09 结束本次 | P09 ctaEndBtn | T14 · 步 20 |
| P05 → Tab 1 | P05 | SC-01 步 12（Tap Tab 1 返回）|

| 出口 | 目标 | 触发条件 |
|---|---|---|
| 路由 push | P07 today-review | Tap HERO 大卡「全部开始」(T09 · POST /sessions 成功) |
| 路由 push | P08 review-exec | Tap Resume Banner (SC-03 步 19→20 · POST /sessions/{sid}:resume) |
| 路由 push | P02 capture | Tap 快捷入口「拍新题」/ EMPTY hero CTA |
| 路由 push | P05 wrongbook-list | Tap 快捷入口「错题本」 |
| 路由 push | P10 calendar-month | Tap 7-day strip 任意日 / 快捷入口「日历」 / 「月视图 ›」 |
| 路由 push | P11 event-detail | Tap inbox 消息条目（type=STUDY/EXAM/FAMILY）|
| 路由 push | P12 notifications | Tap inbox「全部 N ›」 |
| 路由 push | P13 settings | Tap 快捷入口「偏好」 |

来源：biz §2A.3.3「跳转」 + biz §2A.3 IA 路由表。

---

## §8 Wire format (SSE / WebSocket 事件)

本页无 SSE/WebSocket 通道。事件通讯全部走 §5 HTTP 触点（GET /api/home/today · POST /api/review/sessions）。

（如未来引入服务器推送的"今日复习剩余数变更"实时刷新，将在此节补 channel + payload）

---

## §9 异常 & 降级

| 异常 | 触发条件 | UI 反馈 | 系统行为 | 关联 TC |
|---|---|---|---|---|
| 今日无复习 | GET /today 200 · total=0 | HERO 切换为「今天没有复习安排，拍一道新题试试？」hero · CTA 跳 P02 | — | — (biz §2A.3.3 异常态) |
| 服务降级 | GET /today 5xx / timeout | 顶部黄条「部分数据正在同步」+ 允许拉下刷新 | 留旧数据 / skeleton | — |
| 首次登录 | onboarding flag=true | onboarding 三步浮层 | flag 落 localStorage | — |
| 跨天 paused session | 学生隔日打开 · createdAt < today 00:00 | 大卡不显示 Resume Banner | 后端将 PAUSED 自动置 EXPIRED | TC-03.03 |
| 数字 +1/-1 动画静默替换 | T08/T14 实现 bug | — | 必须可见 ≥300ms（T08 TI3 / T14 TI1）| TC-01.01 (步 13/20) |
| ALL_DONE 终态 | done==total | HERO 切「今天已完成」+ Tab 3 拍题入口高亮 | — | TC-01.01 终态（T14 AC5）|

来源：biz §2A.3.3「异常态」+ biz §2A.7 异常路径降级矩阵 + feature_list.json T08/T14 test_invariants。

---

## §10 验收点（TC → AC 映射）

| TC ID | 类型 | GIVEN | WHEN | THEN | 关联 task AC |
|---|---|---|---|---|---|
| TC-01.01 (步 12-13) | 正常 | SC-01 步 11 P05 已渲染 highlightedQid | Tap Tab 1 返回 P-HOME | GET /api/home/today 200 · 大卡数字 N→N+1 动画可见 ≥300ms · 圆环 300ms easeInOut | T08 AC1/AC2/AC3/AC4 |
| TC-01.01 (步 14) | 正常 | P-HOME · total=9 · 大卡渲染完毕 | Tap 大卡「全部开始」CTA | POST /api/review/sessions 200 {sid, nids:[9], total:9} · 跳 P07 ≤500ms · 埋点 `home_today_start_all{count=9}` | T09 AC1/AC2/AC3/AC4/AC5 |
| TC-01.01 (步 20) | 正常 | P09 庆祝态 · 步 18 已 grade MASTERED | Tap「结束本次」 | P09→P-HOME ≤500ms · GET /today 刷新 · 大卡 N→N-1 动画 ≥300ms · done==total 时切 ALL_DONE hero | T14 AC1/AC2/AC3/AC4/AC5 |
| TC-03.01 (步 1) | 正常 | P-HOME · 今日 8 题 · session 不存在 | Tap 大卡「全部开始」 | POST /sessions {date, node_ids:[...8]} → sid · POST /nodes/{nid1}/open · `home_today_start_all{count=8}` ≤800ms | （SC-03 范围 · 与 T09 同源）|
| TC-03.01 (步 19) | 正常 | 学生在 P08 完成 5 题 · 第 6 题 tap × 退出 → `:pause` 落库 | 跳回 P-HOME | GET /today 含 `pausedSession{sid,nextNid=nid6}` · HERO 底部出现 Resume Banner "上次做到第 6 题，点我继续" · 埋点 `home_view{resume=true}` | （SC-03 范围 · MVP 暂返 resume:null · Phase 1+ 落地）|
| TC-03.03 | 边界 | P-HOME 有 paused session · 隔日再打开 | 打开 App | 跨天 paused 自动归档（resumedAt 为空 + createdAt<today 00:00 → EXPIRED）· Resume Banner 不显示 · nid6-8 按新一天重排 | — |
| TC-03.04 | 异常 | 学生 tap 退出后立即杀 App | 重启 App | 落 P-HOME · Resume Banner 正常出现（PAUSED 已服务端落地）| — |

来源：biz §2B.2 SC-01 QA 用例表 + biz §2B.4 SC-03 QA 用例表 + feature_list.json T08/T09/T14 acceptance_criteria。

---

## §11 性能预算

| 操作 | P95 budget | 来源 |
|---|---|---|
| 首屏 TTI（mount → 数据替换骨架屏） | ≤ 1.2 s | biz §2A.3.3「性能预算」 |
| GET /api/home/today 服务端响应 | ≤ 400 ms | biz §2A.3.3 |
| 大卡数字 N→N±1 动画可见 | ≥ 300 ms（下限 · 不许静默）| feature_list T08 TI3 / T14 TI1 |
| 圆环进度动画 | 300 ms easeInOut | T08 AC4 / T14 AC4 |
| Tap「全部开始」→ 跳 P07 | ≤ 500 ms（biz）/ ≤ 800 ms（SC-03 步 1 含 open 调用）| biz §2B.2 步 14 / biz §2B.4 步 1 |
| Tap「结束本次」→ 回 P-HOME 渲染 | ≤ 1.2 s | biz §2B.2 步 12（同首屏 TTI）|

来源：biz §2A.3.3 + biz §2B.2 / §2B.4「耗时预算」列 + feature_list T08/T09/T14 test_invariants。

---

## §12 埋点事件

| Event name | When | Properties | 来源 |
|---|---|---|---|
| `home_view` | P-HOME mount · GET /today 200 | `{tz, total, done, resume:bool}` | biz §2A.3.3 + biz §2B.2 步 12 |
| `home_today_start_all` | Tap 大卡「全部开始」（POST /sessions 200 后）| `{count, estMin?}` | biz §2A.3.3 + biz §2B.2 步 14 + T09 TI3 |
| `home_week_tap` | Tap 7-day strip 任意日 | `{date}` | biz §2A.3.3 |
| `home_msg_tap` | Tap inbox 条目 | `{type, refId}` | biz §2A.3.3 |
| `home_weak_kp_drill` | Tap AI insight「立即专练」 | `{kpId}` | biz §2A.3.3 |
| `home_quick_entry` | Tap 快捷入口 4 选 1 | `{target:'wrongbook'/'capture'/'calendar'/'settings'}` | biz §2A.3.3 + biz §2B.2 步 1 |
| `home_resume` | Tap Resume Banner（SC-03）| `{sid, nextNid}` | biz §2B.4 步 20 |
| `wb_done_exit` | 配套 T14 步 20 离开 P09 时 | `{nid}` | biz §2B.2 步 20 |

来源：biz §2A.3.3「埋点事件」+ biz §2A.8 埋点字典 + biz §2B.2/§2B.4。

---

## §13 testid 表

| testid | 用途 | 出现位置（mockup / source） | E2E 引用 |
|---|---|---|---|
| `p-home-root` | 页面根 | 01_home_v2.html `.phone`（root 容器）| t08 / t09 / t14 spec beforeEach mount |
| `greeting-hero` | 问候 hero | `.topbar .greet` | t08 渲染断言 |
| `streak-bar-fire-icon` | 连续打卡火焰图标 | `.streakchip svg` | — |
| `streak-bar-days-number` | 连续打卡天数 | `.streakchip .n` | — |
| `today-review-card` | HERO 暗卡 | `.hero` | t08 / t09 / t14 主断言 |
| `today-review-card-circle-progress` | 圆环 SVG | `.hero .ring svg` | T08 AC4 / T14 AC4 圆环动画 |
| `today-review-card-total` | 大卡数字 | `.hero-display .big` | T08 AC3（N→N+1）/ T14 AC3（N→N-1）|
| `today-review-card-est-min` | 预计耗时 | `.hero-sub strong` | — |
| `today-review-card-start-all-btn` | 全部开始 CTA | `.hero-go` | T09 AC1/AC2 |
| `p-home-weekly-sparkline` | Bento 掌握率 sparkline | `.tile.mastery .spark svg` | — |
| `week-strip` | 7 天条带 | `.weekcard .wcrow` | — |
| `p-home-messages` | inbox 容器 | `.msgs` | — |
| `p-home-messages-more-link` | 全部消息链接 | `.sec a.m[href="12_notifications.html"]` | — |
| `p-home-weak-kp` | AI insight 暗卡 | `.insight` | — |
| `p-home-quick-entries` | 快捷入口容器 | `.quicks` | — |

来源：`frontend/packages/testids/src/index.ts` `TEST_IDS.pHome.*` L249-L270 + 01_home_v2.html DOM 视觉对位。

> **注**：当前 01_home_v2.html 尚未把 testids 注入 `data-testid` 属性（mockup 是静态视觉稿）· 真正落码到 `frontend/apps/h5/src/pages/home/` 时按本表 §2.2 selector 对位注入。

---

## §14 i18n key

| Key | 中文 | 英文 | 用途 |
|---|---|---|---|
| `home.greeting.hi` | 小 {name}, 今天继续 | Hi {name}, keep going | topbar 问候 |
| `home.streak.days` | {n} 天 | {n} day streak | streak chip |
| `home.today.kicker` | 今日复习 | Today's review | HERO 标题 |
| `home.today.unit` | 题 | items | 大数字单位 |
| `home.today.estMin` | 预计 {min} 分钟 | About {min} min | HERO 副文案 |
| `home.today.startAll` | 开始复习 | Start review | HERO CTA |
| `home.today.emptyHero` | 今天没有复习安排，拍一道新题试试？ | All done · capture a new one? | EMPTY 态 hero |
| `home.today.allDoneHero` | 今天已完成，拍一道新题试试？ | All done today · capture a new one? | ALL_DONE 态 hero（T14 AC5）|
| `home.resume.banner` | 上次做到第 {n} 题，点我继续 | Resume from #{n} | SC-03 Resume Banner |
| `home.week.title` | 本周 | This week | 本周 section header |
| `home.schedule.title` | 日程 | Schedule | 日程 section header |
| `home.insight.title` | AI 洞察 | Signal | AI 洞察 section |
| `home.insight.drill` | 立即专练 | Drill now | AI insight CTA |
| `home.messages.title` | 消息 | Inbox | 消息 section |
| `home.messages.more` | 全部 {n} | All {n} | 全部消息链接 |
| `home.shortcuts.title` | 快捷入口 | Shortcuts | 快捷入口 section |
| `home.shortcuts.wrongbook` | 错题本 | Wrongbook | 快捷入口 1 |
| `home.shortcuts.capture` | 拍新题 | Capture | 快捷入口 2 |
| `home.shortcuts.calendar` | 日历 | Calendar | 快捷入口 3 |
| `home.shortcuts.settings` | 偏好 | Settings | 快捷入口 4 |
| `home.error.degraded` | 部分数据正在同步 | Partial data syncing | 服务降级黄条 |

来源：biz §2A.3.3「埋点事件 / 异常态」文案 + 01_home_v2.html 视觉文案 + frontend/packages/i18n/（落码时补完）。

---

## §15 关联与影响

- **上游 spec**：P00-login（登录成功 → P-HOME）/ P05-wrongbook-list（步 12 Tab 1 返回）/ P09-review-done（步 20 结束本次）
- **下游 spec**：P07-review-today（步 14 全部开始）/ P08-review-exec（SC-03 Resume Banner）/ P02-capture（快捷入口 / EMPTY hero CTA）/ P05 / P10-calendar-month / P11-event-detail / P12-notifications / P13-settings
- **关联 task**：feature_list.json SC-01 T08（home-today-counter-tick · 步 12-13）/ T09（session-start-all · 步 14）/ T14（exit-to-home · 步 20）
- **关联 audit**：audits/SC-01-PHASE-0/A05-review-plan.md §2.1（POST /sessions）/ §2.4（HomeAggregatorController · home/today MVP 子集）
- **关联 mockup**：design/mockups/wrongbook/01_home_v2.html（canonical · v2）；废弃备份：01_home.html / 01_home_apple.html / 01_home_ios_refined.html（早期迭代探索 · 仅留作历史参考 · 不再 reference）
- **后端载体**：`backend/review-plan-service/.../HomeAggregatorController.java` (MVP) · Phase 1+ 剥独立 `home-aggregator` module（A07 决策）
- **DTO**：`HomeTodayResp(tz, today:{total,done,circleProgress}, resume:null)` · `record` 字段对齐 §4.1 / §5 #1
