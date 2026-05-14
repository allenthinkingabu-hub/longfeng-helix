# P10 · 日历月视图 (CalendarMonth)

**Status**: Active
**Owner**: design + frontend + backend
**Last-updated**: 2026-05-14
**Mockup**: `design/mockups/wrongbook/10_calendar_month.html`
**Biz refs**: biz/业务与技术解决方案_AI错题本_基于日历系统.md §2A.3 路由表 P10 (L234) + §2A.3.3 P-HOME 跳转规则 第 6/7 条 (L359-L360) + §2B.6 SC-05 (L939-L984) + §2B.7 SC-06 (L987-L1019) + §2A.6 跨域一致性表 (L657)
**Related tasks**: feature_list.json SC-05 (P-HOME → 日历 → STUDY 事件 → 立即复习) + SC-06 (日历 → GENERIC/FAMILY 事件 → 编辑) + SC-10 (归档错题 → 级联取消节点 · L762)

> **特别说明 · 无 §2A.4 规格卡**：biz 文档未为 P10 提供独立的 §2A.4 12 维度规格卡（与 P02/P07 等不同 · §2A.4 段在仓库当前版本只覆盖 P-HOME / P02..P09 / P11..P13）。本 spec 的 14 节素材**主源是 mockup HTML + §2B.6 SC-05 + §2B.7 SC-06**，辅以 §2A.3 路由表 + §2A.3.3 跳转规则。每节末尾的"来源"行已标注实际依据。

---

## §1 页面目的

P10 是**完整月历**二级页 · 把"事件"（复习节点 / 考试 / 家庭 / 提醒）按日历时间网格全景化展示。方案 β 将日历从 Tab 1 降级为二级页（§2A.3 L213）后，P10 不再是用户每日心智入口，但**仍是业务写入的唯一排期载体** —— 学生在此查看长跨度计划、考试倒计时、复习节点分布。本页承担 §2B.6 SC-05 "首页条带 → 日历 → 事件详情（复习形态）→ 立即复习"的视图融合锚点：从任务视角（P-HOME）切到时间视角（P10），再经 P11 双形态同壳跳回任务执行（P08）。同时承担 §2B.7 SC-06 "日历 → 事件详情（通用/家庭形态）→ 编辑"分支。对系统的价值：以"月格 + 当日列表"二段式 IA 把"复习排期 / 考试 / 家庭事件" relation_type 异构数据统一渲染。

---

## §2 布局分区 + Wireframe

### 2.1 布局分区 (zone 划分)

```
┌─────────────────────────────────┐  iOS Status bar (54px)
├─────────────────────────────────┤  Navbar: ← 首页 · "2026 年 4 月" + "Asia/Shanghai · 周二" 副 · ＋ 图标
│  Seg: 日 / 周 / 月(on) · 右侧 "显示复习 · 开" filter chip │
├─────────────────────────────────┤  Weekday header: 一 二 三 四 五 六(红) 日(红)
├─────────────────────────────────┤  Month grid 7×6 (cells 52px · 含 mute 上/下月格 + today 蓝圆 + bar 计数 + 色点 dots)
│  (本月 28 天 · 加上下月填充 共 42 格)                                      │
├─────────────────────────────────┤  Day events list (sheet · 圆角顶 22px · h=268)
│  "4 月 21 日" + "8 条复习 · 1 场考试 · 1 条家庭" · 右上 "全部 ›" → P07     │
│  Row × N · 左色条 + 标题(+ studytag) + 学科 / 第 n 次 / mini 6 圈 + 时间   │
├─────────────────────────────────┤  Tab Bar (5 个 · 首页 on)
└─────────────────────────────────┘  Home indicator
```

来源：mockup HTML L122-L194 视觉（navbar + sub-nav seg + body grid + list sheet）+ §2B.6 步 2 "顶部 title '2026 年 4 月 / Asia/Shanghai'" + 步 3 "下方事件列表刷新为 '4 月 28 日 星期二 · 3 件事'" + §2A.3.3 第 6 条 "返回指向 4 月"。

### 2.2 关键视觉锚 (mockup HTML 真 selector)

| Zone | DOM selector / class | testid | 用途 |
|---|---|---|---|
| Page root | `.phone` | `p10-root` | P10 根 |
| Navbar back | `.nav-top a.back "首页"` | `p10-month-nav` (容器) | 返回 P-HOME |
| Navbar title | `.nav-top .center .t "2026 年 4 月"` | `p10-month-nav-title` | 月份大标题 |
| Navbar sub | `.nav-top .center .s "Asia/Shanghai · 周二"` | — | 时区 / 星期副 |
| Prev / Next | (mockup 仅 ＋ 图标 · 真实 ← → 由 swipe / 隐式) | `p10-month-nav-prev` / `p10-month-nav-next` | 切换上/下月 |
| Today btn | (mockup 用 today cell · 跳转隐式) | `p10-month-nav-today` | 跳回今日 |
| Seg view | `.seg` "日 / 周 / 月(on)" | — (TBD) | 视图切换 (P0 月模式恒选) |
| Filter chip | `.filter "显示复习 · 开"` | `p10-filter-study` | 切换 STUDY 类型可见性 |
| Weekday header | `.weekdays` | `p10-week-header` | 周一..周日 |
| Month grid | `.grid` (`grid-template-columns:repeat(7,1fr)`) | `p10-month-grid` | 6×7 = 42 格 |
| Day cell | `.cell` / `.cell.mute` / `.cell.today` / `.cell.weekend` | `p10-month-grid-cell-{1..42}` | 单元格 |
| Today marker | `.cell.today .d` (蓝圆) | `p10-month-grid-cell-{n}-today-marker` | 蓝实心圆 |
| Event count bar | `.cell .bar "3"` (右上角靛蓝胶囊) | — | 当日事件总数 |
| Color dots | `.dot.d-red/.d-ora/.d-grn/.d-ind/.d-ylw/.d-pnk/.d-pur/.d-blu/.d-tea` | `p10-month-grid-cell-{n}-dot-{1..3}` | 最多 3 色点 (>3 → overflow) |
| Overflow | (mockup 隐式 · 4/21 today 自带 4 个点) | `p10-month-grid-cell-{n}-overflow` | "+N" 溢出 |
| Skeleton | (mockup 未画) | `p10-month-grid-skeleton` | LOADING 占位 |
| Legend bar | (mockup 未画 · 在筛选 chip 旁) | `p10-legend-bar` + `legendMath` / `legendPhysics` / `legendChemistry` / `legendEnglish` / `legendExam` / `legendFamily` | 学科/类别 色图例 |
| Readonly banner | (mockup 未画 · 观察者 / 分享时) | `p10-readonly-banner` | "只读模式" 顶部条 |
| Day list sheet | `.list` (圆角顶 22px) | — | 当日事件列表容器 |
| List head title | `.list-head .t "4 月 21 日"` | — | 选中日 |
| List head sub | `.list-head .sub "8 条复习 · 1 场考试 · 1 条家庭"` | — | 分类汇总 |
| List head "全部 ›" | `.list-head a.more` → `07_review_today.html` | — | 跳 P07 |
| Event row | `.row` (cursor:pointer · → `11_event_detail.html`) | — | 单事件 |
| Row 左色条 | `.bar3` (red/orange/pink/green) | — | event 类型色 |
| Row studytag | `.row .ti .studytag "T1 复习"` | — | STUDY 类型徽章 |

来源：mockup L40-L96（grid/cell/dot/list/row 真 selector）+ frontend/packages/testids/src/index.ts L175-L198 `TEST_IDS.p10.*`。

---

## §3 核心组件

| 组件 | 来源 | 接受 props | 说明 |
|---|---|---|---|
| `<MonthNav>` | frontend/apps/h5 P10 内置 | `{yearMonth, weekdayLabel, tzLabel, onPrev, onNext, onToday}` | 顶部月份切换 + 时区副标 |
| `<ViewSegmented>` | ui-kit (推断) | `{value: 'day'/'week'/'month', onChange}` | 日/周/月 三段切换（P0 默认 month） |
| `<FilterStudyChip>` | P10 内置 | `{showStudy: bool, onToggle}` | 显示复习 开/关 · 持久化到 `user_setting.calendar.showStudy` |
| `<WeekdayHeader>` | P10 内置 | `{startsOn: 'mon'/'sun'}` | 周一首列 · 周六/日红字 |
| `<MonthGrid>` | P10 内置 | `{cells: DayCell[42], onSelectDay}` | 6×7 grid · 渲染 cell + bar + dots |
| `<DayCell>` | P10 内置 | `{date, inCurrentMonth, isWeekend, isToday, isSelected, eventCount, dots: ColorDot[≤3], overflow?: number}` | 单格 · today 蓝圆 + bar 计数 + 色点 |
| `<DayEventSheet>` | P10 内置 | `{date, dayCounts:{study,exam,family}, events: EventRow[]}` | 底部圆角列表 |
| `<EventRow>` | P10 内置 | `{eventId, type, subject?, relationType, state, title, timeLabel, subLabel, studyTag?, miniSequence?}` | 单事件行（双形态：STUDY 带 studytag · GENERIC 带 type tag） |
| `<ReadonlyBanner>` | ui-kit | `{kind: 'observer'/'share'}` | 观察者 / 分享只读提示 |
| `<EmptyState>` | ui-kit | `{kind: 'EMPTY_MONTH'/'EMPTY_DAY'}` | 月无事件 / 日无事件 |

来源：mockup HTML 真 DOM 结构（`.navbar` / `.seg` / `.filter` / `.weekdays` / `.grid` / `.cell` / `.list` / `.row`）+ frontend/packages/testids `TEST_IDS.p10.*` 反推组件命名。

---

## §4 数据绑定 (Entity / DTO)

### 4.1 Page-level State 绑定

```typescript
{
  student: { id, timezone: 'Asia/Shanghai' },
  preferences: { showStudy: boolean },  // 来自 user_setting.calendar.showStudy
  calendar: {
    state: 'LOADING' | 'READY' | 'DAY_SELECTED' | 'EMPTY' | 'ERROR',
    yearMonth: 'YYYY-MM',
    selectedDate: 'YYYY-MM-DD' | null,
    days: Array<{
      date: 'YYYY-MM-DD',
      inCurrentMonth: boolean,
      eventCount: number,
      events: Array<{
        eventId: string,
        type: 'STUDY'|'EXAM'|'FAMILY'|'REMINDER',
        subject?: 'MATH'|'PHYSICS'|'CHEMISTRY'|'ENGLISH'|null,
        relationType: 'STUDY'|'EXAM'|'FAMILY'|'GENERIC',
        relationId?: string,             // 'question:200:node:700' (STUDY) / 'family:member:grandma' / 'exam:E512'
        state: 'PENDING'|'COMPLETED'|'CANCELLED'|'OVERDUE',
        title: string,
        startAt: ISO8601,
        durationMin?: number,
        allDay?: boolean
      }>
    }>
  }
}
```

### 4.2 涉及的后端 Entity

- `wb_calendar_event` (calendar-core · eventId / studentId / type / relationType / relationId / startAt / durationMin / state / rrule)
- `event_share` (eventId / sharedToStudentId · 家长共享 SC-09 涉及)
- `user_setting` (calendar.showStudy / calendar.timezone · §2B.6 分支 B + §2B.9 SC-08)
- 联表查询 `wb_review_node` (relationType=STUDY 时反查 T 级 / readyAt) · `wb_question` (relationId 含 question:{qid} 时反查标题/学科)

来源：mockup HTML 色点+studytag 反推 type/relationType 枚举 + §2B.6 步 4 `relation_type=STUDY, relation_id=question:200:node:700` + §2B.7 步 1 `relation_type=FAMILY`。

---

## §5 API 触点

> path/method 字符级以 biz §2B.6 + §2B.7 原文为准（biz 是 ground truth · 任务 brief 中"推断"的 `/api/calendar/months/{yyyy-MM}` 与 biz 实际 `GET /api/calendar/events?month=YYYY-MM` 不一致 · 按 spec Rule 4 反作弊红线以 biz 为准）。calendar-core 服务**尚未在仓库落地**（仅有 review-plan-service 的 `CalendarFeignClient`、未见 `calendar-core/` 模块）· 故 §5 端点为 spec'd（spec is canonical · 下游 audit 阶段需 fix calendar-core 实现以对齐）。

| # | Method | Path | Headers (req) | Body / Query | Response | P95 预算 | 失败降级 |
|---|---|---|---|---|---|---|---|
| 1 | GET | `/api/calendar/events?month=YYYY-MM` | `Authorization` · `X-Request-Id` · `X-Timezone: Asia/Shanghai` | query: `month`, optional `refresh=true`（步 9 强刷） | `200 {month, days:[{date, events:[...]}]}` | ≤ 500ms (§2B.6 步 2) | 重试 2 次 → EMPTY 态 + retry banner |
| 2 | GET | `/api/calendar/events/{eventId}` | `Authorization` | — | `200 {eventId, relationType, relationId, type, state, startAt, durationMin, title, sharedFrom?, rrule?}` | ≤ 600ms (§2B.6 步 4) | 404 → P11 "节点已取消" 占位 (TC-05.04) |
| 3 | PATCH | `/api/me/preferences` | `Authorization` · `X-Idempotency-Key`（可选） | `{calendar:{showStudy: boolean}}` | `204 No Content` | ≤ 300ms | 本地 optimistic 切换 · PATCH 失败回滚 + Toast |
| 4 | POST | `/api/calendar/events/{eventId}/subscribe` | `Authorization` · `X-Idempotency-Key` | `{}` | `201 {reminderId}` | ≤ 400ms | 重试 3 次 → "稍后再试" Toast (复用 §2B.9 SC-09 步 6) |

来源：§2B.6 步 2 / 步 4 / 步 9 + 分支 B 2.B / 4.B (`PATCH /api/me/preferences`) + §2B.7 步 1 + §2B.9 SC-09 步 6 (`POST /api/calendar/events/{eventId}/subscribe`)。

---

## §6 状态机

```
                  bootstrap                   GET /events?month=
                  enter                       200
       ┌──────────────────────┐   ┌────────────────────┐
       │  ENTRY (from P-HOME) │──►│  LOADING (skeleton)│──┐
       └──────────────────────┘   └────────────────────┘  │
                                       │ 5xx / timeout    │ 200 + days
                                       ▼                  ▼
                                ┌──────────┐       ┌────────────┐
                                │  ERROR   │       │   READY    │◄────┐
                                │ (banner) │       │ (month grid│     │
                                └──────────┘       │  + today)  │     │
                                                   └─────┬──────┘     │
                                                  Tap day│            │
                                                         ▼            │
                                                ┌────────────────┐    │
                                                │  DAY_SELECTED  │    │
                                                │ (sheet 弹起)    │    │
                                                └─────┬──────────┘    │
                                            Tap event│  Tap "全部 ›"  │
                                                     ▼                │
                                                  → P11               │
                                                     ▲                │
                                              return │ refresh=true   │
                                                     └────────────────┘

  Filter chip toggle (异步):
       READY / DAY_SELECTED ──showStudy toggle──► FILTER_CHANGED
                                                  PATCH /me/preferences
                                                  → READY / DAY_SELECTED (refilter)

  Empty path:
       LOADING ──月无 event──► EMPTY (空 grid + 提示卡)
```

### 6.1 状态转移规则

| From | To | Trigger | Side effect |
|---|---|---|---|
| ENTRY | LOADING | mount + month 解析 | skeleton grid 显示 · `GET /events?month=` 发起 |
| LOADING | READY | API 200 | 渲染 grid + today cell 默认选中 · 触发 DAY_SELECTED |
| LOADING | ERROR | API 5xx / 网络 timeout (重试 2 次后) | 顶部 banner + retry |
| LOADING | EMPTY | API 200 + days[].events 全空 | 渲染空 grid + "本月无安排" 卡 |
| READY | DAY_SELECTED | tap day cell | 高亮 cell · sheet 弹起 · 渲染当日 events |
| DAY_SELECTED | DAY_SELECTED | tap 另一 day cell | 切换 selectedDate · sheet 内容刷新 |
| DAY_SELECTED | → P11 | tap event row | `navigator.state.from='CAL'` · 跳 `/event/:eventId` |
| DAY_SELECTED | → P07 | tap "全部 ›" | 跳 `/review?date=YYYY-MM-DD`（直接过滤该日队列 · §2A.3.3 第 7 条） |
| READY / DAY_SELECTED | FILTER_CHANGED | tap "显示复习" chip | 前端本地 refilter（不 reload month） · 异步 `PATCH /me/preferences` 持久化 |
| FILTER_CHANGED | READY / DAY_SELECTED | PATCH 成功 / 失败回滚 | Toast "已保存" / "保存失败" |
| 任意 | READY (refreshed) | 返回自 P09 完成 + refresh=true (§2B.6 步 9) | 月格 STUDY 点变绿 + 列表项 "已完成 ✓" |

来源：mockup（无显式状态）+ §2B.6 表 `home → calendar.LOADING → calendar.READY` / `calendar.DAY_SELECTED{date}` / `calendar.FILTER_CHANGED` / `done.EXIT → calendar.READY` + §2B.7 表 `calendar → event.LOADING_GENERIC` + `event → calendar.READY`。

---

## §7 跳转

| 入口 | 来源 | 触发条件 | 携带参数 |
|---|---|---|---|
| 首页周条带 "完整日历 →" | P-HOME 周条带右端 | 学生 tap | `?anchor=YYYY-MM-DD` (§2A.3.3 第 7 条) |
| 首页周条带某日 | P-HOME 周条带 | 学生 tap 某日（**非** "n 题复习"徽章） | `/calendar/month?anchor=YYYY-MM-DD` (§2A.3.3 第 7 条) |
| 首页快捷入口 2×2 | P-HOME 2×2 grid "完整日历" | 学生 tap | 默认本月 + today 选中 (§2A.3 L213) |
| Tab 5 我的 → "我的日历" | P13 列表 | 学生 tap | 默认本月 (§2A.3 L213) |
| 深链 | 推送 / 扫码 | `wb://calendar` | (§2A.3 L234) |

| 出口 | 目标 | 触发条件 | 路由 |
|---|---|---|---|
| 路由 push | P11 (`/event/:eventId`) | 学生 tap day list 的 event row | `navigator.state.from='CAL'` (§2A.3.3 第 6 条 → P11 返回 "4 月") |
| 路由 push | P07 (`/review?date=YYYY-MM-DD`) | 学生 tap day sheet 头 "全部 ›" | 该日 review 队列过滤（mockup row href 指向 `07_review_today.html`） |
| 路由 back | P-HOME (`/`) | 学生 tap ← 首页（mockup `back href="01_home.html"`） | — |

来源：§2A.3 L234 路由表 + §2A.3.3 L322 "P10 完整日历" + L341 二级页跳转图 + L359 第 6 条 navigator.state.from + L360 第 7 条 P-HOME 周条带 + mockup `back href` / `row href`。

---

## §8 Wire format (SSE / WebSocket 事件)

本页**无 SSE / WebSocket 通道**。所有事件通讯走 §5 HTTP 触点（4 条 REST）。日历数据是"快照"语义 · 月切换 / 日点击 / 筛选变更皆走显式 GET 拉取；P09 完成后的"月格变绿"由 §2B.6 步 9 `GET /events?month=...&refresh=true` 主动重拉而非 push。

---

## §9 异常 & 降级

| 异常 | 触发条件 | UI 反馈 | 系统行为 | 关联 TC |
|---|---|---|---|---|
| 月数据加载 5xx | `/events?month=` 服务降级 | 顶部 banner + retry button | 重试 2 次 → 切空 grid + "稍后再试" | — |
| 月数据空 | days[].events 全空 | EMPTY 卡 "本月无安排 · 去拍一道" + CTA → P02 | — | — |
| 单日多事件溢出 | 某日 events > 3（最多 3 dots） | cell 显示 bar 计数 N + 3 dots + "+(N-3)" overflow | sheet 内仍完整列出 | TC-05.03 |
| 节点已取消 | tap STUDY event 后 `GET /events/{eid}` 关联 node 404 | P11 占位 "该复习节点已取消，下次排期已更新" + CTA → P05(qid) | calendar 列表不立即移除 · 等下次 refresh | TC-05.04 |
| 复习筛选关 | tap "显示复习 · 关" | 月格 STUDY 类型 T 级色点消失 (只剩 EXAM 红 / FAMILY 蓝) · sheet 自动过滤 studytag | 前端本地 refilter + `PATCH /me/preferences {calendar.showStudy:false}` | TC-05.02 |
| 复习筛选 PATCH 失败 | PATCH 5xx | Toast "保存失败 · 已恢复" + UI 回滚 | optimistic UI 回退 · 不阻塞浏览 | — |
| 观察者只读 | OBSERVER JWT 进入 | 顶部 `p10-readonly-banner` "只读模式 · 不可写" | 所有写按钮置灰 · subscribe / edit 直接 403 (§2A.3.3 L365) | — |
| 深链节点不存在 | `wb://event/abc` 但 eventId 不在该学生名下 | P11 渲染前 403 → 降级 P-HOME (§2A.3 第 5 条 L358) | 埋点 `wb_deeplink_forbidden` (TC-05.05) | TC-05.05 |
| Outbox 写补偿延迟 | SC-10 归档错题后未来 event 未即时消失 | 1 min 内仍可见 | 不影响 question.ARCHIVED · 1 min 内最终一致 | TC-10.03 (L1157) |

来源：§2B.6 TC-05.02 / 05.03 / 05.04 / 05.05 + §2A.3.3 L358-L365 硬性导航规则 + §2B.13 SC-10 TC-10.03 + mockup 4/21 today 自带 4 dots（实战 overflow 场景）。

---

## §10 验收点 (TC → AC 映射)

| TC ID | 类型 | GIVEN | WHEN | THEN | 关联 task AC |
|---|---|---|---|---|---|
| TC-05.01 | 正常 | P-HOME 周条带 · 4/28 有 T4 复习 · showStudy=开 | SC-05 步骤 1-9 (P-HOME → P10 → P11 → P08 → P09 → P10) | P10 月格 4/28 渲染靛蓝点 · P11 渲染 STUDY 变体 · 完成后 P09 返回 P10 月格点变绿 + 列表项 "已完成 ✓" · 无多余 P07 跳转 | SC-05 整链 AC |
| TC-05.02 | 正常 | P-HOME 周条带 · 4/28 有 T4 复习 · showStudy=关 | 步骤 1-3 + 切换 chip | 4/28 列表无复习项 · 学生切回开 → 色点立即恢复 · `PATCH /api/me/preferences` 成功 | SC-05 分支 B AC |
| TC-05.03 | 边界 | 学生 4/28 有 3 复习 + 1 考试 + 2 家庭 (mockup 4/21 today 8 条同 pattern) | 步骤 3 tap 4/28 | 事件列表按时间升序：T1 复习 / T4 复习 / 数学月考（红 tag）/ T6 复习 / 接奶奶放学 / 家庭聚餐 · 所有复习项带 studytag · 全部可 tap 进 P11 | SC-05 多事件 AC |
| TC-05.04 | 异常 | 步骤 4 时 `/review/nodes/700` 返回 404（FORGOT 后取消） | tap 事件 | P11 显示 "该复习节点已取消，下次排期已更新" 占位 + CTA "查看新排期" → P05 qid=200 · 无崩溃 | SC-05 兜底 AC |
| TC-05.05 | 安全 | 深链 `wb://event/abc` 属于另一学生 | 扫码进入 | 403 · 跳 P-HOME · 埋点 `wb_deeplink_forbidden` | 共享 AC |
| TC-05.06 | 性能 | 月视图 200+ 条 event | tap 任意日 | 下方列表渲染 ≤ 300 ms · 虚拟列表 60 fps | 性能 AC |
| TC-06.01 | 正常 | P10 中 4/21 有 FAMILY event E900 | SC-06 步骤 1-8 | P11 渲染 GENERIC 变体（无曲线）· 编辑保存成功 · P10 列表刷新 | SC-06 整链 AC |
| TC-06.04 | 安全 | E900 是家长共享只读事件 | 学生 tap 编辑 | "编辑"按钮置灰 + 提示 "此事件由家长共享，如需修改请联系家长" | 权限 AC |
| TC-10.03 | 异常 (SC-10) | 步骤 3 calendar 删除失败 | 等待补偿 | outbox 最终一致 · 期间 P10 可短暂看到未来 event · 1 min 内消失 | SC-10 一致性 AC |

来源：biz §2B.6 QA 用例表 L976-L983 + §2B.7 QA 用例表 L1014-L1019 + §2B.13 SC-10 TC-10.03 L1157。

---

## §11 性能预算

| 操作 | P95 budget | 来源 |
|---|---|---|
| P-HOME → P10 (含 `GET /events?month=`) | ≤ 500 ms | §2B.6 步 2 耗时预算 |
| Tap day cell → DAY_SELECTED + sheet 渲染 | ≤ 300 ms | §2B.6 步 3 (TC-05.06 性能 AC) |
| Tap event row → P11 (`GET /events/{eid}`) | ≤ 600 ms | §2B.6 步 4 耗时预算 |
| P09 → P10 (refresh=true) 月格更新 | ≤ 800 ms | §2B.6 步 9 耗时预算 |
| Filter chip 切换（本地 refilter） | ≤ 100 ms (本地) + `PATCH /me/preferences` 异步 ≤ 300 ms | §2B.6 分支 B 2.B + §5 行 3 P95 |
| 月视图 200+ event 滚动 | 60 fps | §2B.6 TC-05.06 |

来源：§2B.6 表 "耗时预算" 列 + §2B.6 TC-05.06 性能 AC + §5 行 P95 budget。

---

## §12 埋点事件

| Event name | When | Properties | 来源 |
|---|---|---|---|
| `home_open_full_calendar` | P-HOME → P10 mount | `{from: 'weekstrip'/'quick'/'me-tab'}` | §2B.6 步 2 埋点列 |
| `calendar_view` | P10 mount 完成 | `{yearMonth, tz, showStudy}` | 推断（与 `home_open_full_calendar` 配对） |
| `calendar_month_switch` | tap prev/next | `{from, to}` | 推断 |
| `calendar_day_tap` | tap day cell | `{date}` | §2B.6 步 3 埋点列 |
| `calendar_filter_study_toggle` | tap "显示复习" chip | `{showStudy: true/false}` | §2B.6 分支 B 2.B 状态 `calendar.FILTER_CHANGED` |
| `calendar_event_tap` | tap event row | `{eventId, relationType: 'STUDY'/'FAMILY'/'EXAM'/'GENERIC'}` | §2B.6 步 4 + §2B.7 步 1 |
| `wb_deeplink_forbidden` | 深链 403 | `{eventId, reason}` | §2B.6 TC-05.05 |
| `wb_done_exit` | P09 返回 P10 | `{returnTo: 'calendar'}` | §2B.6 步 9 埋点列 |

来源：§2B.6 步 1-9 + 分支 B + TC-05.05 埋点列 + §2B.7 步 1 + §2A.6 L657 P10↔P11 返回错乱条目。

---

## §13 testid 表

| testid | 用途 | 出现位置 | E2E 引用 |
|---|---|---|---|
| `p10-root` | P10 根 | mockup `.phone`（推断套用） | sc-05.spec.ts beforeEach mount (TBD) |
| `p10-month-nav` | 顶部导航容器 | `.navbar` | sc-05.spec.ts 步 2 |
| `p10-month-nav-title` | 月份标题 "2026 年 4 月" | `.nav-top .center .t` | sc-05.spec.ts assert title |
| `p10-month-nav-prev` | 上月（mockup 隐式 · swipe） | TBD | TBD |
| `p10-month-nav-next` | 下月（mockup 隐式） | TBD | TBD |
| `p10-month-nav-today` | 跳今日 | TBD | TBD |
| `p10-week-header` | 周一..周日 | `.weekdays` | — |
| `p10-month-grid` | 6×7 grid | `.grid` | sc-05.spec.ts assert 42 cells |
| `p10-month-grid-cell-{1..42}` | 单日格（动态） | `.cell × 42` | sc-05.spec.ts step 3 tap 4/28 |
| `p10-month-grid-cell-{n}-today-marker` | 今日蓝圆 | `.cell.today .d` | — |
| `p10-month-grid-cell-{n}-dot-{1..3}` | 单日色点（动态） | `.cell .dots .dot` | sc-05.spec.ts assert STUDY dot |
| `p10-month-grid-cell-{n}-overflow` | "+N" 溢出 | TBD（mockup 隐式） | TC-05.03 |
| `p10-month-grid-skeleton` | LOADING 占位 | TBD | sc-05.spec.ts assert LOADING |
| `p10-legend-bar` | 学科图例容器 | TBD（mockup 未画 · 设计待补） | — |
| `p10-legend-bar-item-math` / `-physics` / `-chemistry` / `-english` / `-exam` / `-family` | 单图例项 | TBD | — |
| `p10-readonly-banner` | 观察者只读条 | TBD | sc-15.spec.ts OBSERVER 用 |
| `p10-filter-study` | "显示复习 开/关" chip | `.filter` | sc-05.spec.ts 分支 B 2.B |

来源：frontend/packages/testids/src/index.ts L175-L198 `TEST_IDS.p10.*` (18 静态 key + 4 类动态模板)。

> **drift 提示**：mockup 当前缺以下区域可视化 — `p10-month-nav-prev/next/today` 三按钮、`p10-legend-bar` 学科图例、`p10-readonly-banner`、`p10-month-grid-skeleton`、`p10-month-grid-cell-{n}-overflow`。spec is canonical → 实现时需补 DOM；testids 已先行定义不算 fabricate。

---

## §14 i18n key

| Key | 中文 | 英文 | 用途 |
|---|---|---|---|
| `calendar.title.month` | `{year} 年 {month} 月` | `{month} {year}` | 顶部月份标题 |
| `calendar.subtitle.tz` | `{tz} · {weekday}` | `{tz} · {weekday}` | 时区 + 星期副 |
| `calendar.back.home` | 首页 | Home | 返回按钮文字 |
| `calendar.seg.day` / `.week` / `.month` | 日 / 周 / 月 | Day / Week / Month | 视图切换段 |
| `calendar.filter.study.on` / `.off` | 显示复习 · 开 / 关 | Show Reviews · On / Off | 筛选 chip |
| `calendar.weekday.mon..sun` | 一..日 | Mon..Sun | 周表头 |
| `calendar.day.summary` | `{study} 条复习 · {exam} 场考试 · {family} 条家庭` | `{study} reviews · {exam} exams · {family} family` | sheet 头副 |
| `calendar.day.allEvents` | 全部 › | All › | 跳 P07 链接 |
| `calendar.empty.month` | 本月无安排 · 去拍一道 | No events this month · Capture one | EMPTY 态 |
| `calendar.readonly.observer` | 只读模式 · 不可写 | Read-only mode | observer banner |
| `calendar.error.loadFailed` | 加载失败，稍后重试 | Failed to load, retry later | API 5xx banner |

来源：mockup 文案字面 + §2B.6 步 2 "2026 年 4 月 / Asia/Shanghai" + §2A.3.3 L365 OBSERVER 403 提示 + §2B.6 TC-05.02 "保存成功" Toast。

---

## §15 关联与影响

- **上游 spec**: `P-HOME.spec.md`（周条带 + 2×2 完整日历入口 + 我的 Tab "我的日历"）· `P13`（未来 spec · "我的日历"入口）
- **下游 spec**: `P11`（事件详情双形态 · STUDY / GENERIC / FAMILY / EXAM 四变体） · `P07`（"全部 ›" → 该日复习队列）
- **关联 task**: feature_list.json SC-05（首页条带 → 日历 → STUDY 事件 → 立即复习）· SC-06（日历 → GENERIC/FAMILY 事件 → 编辑）· SC-10 间接（归档 → 级联取消未来 event）
- **关联 audit**: `audits/SC-05-PHASE-0/` (待生成 · 应包含 calendar-core 服务字符级 path 验证) · `audits/SC-06-PHASE-0/` (待生成)
- **关联 mockup**: `design/mockups/wrongbook/10_calendar_month.html`
- **关联组件契约**: `frontend/packages/testids/src/index.ts` L175-L198 (`TEST_IDS.p10.*`)
- **服务 drift 提示**: backend 当前**无 calendar-core 模块**（仅 review-plan-service 有 `CalendarFeignClient` 占位）· §5 端点为 spec'd · 后续 audit 阶段需推动 calendar-core 实施以对齐 spec。
