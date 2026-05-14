# P07 · 今日待复习 (TodayReview)

**Status**: Active
**Owner**: design + frontend + backend
**Last-updated**: 2026-05-14
**Mockup**: `design/mockups/wrongbook/07_review_today.html`
**Biz refs**: biz/业务与技术解决方案_AI错题本_基于日历系统.md §2A.4 P07 规格卡 (L542-L554) + §2B.2 SC-01 步 14-15 + §2B.4 SC-03 全流（pause / resume）
**Related tasks**: feature_list.json SC-01 T09 (session-start-all) · T10 (open-first-node) · 间接关联 T08 (home-today-counter-tick 大卡数据源)

---

## §1 页面目的

把"今天应复习的 N 题"按**时间窗**（现在 / 上午 / 下午 / 晚上）排序，给学生一个一屏概览 + 一键开始全部 / 单题的入口。承担 SC-01 "首次拍题 → 首次复习"漏斗最后 1/3（步 14 → 步 15），也承担 SC-03 "全部开始 → 中途退出 → Resume" 的列表态展示。对学生的价值是"打开 App 就知道今天要做什么 / 还剩多少"，对系统的价值是把按节点排程的 7 节点（T0..T6）按时段聚合成可执行的工作清单。

---

## §2 布局分区 + Wireframe

### 2.1 布局分区 (zone 划分)

```
┌─────────────────────────────────┐  顶部安全区 + iOS Status bar
├─────────────────────────────────┤  Nav bar: ← 首页 · "今日复习" H1 · 排序 ▾
├─────────────────────────────────┤  Hero 渐变卡 (深蓝→靛 · 气泡粒子)
│  日期行 · 总数 / 预计 N 分钟       │
│  3 统计卡: 已完成 / 进行中 / 未开始  │
│  线性进度条 + 进度% / 掌握度%       │
├─────────────────────────────────┤  Slot 1 (icon: 时钟·黄) "现在 · 上午"
│  Item card[]                     │  每张：HH:MM + T 级 pill / 左色条 / 学科 + KP / 2 行题干 / 倒计时 pill
├─────────────────────────────────┤  Slot 2 (icon: 太阳·蓝) "下午"
│  Item card[]                     │
├─────────────────────────────────┤  (可选) Slot 3 (icon: 月·靛) "晚上"
│  Item card[]                     │
├─────────────────────────────────┤  浮层底 CTA: 蓝色「全部开始」+ 「N 题 · M min」徽章
└─────────────────────────────────┘  Tab Bar (4 个 tab · 复习 tab active · 红色 badge = N)
```

来源：biz §2A.4 P07 「布局分区」字面 `[Hero 渐变卡: 总览] [3 统计卡: 完成/进行/未开始] [进度条+掌握度] [时段 1: 现在·上午] [时段 2: 下午] [底部 CTA 全部开始]` + mockup `07_review_today.html` 真 DOM。

### 2.2 关键视觉锚 (mockup HTML 真 selector)

| Zone | DOM selector / class | testid | 用途 |
|---|---|---|---|
| Nav | `.nav h1 "今日复习"` | — | 顶部标题 |
| Hero | `.hero` (linear-gradient #0F1A3D→#1F3C8C→#5F5BDB) | `today-review-card` | 总览渐变卡 |
| Hero · 总数 | `.hero h2` "8 题待复习" | `today-review-card-total` | total + est minutes |
| Hero · est min | `.hero h2 .sz` "预计 25 分钟" | `today-review-card-est-min` | est minutes 副文本 |
| Hero · 3 stat | `.hero .stats-row .st × 3` | `today-review-card-done` (+ 推断 in-progress / wait) | done / inProgress / wait |
| Hero · 进度条 | `.hero .pg > i` width:38% | `today-review-card-progress-bar` | progressPct |
| Hero · 进度% | `.hero .pg-txt span:first` "进度 38%" | `p07-hero-progress-pct` | progressPct 文字 |
| Hero · 掌握度% | `.hero .pg-txt span:last` "掌握度 72%" | `today-review-card-mastery-pct` | masteryPct 文字 |
| Hero · 气泡 | `.hero .bubble.b1` / `.b2` | `today-review-card-particles` | 装饰粒子 |
| Slot header | `.slot h3` "现在 · 上午" / "下午" / "晚上" | `p07-slot-{key}-header` + `p07-slot-{key}-title` | 时段分组标题 |
| Slot count | `.slot .ct` "2 题" | — | slot 内题数 |
| Item card | `.it.red` / `.orange` / `.indigo` / `.green` | `p07-slot-{key}-item-{idx}` | 单题卡 |
| Item · 时间 | `.it .tc .hh` "09:45" | `p07-slot-{key}-item-{idx}-time` | HH:MM |
| Item · T级 pill | `.it .tc .lv` "T1" | `p07-slot-{key}-item-{idx}-tlevel` | T0..T6 |
| Item · 倒计时 | `.it .right .cd.now` / `.cd.soon` / `.cd.wait` | `p07-slot-{key}-item-{idx}-countdown` | 倒计时 pill (红/橙/灰) |
| Bottom CTA | `.cta` linear-gradient blue | `p07-bottom-cta` + `p07-bottom-cta-start-all-btn` | "全部开始 · N 题 · M min" |
| Empty state | (mockup 未画 · 接 EMPTY 态需新增) | `p07-empty-state` + `p07-empty-capture-btn` | EMPTY 态: 引导拍题 |

来源：mockup HTML grep + frontend/packages/testids/src/index.ts L407-L478 `TEST_IDS.p07.*` + `p07Ids.*` 动态函数。

---

## §3 核心组件

| 组件 | 来源 | 接受 props | 说明 |
|---|---|---|---|
| `<TodayHeroCard>` | frontend/apps/h5 P07 内置 | `{date, tzLabel, total, estMinutes, doneCount, inProgressCount, waitCount, progressPct, masteryPct}` | Hero 渐变 + 3 stat + 双进度文本（biz "Hero 渐变（深蓝→靛）+ 气泡粒子"） |
| `<SlotHeader>` | P07 内置 | `{slotKey: 'now'/'morning'/'afternoon'/'evening', title, count, icon}` | 时段分组标题（biz "时段分组（现在 / 上午 / 下午 / 晚上）"） |
| `<TodayItemCard>` | P07 内置 | `{nid, tLevel, hhmm, subject, kp, stem, tags, nextDueAt, countdownState: 'now'/'soon'/'wait'}` | 单题卡：时间列 + 左色条 + 学科/KP + 2 行题干 + 倒计时 pill |
| `<CountdownPill>` | ui-kit (推断 · 复用 P-HOME 同款) | `{nextDueAt, now}` | 渲染 `4 分钟` / `1 h` / `6 h 15 m` · 配色 red/orange/gray |
| `<StartAllCta>` | P07 内置 | `{total, estMinutes, disabled, onTap}` | 浮层底蓝 CTA |
| `<EmptyState>` | ui-kit | `{kind: 'EMPTY'/'ALL_DONE', onCaptureTap?}` | EMPTY = "今日无题 · 拍一道试试" · ALL_DONE = "今日已完成 · 庆祝态"（biz §2A.4 「状态集」） |
| `<TabBar>` | global layout | — | 4 tab，复习 tab active，badge=total 红色 |

来源：biz §2A.4 P07 「核心组件」字面 + mockup `07_review_today.html` 真 DOM 结构 + frontend/packages/testids `TEST_IDS.p07.*` 反推。

---

## §4 数据绑定 (Entity / DTO)

### 4.1 Page-level State 绑定

```typescript
{
  today: {
    date: string,           // 'YYYY-MM-DD' (按学生 tz 解析)
    tzOffset: string,       // 'GMT+8' / 'Asia/Shanghai'
    totalCount: number,     // = doneCount + inProgressCount + waitCount
    estMinutes: number,     // 预计耗时 (后端估算 · 每题 ≈ 3 min)
    doneCount: number,      // GRADED 节点数
    inProgressCount: number,// OPEN(已 open 未 grade) 节点数
    waitCount: number,      // SCHEDULED + PUSHED 节点数
    progressPct: number,    // 0-100 · doneCount/totalCount * 100
    masteryPct: number,     // 0-100 · 来自 SM-2 ease_factor 聚合 (B02 决策 A · 来源 review_outcome)
    slots: Array<{
      slotKey: 'now' | 'morning' | 'afternoon' | 'evening',
      slotTitle: string,    // i18n: "现在 · 上午" / "下午" / "晚上"
      items: Array<{
        nid: string,                // ≡ review_plan.id (B02 决策 A · HTTP/DTO 层映射)
        tLevel: 'T0' | 'T1' | ... | 'T6',
        hhmm: string,               // 'HH:MM' (按学生 tz 渲染)
        nextDueAt: string,          // ISO-8601 UTC
        subject: 'MATH' | 'PHY' | 'CHEM' | 'EN' | ...,
        kp: string,                 // 知识点 (顶点式 / 欧姆定律 ...)
        stem: string,               // 题干 (2 行截断)
        tags: string[],             // ['顶点式','配方法','★★★']
        countdownState: 'now' | 'soon' | 'wait', // FE 计算: now: <=15min 红 / soon: <=2h 橙 / wait: >2h 灰
        sideColor: 'red'|'orange'|'blue'|'indigo'|'green', // 学科色映射
        status: 'SCHEDULED' | 'PUSHED' | 'OPEN' | 'GRADED'
      }>
    }>
  },
  session: {                // 仅当存在 paused / open session 时
    sid: string | null,
    state: 'NONE' | 'OPEN' | 'PAUSED',
    nextNid: string | null
  },
  pageState: 'today.LIST' | 'today.EMPTY' | 'today.ALL_DONE'
}
```

**Slot 分组逻辑（FE 计算 · 后端只返 items[].nextDueAt）**：
- `now` (现在·上午)：`nextDueAt` ≤ now+2h 且属于上午时段（< 12:00）
- `morning` (上午)：12:00 之前但已不在 `now` 窗
- `afternoon` (下午)：12:00 ≤ hhmm < 18:00
- `evening` (晚上)：hhmm ≥ 18:00

mockup `07_review_today.html` 现展示 slot 标签为 "现在 · 上午" + "下午" 两段（晚上空时不渲染 header） · slot 内按 `nextDueAt` 升序。

### 4.2 涉及的后端 Entity

- `wb_review_plan`（review-plan-service · 7 节点 T0..T6 · `node_index` 0..6 · `next_due_at` · `status=ACTIVE/COMPLETED` · ease_factor）
- `wb_review_outcome`（每次 grade 写一行 · `quality` 0-5 · 用于 masteryPct 聚合）
- `review_session`（**内存 in-memory** · `ReviewSessionService.java` L119 行 · B02 决策 A · reboot 后丢失可接受 · 详见 §11 / §15）
- `wb_question` join（拿 subject / kp / stem · 渲染 item card）

来源：biz §2A.4 P07 「数据绑定」字面 + audits/SC-01-PHASE-0/A05-review-plan.md §1.3 + §1.5 + B02 决策 A。

---

## §5 API 触点

> 字符级精准 path + method · 必须与 audits/SC-01-PHASE-0/A05-review-plan.md §2.1 字面一致。三端点均归属 `review-plan-service.ReviewPlanController`。

| # | Method | Path | Headers (req) | Body (req) | Response | P95 预算 | 失败降级 |
|---|---|---|---|---|---|---|---|
| 1 | GET | `/api/review/today?tz=Asia/Shanghai` | `X-User-Id`, `X-Request-Id` | — (query: `tz`) | `200 TodayResp{date, tzOffset, totalCount, estMinutes, doneCount, inProgressCount, waitCount, progressPct, masteryPct, slots:[{slotKey, slotTitle, items:[{nid, tLevel, hhmm, nextDueAt, subject, kp, stem, tags, status}]}]}` | ≤ 300ms | 走本地缓存节点（biz §2A.4 P07 「异常 & 降级」"无网络 → 走本地缓存节点"） |
| 2 | POST | `/api/review/sessions` | `X-User-Id`, `X-Request-Id`, `X-Idempotency-Key` (可选) | `{date?: 'YYYY-MM-DD', node_ids?: string[], tz?: string}` | `200 {sid, nids: string[], total: number}` | ≤ 400ms | in-memory store (B02 决策 A) · 5xx 由 FE 弱网重试 3 次 + 落 outbox-FE 兜底 |
| 3 | GET | `/api/review/nodes/{nid}` | `X-User-Id`, `X-Request-Id` | — | `200 ReviewPlanDto{nid, wrongItemId, nodeIndex (0..6), tLevel, easeFactor, intervalDays, status, nextDueAt, openedAt?, revealedAt?}` | ≤ 200ms | 404 NODE_NOT_FOUND / 403 NODE_FORBIDDEN（跨学生）→ Toast "该节点不存在或无权访问" |

**A05 audit §2.1 字符级比对**：路径 #1/#2/#3 在 `ReviewPlanController.java` L277 (today) / L239 (createSession) / L300 (getNode) 实测命中，状态 ✅ 8/8 一致。

来源：biz §2A.4 P07 「API 触点」高层 + audits/SC-01-PHASE-0/A05-review-plan.md §1.1 行号 + §2.1 比对表（字符级 ground truth）。

---

## §6 状态机

```
                  GET /today               total > 0
       ┌─────────────────────────────────────────────┐
       │                                              │
       ▼                                              │
   ┌────────┐ total==0    ┌────────────┐    Tap「全部开始」  ┌──────────────────┐
   │LOADING │────────────►│today.EMPTY │              POST /sessions 200      │
   │        │             │ (恭喜态)    │                                     │
   │        │ total > 0   └────────────┘                                     │
   │        │────────────►┌────────────┐ Tap item「开始」/「全部开始」首条    │
   └────────┘             │today.LIST  │─────────────────────────────────────►│
                          │            │                                      │
                          │ doneCount  │ 所有题 GRADED                        │
                          │ ==total    │─────────────►┌────────────────┐    │
                          │            │              │today.ALL_DONE   │   │
                          │            │              │ (庆祝升级态)    │   │
                          └────────────┘              └────────────────┘   │
                                                            │                │
                                                            ▼                ▼
                                                       (跳 P-HOME)     (跳 P08 nid1)
```

### 6.1 状态转移规则

| From | To | Trigger | Side effect |
|---|---|---|---|
| LOADING | today.LIST | `GET /today` 200 + `totalCount > 0` | 渲染 Hero + slot list + bottom CTA |
| LOADING | today.EMPTY | `GET /today` 200 + `totalCount == 0` | 渲染 EmptyState「今日无题 · 拍一道试试」+ CTA 跳 P02 |
| today.LIST | session.OPEN (前置 P08) | Tap bottomCta「全部开始」→ POST `/sessions` 200 | session.OPEN → 立即 POST `/nodes/{nid1}/open` → 跳 P08 nid1 (SC-01 步 14-15) |
| today.LIST | session.OPEN (前置 P08) | Tap 单题 item → POST `/sessions` body `{node_ids:[nid_tapped]}` | 同上 · 单题 session |
| today.LIST | today.ALL_DONE | `doneCount == totalCount` (从 P09 返回时刷新触发) | Hero 切换庆祝升级态 + bottom CTA 隐藏 |
| today.LIST (any) | today.LIST (refreshed) | 学生从 P08/P09 返回 + pull-to-refresh | re-fetch `GET /today` |

来源：biz §2A.4 P07 「状态集」`EMPTY(今日无题 → 恭喜态)` / `LIST` / `ALL_DONE(庆祝态)` + biz §2B.2 步 14 (`today.LIST → session.OPEN`) + biz §2B.4 SC-03 步 18-20 (paused session resume 走 P-HOME · 不直接回 P07)。

---

## §7 跳转

| 入口 | 来源 | 触发条件 |
|---|---|---|
| Tab 4 「复习」 | global tabbar | 学生 tap 复习 tab (badge 显示 N 红色) |
| P-HOME 大卡「全部开始」 | P-HOME `today-review-card-start-all-btn` | SC-01 步 14 · 直接进入 P07（mockup 风险：mockup 显示 step 14 后还过 P07 再跳 P08，但 biz §2B.4 步 1 描述"P-HOME → P07 今日列表 → 自动跳转 P08 第 1 题" 表明 P07 仅作 transient 闪过/可见 ≈ 100-300ms 后即被 P08 cover）|
| 推送深链 | 通知 | `wb://review/today` 落位 P07 |
| P06 「立即复习」 | P06 详情页 | 学生从错题详情触发"立即复习"按某 nid |
| 出口 → P08 | bottom CTA「全部开始」or 单题 item tap | SC-01 步 14-15 · `POST /sessions` 200 → `POST /nodes/{nid1}/open` → push P08 |
| 出口 → P02 | EMPTY 态「拍一道试试」 | EMPTY 态 CTA |
| 出口 ← P-HOME (back) | Nav 左上「< 首页」 | 系统返回键 / nav back |

来源：biz §2A.4 P07 「跳转」「入：Tab4 / 推送深链 / `P06 立即复习`；出：`P08`(单题或全部开始)」。

---

## §8 Wire format (SSE / WebSocket 事件)

本页**无 SSE / WebSocket 通道**。事件通讯走 §5 HTTP 触点（`GET /today` 拉取 · `POST /sessions` 创建 · `GET /nodes/{nid}` 单查）。流式只在 P03 (AI 分析) 有，详见 P03 spec。

---

## §9 异常 & 降级

| 异常 | 触发条件 | UI 反馈 | 系统行为 | 关联 TC |
|---|---|---|---|---|
| 无网络 / `GET /today` 5xx | 全断网 / 后端 down | 顶部 Banner "网络异常 · 显示本地缓存" · 数据为最近一次成功响应 | LocalStorage 缓存 last `TodayResp` · 后台静默重试 3 次 | biz §2A.4 P07 「无网络 → 走本地缓存节点」 |
| 节点跨天漂移 | XXL-Job 延迟 / `node-ready-scan` 未跑 | Banner "数据同步中 · 稍后刷新" | reminder-svc hourly 兜底扫描（biz §2A.7 异常矩阵） | — |
| `POST /sessions` 5xx | review-plan-service 5xx | bottom CTA loading → 红色 toast "启动失败 · 请重试" · 触觉 error | FE 重试 3 次（带 `X-Idempotency-Key`）· 仍失败 → outbox-FE 兜底待网恢复 | TC-03.02 (类比异常) |
| `POST /sessions` 重放 | 同 idem key 重 POST | 透明 · 返当前快照 | in-memory store 用 `X-Idempotency-Key` 去重（B02 决策 A 当前为按 sid 重 POST 返当前 · §11 注） | T09 TI2 |
| session 跨设备并发 | 学生在设备 A 完成 · 设备 B Tap 全部开始 | Toast "已在另一设备完成" | 后端校验 node ACTIVE 态 · 已 GRADED 不计入 nids | biz §2A.7 异常矩阵 |
| reboot 后 session 丢失 | review-plan-service 重启 | 透明 · FE Tap 「全部开始」会建新 sid | in-memory store · reboot 清空（B02 决策 A 明示接受） | A05 §4 跟进项 #1 |
| `GET /nodes/{nid}` 404 / 403 | 跨学生 nid / nid 已归档 | Toast "该节点不存在或无权访问" · 列表自动刷新 | 不阻塞页面 · 单题降级 | biz §2A.7 异常矩阵 |
| paused session 跨天 | 学生退出后隔日打开 | P07 不显示 paused banner（banner 在 P-HOME） · 隔日 PAUSED 自动 EXPIRED | 后端定时 job 清理（详见 SC-03 TC-03.03） | TC-03.03 |
| 时区切换 | 学生跨时区登录 | 顶部 Banner "时区已切换 · 重新计算今日节点" | `GET /today?tz=` 重发 · slot 重算 | biz §2A.7 「时区变化」 |

来源：biz §2A.4 P07 「异常 & 降级」+ biz §2A.7 异常矩阵 + biz §2B.4 SC-03 TC-03.02/.03/.04 + feature_list.json T09 TI1/TI2 + A05 audit §4 跟进项。

---

## §10 验收点 (TC → AC 映射)

| TC ID | 类型 | GIVEN | WHEN | THEN | 关联 task AC |
|---|---|---|---|---|---|
| TC-01.01 | 正常 (SC-01 步 14-16) | 学生在 P-HOME · today.total=9 · 网络稳定 | Tap 大卡「全部开始」→ P07 渲染 → 自动跳第 1 题 P08 | `POST /sessions` 200 (sid 生成) + P07 渲染 Hero + slots + bottom CTA + P07→P08 跳转 ≤ 500ms + 埋点 `home_today_start_all{count=9}` | T09 AC1/AC2/AC3/AC4/AC5 |
| TC-01.01b | 正常 (SC-01 步 15) | 学生在 P07 · today.LIST · 9 题 | Tap 列表第 1 题 item | `POST /sessions body {node_ids:[nid1]}` 200 → `POST /nodes/{nid1}/open` 200 + `EVENT_OPENED` outbox 写入 + P07→P08 跳转 ≤ 400ms | T10 AC1/AC2/AC3 |
| TC-03.01 | 正常 (SC-03 全流) | 学生在 P-HOME · 8 题待复习 · session 不存在 | 完成 SC-03 步 1-20（全部开始 → 连做 5 → 退出 → resume） | P07 在步 1 短暂渲染后跳 P08 · 步 18 退出后回 P-HOME（不回 P07）· nid1-5 GRADED / nid6-8 SCHEDULED · sid 单一串起 paused+resumed | (跨页 · P07 仅作 transient list) |
| TC-03.04 | 边界 (SC-03 reboot 安全) | 学生 Tap 退出后立即杀掉 App | 重启 App | 落 P-HOME · Resume Banner 正常显示（PAUSED 已落服务端）· **P07 不暴露 reboot 后内存 session 丢失**（FE 不直接读 session 状态，FE 只 Tap 重建） | A05 §4 跟进项 #1 |

来源：biz §2B.2 SC-01 TC-01.01 + biz §2B.4 SC-03 TC-03.01/.04 + feature_list.json SC-01 T09 / T10 task acceptance_criteria。

---

## §11 性能预算

| 操作 | P95 budget | 来源 |
|---|---|---|
| `GET /api/review/today` 返回 | ≤ 300ms | §5 行级 budget + A05 §2.1 #2 (DB 查询单 + slot 聚合 FE 端做 · 后端轻量) |
| `POST /api/review/sessions` 返回 | ≤ 400ms | §5 行级 budget + A05 §2.1 #1 (in-memory store · 零 DB 写) |
| `GET /api/review/nodes/{nid}` 返回 | ≤ 200ms | §5 行级 budget + A05 §2.1 #3 (单 PK 查询) |
| Tap 大卡「全部开始」→ P07 首屏渲染 | ≤ 500ms | biz §2B.2 步 14 「耗时预算」 |
| P-HOME → P07 → P08 第 1 题 (含 sessions + open 二端点) | ≤ 800ms | biz §2B.4 SC-03 步 1 「耗时预算」（"P-HOME → P07 → P08 第 1 题" 复合） |
| P07 → P08 单题跳转（含 `/nodes/{nid}/open`） | ≤ 400ms | biz §2B.2 步 15 「耗时预算」 |

**重要声明**（owner: backend）：`ReviewSessionService` 当前为 **in-memory store**（B02 决策 A · A05 §4 跟进项 #1）· reboot 后会话**全部丢失** · FE 必须能从「全部开始」按钮重建 session（不应假设 sid 持久）· Phase 1+ 引入 `review_session` 表持久化（含 expires_at）。

来源：biz §2B.2 SC-01 步 14/15 「耗时预算」列 + biz §2B.4 SC-03 步 1 + audits/SC-01-PHASE-0/A05-review-plan.md §4。

---

## §12 埋点事件

| Event name | When | Properties | 来源 |
|---|---|---|---|
| `wb_today_view` | P07 mount + `GET /today` 200 后 | `{count: totalCount, doneCount, slotCount}` | biz §2A.4 P07 「埋点事件」 `wb_today_view{count}` |
| `wb_today_start_all` | Tap bottom CTA「全部开始」前 | `{count: totalCount, estMin: estMinutes}` | biz §2A.4 P07 + biz §2A.8 字典 `wb_today_start_all{count, estMin}` |
| `wb_today_start_one` | Tap 单题 item 前 | `{nid, tLevel, slotKey, subject}` | biz §2A.4 P07 「埋点事件」 `wb_today_start_one{nid}` |
| `home_today_start_all` | (P-HOME 大卡 Tap · 跨页埋点) | `{count}` | biz §2B.2 步 14 + feature_list.json T09 TI3（P-HOME 处发出 · P07 不重复发） |

来源：biz §2A.4 P07 「埋点事件」+ biz §2A.8 埋点字典 L672 `wb_today_start_all`。

---

## §13 testid 表

| testid | 用途 | 出现位置 (mockup 或 testids 包) | E2E 引用 |
|---|---|---|---|
| `p07-root` | P07 页面根 | testids index.ts L408 | t09-session-start-all.spec.ts (推断 beforeEach mount) |
| `today-review-card` | Hero 渐变卡根 | testids L409 + mockup `.hero` | t09 spec · T09 AC4 |
| `today-review-card-total` | "8 题待复习" 主文本 | testids L410 + mockup `.hero h2` | t09 spec |
| `today-review-card-done` | 已完成 stat 卡 | testids L411 + mockup `.hero .stats-row .st:first` | t09 spec |
| `today-review-card-est-min` | "预计 25 分钟" 副文本 | testids L412 + mockup `.hero h2 .sz` | t09 spec |
| `today-review-card-progress-bar` | 线性进度条 | testids L413 + mockup `.hero .pg > i` | t09 spec |
| `p07-hero-progress-pct` | "进度 38%" | testids L414 + mockup `.hero .pg-txt span:first` | t09 spec |
| `today-review-card-mastery-pct` | "掌握度 72%" | testids L415 + mockup `.hero .pg-txt span:last` | t09 spec |
| `today-review-card-particles` | Hero 气泡装饰 | testids L416 + mockup `.hero .bubble` | t09 VRT (TI4) |
| `p07-empty-state` | EMPTY 态根 | testids L417 | empty 态 e2e (推断) |
| `p07-empty-capture-btn` | EMPTY 态「拍一道试试」 | testids L418 | empty 态 → P02 跳转 e2e |
| `p07-bottom-cta` | 浮层底 CTA 容器 | testids L419 + mockup `.cta` | t09 spec |
| `p07-bottom-cta-start-all-btn` | 「全部开始」按钮 | testids L420 + mockup `.cta` | t09 AC1 Tap 行为 |
| `p07-slot-{key}-header` (动态) | slot 标题行 (key='now'/'morning'/'afternoon'/'evening') | testids L472 `p07Ids.slotHeader` | t09 AC4 slot 渲染断言 |
| `p07-slot-{key}-title` (动态) | slot 标题文本 | testids L473 | t09 AC4 |
| `p07-slot-{key}-item-{idx}` (动态) | 单题卡 (idx 从 0) | testids L474 + mockup `.it.red` 等 | t10 AC1 Tap 单题 / t09 list 渲染 |
| `p07-slot-{key}-item-{idx}-time` (动态) | 时间列 "HH:MM" | testids L475 + mockup `.it .tc .hh` | t09 spec |
| `p07-slot-{key}-item-{idx}-tlevel` (动态) | T 级 pill | testids L476 + mockup `.it .tc .lv` | t09 spec |
| `p07-slot-{key}-item-{idx}-countdown` (动态) | 倒计时 pill (now/soon/wait) | testids L477 + mockup `.it .right .cd` | t09 spec |

来源：frontend/packages/testids/src/index.ts L407-L478 `TEST_IDS.p07.*` + `p07Ids.*` + mockup `07_review_today.html` `data-testid` (mockup 当前未直接挂 testid · 真组件实现时按上表挂)。

---

## §14 i18n key

| Key | 中文 | 英文 | 用途 |
|---|---|---|---|
| `today.title` | 今日复习 | Today Review | Nav h1 |
| `today.sort.byTime` | 排序 · 时间 | Sort · Time | Nav 右侧 |
| `today.hero.total` | `{count} 题待复习` | `{count} to review` | Hero 主文本 |
| `today.hero.estMin` | `预计 {min} 分钟` | `Est. {min} min` | Hero 副文本 |
| `today.hero.statDone` | 已完成 | Done | 3 stat 卡 |
| `today.hero.statInProgress` | 进行中 | In progress | 3 stat 卡 |
| `today.hero.statWait` | 未开始 | Not started | 3 stat 卡 |
| `today.hero.progressPct` | `进度 {pct}%` | `Progress {pct}%` | 进度文本 |
| `today.hero.masteryPct` | `掌握度 {pct}%` | `Mastery {pct}%` | 掌握度文本 |
| `today.slot.now` | 现在 · 上午 | Now · Morning | slot header (key='now') |
| `today.slot.morning` | 上午 | Morning | slot header (key='morning') |
| `today.slot.afternoon` | 下午 | Afternoon | slot header (key='afternoon') |
| `today.slot.evening` | 晚上 | Evening | slot header (key='evening') |
| `today.slot.count` | `{n} 题` | `{n} items` | slot 右侧计数 |
| `today.countdown.now` | `{m} 分钟` | `{m} min` | 倒计时 (now 态 红) |
| `today.countdown.soon` | `{h} h` | `{h} h` | 倒计时 (soon 态 橙) |
| `today.countdown.wait` | `{h} h {m} m` | `{h} h {m} m` | 倒计时 (wait 态 灰) |
| `today.cta.startAll` | 全部开始 | Start All | 浮层底 CTA |
| `today.empty.title` | 今日无题 · 拍一道试试 | Nothing today · Capture one | EMPTY 态 |
| `today.empty.cta` | 去拍题 | Go capture | EMPTY 态 CTA |
| `today.allDone.title` | 今日全部完成 🎉 | All done today 🎉 | ALL_DONE 庆祝态 |
| `today.error.network` | 网络异常 · 显示本地缓存 | Network error · showing cached | Banner |
| `today.error.startFailed` | 启动失败 · 请重试 | Failed to start · retry | bottom CTA toast |

来源：biz §2A.4 P07（无显式 i18n Key 列 · 按 biz §2A.9 「i18n 命名遵循 §2A.4 i18n Key 列前缀」约定推断 `today.*` 前缀）+ mockup 文案 + frontend/packages/i18n/（实际项目 i18n 包）。

---

## §15 关联与影响

- **上游 spec**: P-HOME（Tab 4 入口 / 大卡「全部开始」入口 · `today-review-card-start-all-btn`）/ P06（「立即复习」入口）/ 推送（深链 `wb://review/today`）
- **下游 spec**: P08（Tap「全部开始」or 单题 → `POST /sessions` + `POST /nodes/{nid1}/open` → push P08）/ P02（EMPTY 态 → 拍题）
- **关联 task**: feature_list.json SC-01 **T09** (session-start-all · 主) + **T10** (open-first-node · 紧邻) + 间接 T08 (home-today-counter-tick · P-HOME 大卡数据源 · P07 同 `GET /today` 源)
- **关联 audit**: audits/SC-01-PHASE-0/A05-review-plan.md §2.1 #1 createSession L239 / #2 today L277 / #3 getNode L300 + §4 跟进项 #1 (in-memory session reboot 风险) + B02 决策 A (`audits/SC-01-PHASE-0/B02-decision.md`)
- **关联 mockup**: design/mockups/wrongbook/07_review_today.html
- **关联架构决策**:
  - **B02 决策 A**: `nid ≡ review_plan.id`（HTTP/DTO 层概念映射 · DB 层不下沉）· `review_session` 为 in-memory store · reboot 后丢失可接受（A05 §1.1 + §4）
  - SM-2 算法引擎 + 7 节点偏移 `[2h, 1d, 2d, 4d, 7d, 14d, 30d]`（`ReviewPlanService.NODE_OFFSETS` L48 · A05 §1.2-§1.3）
- **关联跟进项 (Phase 1+ tech debt)**: 引入 `review_session` 表持久化 / `NodeLifecycleTracker` 落 `review_outcome` 列 / `HomeAggregatorController` 剥离独立 module（A05 §4）
