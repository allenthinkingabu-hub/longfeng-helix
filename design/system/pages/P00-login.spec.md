# P00 · 启动 / 登录（Auth · Login & Signup）

**Status**: Active
**Owner**: design + frontend + backend (auth-service · anonymous-service · 计划中)
**Last-updated**: 2026-05-14
**Mockup (canonical)**: `design/mockups/wrongbook/00_login.html`
**Biz refs**: biz §2A.3 路由表 P00 行（L224）+ biz §2A.3.1 登录态决策树（L251 · P00 核心素材主源 · 替代缺失的 §2A.4 卡）+ biz §2B.3 SC-02 步 2-3（token 过期 → P00 redirect）+ biz §2B.13 SC-12（游客 → 注册 P00 + Claim）+ biz §2B.14 SC-13（P-SHARED 写操作 → P00）+ biz §2B.15 SC-14（P-WELCOMEBACK → P00 换号分支）
**Related tasks**: 暂无独立 task（P00 由 SC-02 / SC-12 / SC-13 / SC-14 共享 · token 过期 redirect 与 anonymous claim 是横切关注点 · 等 anonymous-service / auth-service backend 落地时再切分 task）

> **特别说明**：P00 在 biz §2A.4 「逐页面规格卡」中 **没有独立的规格卡**（§2A.4 从 P02 开始）。主素材源是 §2A.3.1 决策树（明确 P00 在 4 节点路由中的位置）+ mockup 视觉 + 4 个 SC 流水中对 P00 的引用。本 spec §4 数据绑定 / §9 异常 / §11 性能预算 部分字段以"决策树 + SC TC + 通用 OAuth 实践"兜底；待 §2A.4 增补 P00 卡或 anonymous-service controller 落地时再回填字符级 API path / 字段。

---

## §1 页面目的

P00 是「匿名 → 正式账号」的唯一统一入口 · 三秒注意力黄金窗内告诉用户：① 这是「日历」账号登录页（不是某个第三方页面）· 看到 Logo 与 Slogan 即可建立信任；② 提供 **微信一键 / Apple Sign-In / 邮箱+密码** 三档登录方式，覆盖 iOS / Android / H5 / 小程序；③ 如果是从 P-GUEST-CAPTURE 试用 / P-SHARED 分享 / P-WELCOMEBACK 回流 / SC-02 token 过期 跳转过来，登录成功后**自动回到 redirect 目标页**（携带 `guest_session_id` / `shareToken` / `redirect` 参数）而非默认 P-HOME。它不是路由的"起点"（决策树 §2A.3.1 节点 1-3 都可能绕过 P00），但它是"匿名升正式"的最后一公里转化节点。

---

## §2 布局分区 + Wireframe

### 2.1 布局分区（从上到下 · 来源：mockup 00_login.html 视觉真相 · 在缺失 §2A.4 「布局分区」字段时以 mockup 为兜底 ground truth）

```
┌──────────────────────────────────────────┐
│ statusbar (54px · 黑字 on 浅灰渐变)        │
├──────────────────────────────────────────┤
│ logo zone (margin-top 62px)               │
│   · 92×92 蓝色圆角 Logo (App 图标)        │
│   · App 标题 "日历" (28px · weight 700)   │
│   · Slogan "统一 学习·任务·提醒·备忘"    │   ← b 强调彩色字
├──────────────────────────────────────────┤
│ 凭据卡 (333×auto · radius 22 · blur 30)    │
│   · 邮箱/手机号 input  (icon + placeholder)│
│   · 密码 input         (icon + placeholder)│
│   · row-foot: [√ 记住我]      [忘记密码？] │
├──────────────────────────────────────────┤
│ 主 CTA「登录」(333×50 · 蓝色渐变)          │
├──────────────────────────────────────────┤
│ divider 「或使用」                          │
├──────────────────────────────────────────┤
│ Apple 一键登录按钮 (黑底白字)               │
│ 微信一键登录按钮  (白底 · 微信绿 logo)      │
├──────────────────────────────────────────┤
│ foot: "登录即表示同意 <服务条款> 与 <隐私政策>" │
└──────────────────────────────────────────┘
```

### 2.2 关键视觉锚（mockup 00_login.html 真 selector + testids/src/index.ts L235-247 `TEST_IDS.p00.*`）

| Zone | DOM selector / class | testid (TEST_IDS.p00.*) | 用途 |
|---|---|---|---|
| 页面根 | `.phone` → `.screen` | `p00-root` | 路由 outlet 容器 |
| 状态栏 | `.status` | `p00-statusbar` | 系统时间 / 信号 / 电池 |
| Logo zone | `.logo-wrap` | `p00-logo-zone` | 92×92 蓝色 logo + App 名 + slogan |
| Logo 本体 | `.logo svg` | `p00-logo-zone-logo` | 蓝色渐变图标 |
| 邮箱 input | `.card .field:nth-child(1) input` | (TBD · testids 表未列 · 建议 `p00-email-input`) | 邮箱或手机号 |
| 密码 input | `.card .field:nth-child(2) input` | (TBD · 建议 `p00-password-input`) | 密码 |
| 记住我 | `.row-foot .chk` | (TBD · 建议 `p00-remember-me`) | 7 天免登 |
| 忘记密码 | `.row-foot .forget` | (TBD · 建议 `p00-forget-password-link`) | 找回密码入口 |
| 主登录 CTA | `.btn.primary` | (TBD · 建议 `p00-login-submit-btn`) | 邮箱/密码登录提交 |
| 微信登录 | `.btn.wechat` | `p00-wechat-cta-btn` (data-iron-rule-1-exception="wechat-brand") | 微信 OAuth 一键登录（小程序为主) |
| 其他登录方式 | (TBD · mockup 当前展示全部 3 种 · 折叠版按钮) | `p00-other-methods-link` | 折叠"使用其他方式" |
| Apple 登录 | `.btn.apple` | (TBD · 建议 `p00-apple-cta-btn`) | Apple Sign-In (iOS 优先) |
| 合规同意 bar | `.foot` | `p00-consent-bar` | 服务条款 + 隐私政策 + 未成年人提示 |
| 同意 checkbox | (P0 强制版增加) | `p00-consent-checkbox` | 必勾才能点登录 (合规) |
| 服务条款 | `.foot a:nth-child(1)` | `p00-consent-bar-link-tos` | 跳服务条款页 |
| 隐私政策 | `.foot a:nth-child(2)` | `p00-consent-bar-link-privacy` | 跳隐私政策页 |

> 注：testids 表里 `p00.*` 只显式列了 9 个（root / statusbar / logoZone / logoZoneLogo / wechatCtaBtn / otherMethodsLink / consentBar / consentCheckbox / consentLinkTos / consentLinkPrivacy）· 邮箱 / 密码 / 主登录 / Apple 等 input/button 当前没有 testid · 等 SC-02-T0X 拍 task 时回补。

---

## §3 核心组件

| 组件 | 来源 | 接受 props | 说明 |
|---|---|---|---|
| `<AuthLogoBlock>` | frontend/packages/ui-kit | `{appName, slogan, iconHref}` | Logo + 标题 + slogan 三件套（兼容启动屏复用）|
| `<CredentialCard>` | ui-kit | `{value:{email,password,remember}, onChange, dirty}` | 凭据玻璃卡（blur + radius 22）|
| `<EmailOrPhoneInput>` | ui-kit | `{value, onChange, error}` | 支持邮箱/手机号双格式自动识别 |
| `<PasswordInput>` | ui-kit | `{value, onChange, showStrengthHint}` | password 类型 + show/hide eye(P1) |
| `<RememberMeCheck>` | ui-kit | `{checked, onChange}` | 7 天免登复选 |
| `<ForgetPasswordLink>` | ui-kit | `{onClick}` | 跳找回密码 H5 |
| `<PrimaryAuthCTA>` | ui-kit | `{disabled, loading, onTap}` | 主登录按钮（蓝渐变 + loading spinner）|
| `<OAuthButtonStack>` | ui-kit | `{providers:['apple','wechat'], onLaunch}` | Apple + 微信 按钮组 · 根据 platform 排序 |
| `<ConsentBar>` | ui-kit | `{tosHref, privacyHref, mustAccept, isMinor}` | 服务条款 + 隐私政策 + 未成年人保护 |
| `<RedirectBanner>` | ui-kit | `{from:'expired'/'guest-claim'/'share'/'welcomeback'}` | 顶部黄/蓝条说明"登录后继续 ..." |

来源：mockup 00_login.html 真 DOM + frontend/packages/ui-kit + biz §2A.3.1 / §2B.13-15 SC 流中提到的合规要求。

---

## §4 数据绑定（Entity / DTO）

### 4.1 Page-level State 绑定

```typescript
{
  bootstrap: {
    decisionTreeNode: 1 | 2 | 3 | 'NOT_HIT',   // 决策树 §2A.3.1 命中节点
    redirect?: string,                          // /review/exec/12345 等
    guestSessionId?: string,                    // SC-12 claim 入参
    shareToken?: string,                        // SC-13 returnTo 入参
    fingerprintMatched?: boolean,               // SC-14 (P1) device fp 命中
  },
  form: {
    email: string,
    password: string,
    rememberMe: boolean,                        // 默认 true
    consentAccepted: boolean,                   // 必须 true 才能登录
  },
  auth: {
    state: 'IDLE' | 'VERIFYING' | 'SUCCESS' | 'FAILED' | 'ANONYMOUS_CLAIM',
    error?: AuthErrorCode,                      // TOKEN_EXPIRED / DEVICE_MISMATCH / WX_OAUTH_FAIL ...
    provider?: 'EMAIL' | 'WECHAT' | 'APPLE',
  }
}
```

### 4.2 涉及的后端 Entity（biz §3.1 + §2B.13-15 推断）

- `student`（auth-service · status / phone_hash / email_hash）
- `account_device`（设备指纹软绑定 · SC-14 fingerprint_matched 来源）
- `guest_session`（anonymous-service · SC-12 待 claim · `claimed_by_student_id` 在登录成功后回填）
- `share_token`（anonymous-service · SC-13 P-SHARED 的 returnTo 透传 · 登录不消费令牌只回原页）

来源：mockup 视觉 form 字段 + biz §3.1 聚合根表 + biz §2B.13-15 SC 流推断。无 §2A.4 卡 · 字段是兜底而非引用。

---

## §5 API 触点

> 字符级精准 path · 主源 = biz §2A.3.1 决策树文本（明确提到 `GET /api/session/resolve` · 由前端 `bootstrap/resolve-entry.ts` 调用）+ §2B.13-15 SC 流中提到的 auth/claim 路径。**当前 backend/ 下 anonymous-service / auth-service 未实现 · 字段以 biz 文本为准 · 待 controller 落地时回填字符级一致性检查。**

| # | Method | Path | Headers (req) | Body (req) | Response | P95 预算 | 失败降级 |
|---|---|---|---|---|---|---|---|
| 1 | GET  | `/api/session/resolve` | `X-Device-Fp`, `X-Request-Id` | (query) `?redirect=&shareToken=` | `200 {hasJwt, fingerprintMatched, maskedAccount?, decisionTreeNode}` | ≤ 300ms (biz §2B.15 F01) | 视为节点 3 未命中 · 落 P00（而非 P-LANDING）|
| 2 | POST | `/api/auth/login` | `X-Idempotency-Key`, `X-Request-Id`, `X-Device-Fp` | `{provider:'EMAIL', email, password, rememberMe, consentAt}` | `200 {jwt, refreshToken, expiresIn, student:{id,nickMasked}}` | ≤ 800ms (biz §2B.13 F07) | 401 → 显示行内 error · 不强制跳页 |
| 3 | POST | `/api/auth/wechat-login` | `X-Idempotency-Key`, `X-Device-Fp` | `{code, encryptedData?, iv?, consentAt}` | `200 {jwt, refreshToken, expiresIn, isNew}` | ≤ 800ms (biz §2B.13 F07 · `auth_wechat_success`) | wx.login 失败 → Toast + retry · 不跳页 |
| 4 | POST | `/api/auth/apple-login` | `X-Idempotency-Key`, `X-Device-Fp` | `{identityToken, authCode, consentAt}` | `200 {jwt, refreshToken, expiresIn, isNew}` | ≤ 800ms | identityToken 校验失败 → 401 · 降级到 email tab |
| 5 | POST | `/api/auth/device-refresh` | `X-Idempotency-Key`, `X-Device-Fp` | `{device_fp, oauth_payload}` | `200 {jwt, refreshToken, expiresIn}` | ≤ 500ms (biz §2B.15 F05A) | DEVICE_MISMATCH → 降级 P00 邮箱密码 |
| 6 | POST | `/api/auth/anonymous-claim` (别名 `/api/guest/claim`) | `Authorization: Bearer ${jwt}`, `X-Idempotency-Key` | `{guest_session_id}` | `200 {questionId, plan:{t0NodeId,t1NodeId,...}}` | ≤ 600ms (biz §2B.13 F08) | 同一 session 重复 claim 必返同一 qid（幂等）/ DEVICE_MISMATCH → 403 |
| 7 | POST | `/api/auth/refresh` | `Authorization: Bearer ${refreshToken}` | `{}` | `200 {jwt, expiresIn}` | ≤ 300ms | refresh token 也过期 → 强制跳回 P00 |
| 8 | POST | `/api/auth/forget-password` | `X-Idempotency-Key` | `{email\|phone}` | `200 {sent:true, channel:'sms'/'email'}` | ≤ 1s | 90s 内重复请求 → 429 RATE_LIMITED |

来源：biz §2A.3.1 决策树文本（`GET /api/session/resolve`）+ §2B.13 F07/F08（auth wechat-login / guest/claim）+ §2B.15 F04A/F05A（device-refresh）+ 通用 OAuth/refresh 实践兜底。**backend/auth-service 与 backend/anonymous-service 当前不存在**（确认了 backend/ 下只有 common / file-service / review-plan-service）· 待落地 PR 时这一节做字符级 lock。

---

## §6 状态机

```
                ┌────┐  user input / oauth tap  ┌──────────┐
                │IDLE│─────────────────────────►│VERIFYING │
                └────┘                          └────┬─────┘
                  ▲                                  │
                  │ retry / clear error              │
                  │                  ┌───────────────┤
                  │                  │ 200 OK +      │ 4xx/5xx /
                  │                  │ has guest_id  │ network fail
                  │                  ▼               ▼
                  │       ┌──────────────────┐   ┌──────┐
                  │       │ ANONYMOUS_CLAIM  │   │FAILED│
                  │       └────────┬─────────┘   └──┬───┘
                  │                │ claim 200 OK   │
                  │                ▼                │
                  │       ┌──────────────────┐      │
                  │       │     SUCCESS      │◄─────┴─── (无 guest_id 时直接到 SUCCESS)
                  │       │ (跳 redirect 或   │
                  │       │  P-HOME)         │
                  │       └──────────────────┘
                  │
                  └── (FAILED → IDLE on user re-input)
```

### 6.1 状态转移规则

| From | To | Trigger | Side effect |
|---|---|---|---|
| IDLE | VERIFYING | tap 主登录 / Apple / 微信 CTA | 按钮 loading · CTA disabled · 埋点 `auth_attempt{provider}` |
| VERIFYING | SUCCESS | login 200 + 无 `guestSessionId` | 存 jwt 到 keychain · 触发 `redirect` 或落 P-HOME · 埋点 `auth_success{provider,ms}` |
| VERIFYING | ANONYMOUS_CLAIM | login 200 + 带 `guestSessionId`（来自 SC-12 F06）| 显示 Sheet "正在把你刚才的分析保存到错题本..." · 调 `POST /api/auth/anonymous-claim` |
| ANONYMOUS_CLAIM | SUCCESS | claim 200 | Toast "已加入错题本" · 落 P-HOME（biz §2B.13 F09）· 埋点 `anon_guest_claim_success{ms}` |
| ANONYMOUS_CLAIM | FAILED | claim 403 DEVICE_MISMATCH / 5xx | 保留 jwt · 提示"分析结果保存失败" · 不挡用户进 P-HOME（结果在 24h TTL 内仍可重 claim）|
| VERIFYING | FAILED | 4xx/5xx/网络失败/wx.login 取消 | 行内 error 文案 · 埋点 `auth_fail{code}` · CTA 恢复可点 |
| FAILED | IDLE | 用户修改表单 / tap 重试 | 清 error · 状态归零 |
| SUCCESS | (P00 退场) | 跳 redirect 或 P-HOME | 路由 push · 销毁 P00 实例 |

来源：biz §2A.3.1 决策树 + biz §2B.13 F06-F09 SC-12 流（ANONYMOUS_CLAIM 子态来源）+ biz §2B.15 F04A 流（device-refresh 视为 VERIFYING 特殊 provider）+ mockup 视觉 loading 状态。

---

## §7 跳转

### 7.1 入口（含登录态决策树 §2A.3.1 4 节点）

| 入口 | 来源 | 触发条件 |
|---|---|---|
| **决策树节点 1 命中 · 直达** | bootstrap | **不经 P00** · 持有合法 JWT → 直接 redirect 原目标或 P-HOME |
| **决策树节点 2 命中** | URL 含 `/s/:shareToken` 或 `/observer/:code` | **不经 P00** · 落 P-SHARED / P-OBSERVER（P00 仅当用户在 P-SHARED 内 tap 写操作时再跳来 · 带 `?returnTo=/s/<token>`）|
| **决策树节点 3 命中**（设备指纹 · P1）| `/api/session/resolve` 返回 fingerprintMatched | **不经 P00** · 落 P-WELCOMEBACK · 用户在该页 tap 「换个账号登录」才跳 P00（SC-14 F04B）|
| **决策树节点 4 未命中** | 全部未命中 | 落 P-LANDING · 用户在 P-LANDING tap 「已有账号 → 登录」才跳 P00 |
| P-LANDING 双 CTA 之 「已有账号 → 登录」 | landing 页 | 匿名用户主动选择登录 |
| P-SHARED 任意写操作 | SC-13 F04-F05 | 收藏 / 评论 / 立即复习 等需登录才能完成 · 带 `?returnTo=/s/<token>` |
| P-GUEST-CAPTURE / P04 游客态 「保存到我的错题本」 | SC-12 F06 | 试用完想留存 · 带 `?guest_session_id=<id>` |
| P-WELCOMEBACK 「换个账号登录」 | SC-14 F04B | 流失用户拒绝一键回登 · 清 device_fp 软绑定 |
| **Token 过期 redirect** | 任意页 401 | SC-02 步 3 `GET /api/auth/verify` 返 401 → 带 `?redirect=/review/exec/12345` 跳 P00 |
| 推送深链 token 过期 | SC-02 TC-02.02 | 推送 → 跳 P08 时检测 JWT 过期 → 自动 push P00 + redirect |

### 7.2 出口

| 出口 | 目标 | 触发条件 |
|---|---|---|
| 路由 replace | `redirect` 参数指定的 URL（含 SC-02 的 `/review/exec/:nid`）| SUCCESS 状态 + 有 `redirect` |
| 路由 replace | `/s/<shareToken>`（已登录态再回 P-SHARED）| SUCCESS + 有 `shareToken` |
| 路由 replace | P-HOME `/` | SUCCESS · 无 redirect / 无 guestSessionId / 无 shareToken（默认终点）|
| 路由 replace | P-HOME + Toast "已加入错题本" | ANONYMOUS_CLAIM → SUCCESS（来自 SC-12 F09）|
| 路由 back | 上一页（P-LANDING / P-SHARED / P-WELCOMEBACK）| 学生 tap 系统返回 / 顶部 < · 维持匿名态 |
| 路由 push | `/auth/forget-password` H5 | tap 「忘记密码？」 |
| 路由 push | `/about/tos` / `/about/privacy` | tap 服务条款 / 隐私政策 |

来源：biz §2A.3.1 决策树（4 节点 + redirect 语义）+ biz §2B.13 F06-F09 + §2B.14 F05 + §2B.15 F04B + §2B.3 SC-02 TC-02.02。

---

## §8 Wire format（SSE / WebSocket 事件）

本页无 SSE / WS 通道 · 事件通讯走 §5 HTTP 触点。微信小程序的 `wx.login` 是 JSSDK 本地调用 · Apple Sign-In `ASAuthorizationController` 是 iOS 系统级 callback · 均不走 SSE / WS · 上行结果直接做为 `POST /api/auth/wechat-login` / `apple-login` 的 body 字段。

---

## §9 异常 & 降级

| 异常 | 触发条件 | UI 反馈 | 系统行为 | 关联 TC |
|---|---|---|---|---|
| **Token 过期 401** | 任意页 `/api/auth/verify` 或受保护接口返 401 | 顶部 Banner "登录已过期，请重新登录" + 自动填邮箱（如有 rememberMe）| 跳 P00 · URL 带 `?redirect=<原 URL>` · 登录成功后 replace 回去 | TC-02.02 (SC-02) |
| **设备指纹冲突 DEVICE_MISMATCH** | SC-12 F08 claim · device_fp 不匹配 guest_session.device_fp | Sheet 红色 "保存失败：设备不一致" + 「依然进入 P-HOME」/「重试」二选一 | 不挡 P-HOME（jwt 已签发）· guest_session 进入 24h TTL 失效流程 | TC-12.04 (SC-12) |
| **share_token 过期** | P-SHARED returnTo 但 token 已过 exp | P00 顶部黄条 "这个分享已过期 · 登录后默认进首页" · returnTo 自动失效 | 登录成功后 redirect 改为 P-HOME · 埋点 `anon_share_token_expired` | TC-13.03 (SC-13) |
| **三方登录失败** (wx.login cancel / Apple cancel) | 用户取消 OAuth 弹窗 | 行内 Toast "取消登录" · CTA 恢复可点 | 不埋错 · 埋点 `auth_oauth_cancel{provider}` | — |
| **三方登录后端校验失败** | wechat-login / apple-login 返 401 INVALID_TOKEN | 行内 error "授权失败 · 请重试或使用邮箱登录" | CTA 恢复 · 引导降级 email tab | — |
| **微信 wx.login code 过期** | 5 分钟前取的 code · 此刻提交 | 自动 silent retry 1 次 · 失败后行内错误 | 重新调 `wx.login` · 用户无感 | — |
| **邮箱/密码错误** | login 返 401 INVALID_CREDENTIALS | 密码 input 红框 + 行内 "邮箱或密码错误" · 失败 5 次锁定 5 分钟 | 后端按 `email_hash + ip` 维度限流 · 429 时前端额外提示 | — |
| **网络断开** | login XHR network error | 顶部红条 "网络不可用，请检查后重试" + 重试按钮 | 凭据 form 保留 · rememberMe 复选不丢 | — |
| **未勾选 consent** | P0 强制版 · checkbox 未勾就 tap 登录 | CTA 抖动 + ConsentBar 红色边框 + Toast "请阅读并同意条款" | 不发请求 · 等用户勾选 | — |
| **未成年人保护** | identity_token 解析年龄 < 14 且无监护人同意 | 阻塞登录 · Sheet "请监护人辅助完成同意" + CTA "退出" | 不签发 jwt · 埋点 `auth_minor_guardian_required` | — |
| **多账号歧义** | device-refresh 返多个 student_id (SC-14 异常) | P00 改为账号选择列表（脱敏 nick）| 不一键登录 · 用户选择后走 email tab 验证 | TC-14.02 (SC-14) |
| **被删除账号** | login 返 410 ACCOUNT_DELETED | 阻塞 + Sheet "该账号已注销 · 如需恢复请联系客服" | 不签发 jwt · 降级回 P-LANDING | TC-14.03 (SC-14) 关联 |

来源：biz §2B.3 SC-02 TC-02.02 (token 过期) + biz §2B.13 SC-12 TC-12.04 (DEVICE_MISMATCH) + biz §2B.14 SC-13 TC-13.03 (token 过期) + biz §2B.15 SC-14 TC-14.02/14.03 + 通用 OAuth 异常实践兜底。

---

## §10 验收点（TC → AC 映射）

| TC ID | 类型 | GIVEN | WHEN | THEN | 关联 task AC |
|---|---|---|---|---|---|
| TC-02.02 | 异常 | 学生已登录 · 推送 SC-02 nid=12345 · token 已过期 | Tap 推送 → 走 SC-02 步 2-3 401 | 自动弹"登录已过期"Sheet → 引导 P00 → 登录成功 → 跳 P08 nid=12345 · `redirect` 参数正确传递 · 不丢埋点 | (SC-02 待切分到 P00 的 token-expired-redirect task) |
| TC-12.01 | 正常 | 新设备首次试用 · 完成 P-GUEST-CAPTURE 分析 | SC-12 F06-F09 完整走 | P00 邮箱 / 微信注册成功 · Claim 调用 · P-HOME 显示新题徽章 · 埋点链 `anon_guest_cta_save` → `auth_*_success` → `anon_guest_claim_success` 完整 | (SC-12 anonymous-claim task) |
| TC-12.04 | 异常 | 已分析完 · 用户注册后用了不同 device_fp | SC-12 F08 Claim | 服务端 403 `DEVICE_MISMATCH` · 前端 Toast · jwt 仍然下发（用户进 P-HOME 但题没 claim 上）· guest_session 24h TTL 保留 | (SC-12 anonymous-claim task) |
| TC-13.02 | 正常 | 合法 share_token · type=QUESTION · 分享者允许 claim | SC-13 F04-F06 完成 P00 登录 | 回到 P-SHARED 已登录态 → 自动触发 `POST /api/share/:token/claim` → 跳 P-HOME + Toast "已加入错题本" | (SC-13 share-upgrade task) |
| TC-13.03 | 异常 | share_token exp 已过 | 进入 `/s/:token` 然后跳 P00 | P00 顶部"这个分享已过期" · 登录后 redirect 改为 P-HOME · 埋点 `anon_share_token_expired` | (SC-13 task) |
| TC-14.02 | 异常 | device_fp 命中 2 个 student_id | 决策树节点 3 命中 → P-WELCOMEBACK → "换个账号" → P00 | P00 改为账号选择列表（脱敏 nick）· 用户选择 1 个后继续 email/oauth 登录 | (SC-14 device-refresh task) |
| TC-14.03 | 边界 | 设备从未登录过 | bootstrap | 决策树节点 3 未命中 → 落 P-LANDING（**不经 P00**）· 验证 P00 不是冷启动默认入口 | (SC-14 task) |

来源：biz §2B.3 / §2B.13 / §2B.14 / §2B.15 QA 用例表（grep-验证 TC ID 真实存在）。task AC 列暂留参考性占位 · 待 feature_list.json SC-02 / SC-12 / SC-13 / SC-14 拆分子 task 时回填。

---

## §11 性能预算

| 操作 | P95 budget | 来源 |
|---|---|---|
| `GET /api/session/resolve`（决策树）| ≤ 300ms | biz §2B.15 F01 SC-14 "≤ 300 ms" |
| 邮箱密码登录 `POST /api/auth/login` | ≤ 800ms | biz §2B.13 F07 SC-12 `auth_wechat_success` "≤ 800 ms"（同等量级）|
| 微信一键登录 `POST /api/auth/wechat-login` | ≤ 800ms | biz §2B.13 F07 SC-12 |
| Apple Sign-In `POST /api/auth/apple-login` | ≤ 800ms | 同 wechat-login 量级（系统 OAuth 等量）|
| device-refresh `POST /api/auth/device-refresh` | ≤ 500ms | biz §2B.15 F05A SC-14 "≤ 500 ms" |
| anonymous-claim `POST /api/auth/anonymous-claim` | ≤ 600ms | biz §2B.13 F08 SC-12 "≤ 600 ms" |
| P00 首屏 TTI（冷启动 / 从 redirect 进入）| ≤ 1.0s | biz §2A.3.2 P-LANDING 性能预算 "首屏 TTI ≤ 1.0 s" 同等量级（同 Anonymous Shell）|
| SUCCESS → redirect / P-HOME 跳转 | ≤ 500ms | biz §2B.13 F09 home 落位（同 P-HOME 渲染量级） |

来源：biz §2B.13 F07-F09 + biz §2B.15 F01 / F05A + biz §2A.3.2 P-LANDING 卡（同 Shell 通用预算）。无 §2A.4 卡直接列 P00 预算 · 兜底用同 Shell / 同 SC 流量级。

---

## §12 埋点事件

| Event name | When | Properties | 来源 |
|---|---|---|---|
| `auth_view` | P00 mount | `{entry: 'landing-cta'/'guest-claim'/'share'/'welcomeback-switch'/'token-expired', redirect?, has_guest_session, has_share_token}` | 决策树 §2A.3.1 + 推断 |
| `auth_attempt` | tap 主登录 / Apple / 微信 CTA | `{provider:'EMAIL'/'WECHAT'/'APPLE'}` | 推断（SC-12 `anon_guest_cta_save` 后续动作）|
| `auth_success` | login 200 OK | `{provider, ms, is_new_user, has_guest_session}` | biz §2B.13 F07 `auth_wechat_success` |
| `auth_wechat_success` | wechat-login 200 OK | `{ms, is_new_user}` | biz §2B.13 F07 真名 |
| `auth_fail` | login 4xx/5xx | `{provider, code, ms}` | 推断 |
| `auth_oauth_cancel` | 用户取消 OAuth 弹窗 | `{provider}` | 推断 |
| `auth_minor_guardian_required` | identity_token age < 14 拦截 | `{provider}` | biz §2B.13 「合规」/未成年人保护 |
| `anon_guest_claim_start` | ANONYMOUS_CLAIM 进入 | `{guest_session_id}` | biz §2B.13 F08 真名 |
| `anon_guest_claim_success` | claim 200 OK | `{ms, qid}` | biz §2B.13 F08 真名 |
| `anon_share_upgrade_success` | P-SHARED returnTo 后 P00 登录成功 | `{share_token_type}` | biz §2B.14 F06 真名 |
| `anon_welcomeback_switch_account` | SC-14 P-WELCOMEBACK 跳 P00 | — | biz §2B.15 F04B 真名 |
| `auth_forget_password_tap` | tap 忘记密码 | — | 推断 |
| `auth_consent_blocked` | 未勾 consent 就 tap CTA | — | 推断（合规要求）|

来源：biz §2B.13 / §2B.14 / §2B.15 中明确出现的 `auth_*` / `anon_*` 埋点名 + 推断兜底。等 §2A.4 P00 卡或 §2A.8 埋点字典补全后回填精确字段。

---

## §13 testid 表

| testid | 用途 | 出现位置（mockup / testids/src/index.ts L235-247）| E2E 引用 |
|---|---|---|---|
| `p00-root` | P00 页面根 | testids L237 + mockup `.phone .screen` | (待 SC-02 / SC-12 / SC-13 E2E spec 落地) |
| `p00-statusbar` | 状态栏 | testids L238 + mockup `.status` | — |
| `p00-logo-zone` | Logo + 标题 + slogan 三件套 | testids L239 + mockup `.logo-wrap` | — |
| `p00-logo-zone-logo` | Logo 本体 | testids L240 + mockup `.logo svg` | — |
| `p00-wechat-cta-btn` | 微信一键登录 (data-iron-rule-1-exception="wechat-brand") | testids L241 + mockup `.btn.wechat` | — |
| `p00-other-methods-link` | 其他登录方式 (折叠版) | testids L242 + mockup (未在当前 00_login.html 折叠 · 全部展开) | — |
| `p00-consent-bar` | 服务条款 + 隐私政策合规条 | testids L243 + mockup `.foot` | — |
| `p00-consent-bar-checkbox` | 必勾 checkbox（合规 P0 强制版）| testids L244 (mockup 暂无 · 等强制版加) | — |
| `p00-consent-bar-link-tos` | 服务条款链接 | testids L245 + mockup `.foot a:nth-child(1)` | — |
| `p00-consent-bar-link-privacy` | 隐私政策链接 | testids L246 + mockup `.foot a:nth-child(2)` | — |

**TBD（mockup 有但 testids 表未登记 · 等 SC-02 / SC-12 / SC-13 task 拍版时回补）**：

| 建议 testid | 用途 |
|---|---|
| `p00-email-input` | 邮箱 / 手机号 input |
| `p00-password-input` | 密码 input |
| `p00-remember-me` | 记住我 checkbox |
| `p00-forget-password-link` | 忘记密码 |
| `p00-login-submit-btn` | 主登录 CTA |
| `p00-apple-cta-btn` | Apple Sign-In |
| `p00-redirect-banner` | Token 过期 / Claim / Share returnTo 顶部说明条 |

来源：frontend/packages/testids/src/index.ts L235-247 真实落库 `TEST_IDS.p00.*`（10 个）+ mockup HTML 视觉补充（7 个 TBD）。

---

## §14 i18n key

| Key | 中文 | 英文 | 用途 |
|---|---|---|---|
| `auth.title` | 日历 | Calendar | App 标题（mockup `.app-title`）|
| `auth.subtitle` | 统一 学习·任务·提醒·备忘 | Unified study, tasks, reminders, notes | Slogan（mockup `.app-sub`）|
| `auth.email.placeholder` | 邮箱或手机号 | Email or phone | 邮箱 input placeholder |
| `auth.password.placeholder` | 密码 | Password | 密码 input placeholder |
| `auth.rememberMe` | 记住我 | Remember me | 7 天免登 |
| `auth.forgetPassword` | 忘记密码？ | Forgot password? | 找回密码 |
| `auth.submit` | 登录 | Sign in | 主 CTA |
| `auth.divider.or` | 或使用 | Or continue with | divider |
| `auth.apple.cta` | 使用 Apple 账号继续 | Continue with Apple | Apple Sign-In CTA |
| `auth.wechat.cta` | 使用微信登录 | Continue with WeChat | 微信 CTA |
| `auth.consent.text` | 登录即表示同意 {tos} 与 {privacy} | By signing in, you agree to {tos} and {privacy} | 合规条 |
| `auth.consent.tos` | 服务条款 | Terms of Service | 链接锚 |
| `auth.consent.privacy` | 隐私政策 | Privacy Policy | 链接锚 |
| `auth.error.invalidCredentials` | 邮箱或密码错误 | Invalid email or password | login 401 行内 |
| `auth.error.tokenExpired` | 登录已过期，请重新登录 | Your session has expired, please sign in again | 顶部 Banner |
| `auth.error.network` | 网络不可用，请检查后重试 | Network unavailable, please try again | 网络断开 |
| `auth.error.deviceMismatch` | 保存失败：设备不一致 | Save failed: device mismatch | Claim 403 |
| `auth.banner.shareExpired` | 这个分享已过期 · 登录后默认进首页 | This share has expired — you will land on Home | share_token 过期 |
| `auth.claim.loading` | 正在把你刚才的分析保存到错题本... | Saving your analysis to wrongbook... | Claim sheet |
| `auth.claim.success` | 已加入错题本 | Added to wrongbook | Claim toast |
| `auth.minor.guardianRequired` | 请监护人辅助完成同意 | Please ask a guardian to complete consent | 未成年人挡板 |

来源：mockup 00_login.html 视觉真文案 + biz §2B.13 / §2B.14 Toast 文案 + 推断兜底（无 §2A.4 「i18n Key」字段）。

---

## §15 关联与影响

- **上游 spec（决策树 4 节点的 3 个匿名页 + 1 个回流页）**：
  - `P-LANDING`（决策树节点 4 未命中 · 「已有账号 → 登录」CTA → P00）
  - `P-SHARED`（决策树节点 2 · 写操作触发 P00 · returnTo）
  - `P-WELCOMEBACK`（决策树节点 3 P1 · 「换个账号登录」分支 → P00）
  - `P-GUEST-CAPTURE` / `P04 (游客态)`（SC-12 F06 「保存到我的错题本」→ P00 + guest_session_id）
  - **任意已登录页**（受保护接口 401 → 自动 redirect 到 P00 · SC-02 TC-02.02）
- **下游 spec（登录成功后的去向）**：
  - `P-HOME`（默认 SUCCESS 终点 · 无 redirect 时）
  - `P08`（SC-02 redirect 到 `/review/exec/:nid`）
  - `P-SHARED`（returnTo 回原分享页 · SC-13 F06）
- **关联 task**：暂无独立 task（feature_list.json 中 SC-02 / SC-12 / SC-13 / SC-14 涉及 P00 的子动作分散 · 待拆 token-expired-redirect / anonymous-claim / share-upgrade / device-refresh 4 个 task 时再回填）
- **关联 audit**：暂无（anonymous-service / auth-service 未落地 · 待 PR 提交后产出 `audits/SC-XX-PHASE-0/A0X-auth-*.md`）
- **关联 mockup**：`design/mockups/wrongbook/00_login.html`（canonical）
- **关联 backend service**：`backend/auth-service/`（待建）、`backend/anonymous-service/`（待建）· 决策树前端逻辑：`frontend/.../bootstrap/resolve-entry.ts`（待建）
