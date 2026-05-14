# P-OBSERVER · 只读观察者会话（Observer · Read-only Session）

**Status**: P1 · MVP 范围外（与 SC-15 同优先级 · 见 biz §2B.16 与 §2A.3.2「P-OBSERVER 卡」）
**Owner**: design + frontend + backend（anonymous-service · gateway/ObserverFilter）
**Last-updated**: 2026-05-14
**Mockup (canonical)**: `design/mockups/wrongbook/18_observer.html`
**Biz refs**: biz §2A.3.2「P-OBSERVER · 只读观察者会话」(L433-L445) + biz §2A.3 路由表 L223 + L229-L235 (P05/P06/P10/P11 「观察者只读」列) + biz §2B.16 SC-15 (L1313-L1346) + biz §4.12 `observer_invite` / `observer_session` DDL (L1667-L1695) + biz §10.10 观察者会话 API 全表 (L2166-L2187)
**Related tasks**: feature_list.json SC-15 涉及本页的 task（P1 阶段未拆分 · 待 SC-15 进入实施时回填）

---

## §1 页面目的

P-OBSERVER 是「家长 / 班主任」一次性邀请码兑换出的**只读观察者会话**首屏。它在不占用学生账号、不产生正式账号、不污染学生推送/数据统计的前提下，让 B 端陪跑角色 (parent · teacher) 在 3 秒注意力黄金窗内看到被关注学生的「最近 7 天掌握率 / 待复习数 / 学科分布」。本页**禁止**写操作（不能拍题、不能编辑、不能归档、不能触发推送），任何写尝试均由网关 `ObserverFilter` 在 `AuthFilter` 之前以 HTTP 403 拦截。它是 SC-15 (家长 / 班主任观察者会话 · P1) 的核心枢纽页，下游通往 P05 / P06 / P10 / P11 的**只读形态**。

---

## §2 布局分区 + Wireframe

### 2.1 布局分区（从上到下 · 来源：biz §2A.3.2「布局分区」+ 18_observer.html 视觉真相）

```
┌──────────────────────────────────────────┐
│ statusbar (54px · 极光蓝绿渐变 header 衬)  │
├──────────────────────────────────────────┤
│ anon-nav: 返回 < · 观察者品牌 chip · 退出  │   ← 顶部高对比导航 (header 260px 渐变衬底)
├──────────────────────────────────────────┤
│ 观察者横幅 identity 卡 (B 端身份提示)        │
│   · 头像 P (Parent) · "您是 Allen 的家长"   │
│   · scope=READ badge (青绿色 pill)          │
│   · 三段 meta: 会话剩余 · 邀请码 · 撤销实时性 │
├──────────────────────────────────────────┤
│ 学生周报卡 student-summary                  │
│   · 头像 A · "Allen 同学"                   │
│   · "高二 12 班 · 连打 5 天 · 本周 23 题"   │
├──────────────────────────────────────────┤
│ 数据 scroll 区 (圆角 26px 上翻 · 米白底)     │
│   · stats 三列 (错题总数 / 掌握率 / 待复习)  │
│   · 近 7 天复习记录 (qitem · 锁图标)        │
│   · disabled-actions 操作禁用条 (4 灰按钮)   │
├──────────────────────────────────────────┤
│ tabghost 84px (假 tabbar · 仅"首页" active) │
│   · 错题本/拍题/复习/我的 全部 locked       │
└──────────────────────────────────────────┘
+ 右上角斜 38° watermark "scope = READ · observer only" (装饰水印 · 高对比合规暗示)
```

### 2.2 关键视觉锚（mockup HTML 真 selector）

| Zone | DOM selector / class | 用途 / testid 锚 |
|---|---|---|
| Header 渐变 | `.header` (linear-gradient #0F1A3D → #1F3C8C → #30B0C7) | 高识别度蓝青 hero 衬底（避开学生端 极光 warm 米白） |
| Watermark | `.watermark` (rotate 38°) | `data-testid="observer-watermark"` · 重申 scope=READ |
| Anon nav | `.anon-nav` | `data-testid="observer-shell-nav"` 容器 |
| Back btn | `.back` | `data-testid="observer-back-btn"` |
| Brand chip | `.brand` | "观察者 · Observer" 品牌识别 |
| Exit btn | `.exit` | `data-testid="observer-exit-btn"` 红色危险色 pill |
| Identity card | `.identity` | `data-testid="observer-identity-card"` |
| Scope badge | `.id-scope` | `data-testid="observer-scope-badge"` (READ pill) |
| Student summary | `.student-summary` | `data-testid="observer-student-summary"` |
| Scroll body | `.scroll` | 数据滚动容器 |
| Stats strip | `.stats > .stat` | 三宫格统计 (错题总数 / 掌握率 / 待复习) |
| Read-only item | `.qitem` (+ `.locked-icon` 🔒) | 时间线条目 · 必带锁图标 |
| Disabled actions | `.disabled-actions` | 灰阶斜纹蒙版 · 4 按钮全 disabled |
| Lock note | `.disabled-actions .lock-note` | "您的 JWT scope=READ · 所有写接口已在网关层拒绝" |
| Tabghost | `.tabghost > .tab.locked` | `data-testid="observer-ghost-tab-*"` 假 tabbar |

---

## §3 核心组件

| 组件 | 来源 | 接受 props | 说明 |
|---|---|---|---|
| `<ObserverShell>` | frontend/packages/ui-kit (P1 新增) | `{observerToken, scopeStudentId, role, expiresAt, onExit}` | 整页 shell · 强制 scope=READ · 注入 watermark + ghost tabbar |
| `<ObserverBanner>` | frontend/packages/ui-kit | `{role:'PARENT'/'TEACHER', studentNickMasked, expiresIn}` | 顶部 identity 卡 (`.identity`) · biz §2A.3.2 「核心组件」 |
| `<WeeklyReportCard>` | frontend/packages/ui-kit | `{masteryRate, pendingReview, subjectDist[]}` | 周报数据卡 · 复用 stats 三宫格视觉 |
| `<SubjectRadar>` | frontend/packages/ui-kit | `{subjects:[{code,score}]}` | 学科雷达 (只读) · biz §2A.3.2 提到的 viz |
| `<RecentTimeline>` | frontend/packages/ui-kit | `{items:[{qid,subject,kpTagsMasked,lastReviewedAt,tLevel}]}` | 最近错题时间线 · 题型 tag · 不可点开原图 |
| `<ReadOnlyDetailWrapper>` | frontend/packages/ui-kit | `{children}` | P06 / P11 路由命中时套此 wrapper · 注入紫色横幅 + 写按钮置灰 (`aria-disabled='true'`) |
| `<DisabledActionBar>` | frontend/packages/ui-kit | `{actions:['edit','redo','archive','share']}` | 灰阶 + 斜纹蒙版 + 锁图标 · 任意 tap → toast |
| `<GhostTabbar>` | frontend/packages/ui-kit | `{activeTab:'home'}` | 假 tabbar (`.tabghost`) · 视觉对齐学生端但仅 home active |

来源：biz §2A.3.2 「核心组件」(ObserverBanner · WeeklyReportCard · SubjectRadar · RecentTimeline · ReadOnlyDetailWrapper) + 18_observer.html DOM + `frontend/packages/testids/src/index.ts` `TEST_IDS.observerShell.*`。

---

## §4 数据绑定（Entity / DTO）

### 4.1 Page-level State 绑定

```typescript
{
  observer: {
    observerToken: string,            // OBSERVER JWT (role=OBSERVER, scope=READ)
    scopeStudentId: string,           // 被观察学生 ID (hash)
    studentNickMasked: string,        // 学生昵称首字 + * (如 "张*")
    role: 'PARENT' | 'TEACHER',
    expiresAt: ISO8601,               // PARENT 30d · TEACHER 90d (滑动续期 +7d)
    viewMode: 'today' | 'wrongbook' | 'calendar', // 默认 'today'
  },
  overview: {
    masteryRate: number,              // 0-1 掌握率
    pendingReview: number,            // 待复习数
    totalWrong: number,               // 错题总数
    subjectDist: [{ code, count, mastery }],
    weeklyReport: { streakDays, weekNewCount }
  },
  timeline: {
    items: [{ qid, subject, kpTagsMasked, lastReviewedAt, tLevel, mastery }],
    nextCursor: string | null,
  },
  ui: {
    state: 'REDEEMING' | 'DASHBOARD' | 'EXPIRED' | 'REVOKED',
    error: 'INVITE_EXPIRED' | 'INVITE_REVOKED' | 'OBSERVER_REVOKED' | 'OBSERVER_FORBIDDEN_WRITE' | null,
    writeBlockedToast: boolean,
  }
}
```

### 4.2 涉及的后端 Entity

- `observer_invite` (anonymous-service · `invite_code` CHAR(6) UNIQUE / `student_id` / `role` / `status` 1 PENDING / 2 EXCHANGED / 3 EXPIRED / 4 REVOKED / `expires_at` 默认 created_at + 24h) — biz §4.12 L1670-L1678
- `observer_session` (anonymous-service · `jti` UNIQUE / `student_id` / `role` / `device_fp` / `status` 1 ACTIVE / 2 EXPIRED / 3 REVOKED_BY_STUDENT / `expires_at` PARENT 30d / TEACHER 90d) — biz §4.12 L1680-L1692
- `wb_question` (wrongbook-service · 只读访问 · `original_image_url` / `student_email` / `chat_id` 三字段对 OBSERVER 一律返 `null`) — biz §2B.16 关键断言点 (数据脱敏)

来源：biz §2A.3.2「数据绑定」+ biz §4.12 DDL + biz §2B.16 「关键断言点 · 数据脱敏」。

---

## §5 API 触点

> 字符级精准 path + method · 与 biz §10.10 (L2166-L2187) 一致 · 与 biz §2B.16 F02/F03/F07 流水线对齐。

| # | Method | Path | Headers (req) | Body (req) | Response | 失败码 | P95 预算 |
|---|---|---|---|---|---|---|---|
| 1 | POST | `/api/observer/exchange` | `Content-Type: application/json` (无 JWT) | `{inviteCode: "O-A9T4-XZ", deviceFp: "<fp_hash>", purpose?: "PARENT_VIEW"}` | `200 {observerToken, studentIdHash, role, expiresAt}` | `410 INVITE_EXPIRED` · `403 INVITE_REVOKED` | ≤ 400 ms (biz §2B.16 F02) |
| 2 | GET  | `/api/observer/overview` | `Authorization: Bearer <OBSERVER JWT>` | — | `200 {masteryRate, pendingReview, subjectRadar, weeklyReport}` | `401` token 缺失 · `403 OBSERVER_REVOKED` | ≤ 600 ms (biz §2B.16 F03) |
| 3 | GET  | `/api/observer/timeline?limit=20&cursor=<c>` | `Authorization: Bearer <OBSERVER JWT>` | — | `200 [{qid, subject, kpTagsMasked, lastReviewedAt, mastery}, ...]` | `403 OBSERVER_REVOKED` | ≤ 600 ms |
| 4 | GET  | `/api/wb/questions/:qid` | `Authorization: Bearer <OBSERVER JWT>` (header `observer-token` 也接受) | — | `200 {qid, ...通用字段..., original_image_url: null, student_email: null, chat_id: null, thumbnailMasked: true}` | `403 OBSERVER_FORBIDDEN_WRITE` (写方法) | — |
| 5 | DELETE | `/api/observer/sessions/:jti` | `Authorization: Bearer <STUDENT JWT>` (注：学生端调) | — | `204` | — | ≤ 100 ms (biz §2B.16 F07) |

**网关行为（ObserverFilter · biz §10.13 鉴权总原则 + L2239 + L2201）**：
- `OBSERVER` JWT 在 `GatewayAuthFilter` 之前由 `ObserverFilter` 强制 `scope=READ`；
- 命中 Redis 黑名单 `obs:revoked:{jti}` (学生 P13 撤销后 ≤ 1 s 同步) → 立即 `403 OBSERVER_REVOKED`；
- 任何 `POST/PUT/DELETE/PATCH` 方法（除 `/api/observer/exchange` 本身）→ `403 OBSERVER_FORBIDDEN_WRITE`；
- 响应字段脱敏：`original_image_url` / `student_email` / `chat_id` 强制 null。

来源：biz §2A.3.2「API 触点」+ biz §10.10 (字符级 API · L2166-L2187) + biz §2B.16 流水线步 F02-F07 + biz §10 鉴权总原则 L2201。

---

## §6 状态机

```
   ┌──────────┐  POST /observer/exchange  ┌──────────┐
   │REDEEMING │──────────────────────────►│DASHBOARD │
   └────┬─────┘  200 + observerToken      └────┬─────┘
        │ 410 INVITE_EXPIRED                   │ GET /overview · /timeline
        │ 403 INVITE_REVOKED                   │
        ▼                                      ▼
   ┌──────────┐                          ┌──────────────────┐
   │ EXPIRED  │ ←──── 任何后续 API 命中 ──│ 写尝试 / 撤销命中 │
   └────┬─────┘      403 OBSERVER_REVOKED └──────────────────┘
        │ Tap "联系学生重发" CTA                  │
        ▼                                        ▼
   (跳 P-LANDING)                            REDIRECT P-LANDING
```

### 6.1 状态转移规则

| From | To | Trigger | Side effect |
|---|---|---|---|
| (entry) | REDEEMING | 路由 `wb://observer/:code` 命中 / `/observer?code=...` 命中 | Loading "正在准备观察视图..." |
| REDEEMING | DASHBOARD | POST `/api/observer/exchange` 200 | observerToken 落 sessionStorage · 跳 P-OBSERVER 主体 · 埋 `obs_exchange_success{role}` |
| REDEEMING | EXPIRED | 410 INVITE_EXPIRED / 403 INVITE_REVOKED | 挡板页 + CTA "联系学生重发" · 埋 `obs_invite_expired` |
| DASHBOARD | DASHBOARD | 任意 read API 200 · 滑动续期 +7d (服务端) | 数据局部刷新 |
| DASHBOARD | EXPIRED | 任意后续 API 命中 403 OBSERVER_REVOKED (学生 P13 撤销) | Toast "学生已撤销你的查看权限" → 跳 P-LANDING · 埋 `obs_revoked_by_student` |
| DASHBOARD | DASHBOARD (toast) | 用户 tap 任一灰按钮 / 写尝试 → 网关 403 OBSERVER_FORBIDDEN_WRITE | Toast "观察者不可编辑 · 如需操作请联系 @<studentNickMasked>" · 埋 `obs_write_blocked{action}` |
| EXPIRED | (P-LANDING) | 路由 push 自动跳 | observerToken 清空 |

来源：biz §2A.3.2「状态集」(`INVITE_VALID → READY` / `INVITE_EXPIRED` / `INVITE_REVOKED`) + biz §2A.5 `ObserverSession` 状态机 L622 + biz §2B.16 F01-F07 流水。

---

## §7 跳转

| 入口 | 来源 | 触发条件 |
|---|---|---|
| 邀请深链 | `wb://observer/:code` / `/observer?code=...` | 家长扫码 / 粘贴邀请码 / 点击邀请链接（决策树节点 2 命中）|
| 学生端生成 | P13「我的 - 观察者」`POST /api/observer/invites` | 学生生成邀请码后分享给家长 (biz §2B.16 前置条件) |

| 出口 | 目标 | 触发条件 |
|---|---|---|
| 路由 push | P05 (`/wrongbook` 只读) | Tap 错题本 ghost tab (P1 P05 显式支持 OBSERVER) · biz §2A.3 L229 |
| 路由 push | P06 (`/wrongbook/:qid` 只读) | Tap 时间线 qitem → 进 P06 只读形态 · biz §2B.16 F04 |
| 路由 push | P10 (`/calendar/month` 只读) | Tap 日历 tab (P1) · biz §2A.3 L234 |
| 路由 push | P11 (`/event/:eventId` 只读) | Tap 日历事件 → P11 只读形态 · biz §2B.16 F05 |
| 路由 push | P-LANDING | 会话过期 / 学生撤销 / Exit 按钮 / 邀请码失效 |

来源：biz §2A.3.2「跳转」L443 + biz §2A.3 路由表 L223 + L229-L235 (P05/P06/P10/P11 「观察者只读」列) + biz §2B.16 F04/F05/F07。

---

## §8 Wire format (SSE / WebSocket 事件)

本页**无 SSE / WebSocket 通道**。所有事件通讯走 §5 HTTP 触点：

- 兑换会话：单次 `POST /api/observer/exchange` (无流式)；
- 数据拉取：`GET /api/observer/overview` + `GET /api/observer/timeline` 标准 REST；
- 撤销通知：学生端 P13 写 Redis 黑名单 → 家长端下次请求命中 `403 OBSERVER_REVOKED` (拉模式 · 非推模式) · biz §2B.16 F07 关键断言点「撤销实时性 ≤ 1 s」靠 Redis Bloom Filter + 网关同步实现，**不通过** WebSocket 推送。

P1 + 阶段可考虑通过 `EventSource /api/observer/session/heartbeat` 加 server-push 撤销通知（待 SC-15 上线后评估）。

---

## §9 异常 & 降级

| 异常 | 触发条件 | UI 反馈 | 系统行为 | 关联 TC |
|---|---|---|---|---|
| 邀请码已过期 | exchange 410 INVITE_EXPIRED (24h 过期 / invite status=3) | 挡板页 + 图标 + 主标题"邀请码已过期" + CTA "联系学生重发" → P-LANDING | observer_invite.status 校验失败 · 埋 `obs_invite_expired` | TC-15.02 |
| 邀请码已被撤销/已用 | exchange 403 INVITE_REVOKED (one-shot 失败 · status=4 或 status=2) | 挡板页 + "此邀请码已被使用或撤销" + CTA | one-shot 邀请码不可重用 (biz §2B.16 关键断言点) | — |
| Token 过期 | 任一 read API 401 (jti 过 expires_at) | 顶部 banner "会话已过期" + CTA "重新邀请" → P-LANDING | observer_session.status=2 EXPIRED | — |
| 学生撤销 | 任一 API 403 OBSERVER_REVOKED (Redis 黑名单命中) | Toast "学生已撤销你的查看权限" 1.5s → 强跳 P-LANDING | jti 进 `obs:revoked:{jti}` ≤ 1 s 生效 (biz §2B.16 关键断言点) | TC-15.04 |
| 任何 POST/PATCH/DELETE 尝试 | 网关 ObserverFilter 拦截 | Toast "您是观察者 · 仅可只读 · 如需操作请联系 @<studentNickMasked>" | 网关 403 OBSERVER_FORBIDDEN_WRITE + 审计日志 `abuse_attempt` · 埋 `obs_write_blocked{action}` | TC-15.03 |
| 尝试看原图 | P06 图片区 tap 放大 / 直接请求 original_image_url | 只显示脱敏缩略图 · 长按 / 点击放大不放行 · Toast "观察者视图仅显示脱敏缩略图" | 后端响应字段 `original_image_url=null` 强制 | TC-15.05 |
| 网络降级 | GET /overview 5xx / timeout | 顶部黄条 "数据加载失败 · 下拉刷新" | 留 skeleton · 不强制跳错误页 | — |

来源：biz §2A.3.2「合规 / 权限」+ biz §2B.16 关键断言点 + biz §2A.6 异常路径表（含 OBSERVER_REVOKED L662）+ biz §10 鉴权总原则 L2201。

---

## §10 验收点（TC → AC 映射）

| TC ID | 类型 | GIVEN | WHEN | THEN | 关联 task AC |
|---|---|---|---|---|---|
| TC-15.01 | 正常 | 学生 P13 生成有效邀请码 · role=PARENT · 24h 内 | 家长完整走 F01-F05（扫码 → exchange → P-OBSERVER → P06 只读 → P11 只读） | exchange 200 ≤ 400ms · 周报数据正确 · 时间线条目 `kpTagsMasked` 脱敏 · P06 / P11 顶部紫色横幅"观察者只读模式" + 写按钮全置灰 | （SC-15 task 待拆 · P1 阶段）|
| TC-15.02 | 异常 | 邀请码已过 24h | F02 兑换 | 410 INVITE_EXPIRED · 挡板页 + CTA "联系学生重发" · 埋 `obs_invite_expired` | （SC-15 task 待拆）|
| TC-15.03 | 安全 | 已获 OBSERVER JWT | 观察者直接构造 `POST /api/wb/questions` 调接口 | 网关 403 OBSERVER_FORBIDDEN_WRITE · 审计日志 `abuse_attempt` 记录 jti + IP + UA · 埋 `obs_write_blocked{action='create_question'}` | （SC-15 task 待拆）|
| TC-15.04 | 安全 | 家长持有 ACTIVE OBSERVER JWT | 学生 P13 撤销后 ≤ 1s · 家长任意 API 请求 | 403 OBSERVER_REVOKED · 前端 Toast 1.5s → 跳 P-LANDING · observerToken 清空 | （SC-15 task 待拆）|
| TC-15.05 | 合规 | 家长进 P06 只读模式 | tap 图片区放大 / 直接构造原图 URL | 只显示脱敏缩略图 · 放大不放行 · `original_image_url=null` 强制 · `student_email` / `chat_id` 不出现在响应体 | （SC-15 task 待拆）|

来源：biz §2B.16 QA 用例表 (L1340-L1346) + 待 feature_list.json 在 SC-15 进入实施阶段时拆分对应 task AC。

---

## §11 性能预算

| 操作 | P95 budget | 来源 |
|---|---|---|
| POST /observer/exchange 服务端响应 | ≤ 400 ms | biz §2B.16 F02 「时延预算」 |
| GET /observer/overview + /timeline 服务端响应 | ≤ 600 ms | biz §2B.16 F03 「时延预算」 |
| 学生撤销 → 网关黑名单生效 | ≤ 1 s（≤ 100 ms 写黑名单 + Redis 命中）| biz §2B.16 F07 + 关键断言点「撤销实时性」 |
| Toast "观察者不可编辑" 渲染 | ≤ 100 ms | biz §2A.3.2 + 标准 UI 反馈预算 |
| 跳 P-LANDING (token 失效 / 撤销) | ≤ 500 ms | 标准路由 push P95 预算 |

来源：biz §2B.16 「时延预算」列 + biz §11 非功能需求性能 SLA。

---

## §12 埋点事件

| Event name | When | Properties | 来源 |
|---|---|---|---|
| `obs_enter` | 路由命中 `/observer?code=...` | `{code_hash, entry_source:'invite'}` | biz §2B.16 F01 |
| `obs_exchange_success` | POST /exchange 200 | `{role:'PARENT'/'TEACHER'}` | biz §2A.3.2 + biz §2B.16 F02 + biz §2A.8 埋点字典 L683 |
| `obs_overview_view` | P-OBSERVER 主体 mount · GET /overview 200 | `{masteryRate, pendingReview, studentIdHash}` | biz §2A.3.2 + biz §2B.16 F03 |
| `obs_timeline_tap` | Tap 时间线某条 qitem | `{qid, subject}` | biz §2A.3.2 |
| `obs_detail_readonly_view` | 进入 P06 / P11 只读形态 | `{qid 或 eventId, target:'P06'/'P11'}` | biz §2A.3.2 + biz §2B.16 F04 |
| `obs_write_blocked` | 用户 tap 灰按钮 / 写请求被网关 403 拦 | `{action:'edit'/'redo'/'archive'/'share'/'create_question'}` | biz §2B.16 F06 |
| `obs_invite_expired` | exchange 410 INVITE_EXPIRED | `{code_hash}` | biz §2A.3.2 |
| `obs_revoked_by_student` | 任一 API 403 OBSERVER_REVOKED | `{jti_hash}` | biz §2B.16 F07 |

**合规要求**：所有 `obs_*` 事件**不进入学生维度统计**，独立 ClickHouse 表 `obs_events` (biz §2B.16 关键断言点「不污染统计」)；事件必须携带 `student_id_hash`，**禁止**携带原始 PII (biz §2A.8 L686)。

来源：biz §2A.3.2「埋点事件」+ biz §2B.16 各 F0X 行埋点 + biz §2A.8 埋点字典 L683-L686。

---

## §13 testid 表

| testid | 用途 | 出现位置（mockup / source） | 写操作锁约束 |
|---|---|---|---|
| `observer-shell` | ObserverShell 根 | 18_observer.html `.phone` (root)| — |
| `observer-watermark` | 右上角 scope=READ 斜水印 | `.watermark` | 装饰 · 不可点击 |
| `observer-banner` | 顶部 identity 横幅 | `.identity` | SC-15 `assertReadOnlyBannerVisible` |
| `observer-student-summary` | 学生周报卡 | `.student-summary` | SC-15 `assertStudentSummary` |
| `observer-shell-nav` | 顶部 nav 容器 | `.anon-nav` | — |
| `observer-back-btn` | 返回按钮 | `.back` | — |
| `observer-exit-btn` | 红色退出 pill | `.exit` | tap → 清 observerToken → P-LANDING |
| `observer-identity-card` | identity 卡片整体 | `.identity` | — |
| `observer-scope-badge` | scope=READ pill | `.id-scope` | — |
| `observer-shell-outlet` | 路由 outlet (P06 / P11 嵌入位) | — | 仅渲染只读视图 |
| `observer-ghost-tab-home` | 假 tabbar · 首页 active | `.tabghost .tab.active` | — |
| `observer-ghost-tab-wrongbook` | 假 tabbar · 错题本 locked | `.tabghost .tab.locked:nth-child(2)` | `aria-disabled='true'` |
| `observer-ghost-tab-capture` | 假 tabbar · 拍题 locked | `.tabghost .tab.locked:nth-child(3)` | `aria-disabled='true'` · 严禁路由到 P02 |
| `observer-ghost-tab-review` | 假 tabbar · 复习 locked | `.tabghost .tab.locked:nth-child(4)` | `aria-disabled='true'` |
| `observer-ghost-tab-me` | 假 tabbar · 我的 locked | `.tabghost .tab.locked:nth-child(5)` | `aria-disabled='true'` |

**§13 写操作禁用红线（UI 锁层 · 与 ObserverFilter 双重锁）**：

凡是带写操作的 testid（无论本页内灰按钮还是嵌入 P06 / P11 时下游页面的 testid）在观察者模式下**必须** `aria-disabled='true'` + visually disabled + tap 仅触发 toast 不触发请求：

| 跨页 testid | 写操作 | 观察者模式渲染 |
|---|---|---|
| `capture-shutter` (P02 78px 快门 · TEST_IDS.p02.*) | 拍题 | **不应该可见**（路由层拒进 P02）· 兜底：`aria-disabled='true'` |
| `save-btn` / `p04-save-cta` (P04 保存) | 保存 question | aria-disabled · tap → toast `obs_write_blocked{action:'save'}` |
| `p08-grade-buttons-*` (P08 grade 三按钮) | 提交评分 | aria-disabled · tap → toast |
| `wrongbook-edit-btn` / `p06-edit-btn` (P06 编辑) | PATCH question | aria-disabled · tap → toast |
| `p06-archive-btn` (P06 归档) | DELETE / archive | aria-disabled · tap → toast |
| `share-btn` (P06 / P11 分享) | POST /share/tokens | aria-disabled · tap → toast |

来源：`frontend/packages/testids/src/index.ts` `TEST_IDS.observerShell.*` (L347-L365) + 18_observer.html `.locked-icon` + `.disabled-actions` + `.tab.locked` + biz §2B.16 关键断言点「权限边界」。

---

## §14 i18n key

| Key | 中文 | 英文 | 用途 |
|---|---|---|---|
| `observer.brand` | 观察者 · Observer | Observer | 顶部品牌 chip |
| `observer.exit` | 退出 | Exit | 顶部红色退出按钮 |
| `observer.role.parent` | 您是 {studentNick} 的家长 | You are viewing as {studentNick}'s parent | identity 卡 PARENT 主标题 |
| `observer.role.teacher` | 您是 {studentNick} 的老师 | You are viewing as {studentNick}'s teacher | identity 卡 TEACHER 主标题 |
| `observer.scope.read` | scope=READ · 仅可只读 | scope=READ · read-only | scope badge |
| `observer.session.remaining` | 会话剩余 {duration} | Session {duration} left | meta 行 |
| `observer.invite.code` | 邀请码 {code} | Invite {code} | meta 行 |
| `observer.revocable.note` | 学生可随时撤销 · 秒级生效 | Student can revoke instantly | meta 行 |
| `observer.section.recent` | 近 7 天复习记录 | Last 7 days review log | section title |
| `observer.section.readonly` | 只读 · 不可操作 | Read-only · No actions | section subtitle |
| `observer.actions.disabled_title` | 操作按钮 · 观察者不可用 | Actions · Disabled in observer mode | disabled-actions 标题 |
| `observer.actions.lock_note` | 您的 JWT 具有 scope = READ · 所有写接口已在网关层拒绝 (HTTP 403) · 学生可随时撤销 | Your JWT has scope = READ. All write APIs are blocked at gateway (HTTP 403). Student can revoke anytime. | lock note 文本 |
| `observer.toast.write_blocked` | 您是观察者 · 仅可只读 · 如需操作请联系 @{studentNick} | You are an observer — read-only. Contact @{studentNick} to edit. | 写尝试 toast (biz §2B.16 F06) |
| `observer.error.invite_expired.title` | 邀请码已过期 | Invite expired | 挡板页主标题 |
| `observer.error.invite_expired.cta` | 联系学生重发 | Ask student to resend | 挡板页 CTA |
| `observer.error.revoked.toast` | 学生已撤销你的查看权限 | Student has revoked your access | 撤销 toast (biz §2B.16 关键断言) |
| `observer.readonly.banner` | 观察者只读模式 | Observer · Read-only | P06 / P11 顶部紫色横幅 (biz §2B.16 F04) |

来源：biz §2A.3.2「合规 / 权限」+ biz §2B.16 各 F0X UI 反馈 + 18_observer.html 文案。

---

## §15 关联与影响

- **上游 spec**:
  - P13 设置/我的 (`/me`) — 学生端生成邀请码 (`POST /api/observer/invites`) · 撤销会话 (`DELETE /api/observer/sessions/:jti`) · 见 biz §2B.16 前置条件
  - 决策树节点 2 (biz §2A.3.1) — `wb://observer/:code` 命中后路由到本页
- **下游 spec**（全部为只读形态嵌入 ObserverShell）:
  - P05 错题本列表（只读）— 复用 P05 视觉 · 写按钮全 aria-disabled · biz §2A.3 L229
  - P06 错题详情（只读）— 顶部紫色横幅 + 编辑/归档/分享置灰 · `original_image_url=null` · biz §2B.16 F04
  - P10 日历月视图（只读）— biz §2A.3 L234
  - P11 事件详情（只读）— 顶部紫条 + 所有写置灰 · biz §2B.16 F05
  - P-LANDING — 会话过期 / 学生撤销 / Exit 时降级目标
- **关联 task**: feature_list.json SC-15 P1 阶段未拆分 task（待 SC-15 进入实施时回填 ObserverFilter 网关 task / exchange API task / shell 组件 task）
- **关联 audit**: 待 SC-15 进入 PHASE-0 时建 `audits/SC-15-PHASE-0/A0X-observer-exchange.md` + `A0X-observer-filter.md`
- **关联 mockup**: design/mockups/wrongbook/18_observer.html
- **关联表**: `observer_invite` / `observer_session` (biz §4.12) + Redis 黑名单 `obs:revoked:{jti}`
- **关联 ClickHouse 表**: `obs_events` (独立 · 不进学生维度统计 · biz §2B.16 关键断言点)
- **关联微服务 / 网关组件**:
  - `anonymous-service` (biz §0 + biz §10.10) — observer_invite / observer_session 主仓
  - 网关 `ObserverFilter` (biz §10 L2239 + L2201) — 在 `AuthFilter` 之前强制 `scope=READ` + Redis 黑名单命中
- **风险登记**: 「观察者越权」高风险 (biz §13 风险矩阵 L3011) — 由 ObserverFilter + JWT 独立签名密钥 + 黑名单秒级同步 + 所有写请求 403 + 审计四重防御覆盖
