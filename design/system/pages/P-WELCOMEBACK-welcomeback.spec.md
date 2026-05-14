# P-WELCOMEBACK · 回流唤起（WelcomeBack）

**Status**: P1 · MVP 范围外（P0 决策树节点 3 按"未命中"降级 P-LANDING，本页不渲染；P1 阶段启用 `account_device` 软绑定后才上线）
**Owner**: design + frontend (bootstrap/resolve-entry) + backend (anonymous-service · auth-service)
**Last-updated**: 2026-05-14
**Mockup (canonical)**: `design/mockups/wrongbook/17_welcomeback.html`
**Biz refs**: biz §2A.3.1 登录态决策树（节点 3）+ biz §2A.3.2 P-WELCOMEBACK 规格卡（L419-431）+ biz §2B.15 SC-14（L1277-1310）+ biz §4.13 account_device DDL（L1697-1716）+ biz §10.6 / §10.11 API 定义（L2105-2116 / L2189-2196）
**Related tasks**: feature_list.json SC-14（P1 阶段 · 当前尚未在 MVP feature_list 落地 · 占位待补）

> ⚠️ **范围声明**：本 spec 描述 P1 阶段的目标契约，**不阻塞 SC-01..SC-10 MVP 上线**。P0 期间前端 `bootstrap/resolve-entry.ts` 在节点 3 命中时**直接降级 P-LANDING**（biz §2A.3.1 节点 3 备注："P1；P0 先按未命中处理"）；本页代码、testid 常量、E2E 用例均**不在 MVP 验收范围**。

---

## §1 页面目的

P-WELCOMEBACK 是登录态决策树**节点 3**（设备指纹软绑定命中）的专属落位页，针对"曾登录 ≥ 7 天未活跃 + 当前无合法 JWT"的回流用户。三秒注意力窗口内告诉学生：① 我们认出了你这台设备（眼熟感）；② 你的账号还在，还剩 N 个节点待复习（回归动力 / 损失厌恶）；③ 不用重输手机号 —— 一键 OAuth 即可接续（摩擦最低化）。

它**不替代 P00 登录** —— 设备指纹仅用于"识别 + 提示"，**绝不自动签发 JWT**（合规要求 · 未成年人保护风控）。用户必须主动 tap「一键回登」完成 OAuth 第二因子后才进 P-HOME。

---

## §2 布局分区 + Wireframe

### 2.1 布局分区（来源：biz §2A.3.2 + 17_welcomeback.html 视觉真相）

```
┌────────────────────────────────────────┐
│ statusbar (54px · 白字 on 暖夕阳渐变)    │
├────────────────────────────────────────┤
│ anon-nav (62px)                        │
│   · back (× 关闭) · brand chip         │
│   · device-fp chip "FP · a4c9…7e21"    │
├────────────────────────────────────────┤
│ HERO Zone (360px · 暖夕阳渐变 hero)     │
│   · eyebrow "识别到你熟悉的设备"        │
│   · title "好久不见，你的复习曲线还在等你" │
│   · sub "还剩 12 个节点 · 最长延迟 5 天"  │
│   · last-seen chip (Allen · 高二 · 40 天前) │
├────────────────────────────────────────┤
│ SCROLL Body (底部 180px padding)        │
│   · Pending Hero Card                  │
│     - 12 个待复习 / 60% 遗忘风险 donut  │
│     - 学科 breakdown (数 7 · 物 3 · 英 2) │
│   · Progress Stripe (14 天缺席记录热图) │
│   · Top Pending QList (最需要复习的 3 题)│
├────────────────────────────────────────┤
│ CTA Dock (sticky bottom · 84px)         │
│   · primary 「一键回登 · 接续复习」      │
│   · secondary 「继续匿名浏览 · 不回登」  │
│   · hint "使用保存的微信/Apple ID"      │
├────────────────────────────────────────┤
│ home-bar (5px)                          │
└────────────────────────────────────────┘
```

**Shell**：匿名 Shell · **无 Tab Bar**（biz §2A.3.1 硬性规则 8）· 顶部仅 Logo + 右上无登录按钮（本页本身就是登录入口 · 用 brand chip 替代）。

### 2.2 关键视觉锚（17_welcomeback.html 真 selector · testid 见 §13）

| Zone | DOM selector / class | 用途 |
|---|---|---|
| 页面根 | `.phone` | 路由 outlet · anon-shell-outlet 子节点 |
| 顶部导航 | `.anon-nav` | back / brand / fingerprint chip |
| 关闭按钮 | `.anon-nav .back` (× 图标) | 用户主动放弃 → 降级 P-LANDING |
| Hero 区 | `.hero` + `.welcome` | 暖夕阳渐变 + 欢迎文案 |
| 上次活跃卡 | `.lastseen` | 显示脱敏 nick + 距今天数 |
| Pending 大卡 | `.pending` | donut + 学科 breakdown |
| 14 天热图 | `.calendar-strip` + `.cell` | 缺席记录可视化 |
| 题目列表项 | `.qitem` × N | 最需要复习的 3 题（脱敏 · 仅露题型 + 学科）|
| 主 CTA | `.cta-back` | 「一键回登」按钮（暖夕阳渐变）|
| 次 CTA | `.cta-keep` | 「继续匿名浏览」边框按钮 |

---

## §3 核心组件

| 组件 | 来源 | 接受 props | 说明 |
|---|---|---|---|
| `<WelcomeBackHero>` | frontend/packages/ui-kit/anon | `{nickFirstChar, daysSinceLastSeen, pendingCount}` | 暖夕阳渐变标题区 |
| `<AccountSummaryCard>` | ui-kit/anon | `{pendingCount, overdueCount, forgetRiskPct, subjectBreakdown[]}` | 12 个待复习 donut + 学科分布 |
| `<AbsenceCalendarStrip>` | ui-kit/anon | `{days: 14, cells: [{date, density}]}` | 14 天缺席热图（无登录格为 gap 斑马纹）|
| `<PendingQuestionList>` | ui-kit/anon | `{items: [{qid, subject, tLevel, overdueDays, stemFirstChars}]}` | 最需要复习的 3 题（题干前 12 字脱敏）|
| `<PrimaryOAuthCTA>` | ui-kit/anon | `{provider: 'wechat'\|'apple'\|'refresh', onLaunch}` | 一键回登按钮（暖渐变）|
| `<SwitchAccountLink>` | ui-kit/anon | `{onTap}` | 「换个账号登录」→ P00 |
| `<AutoExitTimer>` | ui-kit/anon | `{ttlSec: 60, onTimeout}` | 静默 60s 自动跳 P-LANDING（安全策略）|
| `<DeviceFpChip>` | ui-kit/anon | `{fpHash: string}` | 顶部 FP 哈希展示（透明度提示 · 让用户知道我们识别了什么）|

来源：biz §2A.3.2「核心组件」(WelcomeBackHero / AccountSummaryCard / PrimaryOAuthCTA / SwitchAccountLink / AutoExitTimer) + 17_welcomeback.html 真组件 + 匿名 Shell 规范。

---

## §4 数据绑定 (Entity / DTO)

### 4.1 Page-level State 绑定

```typescript
{
  welcomeback: {
    state: 'RECOGNIZING' | 'RECOGNIZED' | 'NOT_RECOGNIZED' | 'LOGGING_IN' | 'TIMEOUT',
    recognizedHint: {
      maskedUserId: string,       // 脱敏 student_id (前 4 + ****)
      maskedNick: string,         // "Allen" → "A***" (首字母 + 星号)
      lastSeenAt: ISO8601,        // 上次登录时间
      daysSinceLastSeen: number,  // 40 (天)
      pendingReviewCount: number, // 12
      overdueCount: number,       // 3 (其中已逾期)
      forgetRiskPct: number,      // 60 (donut 数字)
      subjectBreakdown: Array<{ subject: SubjectCode, count: number }>,
      topPendingPreview: Array<{  // ≤ 3 条 · 题干前 12 字 + 学科 + T 级
        qid: string,
        subject: SubjectCode,
        tLevel: 'T0'|'T1'|'T2'|'T3'|'T4'|'T5'|'T6',
        overdueDays: number,
        stemFirstChars: string,   // 前 12 字 · 不含图
      }>,
    } | null,
    ctaPrimary: 'quick-login',    // 主 CTA 一键回登
    ctaSecondary: 'manual-login', // 次 CTA 换账号 → P00
    autoExitAt: number,           // Date.now() + 60_000 · TIMEOUT 兜底
    error: 'DEVICE_MISMATCH' | 'STUDENT_DELETED' | 'MULTI_MATCH' | 'OAUTH_FAILED' | null,
  },
  device: {
    fp: string,                   // device fingerprint hash
    fpDisplay: string,            // "a4c9…7e21" (展示用 · 不全展)
    platform: 'H5' | 'MINIP' | 'IOS' | 'ANDROID',
  },
}
```

### 4.2 涉及的后端 Entity

- `account_device` (anonymous-service / auth-service · biz §4.13 · `student_id`/`device_fp`/`last_seen_at`/`login_count` · UNIQUE INDEX (student_id, device_fp))
- `student` (引用 · 只读 · 用于 `status=DELETED` 拦截 → 降级 P-LANDING)

**写时机**：仅 OAuth 成功（步 F05A）后 auth-service 才 INSERT/UPDATE `account_device`；P-WELCOMEBACK 本身**只读**该表（通过 `/session/resolve`）。

来源：biz §2A.3.2「数据绑定」+ biz §4.13 account_device DDL + biz §3.1 Student 聚合根（`account_device` 子实体）。

---

## §5 API 触点

> 字符级精准 path + method · 与 biz §10.6 / §10.11 字面一致。

| # | Method | Path | Headers (req) | Body (req) | Response | P95 预算 | 失败降级 |
|---|---|---|---|---|---|---|---|
| 1 | POST | `/api/session/resolve` | `X-Device-FP`（必填）· `X-Entry-Source` · `X-Request-Id` | `{deviceFp, entrySource, shareToken?, observerCode?}` | `200 {decision:"WELCOME_BACK", maskedAccount:{nickFirstChar, lastLoginAt, pendingReview}}` | ≤ 300ms (biz §2B.15 F01) | 5xx → 降级 P-LANDING（fallback：当作 fingerprint_matched=false） |
| 2 | POST | `/api/auth/device-refresh` | `X-Device-FP` · `X-Request-Id` | `{deviceFp, oauthProvider:"wechat"\|"apple", oauthPayload}` | `200 {jwt, student:{id,nick,...}}` | ≤ 500ms (biz §2B.15 F05A) | `403 DEVICE_MISMATCH` → 跳 P00 手动 · `410 STUDENT_DELETED` → 跳 P-LANDING |

**Spec 简写约定**（与 biz §10.6 一致 · 任务 brief 列的 `POST /api/anon/recognize` 是早期口语化命名 · 实际 endpoint 走 §10.6 `POST /api/session/resolve` · `decision="WELCOME_BACK"` 时 `maskedAccount` 含 `{nickFirstChar, lastLoginAt, pendingReview}`；任务 brief 的 `POST /api/auth/quick-login` 等价于 §10.11 `POST /api/auth/device-refresh`）。

**鉴权**：两个端点都走匿名网关 `AnonFilter`（不要求 JWT · 强制 `X-Device-FP` + 速率限制 · biz §10 鉴权总原则）。

**缓存**：`Cache-Control: no-store`（biz §2B.15 关键断言点 · 防止 masked_account 泄露给共用设备的他人）。

来源：biz §2A.3.2「API 触点」(高层 `POST /api/session/resolve` + `POST /api/auth/device-refresh`) + biz §10.6 / §10.11（字段级）+ biz §2B.15 F01/F04A/F05A（端到端编排）。

---

## §6 状态机

```
                   ┌─────────────┐  /session/resolve 200    ┌──────────────┐
   (entry) ───────►│ RECOGNIZING │─────────────────────────►│ RECOGNIZED   │
                   └──────┬──────┘  decision=WELCOME_BACK    └──────┬───────┘
                          │                                          │
                          │ decision ≠ WELCOME_BACK                  │ tap「一键回登」
                          │ (LANDING / LOGIN)                        ▼
                          ▼                              ┌──────────────────┐
                   ┌──────────────────┐                  │ LOGGING_IN       │
                   │ NOT_RECOGNIZED   │                  │ (OAuth 浮层)     │
                   │ → 路由 P-LANDING │                  └──────┬───────────┘
                   └──────────────────┘                         │
                                                                │ /device-refresh 200
                          ┌─────────────┐  60s 静默             ▼
                          │ TIMEOUT     │◄──── (任何状态)──►   (jwt 签发)
                          │ → P-LANDING │                       │
                          └─────────────┘                       ▼
                                                      ┌──────────────────┐
                                                      │ 路由 push P-HOME │
                                                      └──────────────────┘
```

### 6.1 状态转移规则

| From | To | Trigger | Side effect |
|---|---|---|---|
| (entry) | RECOGNIZING | bootstrap mount + 决策树落位本页 | 调 `/session/resolve` · 启 60s AutoExitTimer · 埋点 `anon_welcomeback_resolve{ms}` |
| RECOGNIZING | RECOGNIZED | resolve 200 + `decision="WELCOME_BACK"` | 渲染 maskedAccount + 学科 breakdown · 埋点 `anon_welcomeback_view{elapsed_days}` |
| RECOGNIZING | NOT_RECOGNIZED | resolve 200 + `decision ≠ "WELCOME_BACK"` / resolve 5xx | 立即路由 replace → P-LANDING（不留历史 · 防回退）|
| RECOGNIZED | LOGGING_IN | tap 主 CTA「一键回登」 | 弹 OAuth 浮层 · 埋点 `anon_welcomeback_oauth_launch` |
| LOGGING_IN | (P-HOME) | `/auth/device-refresh` 200 | 持久化 JWT · MQ 发 `user.returned` · 路由 replace → P-HOME · 埋点 `anon_welcomeback_oauth_success{elapsed_days}` |
| LOGGING_IN | RECOGNIZED | OAuth cancel / 403 / 410 | 关浮层 · 顶部 toast · 错误码细分降级（见 §9）|
| RECOGNIZED | (P00) | tap 次 CTA「换个账号登录」 | 清 device_fp 软绑定提示 · 路由 push → P00 · 埋点 `anon_welcomeback_switch_account` |
| RECOGNIZED | (P00) | tap 次 CTA「继续匿名浏览」（mockup 文案）| 兼容 mockup 文案 · 行为等价 SwitchAccount · 跳 P-LANDING |
| 任意 | TIMEOUT | 60s 无操作 | 路由 replace → P-LANDING · 埋点 `anon_welcomeback_timeout` · **不保留** maskedAccount（防泄露）|

来源：biz §2A.3.2「状态集」(`LOADING / READY / DEVICE_MISMATCH / STUDENT_DELETED`) + biz §2B.15 F01-F06A 编排 + biz §2A.3.1 节点 3 「不自动完成登录」硬性规则。

---

## §7 跳转

| 入口 | 来源 | 触发条件 |
|---|---|---|
| 冷启动决策树 | `bootstrap/resolve-entry.ts` | 节点 3 命中（`device_fp` 在 `account_device` 软绑定 · 无合法 JWT · 上次登录 ≥ 7 天）|
| 深链回流 | `wb://welcome-back` | P1 阶段开放（P0 阶段保留路径但不渲染 · 直跳 P-LANDING）|

| 出口 | 目标 | 触发条件 |
|---|---|---|
| 路由 replace | P-HOME (`/`) | `/auth/device-refresh` 200 + JWT 落本地存储 + Toast「欢迎回来！今天有 N 题待复习」|
| 路由 replace | P-LANDING (`/landing`) | NOT_RECOGNIZED / TIMEOUT / `/session/resolve` 5xx / `STUDENT_DELETED` |
| 路由 push | P00 (`/auth`) | tap 次 CTA「换个账号登录」 / OAuth 失败手动兜底 / `DEVICE_MISMATCH` / `MULTI_MATCH`（多账号歧义降级选择）|

**硬性规则**：
- 出口跳 P-LANDING / P-HOME 必须用 `replace`（不留历史）—— 防回退键再次进入本页泄露 maskedAccount。
- TIMEOUT / NOT_RECOGNIZED 路径**不得**保留 maskedAccount 在内存 · React unmount 时清状态。

来源：biz §2A.3.2「跳转」+ biz §2A.3.1 决策树节点 3 + biz §2B.15 F04B/F04C 分支。

---

## §8 Wire format (SSE / WebSocket 事件)

本页**无 SSE/WS 通道**，事件通讯全部走 §5 HTTP 触点（两次同步 POST）。

OAuth 浮层若用第三方 SDK（微信 `wx.login` / Apple Sign-In）属于 SDK 内部通讯 · 不在本 spec wire format 范围 · 仅最终 `oauthPayload` 透传后端。

---

## §9 异常 & 降级

| 异常 | 触发条件 | UI 反馈 | 系统行为 | 关联 TC |
|---|---|---|---|---|
| 设备指纹无匹配 | `/session/resolve` 返回 `decision ≠ "WELCOME_BACK"` | 不渲染本页 | 路由 `replace` → P-LANDING（不闪屏 · 不留历史）| TC-14.03 |
| 多账号歧义 | 同一 `device_fp` 命中 ≥ 2 个 `student_id` | 后端在 resolve 阶段直接返 `decision="LOGIN"` | 跳 P00 + 列表展示 ≥ 2 个脱敏账号供选择 | TC-14.02 |
| 学生被删除 | `/auth/device-refresh` 410 `STUDENT_DELETED` | Toast「账号已注销 · 重新注册」 | 路由 `replace` → P-LANDING | — (biz §2A.3.2 状态集 STUDENT_DELETED) |
| OAuth 失败 / 取消 | `/auth/device-refresh` 5xx / 403 / 用户关闭浮层 | 顶部错误 banner「回登失败 · 请手动登录」 | 跳 P00（手动登录兜底）· 保留 device_fp 上下文 | — |
| 设备指纹不匹配 | `/auth/device-refresh` 403 `DEVICE_MISMATCH` | Toast「设备信息变更 · 请重新登录」 | 跳 P00 · 清 device_fp 软绑定提示 | — |
| 静默 60s 超时 | AutoExitTimer 触发 | 不弹任何 modal（防泄露 · 安全策略）| 路由 `replace` → P-LANDING · 埋点 `anon_welcomeback_timeout` | TC-14.04 |
| 未成年人保护 | 后端识别 `student.role=MINOR` | maskedAccount 字段不下发细节 | 仅露"有账号可恢复"通用文案 · CTA 不变 | — (biz §4.13 设计要点 3) |
| `/session/resolve` 5xx | 后端 anonymous-service down | 不渲染本页 | 路由 `replace` → P-LANDING（fallback 当作 NOT_RECOGNIZED）| — |

来源：biz §2A.3.2「跳转」+「状态集」+ biz §2B.15 关键断言点 + biz §4.13 设计要点 + biz §10.11 错误码。

---

## §10 验收点 (TC → AC 映射)

| TC ID | 类型 | GIVEN | WHEN | THEN | 关联 task AC |
|---|---|---|---|---|---|
| TC-14.01 | 正常 | 流失 30 天 · 指纹唯一命中 · 未持有合法 JWT | 完整走 SC-14 F01-F06A（resolve → 渲染 → tap 一键回登 → OAuth 成功）| 2 秒内进入 P-HOME · Toast「欢迎回来！今天有 14 题待复习」· JWT 正常签发 · `account_device.last_seen_at`/`login_count` 更新 | （P1 阶段 task 待补 · 占位）|
| TC-14.02 | 异常 | 指纹命中 2 个 `student_id` | F01 调 `/session/resolve` | 后端返 `decision="LOGIN"` · 降级 P00 · 列表展示 2 个脱敏账号供选择 | — |
| TC-14.03 | 边界 | 设备从未登录过（`account_device` 无记录）| F01 调 `/session/resolve` | `decision="LANDING"` · 节点 3 未命中 → 降级 P-LANDING（**本 spec 不渲染**）| — |
| TC-14.04 | 安全 | 他人拿到本机停留 60s 无操作 | AutoExitTimer 到期 | 自动跳 P-LANDING · **不**泄露 `maskedAccount` 任何字段 · 回退键**不**可回到 P-WELCOMEBACK（路由 replace）| — |

来源：biz §2B.15 QA 用例表 TC-14.01..04（L1304-1310）+ biz §2A.3.2「合规要求」+ §2A.3.1 节点 3 硬性规则。

---

## §11 性能预算

| 操作 | P95 budget | 来源 |
|---|---|---|
| `/session/resolve` 返回（resolve → maskedAccount 拿到）| ≤ 300ms | biz §2B.15 F01 时延预算 |
| RECOGNIZING → RECOGNIZED 渲染（含 donut 动画首帧）| ≤ 100ms | spec §6 状态机 · 视觉响应预算 |
| OAuth 浮层弹出 | ≤ 200ms | biz §1.5 「3 秒注意力黄金窗」分摊 |
| `/auth/device-refresh` 返回 → JWT 签发 | ≤ 500ms | biz §2B.15 F05A 时延预算 |
| RECOGNIZED → P-HOME 跳转（路由 replace + Toast）| ≤ 300ms | biz §10.11 + UX 路由切换预算 |
| 端到端：冷启动 → P-HOME（成功路径 P95）| ≤ 2s | biz §2B.15 TC-14.01「2 秒内进入 P-HOME」 |

来源：biz §2B.15 时延预算列 + biz §10.11 API 预算。

---

## §12 埋点事件

| Event name | When | Properties | 来源 |
|---|---|---|---|
| `anon_welcomeback_resolve` | `/session/resolve` 返回 | `{ms, decision, fingerprint_matched, device_fp_hash}` | biz §2B.15 F01 |
| `anon_welcomeback_view` | RECOGNIZED 渲染（页面 mount + 数据到位）| `{elapsed_days, pending_count, overdue_count, device_fp_hash, entry_source, experiment_bucket}` | biz §2A.3.2「埋点事件」+ biz §2B.15 F02 |
| `anon_welcomeback_oauth_launch` | tap 主 CTA「一键回登」 | `{provider: 'wechat'\|'apple'\|'refresh', device_fp_hash}` | biz §2B.15 F04A |
| `anon_welcomeback_oauth_success` | `/auth/device-refresh` 200 | `{elapsed_days, ms, provider, device_fp_hash}` | biz §2A.3.2 + biz §2B.15 F05A |
| `anon_welcomeback_oauth_fail` | OAuth 失败 / 403 / 410 | `{error_code, provider, device_fp_hash}` | biz §2A.3.2（衍生）|
| `anon_welcomeback_switch_account` | tap 次 CTA「换个账号登录」 | `{device_fp_hash}` | biz §2A.3.2 + biz §2B.15 F04B |
| `anon_welcomeback_timeout` | AutoExitTimer 到期（60s 静默）| `{device_fp_hash}` | biz §2A.3.2 + biz §2B.15 F04C |

**通用属性**（所有 `anon_*` 事件 · biz §2A.3.2 Shell 规范）：`device_fp`（哈希 · 不全展）· `entry_source`（`cold-start`/`deeplink`/`share`）· `experiment_bucket`（A/B）。

来源：biz §2A.3.2「埋点事件」+ biz §2B.15 编排列「埋点」+ biz §2A.3.2 匿名 Shell 规范。

---

## §13 testid 表

> ⚠️ **当前状态**：`frontend/packages/testids/src/index.ts` **尚未** 定义 `TEST_IDS.welcomeback.*` 命名空间（grep 验证 · 2026-05-14）。本表为 P1 阶段实施时的**约定契约**，建议命名空间 `TEST_IDS.welcomeback`（与 `pLanding` / `pShared` / `anonShell` 风格一致）。MVP 阶段**不强制**落地。

| testid | 用途 | 出现位置 (mockup 17_welcomeback.html) | 备注 |
|---|---|---|---|
| `welcomeback-root` | P-WELCOMEBACK 页面根 | `.phone` outlet 子 | E2E mount 锚 |
| `welcomeback-anon-nav` | 顶部 anon-nav 容器 | `.anon-nav` | — |
| `welcomeback-back-btn` | × 关闭按钮（退出本页）| `.anon-nav .back` | 触发 NOT_RECOGNIZED 等价行为（手动跳 P-LANDING）|
| `welcomeback-device-fp-chip` | 设备指纹哈希显示 chip | `.fp` (`FP · a4c9…7e21`) | 透明度提示 |
| `welcomeback-hero` | Hero 渐变区根 | `.hero` + `.welcome` | 视觉锚 |
| `welcomeback-hero-title` | 主标题"好久不见..." | `.welcome .title` | — |
| `welcomeback-last-seen-chip` | 上次活跃信息卡 | `.lastseen` | 含脱敏 nick + 距今天数 |
| `welcomeback-pending-card` | Pending 大卡 | `.pending` | donut + breakdown |
| `welcomeback-pending-count` | "12 个" 大数字 | `.pending .l .big` | E2E 断言 pendingReviewCount |
| `welcomeback-overdue-text` | "其中 3 个已逾期" 红字 | `.pending .l .sub span` | E2E 断言 overdueCount |
| `welcomeback-forget-risk-donut` | 60% 遗忘风险 donut | `.pending .donut` | — |
| `welcomeback-subject-breakdown` | 学科分布 3 chip 容器 | `.pending .breakdown` | E2E 遍历断言 subjectBreakdown |
| `welcomeback-subject-chip-math` | 数学 chip | `.sub-chip:nth-child(1)` | 与 `subject-chip-math` 全局规范保持一致考虑 |
| `welcomeback-absence-strip` | 14 天缺席热图 | `.calendar-strip` | — |
| `welcomeback-qlist` | 最需要复习的 3 题列表容器 | scroll 内 `.qitem` 父 | E2E 断言 topPendingPreview |
| `welcomeback-qlist-item-{1..3}` | 单题预览 item（动态）| `.qitem` × N | 动态 testid（建议 helper `welcomebackIds.qlistItem(n)`）|
| `welcomeback-cta-primary` | 主 CTA「一键回登 · 接续复习」 | `.cta-back` | 触发 LOGGING_IN |
| `welcomeback-cta-secondary` | 次 CTA「继续匿名浏览」/「换个账号」 | `.cta-keep` | 触发 SwitchAccount → P00/P-LANDING |
| `welcomeback-cta-hint` | 底部提示「使用保存的微信/Apple ID」 | `.cta-hint` | — |
| `welcomeback-oauth-modal` | OAuth 浮层 sheet | (新增 · mockup 未画) | LOGGING_IN 状态可见 |
| `welcomeback-error-banner` | 顶部错误 banner | (新增 · mockup 未画) | OAuth 失败时显示 |

来源：17_welcomeback.html DOM grep（mockup 真视觉锚）+ 风格对齐 `TEST_IDS.pLanding` / `pShared` / `anonShell`（frontend/packages/testids/src/index.ts L367-402）。

---

## §14 i18n key

| Key | 中文 | 英文 | 用途 |
|---|---|---|---|
| `welcomeback.eyebrow` | 识别到你熟悉的设备 | Familiar device detected | Hero eyebrow chip |
| `welcomeback.title` | 好久不见，你的复习曲线还在等你 | Long time no see, your curve is waiting | 主标题 |
| `welcomeback.sub` | 我们通过设备指纹发现你是这个账户的主人。还剩 {pending} 个节点待复习，最长已延迟 {maxDelay} 天 | We found you via device fingerprint. {pending} nodes pending, max delay {maxDelay} days | 副标题（带变量插值）|
| `welcomeback.lastseen.label` | 上次活跃 · Last Seen | Last Seen | 上次活跃卡 label |
| `welcomeback.lastseen.value` | {nick} · {grade} · {date}（{days} 天前） | {nick} · {grade} · {date} ({days} days ago) | 上次活跃卡 value |
| `welcomeback.pending.label` | 待复习节点 | Pending review nodes | Pending 大卡 eyebrow |
| `welcomeback.pending.overdue` | 其中 {n} 个已逾期 · 最早 {date} | {n} overdue · since {date} | 副信息 |
| `welcomeback.donut.label` | 遗忘风险 | Forget risk | donut 中心 label |
| `welcomeback.absence.title` | 最近 14 天 · 复习缺席记录 | Last 14 days · Absence | progress 卡标题 |
| `welcomeback.qlist.title` | 最需要复习的 3 题 | Top 3 to review | qlist 标题 |
| `welcomeback.qlist.more` | 共 {total} 题 → | {total} total → | qlist more 链接 |
| `welcomeback.cta.primary` | 一键回登 · 接续复习 | Resume in one tap | 主 CTA |
| `welcomeback.cta.secondary` | 换个账号登录 | Switch account | 次 CTA（biz 文案）|
| `welcomeback.cta.hint` | 回登将使用保存的微信 / Apple ID · 不会泄露隐私 | Uses your saved WeChat/Apple ID · Privacy safe | 底部 hint |
| `welcomeback.error.deviceMismatch` | 设备信息变更 · 请重新登录 | Device changed · Please re-login | 错误 toast |
| `welcomeback.error.studentDeleted` | 账号已注销 · 重新注册 | Account deleted · Sign up again | 错误 toast |
| `welcomeback.error.oauthFailed` | 回登失败 · 请手动登录 | Resume failed · Manual login | 错误 banner |
| `welcomeback.toast.success` | 欢迎回来！今天有 {n} 题待复习 | Welcome back! {n} reviews today | 跳 P-HOME 后 Toast |

来源：biz §2A.3.2 + 17_welcomeback.html 文案 grep + biz §2B.15 F06A Toast 文案。

---

## §15 关联与影响

- **上游入口**：冷启动 / 深链 → `bootstrap/resolve-entry.ts` → 决策树节点 3 命中（biz §2A.3.1）
- **下游 spec**：
  - 成功路径 → `P-HOME.spec.md`（一键回登成功 · 顶部 Toast 欢迎回来）
  - 无匹配 / 超时 → `P-LANDING.spec.md`（待生成 · SC-11）
  - 手动登录兜底 → `P00.spec.md`（待生成 · OAuth 失败 / 多账号歧义 / 换账号）
- **关联 SC**：
  - biz §2B.15 SC-14（主源 · 流失用户回流 → 一键回登 → 进 P-HOME · P1）
  - biz §2A.3.1 决策树（节点 3 落位）
- **关联 task**：feature_list.json SC-14（**P1 阶段 · 当前尚未在 MVP feature_list.json 拆分** · 占位待补 · 至少应包含 `welcomeback-resolve` / `welcomeback-render` / `welcomeback-oauth-launch` / `welcomeback-device-refresh` / `welcomeback-timeout-exit` 5 个 task 节点）
- **关联 DDL**：biz §4.13 `account_device` 表（V20260421_02 Flyway 迁移 · biz §12 S1 / L33）
- **关联 audit**：（P1 阶段待补 · 建议 `audits/SC-14-PHASE-0/A0X-session-resolve.md` + `A0X-device-refresh.md` 字符级核对）
- **关联 mockup**：design/mockups/wrongbook/17_welcomeback.html
- **后端载体**：
  - `anonymous-service` · `POST /api/session/resolve`（biz §10.6）
  - `auth-service` · `POST /api/auth/device-refresh`（biz §10.11）
  - `AnonFilter`（网关 · biz §10 鉴权总原则）
- **MQ 事件**：`user.returned{student_id, elapsed_days}`（biz §2B.15 F05A · 下游可订阅做"回流欢迎礼包"等运营动作 · 不阻塞登录主链路）
- **范围红线**：本 spec **不替代** P00 登录页 · 不绕过 OAuth · 不自动签发 JWT（biz §2A.3.1 节点 3 硬性规则 + §4.13 设计要点 1：「仅登录成功后才写此表，不在匿名态写」）。
