# P11 · 事件详情 · 三形态融合锚点 (EventDetail)

**Status**: Active
**Owner**: design + frontend + backend
**Last-updated**: 2026-05-14
**Mockup**: `design/mockups/wrongbook/11_event_detail.html`
**Biz refs**: biz/业务与技术解决方案_AI错题本_基于日历系统.md §2A.3 路由表 L235 (P11 行) + L244 (家长分享 → wb://event/:eid · EXAM 形态) + §2A.3.3 硬性规则 L359 (来源感知 from=HOME|CAL|NOTIF) + §2A.5 状态机 + §2A.7 异常矩阵 L657 + §2B.6 SC-05 (STUDY 形态 L939-984) + §2B.7 SC-06 (GENERIC 形态 L987-1019) + §2B.10 SC-09 (EXAM 形态 L1091-1123)
**Related tasks**: feature_list.json 未来 SC-05 / SC-06 / SC-09 拆 task 时回填本 spec 引用 (当前 feature_list.json 仅 SC-01)

> ⚠️ **biz 与 SC 不一致**: §2A.3 L235 文字写"双形态"但 §2B.6/2B.7/2B.10 三个场景实测渲染**三种**变体 (STUDY · GENERIC · EXAM)，testids 包亦含 `relatedStudy / relatedFamily / relatedExam` 三组并存。本 spec 取"三形态"为准；biz §2A.3 文字 surface 给业务下次回改。

---

## §1 页面目的

P11 是「日历 × 复习」与「跨角色协同」的**视图融合锚点**：把不同来源 (复习节点 / 通用家庭事件 / 家长分享考试日) 的事件统一在**同壳异面**的详情页呈现，并在该页提供单一 CTA 路径回到任务执行。给学生：一个事件不论从首页消息卡 / 日历月格 / 通知 / 微信分享深链点击，都落到形态一致的 P11，再决定"立即复习 / 编辑 / 加入提醒"；给业务：把"日历 × 复习" UX 是否成立的判定收敛到一张卡 (SC-05 关键路径)；给系统：通过 `relation_type ∈ {STUDY, FAMILY, EXAM}` 字段单点分支，复用 header / 时间&提醒 / 关联 / action bar / tab bar 五区 DOM 结构，复习域零侵入日历域。

---

## §2 布局分区 + Wireframe

### 2.1 布局分区 (zone 划分)

```
┌──────────────────────────────────┐  顶部安全区 + iOS Status bar
├──────────────────────────────────┤  Nav: ← {来源标签} · "事件详情" H1 · 编辑*
├──────────────────────────────────┤  Hero (variant 着色 + capsule + title + 副标 + 倒计时 + meta)
│  capsule (T 级胶囊/类型 chip)     │
│  H1 + sub                         │
│  count-row (距离开始 + 预计用时)  │
│  hero-meta (时间窗 / 地点 / 提醒) │
├──────────────────────────────────┤  ★ 题目缩略 + chips (STUDY only)
├──────────────────────────────────┤  ★ 记忆曲线 + T0..T6 节点 (STUDY only)
├──────────────────────────────────┤  时间 & 提醒 (开始 / 时长 / 提醒 / 重复)
├──────────────────────────────────┤  关联 (错题 / 知识点 / 考试 — STUDY)
│                                    (参与人 / 地点 — GENERIC)
│                                    (来源 / 准备清单 — EXAM)
├──────────────────────────────────┤  variant-hint (双形态壳说明 · 视觉辅助)
├──────────────────────────────────┤  Action bar: [次按钮] + [主 CTA]
└──────────────────────────────────┘  Tab Bar (首页 act)
```

\* 编辑按钮仅 GENERIC + 学生自建可点；STUDY / EXAM / 家长共享 GENERIC → 置灰或隐藏 (SC-06 TC-06.04)。
★ 标记仅 STUDY 形态渲染；GENERIC / EXAM 通过条件渲染自动折叠 (mockup variant-hint L407-L410)。

来源：mockup `11_event_detail.html` L194-L446 真 DOM + biz §2B.7 关键断言点 "header / 时间&提醒 / 关联 / action bar / tab bar 五个区域的 DOM 结构在两种形态下完全一致"。

### 2.2 关键视觉锚 (mockup HTML 真 selector)

| Zone | DOM selector / class | testid | 用途 |
|---|---|---|---|
| Nav back | `.topnav .back` (text: "4月" / "首页" / "通知") | `p11-top-bar-back` | 来源感知返回 |
| Nav title | `.topnav .title` "事件详情" | `p11-top-bar` | 页面标题 |
| Nav edit | `.topnav .edit` | `p11-bottom-cta-edit` (复用 · 顶部右侧 / 底部 ghost 两处出现) | 编辑入口 |
| Morph ribbon | (mockup 未画 · 浮层提示当前形态) | `p11-morph-ribbon` | 形态切换横幅 (调试 / 内部分享识别) |
| Hero card | `.hero` (深蓝→靛紫渐变 / 蓝渐变 / 粉红渐变 三套) | `p11-event-hero-card` | 形态 hero |
| Hero badge | `.capsule` (T3 + 复习节点 / 家庭 / 考试) | `p11-event-hero-card-badge` | T 级胶囊 / 类型 chip |
| Hero title | `.hero h1` | (内嵌 hero card 内) | 主标题 + sub |
| Hero countdown | `.count-row .val` "2h 12min" / "21天" | `p11-related-exam-countdown` (EXAM 形态使用同一 testid) | 距开始 / 倒计时 |
| Hero meta | `.hero-meta` | `p11-meta-row` | 时间窗 / 地点 / 提醒 |
| Thumb (STUDY) | `.thumb` | `p11-related-study-question` | 错题缩略 + chips |
| Curve (STUDY) | `.curve` | `p11-related-study-memory-curve` | 记忆曲线 SVG + footer |
| Curve node | `.node.done` / `.node.today` / 默认 (T0..T6) | `p11-memory-curve-node-{T0..T6}` (动态) | 单节点圆点 |
| Cancelled placeholder (STUDY) | (TC-05.04 占位卡 · mockup 未画) | `p11-related-study-cancelled` | 复习节点已取消提示 |
| Section: time | `.section[section-hd="时间 & 提醒"]` | (内嵌 hero card) | 开始 / 时长 / 提醒 / 重复 |
| Section: linked (STUDY) | `.section.linked` row[错题/知识点/考试] | `p11-related-study` | 关联 (3 行) |
| Section: linked (GENERIC) | `.section.linked` row[参与人/地点] (mockup 复用同 section) | `p11-related-family` | 关联家庭 |
| Section: linked (EXAM) | `.section.linked` row[科目/地点/倒计时/来源] | `p11-related-exam` | 关联考试 |
| Exam subject chip | (条件渲染 · EXAM) | `p11-related-exam-subject-chip` | 科目 chip |
| Exam location | (条件渲染 · EXAM) | `p11-related-exam-location` | 考试地点 |
| Exam from | (条件渲染 · EXAM "妈妈") | `p11-related-exam-from` | 分享人 / 来源 |
| Action bar | `.actbar` | `p11-bottom-cta` | 底部双按钮容器 |
| Primary CTA (STUDY) | `.btn.primary` "立即复习 →" | `p11-bottom-cta-review-now` | → P08 |
| Primary CTA (GENERIC) | `.btn.primary` "保存" / 编辑保存 | `p11-bottom-cta-edit` | → editable drawer |
| Primary CTA (EXAM) | `.btn.primary` "加入我的提醒" | `p11-bottom-cta-add-calendar` | POST subscribe |
| Variant hint | `.variant-hint` | — (装饰说明 · 设计辅助) | 双形态壳释义 |

来源：mockup `11_event_detail.html` grep + frontend/packages/testids/src/index.ts L200-L224 `TEST_IDS.p11.*`。

---

## §3 核心组件

| 组件 | 来源 | 接受 props | 说明 |
|---|---|---|---|
| `<EventHeroCard>` | P11 内置 | `{variant: 'STUDY'/'GENERIC'/'EXAM', title, sub, countdown, meta[]}` | 三套渐变背景 + capsule + 倒计时；按 variant 切色：STUDY 深蓝→靛紫 / GENERIC 蓝 / EXAM 粉红 |
| `<EventMorphRibbon>` | P11 内置 | `{variant, from}` | 提示当前形态 + 来源 (debug / observer 模式可见) |
| `<QuestionThumbCard>` | ui-kit (复用 P05 item 缩略) | `{qid, stem, subject, kp, grade, lastState}` | STUDY only · 错题缩略 + chips + "上次状态" |
| `<MemoryCurve>` | ui-kit (复用 P06 / P09 同款) | `{nodes: Array<{T, status, dueAt}>, retentionPredicted, nextDueAt}` | STUDY only · SVG 遗忘曲线 + 6 节点 + 留存率 |
| `<MetaRow>` | P11 内置 | `{startAt, durationMin, reminderRule, repeatRule}` | 时间&提醒 4 行 (五区共享壳) |
| `<LinkedSection>` | P11 内置 (按 variant 分支) | `{variant, items[]}` | 关联区 (STUDY: 错题/KP/考试; GENERIC: 参与人/地点; EXAM: 科目/地点/来源) |
| `<EventEditDrawer>` | P11 内置 (从底部滑出) | `{event, repeatScope: 'once'/'all', onSave, onConflict409}` | GENERIC 编辑抽屉 (SC-06 步 5-7) · 含 RRULE 单次/全部分支 |
| `<ConflictResolveSheet>` | ui-kit | `{localPatch, remoteState, onPick: 'keepMine'/'takeTheirs'/'merge'}` | 409 冲突解决 Sheet (TC-06.03) |
| `<CancelledPlaceholder>` | P11 内置 | `{nextQid, nextDueAt}` | STUDY 节点已 FORGOT 取消时的占位 (TC-05.04) |
| `<ActionBar>` | P11 内置 (按 variant 切 CTA) | `{variant, primaryLabel, primaryOnTap, ghostLabel, ghostOnTap}` | 双按钮容器 |
| `<TabBar>` | global layout | — | 首页 act (P11 二级页保留 tab) |

来源：mockup `11_event_detail.html` 真 DOM 结构 + biz §2B.6 步 5 + §2B.7 步 5 + §2B.10 步 4 字面 + testids p11 命名空间反推。

---

## §4 数据绑定 (Entity / DTO)

### 4.1 Page-level State 绑定

```typescript
{
  event: {
    eventId: string,                   // e.g. 'E900' / UUID
    variant: 'STUDY' | 'GENERIC' | 'EXAM',  // 由 relation_type 推导
    relationType: 'STUDY' | 'FAMILY' | 'EXAM',
    relationId: string | null,         // 'question:200:node:700' (STUDY) / 'family:member:grandma' (GENERIC) / null (EXAM)
    title: string,
    sub?: string,                      // "二次函数 · 高一下 · 来自错题 #1023"
    startAt: string,                   // ISO8601 (UTC 存储 · FE 按 user.tz 渲染)
    durationMin: number,
    reminderRule: string,              // "开始前 15 分钟" / "微信+App"
    repeatRule?: string,               // RRULE 字面 "FREQ=WEEKLY;BYDAY=TU"
    location?: string,
    sharedFrom?: { name: string, relation: string },  // EXAM 来源
    sharedTo?: string[],               // EXAM shared_to student_ids
    state: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED',
    isReadonly: boolean                // 家长共享 / 观察者 → true
  },
  // STUDY only (并发加载)
  study?: {
    node: { nid, T, status, openedAt, dueAt, retentionPredicted },
    question: { qid, stem, subject, kp[], grade, lastState }
  },
  // EXAM only
  exam?: { subjectChip, daysUntil, prepNote? },
  ui: {
    state: 'LOADING_STUDY' | 'LOADING_GENERIC' | 'LOADING_EXAM' | 'READY_STUDY' | 'READY_GENERIC' | 'READY_EXAM'
         | 'EDIT' | 'EDIT_DIRTY' | 'SAVING' | 'CONFLICT_409' | 'EXIT_REVIEW' | 'CANCELLED_PLACEHOLDER' | 'ERROR',
    from: 'HOME' | 'CAL' | 'NOTIF' | 'SHARE',   // navigator.state.from (§2A.3.3 L359)
    editScope: 'once' | 'all'                    // RRULE 编辑范围 (TC-06.02)
  }
}
```

### 4.2 涉及的后端 Entity

- `calendar_event` (calendar-core · `event_id / relation_type / relation_id / start_at / duration_min / state / shared_to`)
- `event_share` (calendar-core · `event_id / student_id / acked_at` · EXAM 受方记录)
- `wb_review_node` (review-plan-service · STUDY 形态并发 `GET /api/review/nodes/{nid}`)
- `wb_question` (wrongbook-service · STUDY 形态并发 `GET /api/wb/questions/{qid}`)
- `user_preference` (个人 reminder · EXAM 形态 subscribe 落 `event_subscription`)

来源：biz §2B.6 步 4 (并发拉 review/nodes + wb/questions) + §2B.7 步 1-5 + §2B.10 步 4 + §2A.5 状态机。

---

## §5 API 触点

> 字符级精准 path + method · 后端 calendar-core 服务尚未实现 (backend/ 当前仅 file-service + review-plan-service)，本节按 biz §2B.6/7/10 字面定义为契约源。

| # | Method | Path | Headers (req) | Body (req) | Response | P95 预算 | 失败降级 |
|---|---|---|---|---|---|---|---|
| 1 | GET | `/api/calendar/events/{eventId}` | `Authorization` | — | `200 {eventId, relationType, relationId, title, startAt, durationMin, reminderRule, repeatRule?, location?, state, sharedFrom?, sharedTo?, isReadonly}` | ≤ 300 ms | 404 → P11 显示"该事件不存在或已取消" + CTA 回 P10 |
| 2 | GET | `/api/review/nodes/{nid}` (STUDY 并发) | `Authorization` | — | `200 {nid, T, status, openedAt, dueAt, retentionPredicted}` | ≤ 300 ms | 404 (FORGOT 取消) → `CANCELLED_PLACEHOLDER` (TC-05.04) |
| 3 | GET | `/api/wb/questions/{qid}` (STUDY 并发) | `Authorization` | — | `200 {qid, stem, subject, kp[], grade, lastState}` | ≤ 300 ms | 404 → 缩略卡占位"题目不可见" |
| 4 | GET | `/api/calendar/events/{eventId}/editable` (GENERIC 编辑前) | `Authorization` | — | `200 {editableFields[], etag, repeatRule}` | ≤ 200 ms | 5xx → 编辑抽屉禁用 + Toast |
| 5 | PATCH | `/api/calendar/events/{eventId}` | `Authorization`, `If-Match: {etag}`, `X-Idempotency-Key` | `{durationMin?, startAt?, title?, location?, reminderRule?, repeat: 'once' \| 'all'}` | `200 {event, etag}` / `409 {currentState, yourPatch}` | ≤ 400 ms | 409 → 弹 `<ConflictResolveSheet>` (TC-06.03) |
| 6 | POST | `/api/calendar/events/{eventId}/subscribe` (EXAM "加入提醒") | `Authorization`, `X-Idempotency-Key` | `{reminderRule?}` | `200 {subscriptionId}` | ≤ 300 ms | 重试 3 次 → toast "稍后重试" |
| 7 | PATCH | `/api/events/{eventId}/ack` (EXAM "标记已查看") | `Authorization` | — | `200 {ackedAt}` | ≤ 200 ms | 静默重试，不阻塞 UI |
| 8 | POST | `/api/review/nodes/{nid}/open` (STUDY "立即复习" CTA) | `Authorization`, `X-Idempotency-Key` | — | `200 {sessionId, exec: {nid, T, qid}}` | ≤ 500 ms | 5xx → 留 P11 + 顶部错误条 |
| 9 | DELETE | `/api/calendar/events/{eventId}` (GENERIC 删除 · 学生自建) | `Authorization`, `X-Idempotency-Key` | `{repeat: 'once' \| 'all'}` | `204` | ≤ 300 ms | 403 (家长共享) → "无权删除" |

**关键 PATCH 语义** (biz §2B.7 关键断言点)：`repeat=once` → 后端为该 RRULE 生成 `exdate` + 新建单次 event (TC-06.02)；`repeat=all` → 修改 RRULE 模板，未来所有发生跟随。前端必须在抽屉里显式让学生选择 scope。

来源：biz §2B.6 步 4/7 + §2B.7 步 5/7 + §2B.10 步 4/6 + §2A.6 US-09 接口列。

---

## §6 状态机

```
                     navigator from=*    ┌──────────────────┐
       ─────────────────────────────────►│  LOADING_*       │
                                          │ (按 relationType)│
                                          └────────┬─────────┘
                          ┌────────────────────────┼────────────────────────┐
                          ▼                        ▼                        ▼
                   ┌──────────────┐         ┌──────────────┐         ┌──────────────┐
                   │ READY_STUDY  │         │READY_GENERIC │         │ READY_EXAM   │
                   └──┬───────────┘         └──┬───────────┘         └──┬───────────┘
                      │ tap 立即复习            │ tap 编辑               │ tap 加入提醒
                      ▼                        ▼                        ▼
              ┌──────────────┐          ┌──────────────┐          POST subscribe
              │ EXIT_REVIEW  │          │   EDIT       │          (toast 已加入)
              │  → P08       │          └──┬───────────┘                 │
              └──────────────┘             │ 改字段                       ▼
                                           ▼                       READY_EXAM
                                       EDIT_DIRTY
                          /review/nodes/   │ tap 保存
                          {nid} 404        ▼
                          (TC-05.04)    SAVING ────PATCH 200──► READY_GENERIC
                          ▼              │
                  CANCELLED_PLACEHOLDER   │ PATCH 409 (TC-06.03)
                                         ▼
                                   CONFLICT_409 (Sheet)
                                         │ pick keepMine/takeTheirs/merge
                                         ▼
                                       (re-PATCH 或 READY_GENERIC)
```

### 6.1 状态转移规则

| From | To | Trigger | Side effect |
|---|---|---|---|
| (entry) | LOADING_STUDY | `GET /events/{eid}` 返回 `relationType=STUDY` | 并发 `GET /review/nodes/{nid}` + `GET /wb/questions/{qid}` |
| (entry) | LOADING_GENERIC | `relationType=FAMILY` | 单条 GET |
| (entry) | LOADING_EXAM | `relationType=EXAM` | 触发 `PATCH /events/{eid}/ack` |
| LOADING_STUDY | CANCELLED_PLACEHOLDER | `/review/nodes/{nid}` 返回 404 | 渲染占位 + CTA "查看新排期" → P05 (TC-05.04) |
| LOADING_STUDY | READY_STUDY | 并发全部 200 | 渲染 hero(STUDY) + thumb + curve |
| READY_STUDY | EXIT_REVIEW | tap "立即复习" | `POST /review/nodes/{nid}/open` · 跳 P08 (跨越 P07) |
| READY_GENERIC | EDIT | tap "编辑" | `GET /events/{eid}/editable` · 打开 drawer |
| EDIT | EDIT_DIRTY | 任意字段变更 | drawer 保存按钮启用 |
| EDIT_DIRTY | SAVING | tap "保存" + 选 scope | `PATCH /events/{eid} body{...,repeat}` |
| SAVING | READY_GENERIC | 200 | toast "已保存" · drawer 关闭 · 字段刷新 |
| SAVING | CONFLICT_409 | 409 | 弹 `<ConflictResolveSheet>` (TC-06.03) |
| CONFLICT_409 | SAVING | 用户选择 keepMine/takeTheirs/merge | 重发 PATCH 带新 If-Match |
| READY_EXAM | (no-state) | tap "加入提醒" | `POST /events/{eid}/subscribe` · 按钮变 "已加入" |
| READY_* | (exit) | tap 左上返回 | 按 `ui.from` 回到 P10/P-HOME/P12 · 上层列表 refresh |

来源：biz §2B.6 / §2B.7 / §2B.10 步表 "前端状态" 列 + §2A.5 (无 P11 entity state；仅 calendar_event state SCHEDULED/COMPLETED/CANCELLED · 用于 thumb 染色)。

---

## §7 跳转

### 7.1 入口

| 入口 | 来源 | 触发条件 | `navigator.state.from` |
|---|---|---|---|
| P-HOME 消息聚合卡 | `P-HOME` 消息条 | 学生 tap "妈妈分享了五月月考" | `HOME` |
| P10 月格事件列表 | `P10` 当日事件项 | tap "二次函数 T4 复习" / "接奶奶放学" / "数学月考" | `CAL` |
| P12 通知项 | `P12` 通知列表 | tap 单条通知 (复习提醒 / 分享通知) | `NOTIF` |
| 微信订阅消息 | 外部 | tap "查看详情" 深链 `wb://event/{eid}?from=share` | `SHARE` |
| 扫码 / 直链 | 外部 | `wb://event/{eid}` (家长分享 EXAM 形态 · §2A.3 L244) | `SHARE` |

### 7.2 出口

| 出口 | 目标 | 触发条件 | 形态约束 |
|---|---|---|---|
| 路由 push | P08 `/review/exec/{nid}` | STUDY tap "立即复习 →" (跨越 P07) | STUDY only |
| 抽屉滑出 | drawer (in-page) | GENERIC tap "编辑" | GENERIC only · 非 readonly |
| 路由 back | P10 | `from=CAL` · 左上返回 | nav text = "4月" |
| 路由 back | P-HOME | `from=HOME` · 左上返回 | nav text = "首页" |
| 路由 back | P12 | `from=NOTIF` · 左上返回 | nav text = "通知" |
| 路由 back | P-HOME (兜底) | `from=SHARE` · 左上返回 (无可返回栈) | nav text = "首页" |
| 路由 push | P05 `/wrongbook?qid={qid}` | STUDY 节点已取消占位 tap "查看新排期" (TC-05.04) | STUDY-CANCELLED only |

来源：biz §2A.3 路由表 L235/L244 + §2A.3.3 硬规则 6 L359 + §2A.7 L657 "P10 → P11 返回错乱"。

---

## §8 Wire format (SSE / WebSocket 事件)

本页无 SSE/WS 通道，事件通讯走 §5 HTTP 触点。形态联动 (P10 月格变绿 / P-HOME 消息已读 / 家长端 "已查看") 在出口时由 P10 / P-HOME 自身的 `?refresh=true` 重拉或后端 outbox 推动，不在 P11 本页接 stream。

来源：mockup HTML 无 EventSource / WebSocket DOM 痕迹 + biz §2B.6/7/10 步表中 P11 行段全部走 HTTP。

---

## §9 异常 & 降级

| 异常 | 触发条件 | UI 反馈 | 系统行为 | 关联 TC |
|---|---|---|---|---|
| 节点已取消 (STUDY) | `/review/nodes/{nid}` 404 (被另一端 FORGOT 后取消) | `<CancelledPlaceholder>` "该复习节点已取消，下次排期已更新" + CTA "查看新排期" → P05 qid={qid} | 不崩溃 · `ui.state=CANCELLED_PLACEHOLDER` | TC-05.04 |
| 深链权限不属 | 扫码进入 `wb://event/abc` 属于另一学生 | 403 · 自动跳 P-HOME · toast "无权访问" | 埋点 `wb_deeplink_forbidden` | TC-05.05 |
| 编辑冲突 | PATCH 返回 409 (另一端已修改) | 弹 `<ConflictResolveSheet>` "另一端已修改，请选择：保留我的 / 采用对方 / 合并" | etag 失配 · 用户选择后重发 PATCH 带新 If-Match | TC-06.03 |
| 重复事件 scope 误判 | GENERIC 编辑未选 scope 直接保存 | 抽屉底部红字 "请选择应用范围：仅当次 / 全部未来" · 保存按钮禁用 | FE 守门 · 不发 PATCH | TC-06.02 |
| 家长共享只读 | EXAM / 家长共享 GENERIC · 学生 tap 编辑 | 编辑按钮置灰 + 提示 "此事件由家长共享，如需修改请联系家长" | 网关亦守 403 | TC-06.04 |
| 解绑后访问家长共享 | EXAM 学生已解绑家长 · 仍持有旧深链 | 403 · 跳 P-HOME + toast "已不再绑定" | event_share 校验失败 | TC-09.03 |
| 微信订阅未授权 | EXAM 学生未授权微信订阅消息 | 通知降级站内红点 · P11 仍能正常打开 | 不阻塞本页 | TC-09.02 |
| 性能 (大量 event) | 月视图 200+ event · 进入 P11 | 进 P11 渲染 ≤ 600 ms (并发 STUDY 三接口) · 否则顶部 skeleton | — | TC-05.06 |
| 加入提醒重复点 | EXAM 已订阅再次 tap | 按钮显示 "已加入" 灰态 · 幂等返回同 subscriptionId | `X-Idempotency-Key` 守门 | — |
| 时区切换 | event.startAt UTC + 用户 tz 切换 | 倒计时与时间窗按新 tz 重算 · DB 不变 | — | TC-08.01 (跨场景) |

来源：biz §2A.7 异常矩阵 L657 + §2B.6 TC-05.04/05/06 + §2B.7 TC-06.02/03/04 + §2B.10 TC-09.02/03。

---

## §10 验收点 (TC → AC 映射)

| TC ID | 类型 | GIVEN | WHEN | THEN | 形态 |
|---|---|---|---|---|---|
| TC-05.01 | 正常 | P-HOME 周条带 · 4/28 有 T4 复习 · 显示复习=开 | SC-05 步骤 1-9 (P10 → P11 → P08 → P09 → P10) | P11 渲染 STUDY 变体；tap 立即复习跳 P08；完成后返回 P10 月格点变绿；过程无多余 P07 跳转 | STUDY |
| TC-05.03 | 边界 | 学生 4/28 有 3 个复习 + 1 考试 + 2 家庭 | 步骤 3 Tap 4/28 后步骤 4 任选一个 | 所有项可 tap 进 P11；STUDY/EXAM/GENERIC 三形态依 relation_type 正确渲染 | 全 3 形态 |
| TC-05.04 | 异常 | 步骤 4 时 `/review/nodes/700` 返回 404 (被另一端 FORGOT 后取消) | Tap 事件 | P11 显示 `<CancelledPlaceholder>` "该复习节点已取消，下次排期已更新" + CTA "查看新排期" → 跳 P05 qid=200；无崩溃 | STUDY |
| TC-05.05 | 安全 | 深链 `wb://event/abc` 属于另一学生 | 扫码进入 | 403 · 跳 P-HOME · 埋点 `wb_deeplink_forbidden` | (跨形态) |
| TC-05.06 | 性能 | 月视图数据 200+ 条 event | Tap 任意日 → 进 P11 | P11 LOADING_STUDY 三接口并发 ≤ 600 ms (biz §2B.6 步 4) | (跨形态) |
| TC-06.01 | 正常 | P10 中 4/21 有 FAMILY event E900 | SC-06 步骤 1-8 | P11 渲染 GENERIC 变体（无曲线）；编辑保存成功；P10 列表刷新 | GENERIC |
| TC-06.02 | 边界 | E900 是重复事件（每周二）· 学生只改当次 | 步骤 6 修改时长 + 选"仅当次" | 后端为该 RRULE 生成 exdate + 新建单次 event · 其他周二不变 (PATCH body `repeat=once`) | GENERIC |
| TC-06.03 | 异常 | 步骤 7 时 PATCH 返回 409 (另一端已修改) | Tap 保存 | 弹 `<ConflictResolveSheet>` "保留我的 / 采用对方 / 合并"；选择后重发 PATCH 带新 If-Match | GENERIC |
| TC-06.04 | 安全 | E900 是家长共享的只读事件 | 学生 Tap 编辑 | "编辑"按钮置灰 + 提示 "此事件由家长共享，如需修改请联系家长" | GENERIC (readonly) |
| TC-09.01 | 正常 | 学生已绑定家长 · 学生微信订阅消息已授权 | SC-09 步骤 1-7 | 学生收到微信消息 · P11 渲染 EXAM 变体 (粉红渐变 · 倒计时 21 天 · 分享人 "妈妈") · `PATCH /events/{eid}/ack` 200 | EXAM |
| TC-09.02 | 异常 | 学生未授权订阅消息 | 同上 | 降级站内红点 · P11 仍能正常打开 · 埋点 `notif_fallback_inapp` | EXAM |
| TC-09.03 | 安全 | 学生已解绑家长 · 家长尝试分享 (或学生持旧深链) | 步骤 1 / 学生 tap | 后端 403 · 家长端 Toast "已不再绑定此学生" / 学生跳 P-HOME | EXAM |
| TC-09.04 | 边界 | 家长一次分享 10 个考试事件 | 批量 POST → 通知聚合 | notification 聚合为 1 条 "妈妈分享了 10 个事项"，点击落 P12 列表 (非直达 P11) | EXAM |

来源：biz §2B.6 QA 用例 L976-983 + §2B.7 QA 用例 L1014-1019 + §2B.10 QA 用例 L1118-1123。

---

## §11 性能预算

| 操作 | P95 budget | 来源 |
|---|---|---|
| P10 tap event → P11 LOADING (STUDY 三接口并发) | ≤ 600 ms | biz §2B.6 步 4 |
| P11 LOADING_GENERIC (单接口) | ≤ 300 ms | biz §2B.7 步 1 (无标 · 按 §2B.6 同档) |
| P11 LOADING_EXAM (单接口 + ack) | ≤ 400 ms | biz §2B.10 步 4 |
| Tap "立即复习" → POST open → P08 | ≤ 500 ms | biz §2B.6 步 7 |
| GENERIC tap 编辑 → drawer 打开 | ≤ 200 ms | biz §2B.7 步 5 (无标 · spec §5 P95 行) |
| PATCH save (含 200/409 双路) | ≤ 400 ms | spec §5 #5 P95 行 |
| 加入提醒 subscribe | ≤ 300 ms | spec §5 #6 P95 行 |
| 返回 P10 月格 refresh | ≤ 800 ms | biz §2B.6 步 9 |
| 月视图 200+ event 时 P11 进入 | ≤ 300 ms (列表渲染) | TC-05.06 |

来源：biz §2B.6 步表 "耗时预算" 列 + §2B.7 / §2B.10 (大部分未显式标，承接 §2B.6 同档)。

---

## §12 埋点事件

| Event name | When | Properties | 来源 |
|---|---|---|---|
| `calendar_event_tap` | P10/P-HOME/P12 tap 事件 (进入 P11 前) | `{eventId, relationType, from}` | biz §2B.6 步 4 / §2B.7 步 1 |
| `event_view` | P11 LOADING → READY 成功 | `{variant: 'STUDY'/'FAMILY'/'EXAM', eventId, nid?, T?, from}` | biz §2B.6 步 5 + §2B.7 步 2 + §2B.10 步 4 |
| `event_review_now` | STUDY tap 立即复习 | `{nid}` | biz §2B.6 步 7 |
| `event_edit_open` | GENERIC tap 编辑 | `{eventId}` | biz §2B.7 步 5 |
| `event_edit_field` | GENERIC drawer 字段变更 | `{key: 'duration'/'startAt'/...}` | biz §2B.7 步 6 |
| `event_edit_save` | GENERIC tap 保存 (PATCH 发出) | `{eventId, scope: 'once'/'all'}` | biz §2B.7 步 7 |
| `event_edit_conflict` | PATCH 409 弹 Sheet | `{eventId, choice?: 'keepMine'/'takeTheirs'/'merge'}` | TC-06.03 (推断) |
| `event_subscribe` | EXAM tap 加入提醒 | `{eventId}` | biz §2B.10 步 6 |
| `event_exit` | tap 左上返回 | `{eventId, returnTo: 'calendar'/'home'/'notif'}` | biz §2B.7 步 8 |
| `wb_deeplink_forbidden` | 深链权限不属 → 跳 P-HOME | `{eventId, reason}` | TC-05.05 |
| `obs_event_readonly_view` | 观察者会话进入 P11 只读 | `{eventId, student_id_hash}` | biz §2A.8 L684 (P1) |

来源：biz §2B.6 步表埋点列 + §2B.7 步表埋点列 + §2B.10 步表埋点列 + §2A.8 L684 obs 事件。

---

## §13 testid 表

| testid | 用途 | 出现位置 (mockup / variant) | E2E 引用 (规划) |
|---|---|---|---|
| `p11-root` | P11 页面根 | `.phone` 顶层 (隐含) | sc-05/06/09.spec.ts beforeEach mount |
| `p11-top-bar` | 顶部 nav 容器 | `.topnav` | nav 文本快照 |
| `p11-top-bar-back` | 左上返回按钮 | `.topnav .back` (text by `from`) | 来源感知断言 (§7) |
| `p11-morph-ribbon` | 形态切换横幅 (debug / observer) | (mockup 未画 · 内部分享识别) | observer 模式 visible 断言 |
| `p11-event-hero-card` | Hero 渐变卡容器 | `.hero` (三套渐变) | hero card 渲染断言 |
| `p11-event-hero-card-badge` | T 级胶囊 / 类型 chip | `.hero .capsule` | STUDY: 文本 "T3" · GENERIC: "家庭" · EXAM: "考试" |
| `p11-related-study` | STUDY 关联区容器 | `.section.linked` (STUDY 形态) | only STUDY 可见 |
| `p11-related-study-question` | 错题缩略卡 | `.thumb` | STUDY only |
| `p11-related-study-memory-curve` | 记忆曲线卡 | `.curve` | STUDY only · TC-05.01 |
| `p11-related-study-cancelled` | 节点已取消占位 | `<CancelledPlaceholder>` | TC-05.04 |
| `p11-related-family` | GENERIC 家庭关联区 | `.section.linked` (GENERIC 形态 · 参与人/地点) | GENERIC only · TC-06.01 |
| `p11-related-exam` | EXAM 关联区容器 | `.section.linked` (EXAM 形态) | EXAM only · TC-09.01 |
| `p11-related-exam-subject-chip` | 考试科目 chip | EXAM section row | EXAM only |
| `p11-related-exam-location` | 考试地点 | EXAM section row | EXAM only |
| `p11-related-exam-countdown` | 倒计时 (21 天) | EXAM hero count-row | EXAM only · TC-09.01 |
| `p11-related-exam-from` | 分享人 (妈妈) | EXAM section row | EXAM only · TC-09.01 |
| `p11-meta-row` | hero meta (时间/地点/提醒) | `.hero-meta` | 跨形态 |
| `p11-bottom-cta` | 底部 action bar 容器 | `.actbar` | 跨形态 |
| `p11-bottom-cta-review-now` | "立即复习 →" | `.btn.primary` (STUDY) | STUDY only · TC-05.01 |
| `p11-bottom-cta-edit` | "编辑" / "保存" | `.btn.primary` (GENERIC) / `.topnav .edit` | GENERIC only · TC-06.01 |
| `p11-bottom-cta-add-calendar` | "加入我的提醒" | `.btn.primary` (EXAM) | EXAM only · TC-09.01 |
| `p11-memory-curve-node-{T0..T6}` | 单节点圆点 (动态) | `.node.done` / `.node.today` | STUDY · 7 节点状态断言 |

来源：frontend/packages/testids/src/index.ts L200-L224 `TEST_IDS.p11.*` + mockup `11_event_detail.html` data-testid (mockup 未声明 · 实施时按本表落)。

---

## §14 i18n key

| Key | 中文 | 英文 | 用途 |
|---|---|---|---|
| `event.title` | 事件详情 | Event details | 顶部标题 |
| `event.back.calendar` | 4月 | April | nav back (from=CAL) |
| `event.back.home` | 首页 | Home | nav back (from=HOME) |
| `event.back.notif` | 通知 | Notifications | nav back (from=NOTIF) |
| `event.variant.study.capsule` | 复习节点 | Review node | STUDY capsule kind |
| `event.variant.study.subcurve` | 艾宾浩斯曲线 · 第 {n} 次回顾 | Ebbinghaus · Review #{n} | STUDY capsule sub |
| `event.variant.generic.capsule` | 家庭 | Family | GENERIC capsule |
| `event.variant.exam.capsule` | 考试 | Exam | EXAM capsule |
| `event.countdown.label` | 距离开始 | Starts in | hero count-row label |
| `event.countdown.exam.label` | 倒计时 | Countdown | EXAM count-row label |
| `event.meta.timeWindow` | {start} - {end} | {start} - {end} | hero meta 时间窗 |
| `event.meta.location` | {place} | {place} | hero meta 地点 |
| `event.meta.reminderOn` | 提醒已开 | Reminder on | hero meta |
| `event.section.time` | 时间 & 提醒 | Time & Reminder | section header |
| `event.section.linked` | 关联 | Related | section header |
| `event.row.startAt` | 开始 | Start | row k |
| `event.row.duration` | 时长 | Duration | row k |
| `event.row.reminder` | 提醒 | Reminder | row k |
| `event.row.repeat` | 重复 | Repeat | row k |
| `event.row.repeat.ebbinghaus` | 遵循艾宾浩斯 | Ebbinghaus-driven | STUDY repeat value |
| `event.row.repeat.weekly` | 每周{day} | Weekly on {day} | GENERIC repeat value |
| `event.linked.question` | 错题 | Wrongbook | STUDY linked row |
| `event.linked.kp` | 知识点 | Knowledge point | STUDY linked row |
| `event.linked.exam` | 相关考试 | Related exam | STUDY linked row |
| `event.linked.member` | 参与人 | Participant | GENERIC linked row |
| `event.linked.from` | 分享人 | Shared by | EXAM linked row |
| `event.cta.reviewNow` | 立即复习 → | Review now → | STUDY primary CTA |
| `event.cta.snooze30` | 延后 30 分 | Snooze 30 min | STUDY ghost CTA |
| `event.cta.edit` | 编辑 | Edit | GENERIC primary CTA / nav edit |
| `event.cta.save` | 保存 | Save | GENERIC drawer primary |
| `event.cta.addReminder` | 加入我的提醒 | Add reminder | EXAM primary CTA |
| `event.cta.addedReminder` | 已加入 | Added | EXAM CTA (subscribed) |
| `event.edit.scope.title` | 应用范围 | Apply to | drawer scope picker |
| `event.edit.scope.once` | 仅当次 | This event only | RRULE 单次 |
| `event.edit.scope.all` | 所有未来 | All future events | RRULE 全部 |
| `event.conflict.title` | 另一端已修改 | Modified elsewhere | 409 sheet 标题 |
| `event.conflict.keepMine` | 保留我的 | Keep mine | 409 选项 |
| `event.conflict.takeTheirs` | 采用对方 | Take theirs | 409 选项 |
| `event.conflict.merge` | 合并 | Merge | 409 选项 |
| `event.cancelled.title` | 该复习节点已取消，下次排期已更新 | This node was cancelled, next schedule updated | TC-05.04 占位 |
| `event.cancelled.cta` | 查看新排期 | See new schedule | TC-05.04 CTA |
| `event.readonly.parent` | 此事件由家长共享，如需修改请联系家长 | Shared by guardian; ask them to edit | TC-06.04 |
| `event.toast.saved` | 已保存 | Saved | PATCH 200 toast |
| `event.toast.subscribed` | 已加入提醒 | Reminder added | subscribe 200 toast |

来源：mockup 文案 + biz §2B.6/7/10 步表 "页面前台" 列字面 + TC-05.04 / TC-06.03 / TC-06.04 异常文案。

---

## §15 关联与影响

- **上游 spec**: `P-HOME.spec.md` (消息聚合卡入口 from=HOME) · `P10` 月视图当日列表 (from=CAL · spec 未生成) · `P12` 通知中心 (from=NOTIF · spec 未生成) · 外部微信订阅消息 (from=SHARE)
- **下游 spec**: `P08-review-exec.spec.md` (STUDY 立即复习跨越 P07 直达) · `P05-wrongbook-list.spec.md` (TC-05.04 占位 CTA) · 编辑抽屉 (in-page · 不独立 spec)
- **关联 SC**: SC-05 (STUDY · 视图融合锚点关键路径) · SC-06 (GENERIC · 编辑 + RRULE 单次/全部) · SC-09 (EXAM · 家长分享接收) · SC-13 (P-SHARED 复用 P11 EXAM 只读视觉) · SC-15 (P1 · 观察者 P11 只读)
- **关联 task**: feature_list.json 当前仅 SC-01；SC-05/06/09 拆 task 时回填本 spec §10 验收点 → task.acceptance_criteria 映射
- **关联 mockup**: `design/mockups/wrongbook/11_event_detail.html` (主) + (P10/P12/P-SHARED 跨页一致性视觉对照)
- **后端依赖**: calendar-core 服务尚未实施 (backend/ 当前仅 file-service + review-plan-service)；本 spec §5 API 触点为 SC-05/06/09 落地时的契约源
- **跨形态一致性约束**: header / 时间&提醒 / 关联区壳 / action bar / tab bar 五区 DOM 结构在 STUDY / GENERIC / EXAM 三形态完全一致 (biz §2B.7 关键断言点)，仅通过 hero 渐变色 + 条件渲染 (thumb / curve / 不同 linked rows) 切面，确保 P11 是真正的"同壳异面"融合锚点
