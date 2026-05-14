# P13 · 设置 / 我的（Settings / Me）

**Status**: Active
**Owner**: design + frontend + backend
**Last-updated**: 2026-05-14
**Mockup**: design/mockups/wrongbook/13_settings.html
**Biz refs**: biz/业务与技术解决方案_AI错题本_基于日历系统.md §2A.3 路由表 L237 (P13 行) + §2A.3.3 Tab Shell L327 (Tab 5 「我的」P13) + §2A.6 US-07 L634 (免打扰 `/me/preferences`) + §2A.7 异常矩阵 L655 (时区变化) + §2B.9 SC-08 跨时区登录→日历重算 L1058-L1088 + §2B.10 SC-09 L1095/L1114 (家长绑定 / 解绑校验) + §2B.16 SC-15 L1317/L1329 (观察者邀请 / 撤销) + §9.1 L2040 (P13 Tab 5 摘要) + §10.10 L2169 (观察者 API)
**Related tasks**: 暂无 §2A.4 规格卡 · 暂无 feature_list.json 任务 (P13 是 SC-08/SC-09/SC-15 的**入口聚合页**而非独立 SC 主战场 · 子任务待 SC-08/15 phase-0 落点后补)

---

## §1 页面目的

P13 是登录态用户的"偏好与账户中枢"，承担 4 类心智职能：① **偏好预设**（时区 / 语言 / 外观 / 一周起始日）以个人化方式驱动 P-HOME / P10 / P12 的渲染上下文；② **通知策略**（推送 / 邮件 / 短信 / 免打扰 / 记忆曲线节奏）实现 US-07「不被打扰」承诺，并兜底 P12 多通道聚合；③ **隐私与账户**（Face ID / 端到端加密 / 数据导出 / 注销）满足合规与可携权；④ **家长绑定 / 观察者邀请管理**（SC-09 前置 + SC-15 撤销点）作为跨角色协同的撤销开关。它不是高频页，但是**单点决策辐射全 App**：尤其时区切换会触发后端 calendar-core 异步重算所有未到期 review_node 的"用户本地时间"呈现（DB 仍保持 UTC 不变），UI 期间显示「排期同步中」直至 outbox 消费完成。

---

## §2 布局分区 + Wireframe

### 2.1 布局分区 (zone 划分)

```
┌──────────────────────────────────────┐  StatusBar (9:41 · 透明覆盖)
├──────────────────────────────────────┤  Nav 96px (返回「日历」 + 大标题「设置」 + 「完成」)
│  Profile Card (avatar 58px + 姓名 +    │  顶部账户区
│   邮箱 · Pro 版 + 同步 chip × 2)        │
├──────────────────────────────────────┤
│  Group · 偏好设置                       │
│  [时区][语言][外观][一周起始日]           │
│  note: "所有时间以 UTC 存储..."         │
├──────────────────────────────────────┤
│  Group · 通知与提醒                     │
│  [推送 switch][邮件 switch][短信 switch] │
│  [免打扰时段 chev][记忆曲线节奏 chev]    │
├──────────────────────────────────────┤
│  Group · 隐私与账户                     │
│  [Face ID switch][端到端加密][数据导出]   │
│  [注销账户 (红色)]                       │
├──────────────────────────────────────┤
│  Group · 关于                          │
│  [版本 1.0.0][服务条款]                 │
│  版权脚注 © 2026 Longfeng              │
├──────────────────────────────────────┤  TabBar 84px (Tab 5 「我的」active)
└──────────────────────────────────────┘
```

来源：mockup 13_settings.html L88-L267 视觉（HIG grouped list 风格）+ biz §2A.3.3 L327 Tab 5 默认落位。

### 2.2 关键视觉锚 (mockup HTML 真 selector)

| Zone | DOM selector / class | 用途 |
|---|---|---|
| Nav 大标题 | `.nav h1` (L110) | 34px / 700 / "设置" |
| Nav 返回 | `.nav .back` (L107) | 蓝色 "< 日历" |
| Profile 卡 | `.profile` (L116-L127) | avatar(conic-gradient) + 名 + 邮箱 · Pro 版 + chip × 2 |
| Profile 同步 chip | `.chip-tone` (L122-L123) | 绿点"已同步 · 刚刚" + 蓝点"3 端在线" |
| 偏好分组 | `.group` (L130-L159) | label "偏好设置" + 4 item list + note |
| 时区行 | `.item` (L133-L138) | blue ico + "时区" + value "Asia/Shanghai (GMT+8)" + chev |
| 语言行 | `.item` (L139-L144) | indigo ico + "语言" + value "简体中文" |
| 外观行 | `.item` (L145-L150) | orange ico + "外观" + value "自动" |
| 一周起始日行 | `.item` (L151-L156) | green ico + "一周起始日" + value "周一" |
| 通知分组 | `.group` (L162-L194) | label "通知与提醒" + 5 item |
| 推送 switch | `.switch.on` (L168) | red ico + "推送通知" + 51px 绿底 toggle (on) |
| 邮件 switch | `.switch.on` (L173) | blue ico + "邮件通知" |
| 短信 switch | `.switch` (L179) | green ico + "短信通知" + value "未绑定手机" (off) |
| 免打扰时段 | `.item` (L181-L186) | indigo ico + value "23:00 — 07:30" |
| 记忆曲线节奏 | `.item` (L187-L192) | orange ico + value "标准 5 阶段" |
| 隐私分组 | `.group` (L197-L223) | label "隐私与账户" |
| Face ID switch | `.switch.on` (L203) | gray ico + "Face ID 解锁" (on) |
| 端到端加密 | `.item` (L205-L210) | pink ico + value "已启用" |
| 数据导出 | `.item` (L211-L216) | blue ico + value ".ics / .json" |
| 注销账户 (危险) | `.item` (L217-L222) | red ico + 红字 "注销账户" |
| 关于分组 | `.group` (L226-L241) | 版本 + 服务条款 |
| 版本行 | `.item` (L229-L233) | gray ico + value "1.0.0 · build 240421" |
| TabBar Tab 5 | `.tab.active` (L258-L261) | active 蓝色 "我的" 图标 + label |

---

## §3 核心组件

| 组件 | 来源 | 接受 props | 说明 |
|---|---|---|---|
| `<ProfileCard>` | frontend/packages/ui-kit | `{user:{name, email, plan}, syncedAt, devicesOnline}` | avatar conic-gradient + chip 行 · tap 进个人资料二级页 |
| `<SettingsGroup>` | frontend/packages/ui-kit | `{label, items:[], note?}` | 通用分组（label + 圆角卡 + 可选 note） |
| `<SettingsItem>` | frontend/packages/ui-kit | `{icon, title, value?, trailing:'chev'\|'switch'\|'none', danger?, testId}` | 一行 · 复用偏好 / 通知 / 隐私三组 |
| `<TimezoneRow>` | frontend/packages/ui-kit | `{tz, onTap}` | `<SettingsItem>` 特化 · tap 出 ActionSheet 列表 |
| `<NotificationSwitchRow>` | frontend/packages/ui-kit | `{channel:'push'\|'email'\|'sms', value, onChange, disabled?}` | 51×31 iOS switch · `.switch.on` 绿底 |
| `<QuietHoursPickerSheet>` | frontend/packages/ui-kit | `{start, end, onConfirm}` | TimeWheel × 2 · 23:00 / 07:30 默认 |
| `<DangerActionRow>` | frontend/packages/ui-kit | `{title, onTap}` | 红字行 · tap 出二次确认 modal |
| `<TabBar>` | frontend/packages/ui-kit | `{activeTab:'me'}` | Tab 5 「我的」active 蓝色（mockup L258） |

来源：mockup 13_settings.html DOM 命名 + biz §2A.3.3 L327 Tab 5 + frontend/packages/ui-kit。

---

## §4 数据绑定 (Entity / DTO)

### 4.1 Page-level State 绑定

```typescript
{
  settings: {
    state: 'LOADING' | 'VIEW' | 'EDITING' | 'SAVING' | 'SAVED',
    tz: string,                              // IANA · e.g. 'Asia/Shanghai'
    locale: 'zh-CN' | 'en-US',
    theme: 'light' | 'dark' | 'auto',
    weekStart: 'mon' | 'sun',
    notifications: {
      push: boolean,
      email: boolean,
      wechat: boolean,                       // 微信订阅消息 (映射 mockup "短信通知" 槽)
      quietHours: { start: string, end: string } | null,  // 'HH:mm'
      reviewCadence: 'standard5' | 'aggressive' | 'gentle',
    },
    parentBinding: { linked: boolean, parentName?: string, bindingId?: number },
    observers: { count: number, hasActive: boolean },     // SC-15 摘要
    privacy: { faceIdEnabled: boolean, e2eeStatus: 'ENABLED' | 'DISABLED' },
    pendingPatch?: Partial<PreferencesReq>,   // EDITING 态暂存
    error?: { code: string, retryable: boolean }
  }
}
```

### 4.2 涉及的后端 Entity

- `user` (auth-service · id / email / role)
- `user_setting` (auth-service · timezone / locale / theme / week_start / notifications JSONB) — biz §2B.9 L1077 关键断言"只改 `user_setting.timezone` 这一条偏好"
- `parent_binding` (user-relation-service · student_id / parent_id / status) — SC-09 L1114 撤销校验源
- `observer_session` (observer-service · jti / role / status) — SC-15 L1329 撤销点
- 副作用 outbox：`user.tz.changed` topic → calendar-core 重算 review_node 的"用户本地呈现"快照（**DB ready_at UTC 不动** · biz §2B.9 L1076）

来源：biz §2A.4 等价数据描述（无 P13 §2A.4 卡 · 抽取自 SC-08/09/15 关键断言 + §9.1 L2040）。

---

## §5 API 触点

> 字符级精准 path + method · 主源是 biz §2B.9 步 3 `PATCH /api/me/preferences` (L1070) 与 §2A.6 US-07 `/me/preferences` (L634) · 本 spec 在缺 §2A.4 卡时**约定式落位** (spec'd · 待 phase-0 audit 复核 controller 字符级路径)。

| # | Method | Path | Headers (req) | Body (req) | Response | P95 预算 | 失败降级 |
|---|---|---|---|---|---|---|---|
| 1 | GET | `/api/preferences` | `X-User-Id`, `X-Request-Id` | — | `200 {tz, locale, theme, weekStart, notifications:{push,email,wechat,quietHours,reviewCadence}, parentBinding:{linked,parentName?}}` | ≤ 300ms | 5xx → 骨架屏 + Toast "稍后重试" · 留 LOADING |
| 2 | PATCH | `/api/preferences` | `X-User-Id`, `X-Idempotency-Key`, `X-Request-Id` | `{tz?, locale?, theme?, weekStart?, showReview?, notifications?:{push?,email?,wechat?,quietHours?,reviewCadence?}}` (subset · 仅传变动字段) | `200 {updated:[...keys], recalcJobId?:string}` (含 tz 时返 outbox jobId) | ≤ 400ms | 5xx → Toast "切换失败,稍后重试" + 保持原值 (TC-08.03) · 4xx → 字段级 inline error |
| 3 | POST | `/api/auth/logout` | `X-User-Id`, `X-Refresh-Token` | `{deviceId?}` | `204 No Content` | ≤ 200ms | 5xx → 仍清前端 token + 强制跳 P00 (fail-safe logout) |
| 4 | POST | `/api/me/unbind-parent` | `X-User-Id`, `X-Idempotency-Key` | `{bindingId, reason?:'STUDENT_INITIATED'}` | `200 {bindingId, status:'REVOKED', revokedAt}` | ≤ 400ms | 5xx → Toast "解绑失败" + 保持 `linked=true` · 后续 SC-09 share 行为按当前 binding 状态走 (L1114) |

**关联但跨页的 API**（在 P13 触发，详细 spec 在他处）：

- `POST /api/observer/invites` (生成邀请码) — biz §10.10 L2169 + §2B.16 L1317 · 详见 P-OBSERVER spec
- 撤销观察权 `DELETE /api/observer/sessions/{jti}` — biz §2B.16 L1329 · 详见 P-OBSERVER spec

来源：biz §2B.9 步 3 L1070 (PATCH) + §2A.6 US-07 L634 + §2A.7 L655 + §2B.10 L1114 (SC-09 校验) + §10.10 L2169 (相邻 API)。

---

## §6 状态机

```
        ┌─────────┐  GET /preferences      ┌──────────┐
        │ LOADING │────────────────────────→│  VIEW    │
        └─────────┘   200 OK                └────┬─────┘
              │                                  │ tap row / toggle switch
              │ 5xx                              ▼
              ▼                              ┌──────────┐
        ┌─────────┐                          │ EDITING  │
        │  ERROR  │                          │ (本地暂存│
        │ (retry) │                          │  pending│
        └─────────┘                          │  Patch) │
                                             └────┬─────┘
                                                  │ tap "完成" / switch 即时确认
                                                  ▼
        ┌─────────┐  PATCH 200             ┌──────────┐
        │  SAVED  │←──────── (含 tz 变动) ──│  SAVING  │
        │ (Toast) │                        │ (顶部蓝条│
        └────┬────┘                        │  "排期同│
             │ 2s 后回 VIEW                │  步中") │
             │                              └────┬─────┘
             ▼                                   │ 5xx
        ┌─────────┐                              ▼
        │  VIEW   │                         (回 EDITING + Toast)
        └─────────┘
```

### 6.1 状态转移规则

| From | To | Trigger | Side effect |
|---|---|---|---|
| (mount) | LOADING | route enter `pages/me/settings` | 起 GET `/api/preferences` |
| LOADING | VIEW | GET 200 | 渲染所有分组 |
| LOADING | ERROR | GET 5xx | 骨架屏 + 顶部 retry banner |
| VIEW | EDITING | tap row (chev) 或 toggle switch | 出 ActionSheet / Sheet · 写 `pendingPatch` |
| EDITING | SAVING | tap 「完成」(nav 右上) 或 switch 即时 commit | 起 PATCH `/api/preferences` · 顶部蓝条 "排期同步中"（含 tz 时） |
| SAVING | SAVED | PATCH 200 | Toast "已更新" · 2s 后回 VIEW · 触发 `user.tz.changed` outbox (含 tz 时) |
| SAVING | EDITING | PATCH 5xx | Toast "切换失败,稍后重试" · `pendingPatch` 保留 · 原值不动 (TC-08.03) |
| SAVED | VIEW | 2s timer 到 | Toast 消失 |
| VIEW | (路由) P00 | tap 「注销账户」二次确认 OR 「退出登录」(隐式 row) | POST `/api/auth/logout` · 清 token · 跳 P00 |
| VIEW | VIEW | tap 「解绑家长」二次确认 OK | POST `/api/me/unbind-parent` · `parentBinding.linked=false` · SC-09 share 后续 403 (L1114) |

来源：mockup 13_settings.html 「完成」按钮 (L108) + biz §2B.9 步 3 L1070 (tz.SAVING 态) + §2B.10 L1114 (解绑副作用)。

---

## §7 跳转

| 入口 | 来源 | 触发条件 |
|---|---|---|
| Tab 5 「我的」 | TabBar (P-HOME / P05 / P02 / P07 等任意 tab shell) | 学生 tap 底部 Tab 5 |
| 启动 SC-08 步 2 | splash 检测 tz 不一致 | 跳 P13 前弹系统级 Sheet (biz §2B.9 步 2 L1069 · `tz.ASK`) |
| 深链 | `wb://me` | 通用入口 (biz §2A.3 L237) |
| P12 设置入口 | 通知中心右上 | tap "管理通知偏好" → 直接锚定通知分组 |

| 出口 | 目标 | 触发条件 |
|---|---|---|
| 路由 push | P00 (`/auth`) | tap 「注销账户」二次确认 OR 隐式 「退出登录」· POST `/auth/logout` 后清 token |
| 路由 push | P10 (`/calendar/month`) | tap "我的日历" 行（隐式从 §9.1 L2040 推导）|
| 路由 push | P-OBSERVER 邀请管理 (`/me/observers`) | tap "家长绑定 / 观察者" 行 |
| 系统外联 | iOS 设置 | tap "Face ID 解锁" 关闭后弹 "去系统设置" |
| 系统下载 | Export `.ics` / `.json` | tap "数据导出" · GET 静态 URL |
| 路由 back | 来源页 (默认日历 / Tab) | tap nav 「< 日历」 |

来源：biz §2A.3 L237 (P13 路由) + §2A.3.3 L327 (Tab 5) + §2B.9 步 2 L1069 (SC-08 入口) + §9.1 L2040 (我的日历入口) + mockup 13_settings.html nav 返回 L107。

---

## §8 Wire format (SSE / WebSocket 事件)

本页**无 SSE/WS 通道**；所有事件通讯走 §5 HTTP 触点。

副作用上 PATCH `/api/preferences` 含 `tz` 时会触发后端 outbox topic `user.tz.changed`，calendar-core 异步消费重算"用户本地时间呈现"（DB `ready_at` UTC 不动 · biz §2B.9 L1076-L1078）。前端不直接订阅 MQ —— 通过下一次 GET `/api/home/today?tz={new}` 或 P10 `/calendar/events?month=&tz={new}` 隐式拿到重算后的呈现；UI 期间靠 PATCH 响应里的 `recalcJobId` + 顶部"排期同步中"提示条遮罩，2s 心跳轮询 GET `/api/preferences/recalc/{jobId}` (P1 · 当前 MVP 直接 timeout 后假定完成)。

---

## §9 异常 & 降级

| 异常 | 触发条件 | UI 反馈 | 系统行为 | 关联 TC |
|---|---|---|---|---|
| 时区切换正常 | splash 检测 tz_mismatch · 学生选 "切换到 LA" | Toast "时区已更新,正在重新计算你的排期..." + 顶部蓝条 "排期同步中" | PATCH `/api/preferences body{tz:'America/Los_Angeles'}` · 触发 outbox `user.tz.changed` · 下次 GET home/today 按新 tz 算 | TC-08.01 |
| 时区不一致 · 双层确认 | splash Sheet 用户选 "保留 Asia/Shanghai" | Sheet 关闭 · preferences 不变 · 下次登录仍提示 (biz §2B.9 TC-08.02) | 不调 PATCH · UI 仍按 SH 呈现 · 埋点 `tz_prompt_dismissed` | TC-08.02 |
| PATCH 5xx · tz 切换失败 | 步 3 PATCH 返 500 | Toast "切换失败,稍后重试" + 状态从 SAVING 回 EDITING · 原值不动 | 不触发 outbox · 埋点 `tz_change_fail` (biz §2B.9 L1087) | TC-08.03 |
| 推送 switch off | 学生关推送通知 toggle | switch 滑左 · 立即 PATCH `{notifications:{push:false}}` | 后续 reminder-svc 发推时按 `user_setting.notifications.push=false` 降级站内（biz §2A.7 L653 推送被拒同路径） | — |
| 免打扰时段 | 学生设 23:00-07:30 | TimeWheel sheet · 确认即时 commit | 后端按新 tz 计算"用户本地"判断推送守时（biz §2B.9 L1079）| US-07 |
| 解绑家长成功 | tap 解绑 + 二次确认 | Toast "已解绑" · row 切到"未绑定" | POST `/api/me/unbind-parent` · `parent_binding.status=REVOKED` · SC-09 后续家长 share 调用返 403 (L1114) | — (SC-09 TC-09.03 关联) |
| 撤销观察权 | 在子页 "观察者管理" tap 撤销 | 列表 row 切 "已撤销" | (跨页 API · 详 P-OBSERVER) JWT `jti` 进 Redis 黑名单 · 家长端下次请求 403 (L1329) | TC-15.04 |
| Logout 失败 (5xx) | 网络抖动 | Toast "退出中..." (≤ 2s) | **fail-safe**: 仍清前端 token + 跳 P00 · server-side session 由 TTL 自然过期 | — |
| 注销账户 | 红字 row tap | 二次确认 modal "此操作 30 天后生效,可撤回" | (P1) POST `/api/me/deletion-request` · 当前 MVP 跳支持页 | — |

来源：biz §2A.7 异常路径降级矩阵 L653-L655 + §2B.9 QA 用例表 L1085-L1087 (TC-08.01/02/03) + §2B.10 L1114 (SC-09 解绑校验) + §2B.16 L1329 (SC-15 撤销)。

---

## §10 验收点 (TC → AC 映射)

| TC ID | 类型 | GIVEN | WHEN | THEN | 关联 task AC |
|---|---|---|---|---|---|
| TC-08.01 | 边界 | 学生原 tz=SH · 当前设备 tz=LA · 进入 P13 时区行 | tap 时区 → 选 America/Los_Angeles → 「完成」| PATCH 200 · `user_setting.timezone=LA` · 顶部"排期同步中"出现 · P-HOME & P10 按 LA 呈现 · DB `wb_review_node.ready_at` UTC 不变 · 免打扰按 LA 算 | (待 SC-08 phase-0 落 task) |
| TC-08.02 | 边界 | 同上 · 但启动 Sheet 选 "保留 SH" | Sheet tap 保留 | preferences 不变 · 不进 P13 时区子页 · UI 按 SH 呈现 · 下次登录仍提示 · 埋点 `tz_prompt_dismissed` | (同上) |
| TC-08.03 | 异常 | 时区子页选 LA · 步 3 PATCH 返 500 | tap 「完成」/「切换」 | Toast "切换失败,稍后重试" · 状态回 EDITING · `user_setting.timezone` 保持原值 SH · 埋点 `tz_change_fail` | (同上) |
| TC-09.03 (关联) | 安全 | 学生在 P13 解绑家长 · 家长尝试分享事件 | 家长端 share | 后端 403 · 家长端 Toast "已不再绑定此学生" (biz §2B.10 L1122-L1123) | — (SC-09 主战场 P11) |
| TC-15.04 (关联) | 安全 | 学生在 P13 撤销观察权 · 观察者后续任意请求 | 任何 observer API | 网关 403 `OBSERVER_REVOKED` · 家长端跳 P-LANDING (biz §2B.16 L1345) | — (SC-15 主战场 P-OBSERVER) |

来源：biz §2B.9 QA 用例表 L1085-L1087 + §2B.10 TC-09.03 L1122 + §2B.16 TC-15.04 L1345。

---

## §11 性能预算

| 操作 | P95 budget | 来源 |
|---|---|---|
| P13 mount → GET `/api/preferences` 200 渲染 | ≤ 400ms | spec §5 #1 (类比 P-HOME 聚合 1.2s 目标 / 单接口 300ms) |
| Switch toggle 触感反馈 → switch 视觉切换 | ≤ 50ms | iOS HIG haptic light + CSS transition .2s (mockup L69) |
| PATCH `/api/preferences` (非 tz) | ≤ 400ms | spec §5 #2 + 类比 P11 PATCH 300ms |
| PATCH `/api/preferences` (含 tz) + outbox 投递 | ≤ 400ms (PATCH 同步) · 后台 recalc ≤ 30s (异步) | biz §2B.9 步 3-4 L1070-L1071 (Toast "正在重新计算") |
| Logout → P00 跳转 | ≤ 500ms | 类比 P00 → P-HOME 500ms · POST `/auth/logout` ≤ 200ms |
| Unbind parent | ≤ 400ms | spec §5 #4 |
| 顶部"排期同步中"蓝条 hold 时长上限 | ≤ 30s 后强制清 (P1: 改 jobId poll) | biz §2B.9 步 4 默认值（无严格上限,业务容忍 30s 内 home 数字短暂不一致） |

来源：biz §2B.9 步 3-4 + spec §5 行级 budget + iOS HIG。

---

## §12 埋点事件

| Event name | When | Properties | 来源 |
|---|---|---|---|
| `settings_view` | P13 mount | `{from:'tab'\|'splash-tz-ask'\|'deeplink'\|'p12'}` | biz §2A.8 (推导 · §2A.4 卡缺) |
| `tz_prompt_shown` | splash 检测 tz_mismatch 弹 Sheet | `{from, to}` | biz §2B.9 步 2 L1069 |
| `tz_changed` | PATCH 200 含 tz 变动 | `{from, to, recalcJobId}` | biz §2B.9 步 3 L1070 |
| `tz_change_fail` | PATCH 5xx | `{from, to, errorCode}` | biz §2B.9 TC-08.03 L1087 |
| `tz_prompt_dismissed` | splash Sheet 选 "保留" | `{kept_tz, detected_tz}` | biz §2B.9 TC-08.02 L1086 |
| `notif_pref_changed` | 通知 switch toggle / 免打扰确认 | `{channel:'push'\|'email'\|'wechat'\|'quiet'\|'cadence', value}` | biz §2A.6 US-07 L634 |
| `parent_unbind` | 解绑家长成功 | `{bindingId}` | biz §2B.10 L1114 |
| `obs_revoked_by_student` | 在子页撤销观察权 | `{jti_hash, role}` | biz §2B.16 L1329 |
| `auth_logout` | tap 退出登录 · POST /logout 200 | `{deviceId, session_age_min}` | biz §2A.3 登录态决策树 (隐式) |

来源：biz §2A.8 埋点字典格式 + §2B.9 / §2B.10 / §2B.16 各 SC 卡埋点列。

---

## §13 testid 表

| testid | 用途 | 出现位置 (mockup / testids) | E2E 引用 |
|---|---|---|---|
| `p13-root` | P13 页面根 | testids.ts L293 + 待 mockup 补 `data-testid` | 待 SC-08 phase-0 e2e |
| `p13-avatar-block` | Profile 卡 | testids.ts L294 · mockup `.profile` L116 | — |
| `p13-avatar-block-name` | 姓名行 | testids.ts L295 · mockup `.profile .name` L119 | — |
| `p13-settings-account` | 账户分组锚 | testids.ts L296 · 偏好设置 group L130 | — |
| `p13-settings-account-logout-row` | 退出登录 row | testids.ts L297 · (mockup 当前无显式 logout · 通过隐私分组的 "退出登录" 补) | — |
| `p13-settings-review` | 复习偏好（含记忆曲线 / 免打扰）| testids.ts L298 · 通知 group L162 | — |
| `p13-settings-review-quiet-hours-row` | 免打扰时段 row | testids.ts L299 · mockup L181-L186 | — |
| `p13-settings-push` | 推送通知 group 锚 | testids.ts L300 | — |
| `p13-settings-push-review-reminder-switch` | 推送复习提醒 switch | testids.ts L301 · mockup L165-L169 | — |
| `p13-settings-push-frequency-preview` | 节奏预览 | testids.ts L302 · 记忆曲线节奏 row L187-L192 | — |
| `p13-settings-privacy` | 隐私分组锚 | testids.ts L303 · mockup L197 | — |
| `p13-settings-about` | 关于分组锚 | testids.ts L304 · mockup L226 | — |
| `p13-settings-about-version` | 版本行 | testids.ts L305 · mockup L229-L233 | — |
| `p13-danger-zone` | 危险区块锚 | testids.ts L306 · mockup L217 (注销) | — |
| `p13-danger-zone-account-deletion-btn` | 注销账户按钮 | testids.ts L307 · mockup `.item` L217-L222 红字 | — |
| `p13-danger-confirm` | 注销二次确认 modal | testids.ts L308 | — |
| `p13-sc16-ai-section` | SC-16 VIP AI 区（条件渲染）| testids.ts L310 · data-sc16-tier=NORMAL\|VIP\|VIP_PLUS · mockup 当前未呈现 | (SC-16 引入时补) |
| `p13-sc16-upgrade-hint` | NORMAL 升级提示 | testids.ts L311 | — |
| `p13-sc16-model-selector` | VIP / VIP_PLUS 模型选择 radiogroup | testids.ts L312 | — |

来源：frontend/packages/testids/src/index.ts L292-L315 (`TEST_IDS.p13.*` 命名空间) + mockup 13_settings.html DOM 锚（mockup 当前无 `data-testid` 属性 · 实施时需在 HTML 补 attr 与 testids 包对齐）。

---

## §14 i18n key

| Key | 中文 | 英文 | 用途 |
|---|---|---|---|
| `settings.title` | 设置 | Settings | nav 大标题 (mockup L110) |
| `settings.nav.back` | 日历 | Calendar | nav 返回按钮 (mockup L107) |
| `settings.nav.done` | 完成 | Done | nav 右上 (mockup L108) |
| `settings.group.preferences` | 偏好设置 | Preferences | mockup L131 |
| `settings.group.notifications` | 通知与提醒 | Notifications & Reminders | mockup L163 |
| `settings.group.privacy` | 隐私与账户 | Privacy & Account | mockup L198 |
| `settings.group.about` | 关于 | About | mockup L227 |
| `settings.tz.row` | 时区 | Time Zone | mockup L135 |
| `settings.tz.sheet.prompt` | 检测到你在{city}。要把时区切换过去吗？| Detected you're in {city}. Switch time zone? | biz §2B.9 步 2 L1069 |
| `settings.tz.sheet.keep` | 保留 {tz} | Keep {tz} | biz §2B.9 步 2 |
| `settings.tz.sheet.switch` | 切换到 {tz} | Switch to {tz} | biz §2B.9 步 2 |
| `settings.tz.toast.saving` | 时区已更新,正在重新计算你的排期... | Time zone updated. Recomputing schedule... | biz §2B.9 步 3 L1070 |
| `settings.tz.toast.fail` | 切换失败,稍后重试 | Switch failed. Try again later. | biz §2B.9 TC-08.03 L1087 |
| `settings.tz.note` | 所有时间以 UTC 存储,按此时区在前端渲染。跨时区旅行时自动切换显示。| All times stored in UTC, rendered in this time zone. Auto-switch when traveling. | mockup L158 |
| `settings.notif.push` | 推送通知 | Push Notifications | mockup L167 |
| `settings.notif.email` | 邮件通知 | Email Notifications | mockup L172 |
| `settings.notif.sms` | 短信通知 | SMS Notifications | mockup L177 |
| `settings.notif.sms.unbound` | 未绑定手机 | Phone not bound | mockup L178 |
| `settings.notif.quiet` | 免打扰时段 | Do Not Disturb | mockup L183 |
| `settings.notif.cadence` | 记忆曲线节奏 | Memory Curve Cadence | mockup L189 |
| `settings.privacy.faceid` | Face ID 解锁 | Face ID Unlock | mockup L202 |
| `settings.privacy.e2ee` | 端到端加密 | End-to-End Encryption | mockup L207 |
| `settings.privacy.export` | 数据导出 | Export Data | mockup L213 |
| `settings.privacy.delete` | 注销账户 | Delete Account | mockup L219 |
| `settings.about.version` | 版本 | Version | mockup L231 |
| `settings.about.tos` | 服务条款与隐私政策 | Terms of Service & Privacy Policy | mockup L236 |
| `settings.unbind.confirm.title` | 解绑家长？ | Unbind Parent? | biz §2B.10 L1114 |
| `settings.logout.confirm.title` | 退出登录？ | Sign Out? | (派生 · biz §2A.3 登录态决策树) |

来源：mockup 13_settings.html 视觉文案 + biz §2B.9 SC-08 Sheet 文案 L1069-L1070 + §2B.10 L1114。

---

## §15 关联与影响

- **上游 spec**: P00 (登出后回落点) · P-HOME (Tab 5 入口 · biz §2A.3.3 L327) · P12 (通知中心右上"管理偏好"链入)
- **下游 spec**: P09 (`+加入日历` · 复用 P13 的 `tz`/`weekStart` 偏好) · P10 (月视图按 `weekStart` + `tz` 渲染) · P11 (事件详情按 `tz` 显示开始时间) · P-OBSERVER (邀请管理 / 撤销子页)
- **关联 SC**: **SC-08 跨时区登录→日历重算** (主源 · biz §2B.9 L1058-L1088) · SC-09 家长分享 (前置绑定校验 L1114) · SC-15 观察者会话 (撤销点 L1329) · US-07 免打扰承诺 (L634)
- **关联 task**: 暂无 (P13 无独立 §2A.4 卡 · 不是 SC 主战场 · 在 SC-08 phase-0 落第一批 task 时引入 `T??-tz-recalc` / `T??-preferences-patch` / `T??-unbind-parent`)
- **关联 audit**: 暂无（待 SC-08 phase-0 落 `audits/SC-08-PHASE-0/A0X-user-preferences.md` 校 PATCH `/api/preferences` 字符级路径 + outbox topic）
- **关联 mockup**: design/mockups/wrongbook/13_settings.html (HIG grouped list)
- **副作用通道**: `user.tz.changed` outbox topic → calendar-core 异步重算 review_node 用户本地呈现快照 (DB UTC 不动 · biz §2B.9 L1076-L1078) · 影响 P-HOME `/home/today` 与 P10 `/calendar/events?month=&tz=` 下次拉取结果
- **跨页一致性约束**: P-HOME / P10 / P11 / P12 渲染时一律读 `user_setting.timezone` + `weekStart` 作为时间格式化上下文；切换 tz 后这些页若已 mount，须订阅 preferences 变更（前端 store）或下次 navigate 时刷新

