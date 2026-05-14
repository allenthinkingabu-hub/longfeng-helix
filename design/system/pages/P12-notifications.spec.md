# P12 · 通知中心 (Notifications)

**Status**: Active (spec'd · 后端 notification-service 已存在 · 列表/已读端点本 spec 首次明文化 · 待后端实现)
**Owner**: design + frontend + backend
**Last-updated**: 2026-05-14
**Mockup**: design/mockups/wrongbook/12_notifications.html
**Biz refs**: biz/业务与技术解决方案_AI错题本_基于日历系统.md §2A.3 路由表 L236 (无 §2A.4 卡) + §2A.3.3 P-HOME IA L211 "我的 Tab · 重要通知红点" + L347 "P12 → 点击未读复习 → P08" + §2B.10 SC-09 步 7 (`home_msg_read`) + §2B.10 TC-09.01/02/04 (P12 红点 + 微信订阅消息 + fallback 站内)
**Related tasks**: feature_list.json SC-09 接收端 task (待立项 · P12 列表 + 已读 + 跳转 P11/P08)

> **重要说明**：biz 文档**没有 §2A.4 P12 规格卡**（与 P02/P-HOME/P05 不同）。本 spec 的主源 = mockup HTML 视觉 + biz §2A.3 路由/IA 引用 + biz §2B.10 SC-09 接收端引用。§5 API 端点为本 spec 首次明文化（属"spec'd · 待后端实现"，待 audit 拉控制器对齐），按 RESTful 惯例 + biz §2B.10 步 7 引用的 `GET /api/notifications?unread=0` 反推。

---

## §1 页面目的

学生侧"全渠道通知聚合站"——把推送（APNs/微信订阅消息）、站内、邮件三条管道下发到学生设备的所有通知按时间倒序聚合在一屏，承担三个职责：①**消息已读控制**（不在 P-HOME 消息聚合区里阅完即走的"长尾消息"留在这里逐条 read）；②**推送降级落地**（SC-09 TC-09.02 学生未授权微信订阅 → 全部消息只能在 P12 看见，避免丢消息）；③**deeplink 调度中心**（复习类→P08 / 考试分享类→P11 / 系统提醒→P13 设置）。是 SC-09 黄金路径的"接收端容器"，也是"推送被拒"降级矩阵的最后一道防线。

---

## §2 布局分区 + Wireframe

### 2.1 布局分区 (zone 划分)

```
┌─────────────────────────────────────┐  顶部安全区 (54px)
├─────────────────────────────────────┤  导航栏 (< 日历 返回 · 全部已读 右上)
│  通知 · 5 条未读                     │  大标题 + 未读计数
│  [今日 · 3] [本周 · 12] [全部]       │  Segmented Tabs (today/week/all)
├─────────────────────────────────────┤
│  ● 未读 · 今天            14:28      │  group-title (未读组 · 红点)
│  ┌──────────────────────────────┐   │
│  │▌icon │ 来源·渠道 ·  · 时间    │   │  unread card (左色条 + 蓝色 3px)
│  │      │ 标题                  │   │
│  │      │ 正文 (kw / time-kw)   │   │
│  │      │ [chips] [chips]       │   │
│  │      │ [稍后] [开始复习]      │   │  actions
│  └──────────────────────────────┘   │
│  ...                                │
│  已读 · 今天          全部静音       │  group-title (已读组)
│  ┌──────────────────────────────┐   │
│  │ ... (无左色条 · 灰色调)         │  read card
│  └──────────────────────────────┘   │
│  免打扰时段 23:00 — 07:30           │  empty-hint (尾部说明)
├─────────────────────────────────────┤
│ 日历 · 待办 · 通知(5) · 我的        │  Tab Bar (84px · 通知格激活 + 角标 5)
└─────────────────────────────────────┘  Home Bar
```

来源：biz §2A.3 路由 L236 (路径 / 深链) + mockup HTML `.nav` / `.seg` / `.content` / `.group-title` / `.card.unread` / `.empty-hint` / `.tabbar`。

### 2.2 关键视觉锚 (mockup HTML 真 selector)

| Zone | DOM selector / class | 用途 |
|---|---|---|
| Header back | `.nav .back` | 左上 "< 日历" 返回 |
| Header mark-all | `.nav .right` | 右上 "全部已读" |
| Title | `.nav h1` | 大标题 "通知" + `.count` 未读计数 |
| Segmented tabs | `.nav .seg button` | 今日/本周/全部 三段切换（`.on` 选中） |
| Group title | `.content .group-title` | 未读/已读组分隔（含 `.dot` 红点） |
| Unread card | `.content .card.unread` | 单条未读卡（左 3px 蓝色边） |
| Read card | `.content .card` (无 `.unread`) | 单条已读卡（无左边） |
| Icon badge | `.card .badge.blue/red/orange/green/indigo` | 类型图标（学习/任务/提醒/完成/备忘） |
| Source | `.card .source strong` | "学习 · 记忆曲线" 来源标签 |
| Time | `.card .time` | "2 分钟前" / "12:00" / "昨天 22:14" |
| Title | `.card .title` | 通知标题 |
| Body | `.card .body` | 正文（含 `.kw` 关键蓝 / `.time-kw` 橙时间） |
| Stages bullet | `.card .stages .stage-bullet` | 学习类卡的 5 阶段进度（done/now/future） |
| Meta chips | `.card .meta .chip` | 类型 / 时区 / 时长等元 chips |
| Actions | `.card .actions .btn` | 底部按钮（稍后/打开/开始复习） |
| Empty hint | `.content .empty-hint` | 尾部"免打扰时段 23:00 — 07:30" |
| Tab Bar badge | `.tabbar .tab.active .bdg` | 通知 Tab 红角标"5" |

---

## §3 核心组件

| 组件 | 来源 | 接受 props | 说明 |
|---|---|---|---|
| `<P12PageHeader>` | frontend/apps/h5 | `{title, unreadCount, onBack, onMarkAllRead}` | 大标题 + 全部已读 |
| `<NotificationSegTabs>` | frontend/packages/ui-kit | `{value:'today'\|'week'\|'all', counts, onChange}` | 时间段 segmented |
| `<NotificationGroup>` | frontend/packages/ui-kit | `{title, items, unread?:boolean}` | 未读/已读分组容器 |
| `<NotificationCard>` | frontend/packages/ui-kit | `{notif:NotificationItem, onTap, onMarkRead, onAction}` | 单条卡（学习/任务/提醒/备忘多类型） |
| `<NotifIconBadge>` | frontend/packages/ui-kit | `{type:'STUDY'\|'TASK'\|'REMIND'\|'DONE'\|'MEMO', color}` | 圆角图标徽 30×30 |
| `<NotifStagesBullet>` | frontend/packages/ui-kit | `{stage:0..5, total:5}` | 5 段学习阶段（done/now/future） |
| `<NotifActions>` | frontend/packages/ui-kit | `{primary, secondary, ghost?}` | 底部 1-2 按钮组 |
| `<EmptyState>` | frontend/packages/ui-kit | `{icon, title, hint}` | "暂无通知" 空态 |
| `<QuietHoursHint>` | frontend/packages/ui-kit | `{start:'23:00', end:'07:30'}` | 尾部免打扰说明（P13 偏好驱动） |

来源：mockup HTML 真 DOM 命名 `.card`/`.badge`/`.stages`/`.actions` + frontend/packages/ui-kit。

---

## §4 数据绑定 (Entity / DTO)

### 4.1 Page-level State 绑定

```typescript
{
  list: {
    state: 'LOADING' | 'LIST' | 'EMPTY' | 'ERROR',
    items: NotificationItem[],
    unreadCount: number,
    seg: 'today' | 'week' | 'all',
    cursor?: string,        // 翻页 cursor
    error?: ErrorCode
  },
  quiet: { start: '23:00', end: '07:30' }   // 来自 P13 student preferences
}

// NotificationItem (本 spec 首次明文 · 待后端 contract 对齐)
{
  nid: string,                            // 通知 id (notification-service 内主键)
  type: 'STUDY_REVIEW_DUE'                // 复习节点到期（→ P08）
      | 'EXAM_SHARE'                      // 家长分享考试日（→ P11 EXAM 变体, SC-09）
      | 'TASK_DDL'                        // 任务截止
      | 'REMIND'                          // 家庭提醒
      | 'STUDY_DONE'                      // 复习完成回执
      | 'MEMO',                           // 备忘
  title: string,                          // 卡标题（1 行）
  body: string,                           // 卡正文（2-3 行 · 含 kw/time-kw 高亮 token）
  createdAt: ISO8601,                     // 服务端落库时间（用于 today/week 分桶）
  isRead: boolean,                        // 已读位
  deeplink: string,                       // wb://review/exec/{nodeId} | wb://event/{eventId} | wb://me 等
  sourceUserId?: string,                  // 分享场景（SC-09）下的家长 user_id (可选)
  meta?: {                                // 卡片渲染辅助（type-specific）
    nodeStage?: 0|1|2|3|4|5,             // STUDY_REVIEW_DUE → stages bullet
    eventId?: string,                     // EXAM_SHARE → P11 路由
    nodeId?: string                       // STUDY_REVIEW_DUE → P08 路由
  }
}
```

### 4.2 涉及的后端 Entity

- `wb_notification` (notification-service · 单设备单学生的通知收件箱 · 主键 nid · index on student_id + created_at desc)
- `wb_push_task` (推送投递任务表 · biz §3 L1941 `node-due-push` 扫这张表)
- `event_share` (SC-09 步 1 写入 · 与 EXAM_SHARE 通知 1:1 配对)
- `student_preferences` (quiet hours / push channel · P13 维护 · 仅取 `quiet_start/quiet_end` 用于 §2 尾部 hint)

来源：mockup HTML 字段含意 + biz §3 L1941 `wb_push_task` + biz §2B.10 步 1 `event_share`。**注**：`wb_notification` 表本身在 biz 文档暂未列细节字段（只列服务名 notification-service in §3 L1750/L2367），属"spec'd · 待后端落 schema"。

---

## §5 API 触点

> 本 spec **首次明文** 这 3 个端点 · 主源 = biz §2B.10 步 7 的 `GET /api/notifications?unread=0` 引用（路径形式）+ 该服务名 notification-service · 字符级 path 待 audit 拉控制器对齐（暂归"spec'd · 待后端实现"）。

| # | Method | Path | Headers (req) | Query / Body (req) | Response | P95 预算 | 失败降级 |
|---|---|---|---|---|---|---|---|
| 1 | GET | `/api/notifications` | `Authorization`, `X-Request-Id` | query `cursor?` (翻页 token) · `type?:STUDY_REVIEW_DUE\|EXAM_SHARE\|TASK_DDL\|REMIND\|STUDY_DONE\|MEMO` · `unread?:0\|1` (filter 已读位) · `seg?:today\|week\|all` (服务端分桶可选 · 也可由前端按 createdAt 切) | `200 {items:NotificationItem[], unreadCount:number, nextCursor?:string}` plain JSON | ≤ 400ms | 5xx → skeleton 保留 + 顶部 toast "加载失败"；离线 → 读本地 cache (last 50) |
| 2 | POST | `/api/notifications/{nid}/read` | `Authorization`, `X-Request-Id` (幂等) | path `nid:String` · body 空 | `200 {nid, isRead:true, unreadCount:number}` (回传最新未读数 · 幂等同帧) | ≤ 300ms | 5xx → 前端乐观 UI 不回滚 · 静默重试 1 次 · 仍失败下次 GET 校正 |
| 3 | POST | `/api/notifications/mark-all-read` | `Authorization`, `X-Request-Id` | body `{seg?:today\|week\|all}` (默认 today) | `200 {markedCount:number, unreadCount:0}` | ≤ 600ms | 5xx → toast "已读失败,请重试" · 不乐观更新 |

**幂等与一致性**：
- POST `/read` 与 `/mark-all-read` 都用 `X-Request-Id` 做幂等键；重复调用同一帧返回同结果。
- `/mark-all-read` 在服务端走 `UPDATE wb_notification SET is_read=1 WHERE student_id=? AND is_read=0 AND created_at >= ?`（today 段限定 `>=今日00:00`，week 限定 `>=本周一00:00`，all 不限）。
- 已读状态需在所有设备同步：notification-service 通过 `student.notification.read` MQ 广播给该学生其他 in-flight session 触发本地 store 更新（SC-09 步 7 "已读同步"断言点）。

来源：biz §2B.10 步 7 (`GET /api/notifications?unread=0`) + biz §3 L1750/L2367 notification-service 已有服务 + RESTful 约定。**spec'd**: 路径形态待 backend 对齐后回写 audit md 并 spec drift fix。

---

## §6 状态机

```
                  GET /api/notifications?seg=today in flight
       ┌─────────┐ ──────────────────────► ┌─────────┐ items=[] ┌─────────┐
       │ LOADING │                         │  fetch  │─────────►│  EMPTY  │
       └─────────┘                         └─────────┘          └─────────┘
            │                                    │ items>0           │
            │ 5xx                                ▼                   │
            ▼                              ┌─────────┐               │
       ┌─────────┐                         │  LIST   │◄──────┐       │
       │  ERROR  │                         └─────────┘       │       │
       └─────────┘                              │            │       │
            │ retry                             │ POST /read │       │
            └──────────────────────────────────►│ 200        │       │
                                                ▼            │       │
                                       (该卡 isRead=true     │       │
                                        移到"已读"组)        │       │
                                                │ POST       │       │
                                                │ /mark-all  │       │
                                                ▼            │       │
                                       (全卡批量 isRead=true)│       │
                                       (unreadCount=0)       │       │
                                       (Tab 角标消失)        ───────┘
```

### 6.1 状态转移规则

| From | To | Trigger | Side effect |
|---|---|---|---|
| (mount) | LOADING | 进入 P12 (Tab 我的 / P-HOME 红点 / `wb://notifications`) | 拉 GET `/api/notifications?seg=today` · skeleton 渲染 |
| LOADING | EMPTY | `items.length===0 && unreadCount===0` | 渲染 `<EmptyState>` "暂无通知" + 静音 hint |
| LOADING | LIST | `items.length>0` | 按 unread/read 分组渲染 |
| LOADING | ERROR | HTTP 5xx / 网络中断 | toast + retry button |
| LIST | LIST (read) | tap 单卡 / 主按钮 | 调 POST `/{nid}/read` · 卡从未读组移到已读组 · `unreadCount--` · 触发跳转 deeplink |
| LIST | LIST (mark-all) | tap 右上"全部已读" | 调 POST `/mark-all-read{seg}` · 当前 seg 所有未读 → 已读 · Tab 角标更新 |
| LIST | LIST (seg switch) | tap 今日/本周/全部 | 重拉 GET · seg query 改变 |
| ERROR | LOADING | retry | 重拉 |

来源：mockup HTML 视觉状态（unread/read 分组 + segmented tabs 切换）+ §5 API 端点幂等约定 + biz §2B.10 步 7 "已读同步"。

---

## §7 跳转

| 入口 | 来源 | 触发条件 |
|---|---|---|
| Tab 我的 | Tab Bar (biz §2A.3 L211 "重要通知红点") | 学生 tap "我的" Tab · 旁路二级页 (mockup 中 Tab 4 "通知" 形态是 H5 demo 简化 · 正式 IA 走 Tab 5 "我的" 子区) |
| P-HOME 红点 | P-HOME 消息聚合区 / "我的"红点 | 学生在首页 tap 重要通知红点 · 埋点 `home_msg_tap{type=notification}` |
| `wb://notifications` | Deep link | 推送通知 deeplink 兜底（当原 deeplink 失效时） |
| `wb://home` 入口卡 | P-HOME 消息聚合卡的"查看全部" | 当 `messages` 数 > 3 时显示 |

| 出口 | 目标 | 触发条件 |
|---|---|---|
| 路由 push | P08 (`/review/exec/{nodeId}`) | tap STUDY_REVIEW_DUE 卡 / 卡内"开始复习" 按钮 · biz §2A.3 L347 "P12 → 点击未读复习 → P08" |
| 路由 push | P11 (`/event/{eventId}?from=share`) | tap EXAM_SHARE 卡（家长分享 · SC-09 TC-09.01 路径） · `from=share` 决定 P11 返回指向"通知"（biz §2A.3 硬性规则 6） |
| 路由 push | P11 (`/event/{eventId}`) | tap 聚合卡 "妈妈分享了 10 个事项" (SC-09 TC-09.04 · 落 P12 list · 再 tap 落 P11) |
| 路由 push | P13 (`/me`) | tap MEMO / 系统类通知（设置变更 / 偏好提醒） |
| 路由 back | 来源页 | 学生 tap 左上 "< 日历" (mockup) / "< 我的" / 系统返回键 |

来源：biz §2A.3 路由 L236 + L347 (P12→P08) + biz §2B.10 SC-09 TC-09.01/04 (P12→P11) + biz §2A.3 硬性规则 6 (P11 来源感知 `from=share`)。

---

## §8 Wire format (SSE / WebSocket 事件)

本页**无 SSE/WS 通道**；事件通讯走 §5 HTTP 触点（GET list / POST read / POST mark-all-read）。跨设备已读同步走后端 MQ `student.notification.read` 广播（见 §5 一致性段），前端在 socket-gateway 接到推送后只 dispatch 本地 store update（**不**通过 P12 自身的 SSE）。系统推送（APNs/微信订阅消息）由 notification-service 与外部网关直接对接，**不**经过 P12 的页面会话通道。

---

## §9 异常 & 降级

| 异常 | 触发条件 | UI 反馈 | 系统行为 | 关联 TC |
|---|---|---|---|---|
| 列表 5xx | GET `/api/notifications` 失败 | skeleton 保留 + 顶部 toast "加载失败,点击重试" | 自动重试 1 次 · 仍失败保留本地 cache (last 50) | — |
| 空状态 | `items=[] && unreadCount=0` | `<EmptyState>` "暂无通知" + 尾部静音 hint | 不展示分组标题 · 不展示"全部已读" | — |
| **微信订阅消息未授权** | 学生 P13 push 偏好未授权微信 | P12 顶部 banner "微信订阅消息未授权 · 仅站内可见" + 跳 P13 设置 CTA | notification-service 自动 fallback 站内 · `notif_fallback_inapp` 埋点 | **TC-09.02** |
| **P12 红点 + 微信订阅消息双通道** | SC-09 步 2 双通道下发 | 微信弹窗 + Tab 角标 +1 + P12 列表首条未读 | 学生任一端 tap 都标 read 同步另一端 (步 7 "已读同步") | **TC-09.01** |
| 聚合通知（家长批量分享） | 一次 ≥ 5 个 event share | 1 条聚合卡 "妈妈分享了 10 个事项" | notification-service 后端聚合 · tap 落 P12 list 展开看具体 10 条 | **TC-09.04** |
| **通知 deeplink 失效（节点被取消）** | tap STUDY_REVIEW_DUE 卡但 `nodeId` 已 CANCELLED (e.g. SC-10 题被归档) | deeplink 解析 → 后端 404/410 → 前端 toast "该复习节点已不存在" + 卡片标 read + 灰显 | 不跳 P08 · 留 P12 · 埋点 `wb_deeplink_invalid{type=node_cancelled}` · biz §2B.3 TC-02.05 "降级跳 P-HOME" 不适用（这里降级是留页 + toast，更克制） | 衍生自 SC-10 级联 + biz §2A.7 异常路径降级 |
| **EXAM_SHARE deeplink 403** | 学生已解绑家长，但旧通知还在收件箱 | toast "该分享已失效" + 卡片标 read + 灰显 | 不跳 P11 · 留 P12 · 埋点 `wb_deeplink_forbidden` | TC-09.03 衍生（家长侧 403） |
| 推送被拒（系统层） | 学生 iOS 设置中关闭 App 推送权限 | P12 顶部 banner "推送已关闭 · 仅 P12 可见" + 跳系统设置 deeplink | 后端继续写 `wb_notification` 表 (不丢) · 仅外部 channel 失效 | biz §2A.7 L653 |
| 免打扰时段命中 | 当前时间在 23:00-07:30 | 列表正常显示 · 尾部 hint "免打扰时段 23:00 — 07:30 · 期间仅推送 P0 紧急通知" | notification-service 对非 P0 的节点延后到 08:00 投递 · P12 列表不受影响 | biz §3 L2373 |
| `mark-all-read` 5xx | 后端原子失败 | toast "已读失败,请重试" | 不乐观更新 · 用户重试 | — |

来源：biz §2B.10 SC-09 TC-09.01/02/04 + biz §2A.7 L653 (推送被拒降级矩阵) + biz §2A.3 L347 (P12→P08) + biz §3 L2373 (免打扰)。

---

## §10 验收点 (TC → AC 映射)

| TC ID | 类型 | GIVEN | WHEN | THEN | 关联 task AC |
|---|---|---|---|---|---|
| TC-09.01 | 正常 (双通道) | 学生已绑定家长 · 学生微信订阅消息已授权 · 家长创建 EXAM 事件 → SC-09 步 1-2 | 学生 tap 微信订阅消息 / 等待自动同步 | 微信弹窗到达 · P12 Tab 角标 +1 · P12 列表首条 `type=EXAM_SHARE` 未读 · tap 卡 → P11 EXAM 变体（hero 粉红渐变） · 后端 `event_view{variant=EXAM,from=share}` 埋点 · 步 7 "全部设备同步已读" | SC-09 接收端 task |
| TC-09.02 | 异常 (fallback 站内) | 学生未授权微信订阅消息 · 家长照常分享 | SC-09 步 1-2 | 无微信消息 · P12 顶部 banner "微信订阅消息未授权" · P12 列表首条 EXAM_SHARE 未读 · `notif_fallback_inapp` 埋点 · 学生下次打开 App 看到 P12 首条 | SC-09 接收端 task |
| TC-09.04 | 边界 (批量聚合) | 家长一次分享 10 个考试事件 | 批量 POST | notification-service 聚合 1 条卡 "妈妈分享了 10 个事项" · tap 该聚合卡 → P12 子列表展开 10 条 · 再 tap 单条 → P11 单事件 | SC-09 接收端 task |
| P12-INV1 (衍生 SC-10) | 异常 (deeplink 失效) | P12 列表存在 `type=STUDY_REVIEW_DUE` 卡 · 该 nodeId 已被 SC-10 归档级联 CANCELLED | tap 卡 / "开始复习" 按钮 | 不跳 P08 · toast "该复习节点已不存在" · 卡标 read 灰显 · 埋点 `wb_deeplink_invalid` · 留 P12 | SC-09 接收端 task TI |
| P12-INV2 (衍生 SC-09.03) | 异常 (deeplink 403) | P12 列表存在 `type=EXAM_SHARE` 卡 · 学生已解绑家长 | tap 卡 | 不跳 P11 · toast "该分享已失效" · 卡标 read 灰显 · 埋点 `wb_deeplink_forbidden` | SC-09 接收端 task TI |
| P12-INV3 | 正常 (已读同步) | 学生 A 设备 P12 tap 标 read | 学生 B 设备同账号同时 in-flight | B 设备 P12 列表该卡同步标 read（MQ `student.notification.read` 广播 + socket-gateway 下发）· Tab 角标同步 -1 | SC-09 接收端 task TI |
| P12-INV4 | 边界 (mark-all-read seg) | P12 seg=today 有 3 条未读 · seg=week 还有 8 条未读 | tap "全部已读" | 仅 today 3 条标 read · seg=week 切回仍有 8 条未读 · `markedCount=3, unreadCount=8` (跨 seg 留存) | SC-09 接收端 task TI |

来源：biz §2B.10 SC-09 TC-09.01/02/04 (3 条直接命中) + 4 条 P12-INV invariant 衍生自 SC-09/SC-10 级联 + §5 幂等约定。**注**：TC ID 形如 `P12-INV*` 是 spec 内部代号（非 biz §2B.X 真 TC 编号 · 严格按 skill §4.3 红线只能 spec'd · 留待 SC-09 接收端 task 立项后写到 feature_list.json 的 `test_invariants` 字段）。

---

## §11 性能预算

| 操作 | P95 budget | 来源 |
|---|---|---|
| P-HOME / Tab → P12 跳转 + 首屏渲染 | ≤ 600ms | spec §5 #1 + UI 体感预算 |
| GET `/api/notifications` 返回 | ≤ 400ms | spec §5 #1 P95 budget |
| POST `/{nid}/read` 返回 | ≤ 300ms | spec §5 #2 P95 budget |
| POST `/mark-all-read` 返回 | ≤ 600ms | spec §5 #3 P95 budget |
| Tab Bar 角标实时更新 (read 后) | ≤ 100ms (本地乐观) | UI 体感预算 |
| 跨设备已读同步 (MQ 广播 + socket-gateway) | ≤ 2s (P95) | biz §2B.10 步 7 "已读同步" 隐含 SLA |
| 上拉加载下一页 (cursor) | ≤ 500ms | spec §5 + 分页体感预算 |

来源：spec §5 行级 budget + biz §2B.10 步 7 + UI 体感预算约定。

---

## §12 埋点事件

| Event name | When | Properties | 来源 |
|---|---|---|---|
| `wb_notification_view` | P12 mount + GET 200 | `{unreadCount, totalCount, seg:'today'\|'week'\|'all'}` | spec'd · 待补 biz §2A.8 埋点字典 |
| `wb_notification_tap` | tap 单卡 / 卡内主按钮 | `{nid, type, deeplink, position}` | spec'd · 待补埋点字典 |
| `wb_notification_mark_read` | POST `/read` 200 后 | `{nid, type, ms}` | spec'd |
| `wb_notification_mark_all_read` | POST `/mark-all-read` 200 后 | `{seg, markedCount}` | spec'd |
| `notif_fallback_inapp` | 微信订阅未授权 fallback 命中 | `{studentId, type}` | biz §2B.10 TC-09.02 (L1121) |
| `wb_push_sent` | （非 P12 触发 · 上游 notification-service 投递时） | `{nid, channel:'APNS'\|'WX'\|'IN_APP', type}` | biz §2B.3 步 1 (L833) + biz §2B.10 步 3 (L1103) |
| `home_msg_read` | （P-HOME 触发 · 学生在 home 消息聚合区直接已读） | `{nid, type}` (与 P12 mark_read 等价) | biz §2B.10 步 7 (L1107) |
| `wb_deeplink_invalid` | deeplink 失效降级（节点 CANCELLED） | `{nid, type, deeplink, cause:'node_cancelled'}` | 衍生自 §9 异常表 + biz §2B.3 TC-02.05 类比 |
| `wb_deeplink_forbidden` | deeplink 403（已解绑分享） | `{nid, type, deeplink, cause:'unbound'}` | biz §2B.3 TC-02.05 (L860) + §2B.10 TC-09.03 |

来源：用户任务"§12 埋点"列出的 3 个核心事件 (`wb_notification_view` / `wb_notification_tap` / `wb_notification_mark_read`) + biz §2B.10 / §2B.3 引用的关联事件。**注**：3 个核心 `wb_notification_*` 事件属 spec'd · 待 SC-09 接收端 task 立项时回写 biz §2A.8 埋点字典。

---

## §13 testid 表

| testid | 用途 | 出现位置 (testids / mockup) | E2E 引用 |
|---|---|---|---|
| `p12-root` | P12 页面根 | `TEST_IDS.p12.root` L274 | SC-09 接收端 e2e mount |
| `p12-header-title` | 大标题 "通知" | `TEST_IDS.p12.headerTitle` L275 + mockup `.nav h1` | header smoke |
| `p12-header-mark-all-read` | 右上"全部已读" | `TEST_IDS.p12.markAllRead` L276 + mockup `.nav .right` | mark-all e2e |
| `p12-group-today` | "今日"组容器 | `TEST_IDS.p12.groupToday` L277 + mockup `.group-title` | group 分组 e2e |
| `p12-group-yesterday` | "昨天"组容器 | `TEST_IDS.p12.groupYesterday` L278 | group 分组 e2e (跨日) |
| `p12-group-thisweek` | "本周"组容器 | `TEST_IDS.p12.groupThisweek` L279 | seg=week e2e |
| `p12-group-earlier` | "更早"组容器 | `TEST_IDS.p12.groupEarlier` L280 | seg=all e2e |
| `p12-empty-state` | EMPTY 态容器 | `TEST_IDS.p12.emptyState` L281 | empty VRT |
| `p12-notif-card-{n}` | 第 n 条通知卡（n 自 1 起） | mockup `.card` + L282 注释 · `data-kind=` `data-read=` 双属性 | card tap / read e2e |
| `p12-notif-card-{n}-icon` | 卡的图标徽 | L283 注释 + mockup `.badge` | type 视觉断言 |
| `p12-notif-card-{n}-title` | 卡标题 | L284 注释 + mockup `.title` | 标题断言 |
| `p12-notif-card-{n}-subtitle` | 卡正文 | L285 注释 + mockup `.body` | 正文断言 |
| `p12-notif-card-{n}-time` | 卡右上时间 | L286 注释 + mockup `.time` | 时间断言 |
| `p12-notif-card-{n}-unread-dot` | 未读蓝色左色条标识 | L287 注释 + mockup `.card.unread::before` | unread 态 VRT |
| `p12-notif-card-{n}-archive-btn` | 卡内归档/已读按钮 | L288 注释 + mockup `.actions .btn` | mark-read e2e |

来源：frontend/packages/testids/src/index.ts L273-289 (`TEST_IDS.p12.*` · 8 个具名 + 6 个注释模式 `p12-notif-card-{n}-*`) + mockup HTML 真 selector 比对。

---

## §14 i18n key

| Key | 中文 | 英文 | 用途 |
|---|---|---|---|
| `notifications.title` | 通知 | Notifications | 大标题 |
| `notifications.unreadCount` | · {n} 条未读 | · {n} unread | 大标题副标 |
| `notifications.markAllRead` | 全部已读 | Mark all read | 右上按钮 |
| `notifications.seg.today` | 今日 · {n} | Today · {n} | seg tab |
| `notifications.seg.week` | 本周 · {n} | This week · {n} | seg tab |
| `notifications.seg.all` | 全部 | All | seg tab |
| `notifications.group.unreadToday` | 未读 · 今天 | Unread · Today | group title |
| `notifications.group.readToday` | 已读 · 今天 | Read · Today | group title |
| `notifications.empty.title` | 暂无通知 | No notifications | EMPTY 态 |
| `notifications.quietHours` | 免打扰时段 {start} — {end} · 期间仅推送 P0 紧急通知 | Quiet hours {start} — {end} · only P0 pushes | 尾部 hint |
| `notifications.banner.wxUnauth` | 微信订阅消息未授权 · 仅站内可见 · 去开启 | WeChat subscription off · in-app only · enable | TC-09.02 banner |
| `notifications.banner.pushOff` | 系统推送已关闭 · 去设置 | Push disabled · open settings | 推送被拒 banner |
| `notifications.deeplinkInvalid` | 该复习节点已不存在 | This review item no longer exists | deeplink 失效 toast |
| `notifications.deeplinkForbidden` | 该分享已失效 | Share no longer accessible | deeplink 403 toast |

来源：mockup HTML 文案抄录 + biz §2A.3 L211 "重要通知红点" + biz §2B.10 SC-09 TC-09.02 / 异常段。frontend/packages/i18n/ 路径待补。

---

## §15 关联与影响

- **上游 spec**: P-HOME (Tab 我的 红点 / 消息聚合"查看全部" 入口) · P00 (推送深链 deeplink fallback 路径 `P00 → P12`)
- **下游 spec**: P08 (`/review/exec/{nodeId}` · STUDY_REVIEW_DUE tap · biz §2A.3 L347) · P11 (`/event/{eventId}?from=share` · EXAM_SHARE tap · SC-09 TC-09.01) · P13 (`/me` · MEMO/系统通知 + push 偏好 banner)
- **关联 task**: feature_list.json **SC-09 接收端 task 待立项**（P12 列表 + 标已读 + EXAM_SHARE → P11 跳转 + 微信 fallback banner + deeplink 失效降级共 5 个 AC 簇）
- **关联 audit**: audits/SC-09-PHASE-0/A0X-notification-api.md **待生成**（拉 notification-service 控制器对齐本 spec §5 三个端点）
- **关联 mockup**: design/mockups/wrongbook/12_notifications.html
- **关联 biz 段**: §2A.3 L236 (路由表 P12 行) · §2A.3 L211 (P-HOME IA 我的 Tab 红点) · §2A.3 L347 (P12→P08) · §2B.10 SC-09 (TC-09.01/02/03/04) · §2A.7 L653 (推送被拒降级) · §3 L1750/L2367/L1941 (notification-service / wb_push_task)
