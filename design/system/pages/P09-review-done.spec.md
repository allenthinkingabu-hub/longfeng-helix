# P09 · 复习完成 (ReviewDone)

**Status**: Active
**Owner**: design + frontend + backend
**Last-updated**: 2026-05-14
**Mockup**: design/mockups/wrongbook/09_review_done.html
**Biz refs**: biz/业务与技术解决方案_AI错题本_基于日历系统.md §2A.4 (P09 规格卡 L571-L582) + §2B.2 SC-01 步 19-20 + §2B.3 SC-02 步 8-12 (ALL_DONE 庆祝升级态) + §2B.5 SC-04 步 3-6 (FORGOT variant)
**Related tasks**: feature_list.json SC-01 T13 (done-result-hero) · T14 (exit-to-home)

---

## §1 页面目的

P09 是单题复习完成后的**即时正反馈**页面：给学生一个被 SM2/艾宾浩斯算法"看见"的瞬间，把抽象的"记忆曲线推进"转成可视的庆祝 Hero、6 节点曲线动画、3 统计卡和 KP 掌握度条形，从而强化"再做一题"的行为闭环。第 N 题完成后展示 `RESULT` 普通态并出"继续 / 结束"双 CTA；最后一题完成后升级到 `ALL_DONE` 庆祝态、仅出"结束本次"。它同时承载日历订阅入口（`+加入日历`）作为 P10/P11 的引流。

---

## §2 布局分区 + Wireframe

### 2.1 布局分区 (zone 划分)

```
┌──────────────────────────────────────┐  StatusBar (绿底白字 9:47)
│  Hero 330px (绿渐变 + confetti)      │
│   ✓ 大对勾圆环 · "本题已掌握"        │
│   T2 → T3 sub · +12 记忆度 chips     │
├──────────────────────────────────────┤  scroll content 顶部圆角溢出
│  记忆曲线进度卡 (SVG · 6 dot · now 脉冲)│
│  └─ AI Advance Banner (绿蓝渐变)    │
│  下次复习卡  [4 月 24 · 周五 20:30]  │
│              [+ 日历] 按钮 (蓝)       │
│  今日战绩 (3 stat: Mastered/Partial/Forgot)│
│  知识点掌握变化 (4 KP 条形)           │
├──────────────────────────────────────┤  CTA 双按钮 (sec 结束本次 · pri 继续复习)
│  TabBar (复习 tab active · 红角标 4) │
└──────────────────────────────────────┘
```

来源：biz §2A.4 「布局分区」+ mockup 09_review_done.html L134-L325 视觉。

### 2.2 关键视觉锚 (mockup HTML 真 selector)

| Zone | DOM selector / class | 用途 |
|---|---|---|
| Hero 庆祝头 | `.hero` (L24-L38) | 绿渐变 330px · `linear-gradient(175deg,#0F7F3E→#34C759)` |
| Confetti 容器 | `.confetti` (L29-L30) | 8 颗彩色矩形 + 3 sparkle SVG · 1s 动画后 fade |
| 大对勾 | `.hicon .core` (L32-L33) | 104px 圆环 · 内 80px 白底 · 44px ✓ stroke 3.6px |
| Hero 标题 | `.htitle` (L35) | 28px / 800 / `本题已掌握` 或 `今日复习全部完成 🎉` |
| Hero sub | `.hsub` (L36) | 13px / `记忆曲线向前推进一节点 · T2 → T3` |
| 记忆曲线卡 | `.card.mc` (L51-L72) | 含 SVG 路径 + 6 .node row |
| 6 节点 row | `.nodes .row` (L61-L72) | T1/T2 done · T3 now (脉冲) · T4-T6 灰 |
| AI Advance | `.advance` (L74-L77) | 绿+蓝渐变 banner · "AI 已按艾宾浩斯模型推进节点" |
| 下次复习卡 | `.nxt` (L80-L86) | 日期 · 提前 30min · `+ 日历` 按钮 |
| 统计卡 | `.stats .stt` (L89-L95) | 3 卡 · `.green/.blue/.orange` |
| KP 列表 | `.kplist .kp` (L98-L105) | 4 行 · `.sq` 色块 + `.kn` 名 + `.bar` 80px + `.pct` |
| CTA 双按钮 | `.cta` (L108-L111) | `结束本次` (sec) + `继续复习 · 第 5 题` (pri) |

---

## §3 核心组件

| 组件 | 来源 | 接受 props | 说明 |
|---|---|---|---|
| `<CelebrateHero>` | frontend/packages/ui-kit | `{state: 'RESULT'\|'ALL_DONE', nodeIndex, nextTLabel, chips:[]}` | 庆祝 Hero · `ALL_DONE` 切换文案为"今日复习全部完成 🎉" + 隐藏 chips 改 streak 数字 |
| `<ConfettiBurst>` | frontend/packages/ui-kit | `{durationMs=1000, particleCount=8, onDone}` | confetti 动画 · ≤ 1s · `pointer-events:none` 不阻塞滚动 |
| `<MemoryCurve>` | frontend/packages/ui-kit | `{nodes:[{tLevel, state}], current}` | SVG 遗忘曲线 + 6 dot · `done`/`now`/`future` 3 态 |
| `<AdvanceBanner>` | frontend/packages/ui-kit | `{nextTLabel, intervalLabel}` | "AI 已按艾宾浩斯模型推进节点 · 下次 T3（3 天后）" |
| `<NextDueCard>` | frontend/packages/ui-kit | `{nextDueAt, eventId, onAddCalendar}` | 日期 + `+ 日历` 按钮 |
| `<StatsRow>` | frontend/packages/ui-kit | `{mastered, partial, forgot}` | 3 统计卡 |
| `<KpChart>` | frontend/packages/ui-kit | `{rows:[{kp, oldPct, newPct}]}` | KP 条形 · `bar-new` 动画从 oldPct 滚动到 newPct |
| `<CtaRow>` | frontend/packages/ui-kit | `{state, onContinue, onEnd}` | `ALL_DONE` 隐藏 `continue` 按钮 (SC-02 步 11) |

来源：biz §2A.4 「核心组件」+ mockup 09_review_done.html + testids `TEST_IDS.p09.*`。

---

## §4 数据绑定 (Entity / DTO)

### 4.1 Page-level State 绑定

```typescript
{
  done: {
    state: 'RESULT' | 'ALL_DONE',
    nid: number,
    sid: number,
    nodeResult: NodeResultResp,            // §5 endpoint #1
    sessionStats?: { total, mastered, partial, forgot, done },  // ALL_DONE 时由 session/next 派生
    kpDelta: [{ kp: string, oldPct: number, newPct: number }],
    nextEventId?: number,                  // 下一节点 calendar_event id · 用于 +日历
    calendarSubscribed: boolean,
  }
}
```

### 4.2 涉及的后端 Entity

- `wb_review_plan` (review-plan-service · plan + ease + interval 时序)
- `wb_review_node` (T0..T6 · nodeIndex / nodeState / nextDueAt)
- `review_outcome` (最近一次评分快照 · quality / easeBefore/After / intervalBefore/After / durationMs / mastered)
- `calendar_event` (relation_type=STUDY · `eid` 用于 subscribe)
- session in-memory store (B02 决策 A · `sid → {nids[], cursor, total, done}`)

来源：biz §2A.4 「数据绑定」+ audits/SC-01-PHASE-0/A05-review-plan.md §2.1 #8 NodeResultResp + §2.4 CalendarSubscribeController。

---

## §5 API 触点

> 字符级精准 path + method · 必须与 audits/SC-01-PHASE-0/A05-review-plan.md 字面一致。

| # | Method | Path | Headers (req) | Body (req) | Response | P95 预算 | 失败降级 |
|---|---|---|---|---|---|---|---|
| 1 | GET | `/api/review/nodes/{nid}/result` | `X-User-Id`, `X-Request-Id` | — | `200 NodeResultResp{planId, wrongItemId, nodeIndex, nodeState, quality, easeBefore, easeAfter, intervalBefore, intervalAfter, nextDueAt, durationMs, mastered}` | ≤ 300ms | 5xx → Hero 退化为中性态 + Toast "结果同步中" · 不阻塞 CTA |
| 2 | POST | `/api/review/sessions/{sid}/next` | `X-User-Id`, `X-Idempotency-Key`, `X-Request-Id` | — | `200 {next_nid: number\|null, completed: number, total: number, done: boolean}` | ≤ 300ms | `done=true` → 自动升级 `ALL_DONE` · 404 → Toast "已在另一设备完成" 返回 P-HOME (TC-02.03) |
| 3 | POST | `/api/calendar/events/{eid}/subscribe` | `X-User-Id`, `X-Idempotency-Key`, `X-Request-Id` | `{}` (eid in path) | `200 {eventId, subscribed: true, snapshot}` | ≤ 400ms | 幂等 · 重放返当前快照 (TI3) · 5xx → Toast "稍后重试" 不改本地 calendarSubscribed |

来源：biz §2A.4 「API 触点」(高层) + audits/SC-01-PHASE-0/A05-review-plan.md §2.1 表 #7 L406 / #8 L426 + §2.4 CalendarSubscribeController L58 (字符级 path)。NodeResultResp 字段清单见 A05 §2.1 #8 明文。

---

## §6 状态机

```
                          ┌─────────────┐
                          │ done.LOADING│  (GET /result in-flight · 骨架屏)
                          └──────┬──────┘
                                 │ 200 OK
                                 ▼
   ┌──────────────────┐   peekNext.done=false   ┌──────────────────┐
   │  done.RESULT     │───────────────────────→│  done.EXIT       │
   │  (单题完成普通态) │     tap 继续复习         │ (路由 P08 nextNid)│
   └──────┬───────────┘                         └──────────────────┘
          │ peekNext.done=true (TC-02.04 边界)
          │  或 步 11 服务端检测 session 完成
          ▼
   ┌──────────────────┐    tap 结束本次          ┌──────────────────┐
   │  done.ALL_DONE   │─────────────────────────→│  home.READY      │
   │  (庆祝升级态)     │   GET /api/home/today    │  (P-HOME 刷新)    │
   │  · 隐藏继续 CTA   │                          │  · 大卡 N→N-1     │
   └──────────────────┘                          └──────────────────┘
```

### 6.1 状态转移规则

| From | To | Trigger | Side effect |
|---|---|---|---|
| (mount) | done.LOADING | route enter `pages/review/done?nodeId={nid}` | 起 GET `/result` |
| done.LOADING | done.RESULT | GET 200 + peekNext 返 `done=false` | confetti 起 (≤1s) + 曲线动画 T(n-1)→T(n) |
| done.LOADING | done.ALL_DONE | GET 200 + peekNext 返 `done=true` | 庆祝升级态 · streak 数字动画 · CTA 隐藏 `continue` |
| done.RESULT | done.EXIT | tap `继续复习` (CTA pri) | POST `/sessions/{sid}/next` → POST `/nodes/{nextNid}/open` → push P08 |
| done.RESULT | done.ALL_DONE | 服务端推 `review.session.completed` (SC-02 步 11) | hot-swap hero · 隐藏 continue |
| done.ALL_DONE | home.READY | tap `结束本次` (CTA sec) | GET `/api/home/today` → push P-HOME · 大卡 -1 动画 |
| done.RESULT (forgot variant) | (同上) | grade=FORGOT (SC-04 步 3) | Hero 改橙红色 · 曲线 T3 重置为 T0 脉冲 |

来源：biz §2A.4 「状态集」(`RESULT` / `ALL_DONE`) + biz §2B.2 步 19-20 + §2B.3 步 11-12 + §2B.5 步 3-6。

---

## §7 跳转

| 入口 | 来源 | 触发条件 |
|---|---|---|
| 路由 push | P08 | `POST /nodes/{nid}/grade` 200 后自动 navigate `pages/review/done?nodeId={nid}` |
| 推送深链 (P1) | 系统推送 | `wb://review/done/{nid}` (兜底 · 主流量经 P08) |

| 出口 | 目标 | 触发条件 |
|---|---|---|
| 路由 push | P08 (`/review/exec/{nextNid}`) | `RESULT` · tap `继续复习` · `sessions/{sid}/next` 返非空 next_nid |
| 路由 push | P-HOME | `ALL_DONE` · tap `结束本次` (SC-01 步 20 / SC-02 步 12) |
| 路由 push | P10 (`/calendar/month`) | SC-05 自定义返回 (`wb_done_exit{returnTo=calendar}`) |
| 系统外联 | 日历 App (iOS/系统) | tap `+ 日历` · POST `/subscribe` 200 后调起系统日历 sheet |

来源：biz §2A.4 「跳转」+ biz §2A.3 IA 路由表 L233 `pages/review/done?nodeId=`。

---

## §8 Wire format (SSE / WebSocket 事件)

本页**无 SSE/WS 通道**；所有事件通讯走 §5 三条 HTTP 触点。`review.session.completed` 是后端 MQ topic (SC-02 步 11)，前端不直接订阅 —— 由 `POST /sessions/{sid}/next` 的 `done:true` 响应推断升级到 `ALL_DONE`，或由 P-HOME 刷新接口隐式感知。

---

## §9 异常 & 降级

| 异常 | 触发条件 | UI 反馈 | 系统行为 | 关联 TC |
|---|---|---|---|---|
| GET `/result` 5xx | review-plan-service down | Hero 退化为中性态 (无 confetti) + 顶部 Toast "结果同步中" | 留 P09 · 不阻塞 CTA · 3s 后重试 1 次 | — |
| `/sessions/{sid}/next` 404 | session 已被另一设备关闭 | Toast "已在另一设备完成" | 返 P-HOME 刷新 · 埋点 `wb_session_conflict` | TC-02.03 |
| `/sessions/{sid}/next` `done=true` (边界) | 会话仅 1 题或最后一题完成 | 不出 `继续` 按钮 · 仅 `结束本次` · Hero 自动升级 `ALL_DONE` | 隐式升级 · 不弹弹窗 | TC-02.04 |
| `/subscribe` 5xx | calendar-core down | Toast "日历同步失败 · 稍后重试" | 本地 calendarSubscribed 不改 · 重试按钮可点 | — |
| `/subscribe` 幂等重放 | 用户连点 / 网络重试 | 静默成功 · 不重复弹 Toast | 后端按 `eid + idem_key` 返当前快照 | TI3 (T13) |
| FORGOT variant | grade=FORGOT (P08 步 18 改) | Hero 橙红色 · 曲线 T3 重置为 T0 脉冲 · 下次复习卡 "1 小时后" | 7 个旧 node soft-delete · 新 7 个 SCHEDULED | TC-01.06 / TC-04.01 |
| confetti 阻塞滚动 | DOM 实现 bug | (反例) | `pointer-events:none` 强制断言 · 动画 ≤ 1s | TI1 (T13) |

来源：biz §2A.4 「状态集」+ biz §2A.7 异常路径降级矩阵 + biz §2B.3 TC-02.03/04 + feature_list.json T13 test_invariants。

---

## §10 验收点 (TC → AC 映射)

| TC ID | 类型 | GIVEN | WHEN | THEN | 关联 task AC |
|---|---|---|---|---|---|
| TC-01.01 | 正常 | 学生新登录 · 网络稳定 · 完成 SC-01 步 1-18 · grade=MASTERED | SC-01 步 19-20 (观看 Hero + tap 结束本次) | P09 渲染绿庆祝 Hero · 曲线 T0→T1 推进 · CTA tap 后回 P-HOME 大卡 -1 | T13 AC1/AC2/AC3 + T14 AC1/AC2/AC3/AC4 |
| TC-02.01 | 正常 | 学生已登录 · 会话有 3 题 · 完成 SC-02 步 1-10 | 步 11-12 (最后一题完成 + 结束本次) | P09 升级 `ALL_DONE` 庆祝态 · 不出现 `继续` 按钮 · 回 P-HOME 大卡归零 + hero 切换 | T13 AC1/AC5 + T14 AC5 |
| TC-02.03 | 异常 | session 已被另一设备关闭 | tap `继续复习` · `/sessions/{sid}/next` 返 404 | Toast "已在另一设备完成" · 返 P-HOME 刷新 · 埋点 `wb_session_conflict` | T13 (异常) |
| TC-02.04 | 边界 | 会话仅 1 题 | 完成最后一题 (peekNext done=true) | 自动进入 `ALL_DONE` · 不出现 `继续` 按钮 · 仅 `结束本次` | T13 AC1 + TI2 |
| TC-04.01 | 异常 | plan 200 有 3 GRADED + 1 OPEN + 3 SCHEDULED | nid=500 (T3) tap 未掌握 | P09 展示 FORGOT variant Hero · 日历未来点位重排 | T13 AC1 (FORGOT 分支) |

来源：biz §2B.2 TC-01.01 + §2B.3 TC-02.01/03/04 + §2B.5 TC-04.01 + feature_list.json T13/T14 acceptance_criteria。

---

## §11 性能预算

| 操作 | P95 budget | 来源 |
|---|---|---|
| P09 mount → confetti 起 | ≤ 200ms | biz §2B.2 步 19 "1s 动画" 包含起 + 渐隐 |
| confetti 动画总时长 (不阻塞滚动) | ≤ 1000ms · `pointer-events:none` | biz §2B.2 步 19 + T13 TI1 |
| GET `/api/review/nodes/{nid}/result` | ≤ 300ms | spec §5 #1 P95 + A05 §2.1 #8 |
| POST `/api/review/sessions/{sid}/next` | ≤ 300ms | spec §5 #2 + biz §2B.3 步 9 "≤ 500ms" 含路由 |
| POST `/api/calendar/events/{eid}/subscribe` | ≤ 400ms | biz §2B.5 步 5 "≤ 300ms" (Toast) + 后端 IO |
| 曲线 SVG T(n-1)→T(n) 推进动画 | 500ms easeInOut | mockup `.node .dot.now::after` pulse 1.6s 是循环动画 · 推进切换 ≤ 500ms |
| P09 → P-HOME 跳转 (SC-01 步 20) | ≤ 500ms | biz §2B.2 步 20 「耗时预算」 |
| P09 → P-HOME 跳转 (SC-02 步 12 ALL_DONE) | ≤ 1.2s | biz §2B.3 步 12 「耗时预算」(含 home/today 聚合) |

来源：biz §2B.2 步 19-20 + biz §2B.3 步 9-12 + feature_list.json T13 TI1。

---

## §12 埋点事件

| Event name | When | Properties | 来源 |
|---|---|---|---|
| `wb_done_view` | P09 mount 后 hero 渲染完 | `{nid, nextT, grade, state: 'RESULT'\|'ALL_DONE'}` | biz §2A.4 + §2B.2 步 19 + §2B.3 步 8 |
| `wb_done_continue` | tap `继续复习` (RESULT only) | `{prevNid, nextNid}` | biz §2B.3 步 9 |
| `wb_done_session_complete` | 服务端推 `review.session.completed` 后 P09 hot-swap | `{total, mastered, partial, forgot}` | biz §2B.3 步 11 |
| `wb_done_add_calendar` | tap `+ 日历` · `/subscribe` 200 后 | `{nid, eid}` | biz §2A.4 + §2B.5 步 5 |
| `wb_done_exit` | tap `结束本次` (RESULT 或 ALL_DONE) | `{nid, returnTo: 'home'\|'calendar', state}` | biz §2B.2 步 20 + §2B.3 步 12 + §2B.5 步 9 |
| `wb_session_conflict` | `/sessions/{sid}/next` 404 | `{sid, nid}` | biz §2B.3 TC-02.03 |

来源：biz §2A.4 「埋点事件」+ biz §2A.8 埋点字典 L674 + biz §2B.2/3/5 各步埋点列。

---

## §13 testid 表

| testid | 用途 | 出现位置 (mockup) | E2E 引用 |
|---|---|---|---|
| `p09-root` | P09 页面根 | `<div data-testid="p09-root">` (顶层 phone 容器) | t13-done-result-hero.spec.ts beforeEach mount |
| `celebrate-hero` | 庆祝 Hero 容器 | mockup `.hero` (L24) | t13 AC1 hero render assert |
| `p09-hero-title` | Hero 主标题 (本题已掌握 / 今日复习全部完成 🎉) | mockup `.htitle` (L166) | t13 ALL_DONE 文案切换断言 |
| `p09-hero-checkmark` | 大对勾 SVG | mockup `.hicon .core` (L152) | t13 AC1 视觉断言 |
| `celebrate-hero-streak-number` | `ALL_DONE` 态 streak 数字 | mockup .hchip "连续 5 题" (L171) | t13 ALL_DONE VRT |
| `confetti-burst` | confetti 容器 | mockup `.confetti` (L136) | t13 TI1 ≤ 1s 动画断言 |
| `memory-curve` | 记忆曲线卡 | mockup `.card.mc` (L179) | t13 AC3 曲线 |
| `memory-curve-node-{tLevel}` | 单节点 (dynamic · `p09Ids.memoryCurveNode('T3')`) | mockup `.node` × 6 (L210-L215) | t13 AC3 6 dot 状态断言 |
| `p09-advance-banner` | AI Advance Banner 容器 | mockup `.advance` (L219) | t13 (隐式 · 文案) |
| `p09-advance-banner-text` | banner 内文案节点 | mockup `.advance .at` (L223) | t13 nextT 文案断言 |
| `p09-next-due-card` | 下次复习卡 | mockup `.nxt` (L228) | t13 AC4 |
| `p09-next-due-card-add-calendar-btn` | `+ 日历` 按钮 | mockup `.nxt .add` (L244) | t13 AC4 tap · TI3 幂等 |
| `p09-stats-row` | 3 统计卡容器 | mockup `.stats` (L252) | t13 AC5 |
| `p09-stats-row-mastered` | 已掌握卡 | mockup `.stt.green` (L253) | t13 AC5 数字断言 |
| `p09-stats-row-partial` | 部分卡 | mockup `.stt.blue` (L254) | t13 AC5 |
| `p09-stats-row-forgot` | 遗忘卡 | mockup `.stt.orange` (L255) | t13 AC5 |
| `p09-kp-chart` | KP 列表容器 | mockup `.kplist` (L260) | t13 AC5 |
| `p09-kp-chart-row-{n}-bar-new` | KP 行条形 (dynamic · `p09Ids.kpChartBarNew(0)`) | mockup `.kp .bar span` × 4 (L264-L283) | t13 AC5 oldPct→newPct 动画 |
| `confetti-burst-particle-{n}` | 单粒子 (dynamic · `p09Ids.confettiParticle(0)`) | mockup `.c` × 8 (L137-L144) | t13 TI1 |
| `p09-cta-row` | CTA 双按钮容器 | mockup `.cta` (L289) | t13/t14 |
| `p09-cta-row-continue-btn` | `继续复习` 主按钮 | mockup `.btn.pri` (L294) | t13 TI2 ALL_DONE 时缺失断言 |
| `p09-cta-row-end-btn` | `结束本次` 次按钮 | mockup `.btn.sec` (L290) | t14 AC1 tap · AC2 跳转 |

来源：frontend/packages/testids/src/index.ts L445-L491 (`TEST_IDS.p09.*` + `p09Ids.*`) + mockup 09_review_done.html `data-testid` 锚位映射 + feature_list T13/T14 physical_verification.frontend_e2e。

---

## §14 i18n key

| Key | 中文 | 英文 | 用途 |
|---|---|---|---|
| `done.hero.title.result` | 本题已掌握 | Mastered | `RESULT` 态 hero 主标题 |
| `done.hero.title.allDone` | 今日复习全部完成 🎉 | All done today 🎉 | `ALL_DONE` 态 hero 主标题 |
| `done.hero.kicker` | REVIEW COMPLETE | Review complete | hero 上方 kicker |
| `done.hero.sub.advance` | 记忆曲线向前推进一节点 · {prevT} → {nextT} | Memory curve advanced · {prevT} → {nextT} | hero sub |
| `done.advance.banner` | AI 已按艾宾浩斯模型推进节点，下次复习节点 {nextT}（{interval} 后），未来 6 次提醒已自动更新。 | AI advanced via Ebbinghaus · next at {nextT} ({interval}) · 6 reminders refreshed. | Advance banner |
| `done.next.title` | 下次复习 | Next review | NextDueCard kicker |
| `done.next.addCalendar` | 日历 | Calendar | `+ 日历` 按钮文案 |
| `done.next.added.toast` | 已同步到日历 | Synced to Calendar | subscribe 成功 toast |
| `done.stats.mastered` | 已掌握 | Mastered | 统计卡 |
| `done.stats.partial` | 部分 | Partial | 统计卡 |
| `done.stats.forgot` | 遗忘 | Forgot | 统计卡 |
| `done.kp.title` | 知识点掌握变化 | KP mastery change | KP 块标题 |
| `done.cta.continue` | 继续复习 · 第 {n} 题 | Continue · Q{n} | CTA pri |
| `done.cta.end` | 结束本次 | End session | CTA sec |
| `done.conflict.toast` | 已在另一设备完成 | Already completed on another device | TC-02.03 toast |

来源：biz §2A.4 「i18n Key」+ frontend/packages/i18n/ + mockup 09_review_done.html 真文案抽取 (L165-L171, L223, L239-L246, L292, L296)。

---

## §15 关联与影响

- **上游 spec**: P08-review-exec (grade 成功后 push P09)
- **下游 spec**: P-HOME (`ALL_DONE` `结束本次` 出口) · P08 (`RESULT` `继续复习` 出口 nextNid) · P10/P11 (`+ 日历` 后续浏览)
- **关联 task**: feature_list.json SC-01 T13 (done-result-hero · AC1-AC5 + TI1-TI5) · T14 (exit-to-home · SC-01 黄金路径终点 · system_invariants 全 4 条)
- **关联 audit**: audits/SC-01-PHASE-0/A05-review-plan.md §2.1 #7 nextInSession L406 / #8 nodeResult L426 + §2.4 CalendarSubscribeController L58
- **关联 mockup**: design/mockups/wrongbook/09_review_done.html
- **跨服务依赖**: review-plan-service (主) · calendar-core (subscribe) · home-aggregator (T14 home/today 刷新)
- **MQ topic**: `review.session.completed` (SC-02 步 11 后端发 · 前端不订阅 · 由 `/sessions/{sid}/next` `done=true` 推断升级)
