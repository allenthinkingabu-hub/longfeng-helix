# P-SHARED · 分享链只读预览（Shared · HS256 Signed Token Preview）

**Status**: Active
**Owner**: design + frontend + backend (anonymous-service · gateway AnonFilter)
**Last-updated**: 2026-05-14
**Mockup (canonical)**: `design/mockups/wrongbook/16_shared.html`
**Biz refs**: biz §2A.3.2「P-SHARED 卡」(L404) + biz §2A.3.1 登录态决策树 (L251 · shareToken 节点) + biz §2B.14 SC-13 (L1241) + biz §4.11 `share_token` DDL (L1636) + biz §10.9 分享令牌接口契约 (L2147)
**Related tasks**: SC-13 全部 F01-F07 编排 · P-SHARED 是 SC-13 的核心承载页 · 上游补 SC-09 分享者发出端 (令牌签发)

---

## §1 页面目的

P-SHARED 是匿名态 Shell 下的"分享链只读预览页"，承担三件事：① 让接收方（家长 / 同学 / 朋友圈点击者）**不注册**就能看到分享者想让 ta 看的内容轮廓（考试日 / 错题 / 复习节点）；② 通过 HS256 签名令牌 + `relation_id` 后端解析 + 字段白名单 `ShareDto` 把脱敏边界硬编码在服务端，**绝不向前端透传原始敏感数据**（`relation_id` / `student_email` / `original_image_url`）；③ 用顶部横幅 + AI 完整分析磨砂遮罩 + 吸底 CTA「一键加入我的错题本」制造升级转化漏斗，目标转化率 ≥ 15%（biz §2A.2 北极星指标）。本页不允许任何写操作（评论 / 收藏 / 立即复习），网关 `AnonFilter` 在请求层直接 403 `ANONYMOUS_WRITE_FORBIDDEN`，前端 UI 层任何 tap 写按钮 → 弹底部半屏登录 Sheet 引导 P00。

---

## §2 布局分区 + Wireframe

### 2.1 布局分区（从上到下 · 来源：biz §2A.3.2 P-SHARED 卡「内容形态」+ 16_shared.html 视觉真相）

```
┌──────────────────────────────────────────┐
│ statusbar (54px · ink on teal-indigo hero)│
├──────────────────────────────────────────┤
│ anon-nav: ← back · Shared brand · 登录    │   ← 匿名态硬规则 (§2A.3.1 §8 ②) 无 Tab Bar
├──────────────────────────────────────────┤
│ sharer-banner (rgba over hero)            │
│   · 36px avatar (conic gradient · Z 字)   │
│   · "来自同学分享 · 3 分钟前"             │
│   · "<Z***> 和你分享了一道错题"           │
├──────────────────────────────────────────┤
│ scroll body (圆角 26px 上翻 · 顶 170px)   │
│ ├ preview ribbon (虚线 indigo · PREVIEW 徽)│
│ ├ masked question card                    │
│ │   · sub-chip + 难度 + T 级              │
│ │   · qimg (170px · blur + 原图脱敏 lock) │
│ │   · qtext (题干前 12 字 + mask 占位)    │
│ │   · kp chips ( 2 露 + N 锁)             │
│ ├ AI 完整分析 teaser (磨砂遮罩 lock-layer)│
│ │   · 4 bullet + bottom 大 lock ic + CTA  │
│ └ audit 卡 (令牌 · 有效期 · IP 已记录)    │
├──────────────────────────────────────────┤
│ cta-dock (吸底 · 渐隐背景)                │
│   · 主 CTA「一键加入我的错题本」(SC-12 claim 复用)│
│   · 次 CTA「先看看就好 · 不登录」         │
└──────────────────────────────────────────┘
```

### 2.2 关键视觉锚（mockup 16_shared.html 真 selector）

| Zone | DOM selector / class | testid (`TEST_IDS.pShared.*`) | 用途 |
|---|---|---|---|
| 页面根 | `.phone` | `p-shared` | 路由 outlet 容器（匿名 Shell · 无 Tab Bar） |
| 状态栏 | `.statusbar` | `p-shared-statusbar` | iOS 安全区 · 时间 + 信号 |
| 分享者横幅 | `.sharer` | `sharer-banner` | "来自 <昵称脱敏> 的分享" |
| 横幅头像 | `.sharer .av` | `sharer-banner-avatar` | conic-gradient 装饰头像 |
| 横幅文本 | `.sharer .txt` | `sharer-banner-text` | "来自同学分享 · 3 分钟前" + 昵称行 |
| 脱敏题卡 | `.qcard` | `masked-question` | 单张错题预览卡 (qimg + qtext + kp) |
| 题干清晰段 | `.qtext` 前段 | `masked-question-stem-clear` | 题干前 12 字 (biz §2A.3.2 脱敏规则) |
| 题干打码段 | `.qtext .mask` | `masked-question-stem-blurred` | 答案 / 错因等 mask span (5 字以上隐藏) |
| 题图磨砂遮罩 | `.qimg::before` + `.qimg .line.blur` | `masked-question-overlay` | 原图脱敏 + 标注隐藏 |
| 记忆曲线预览 | (REVIEW_NODE 型独有 · 复用 P11 视觉) | `memory-curve-preview` / `memory-curve-preview-svg` | 打码艾宾浩斯曲线 SVG |
| 审计元数据 | `.audit` | `share-meta` | 令牌 / 有效期 / IP 已记录 |
| 吸底 CTA | `.cta-dock .cta-join` | `upgrade-cta-fixed` | "一键加入我的错题本" (SC-13 POM.clickUpgradeCta) |
| 过期挡板 | (条件渲染 · 替代 scroll body) | `token-expired-screen` | `410 TOKEN_EXPIRED` 显示 |
| 非法挡板 | 同上 | `token-invalid-screen` | `404 TOKEN_INVALID` 显示 |
| 撤销挡板 | 同上 | `token-revoked-screen` | `403 TOKEN_REVOKED` 显示 |

---

## §3 核心组件

| 组件 | 来源 | 接受 props | 说明 |
|---|---|---|---|
| `<AnonShell>` | `frontend/packages/ui-kit/anon-shell` | `{showBack, brand, onSignIn}` | 匿名态外壳 · 无 Tab Bar (biz §2A.3.1 §8 ②) |
| `<SharedBanner>` | `frontend/packages/ui-kit` | `{sharerNickMasked, sharedAt, type}` | 复用 biz §2A.3.2 「核心组件」SharedBanner |
| `<MaskedContentCard>` | `frontend/packages/ui-kit` | `{type, maskedPayload}` | 3 type 分支：EXAM_DAY/QUESTION/REVIEW_NODE |
| `<MaskedQuestionVariant>` | `frontend/pages/shared/variants/Question` | `{stemSnippet, kp[], redactedFields[]}` | type=QUESTION · 复用 P06 视觉 (打码) |
| `<MaskedExamDayVariant>` | `frontend/pages/shared/variants/ExamDay` | `{eventTitleMasked, dueDate}` | type=EXAM_DAY · 复用 P11 通用事件只读 |
| `<MaskedReviewNodeVariant>` | `frontend/pages/shared/variants/ReviewNode` | `{nodeLevel, masteryRange}` | type=REVIEW_NODE · 复用 P11 复习形态 (打码艾宾浩斯) |
| `<AiAnalysisTeaser>` | `frontend/pages/shared/components` | `{bullets, lockLayer:boolean}` | 4 bullet · 底部 lock-layer 磨砂遮罩 |
| `<ShareMetaRow>` | `frontend/packages/ui-kit` | `{jtiShort, expiresAt, auditNote}` | 令牌/有效期/IP 已记录 (告知性 · 合规要求) |
| `<UpgradeCTA>` | `frontend/packages/ui-kit` | `{variant, allowClaim, onTap}` | 吸底主 CTA · 跳 P00 带 `returnTo=/s/<token>` |
| `<LoginSheet>` | `frontend/packages/ui-kit/login-sheet` | `{visible, onClose, returnTo}` | 写按钮 tap 时半屏弹出 (F04 行为) |
| `<TokenErrorScreen>` | `frontend/pages/shared/error` | `{kind: 'EXPIRED'\|'INVALID'\|'REVOKED'}` | 全屏挡板 + CTA「返回看看新功能」→ P-LANDING |

来源：biz §2A.3.2「核心组件」+ frontend/packages/ui-kit + 16_shared.html DOM 真名 (`.sharer` / `.qcard` / `.teaser` / `.audit` / `.cta-dock`)。

---

## §4 数据绑定（Entity / DTO）

### 4.1 Page-level State 绑定

```typescript
{
  // 路由 path 参数
  routeParam: { shareToken: string },          // URL `/s/:shareToken` HS256 jwt

  // 服务端解析后 page state (biz §2A.3.2 P-SHARED 卡「状态集」)
  shared: {
    state: 'VERIFYING' | 'VIEW_MASKED' | 'REQUIRE_LOGIN' | 'EXPIRED' | 'INVALID' | 'REVOKED',
    type: 'EXAM_DAY' | 'QUESTION' | 'REVIEW_NODE',
    masked: {
      stemSnippet: string,                     // 题干前 12 字 (QUESTION 型)
      subject: SubjectCode,
      kp: Array<{id:string, name:string, locked:boolean}>,
      redactedFields: Array<'errorDiagnosis'|'answer'|'studentNick'|'originalImage'>,
      eventTitleMasked?: string,               // EXAM_DAY 型
      nodeLevelMasked?: 'T?'                   // REVIEW_NODE 型
    },
    originalUserHint: { sharerNickMasked: string, sharedAt: string },
    ctaAction: 'login' | 'register',           // 接收方未登录默认 register · 已登录态切 login
    meta: { jtiShort: string, expiresAt: string, ttlSec: number, allowClaim: boolean }
  },

  // 后端校验结果 (来自 GET /api/share/:shareToken)
  verifyResult: {
    signatureValid: boolean,
    sharerNick: string,                        // 已脱敏 "Z***"
    ttlSec: number
  }
}
```

### 4.2 涉及的后端 Entity

- `share_token` (anonymous-service · biz §4.11 · jti / sharer_student_id / share_type / relation_id / allow_claim / usage_limit / usage_count / status / expires_at)
- `share_token_audit` (anonymous-service · biz §4.11 · jti / viewer_device_fp / viewer_ip_hash / upgraded_student_id / viewed_at)
- `wb_question` (wrongbook-service · 仅 type=QUESTION 时 backend 解 `relation_id → questionId` 后取脱敏字段拼 `maskedPayload` · 前端永远拿不到原 `questionId`)
- 不下发字段（biz §2B.14 关键断言点）：`relation_id` / `student_email` / `original_image_url` / 学生昵称全称 / 错因诊断完整段

来源：biz §2A.3.2「数据绑定 / 脱敏规则」+ biz §4.11 `share_token` DDL + biz §2B.14 关键断言点 + frontend/packages/api-contracts (`ShareDto`)。

---

## §5 API 触点

> 字符级精准 path + method · 必须与 biz §10.9 + biz §2B.14 F02/F06 一致。**Cache-Control: no-store** 强制 (biz §2B.14 令牌安全)。

| # | Method | Path | Headers (req) | Body (req) | Response | P95 预算 | 失败降级 |
|---|---|---|---|---|---|---|---|
| 1 | GET | `/api/share/:shareToken` | `Accept: application/json`, `X-Device-Fp` | — | `200 {type, maskedPayload, sharerNick, ttlSec, signatureValid}` | ≤ 300ms (biz §2B.14 F02) | 410 TOKEN_EXPIRED → §9 挡板；403 TOKEN_REVOKED / 404 TOKEN_INVALID 同样挡板 |
| 2 | POST | `/api/share/:shareToken:claim` | `Authorization: Bearer <JWT>`, `X-Idempotency-Key` | — | `200 {questionId}` | ≤ 600ms (biz §2B.14 F06) | 仅 type=QUESTION 且 `allowClaim=true` 时调用；其它类型不触发 |
| 3 | POST | `/api/auth/login` (P00 接力) | `Content-Type: application/json` | `{phone/wxCode, password?, returnTo:'/s/<token>'}` | `200 {jwt, redirect}` | ≤ 500ms | 失败留 P00；成功后 returnTo 回 P-SHARED 原 token |

**任何写操作（POST `/api/share/:token/comment` / `/favorite` / `/start-review`）匿名时网关 `AnonFilter` 直接返 `403 ANONYMOUS_WRITE_FORBIDDEN`，前端不应主动调用** —— UI 层 tap 写按钮先弹 LoginSheet，不走 API。

来源：biz §10.9 (字符级 path + req/resp) + biz §2B.14 SC-13 F02/F04/F06 + biz §2A.3.2 P-SHARED 卡「API 触点」+ biz §2A.7 异常路径降级矩阵 L658。

**注**：task brief 提及 `POST /api/anon/share/verify` + `GET /api/anon/share/sample/{qid}` 是早期草案；biz canonical 收敛到 `GET /api/share/:shareToken` 单接口（一次返回 maskedPayload，无独立 verify 步），以 biz §10.9 + §2B.14 为准。

---

## §6 状态机

```
                    ┌──────────────────────────────────────┐
                    │  入口：URL `/s/:shareToken`           │
                    └────────────────┬─────────────────────┘
                                     ▼
                              ┌────────────┐
                              │ VERIFYING  │  (骨架屏 + 顶部横幅 placeholder)
                              └─────┬──────┘
                  GET /api/share    │
                       /:token      │
            ┌──────────┬────────────┼──────────────┬─────────────┐
            ▼          ▼            ▼              ▼             ▼
     ┌──────────┐ ┌─────────┐ ┌──────────────┐ ┌──────────┐ ┌──────────┐
     │EXPIRED   │ │INVALID  │ │ VIEW_MASKED  │ │ REVOKED  │ │  (5xx)   │
     │(410)     │ │(404)    │ │ (200 · render│ │(403)     │ │ retry × 1│
     │挡板→Land │ │挡板→Land│ │  3 type variant)│ │挡板→Land│ │→Banner  │
     └──────────┘ └─────────┘ └───┬──────────┘ └──────────┘ └──────────┘
                                  │ tap 写按钮 (收藏/评论/立即复习)
                                  ▼
                          ┌──────────────────┐
                          │ REQUIRE_LOGIN    │  (半屏 LoginSheet)
                          └───┬──────────────┘
                              │ 登录成功 (POST /api/auth/login · returnTo=/s/<token>)
                              ▼
                          回到 VIEW_MASKED (已登录态)
                              │ 若 type=QUESTION + allowClaim:
                              ▼ 自动 POST /api/share/:token:claim
                          跳 P-HOME + Toast "已加入错题本"
```

### 6.1 状态转移规则

| From | To | Trigger | Side effect |
|---|---|---|---|
| (init) | VERIFYING | route enter `/s/:token` | 骨架屏 + `anon_share_enter` 埋点 (biz §2B.14 F01) |
| VERIFYING | VIEW_MASKED | GET 200 + `signatureValid=true` | 渲染 3-type 分支 + `anon_share_view{type,sharer_id_hash}` 埋点 (F02/F03) |
| VERIFYING | EXPIRED | GET 410 `TOKEN_EXPIRED` | 全屏挡板 + `anon_share_token_expired` 埋点 |
| VERIFYING | INVALID | GET 404 `TOKEN_INVALID` | 全屏挡板（签名验证失败 / 不存在）|
| VERIFYING | REVOKED | GET 403 `TOKEN_REVOKED` | 全屏挡板（分享者已撤销 · Redis Bloom 命中）|
| VIEW_MASKED | REQUIRE_LOGIN | tap 写按钮 (collect/comment/review-now) | 弹 LoginSheet · `anon_share_upgrade_cta{type,cta_variant}` 埋点 (F04) |
| REQUIRE_LOGIN | VIEW_MASKED | LoginSheet 关闭（用户取消）| 状态回退 · 不埋点 |
| REQUIRE_LOGIN | (跳 P00) | tap「立即注册 / 已有账号登录」 | router push `/auth?returnTo=/s/<token>` + `anon_share_cta_register` (F05) |
| VIEW_MASKED | (跳 P-HOME) | 登录成功 + type=QUESTION + allowClaim | 自动 `POST /api/share/:token:claim` + `anon_share_upgrade_success` + Toast (F06/F07) |
| EXPIRED / INVALID / REVOKED | (跳 P-LANDING) | tap 挡板 CTA「返回看看新功能」 | router push `/welcome` · **不落 P00** (§2A.3.1 节点 2 降级) |

来源：biz §2A.3.2 P-SHARED 卡「状态集」+ biz §2B.14 F01-F07 编排 + biz §2A.3.1 决策树「节点 2 令牌失效 → P-LANDING 不落 P00」(L296)。

---

## §7 跳转

| 入口 | 来源 | 触发条件 |
|---|---|---|
| 微信群 / 朋友圈 H5 卡片点击 | 外部分享卡 | URL = `/s/<HS256 token>` · 决策树节点 2 命中 → 落 P-SHARED |
| 扫码（二维码海报）| 外部二维码 | 同上 |
| 深链 `wb://s/:token` | iOS / Android App / 小程序 | universal link / scheme |
| 登录成功 returnTo 回锚 | P00 登录页 | `POST /api/auth/login` 携带 `returnTo=/s/<token>` 成功后 |

| 出口 | 目标 | 触发条件 |
|---|---|---|
| router push `/auth` | P00 登录页 | tap 吸底「一键加入我的错题本」/ tap 任意写按钮 → LoginSheet → 注册 (F05) |
| router push `/welcome` | P-LANDING (访客落地) | 令牌 EXPIRED / INVALID / REVOKED → 挡板 CTA · **不落 P00** (§2A.3.1) |
| router push `/` | P-HOME (已登录态) | 登录成功 + type=QUESTION + allowClaim → 自动 claim → Toast "已加入错题本" (F07) |
| router back | 外部浏览器 / 微信 | tap 左上 `<` (anon-nav back) · 退出预览 |
| 外部微信授权页 (P1) | 微信公众号关注页 | tap 「关注公众号获取更新」（biz §2A.3.2 P-SHARED 卡「跳转」P1）|

来源：biz §2A.3.2 P-SHARED 卡「跳转」+ biz §2A.3.1 决策树节点 2 + biz §2B.14 F05/F06/F07 + biz §2A.7 异常路径降级矩阵 L658「分享链令牌失效 → P-LANDING 不回 P00」。

---

## §8 Wire format（SSE / WebSocket 事件）

本页**无 SSE / WS 通道**，事件通讯全部走 §5 HTTP 触点（同步 RPC）。理由：分享预览是冷数据快照（`maskedPayload` 由 backend 一次性拼装下发），无需流式；且 `Cache-Control: no-store` 与流式通道语义冲突。

---

## §9 异常 & 降级

| 异常 | 触发条件 | UI 反馈 | 系统行为 | 关联 TC |
|---|---|---|---|---|
| 令牌过期 (HS256 `exp` < now) | GET `/api/share/:token` 返 `410 TOKEN_EXPIRED` | 全屏挡板 "这个分享已过期" + CTA「返回看看新功能」 | **直接跳 P-LANDING · 不落 P00** (§2A.3.1 节点 2 + §2A.7 L658) | TC-13.03 |
| 令牌签名非法 | GET 返 `404 TOKEN_INVALID`（HS256 verify fail / 不存在）| 全屏挡板 "分享链接无效" + CTA → P-LANDING | 同上 · 写入 `share_token_audit.viewer_ip_hash` 排查 | (无独立 TC · 同 TC-13.03 处理) |
| 令牌已撤销 | GET 返 `403 TOKEN_REVOKED`（Redis Bloom Filter 命中）| 全屏挡板 "分享者已撤销此分享" + CTA → P-LANDING | 同上 · Redis 秒级生效 (biz §4.11 §10.9) | (无独立 TC) |
| 写操作未登录拦截 | 接收方拼接 `POST /api/share/:token/comment` 等写接口 | 网关层不渲染前端 / 接口层返 `403 ANONYMOUS_WRITE_FORBIDDEN` | 网关 `AnonFilter` 直接拦截 · 不走业务层 | TC-13.04 |
| 写按钮点击（UI 层兜底）| VIEW_MASKED 态 tap 收藏 / 评论 / 立即复习 | 半屏 LoginSheet 弹出 · 主 CTA「立即注册」次 CTA「已有账号登录」 | router push `/auth?returnTo=/s/<token>` | TC-13.01 (写按钮弹登录) |
| 未成年人合规打码 | type=QUESTION 且服务端识别 `sharer.is_minor=true` | 题图统一压成 240px 缩略 + 全 blur · 学生昵称只露首字 `Z***` | 服务端 `ShareDto` 拼装时强制脱敏 | TC-13.05 |
| 网络异常 (5xx) | GET 5xx | 顶部红条 "网络异常 · 自动重试中" · 重试 × 1 | 1 次后仍失败 → fallback 到 INVALID 挡板 | — |
| ttl_sec 即将耗尽 (< 1h) | maskedPayload.ttlSec < 3600 | audit 卡上 expiresAt 标橙 "即将过期" | 提示性 · 不阻断 | — |

来源：biz §2A.3.2 P-SHARED 卡「令牌安全」+ biz §2A.7 异常路径降级矩阵 L658-L662 + biz §2B.14 关键断言点「写操作全拦」+ biz §10.9 错误码 (`410 TOKEN_EXPIRED` / `403 TOKEN_REVOKED` / `404 TOKEN_INVALID`)。

---

## §10 验收点（TC → AC 映射）

| TC ID | 类型 | GIVEN | WHEN | THEN | spec.md 锚 |
|---|---|---|---|---|---|
| TC-13.01 | 正常 | 合法 token · type=EXAM_DAY · 未登录 | 进入 P-SHARED | 只读预览正确 · 脱敏字段缺失 · 写按钮点击弹 LoginSheet | §4 redactedFields / §6 VIEW_MASKED→REQUIRE_LOGIN / §9 写按钮 |
| TC-13.02 | 正常 | type=QUESTION · 分享者 `allowClaim=true` | 完整走 F01-F07 (注册 → 自动 claim) | claim 成功 · 跳 P-HOME · 错题本 +1 + Toast | §6 VIEW_MASKED→P-HOME / §5 #2 claim API |
| TC-13.03 | 异常 | token `exp` 已过 (`expiresInSec=-1` fixture) | 进入 `/s/:token` | 挡板页 "这个分享已过期" + CTA → P-LANDING (**不 P00**) | §6 VERIFYING→EXPIRED / §7 出口 → P-LANDING / §9 第 1 行 |
| TC-13.04 | 安全 | 接收方拼接 `POST /api/share/:token/comment` | 直接调接口 | 网关 `403 ANONYMOUS_WRITE_FORBIDDEN` | §5 末尾注 / §9 第 4 行 |
| TC-13.05 | 合规 | QUESTION 类型含未成年人图片 | 进入 P-SHARED | 题图 240px 缩略 + 打码 · 不含学生昵称全称 | §4 redactedFields / §9 第 6 行 |

来源：biz §2B.14 SC-13 QA 用例表 L1267-L1273（5 条 TC 全覆盖到本页）+ §12.S9.6 Playwright 骨架 L2871-L2898（TC-13.01 / 13.03 / 13.04 已有真测试样例）。

---

## §11 性能预算

| 操作 | P95 budget | 来源 |
|---|---|---|
| `GET /api/share/:shareToken` 校验签名 + 返 maskedPayload | ≤ 300ms | biz §2B.14 F02「时延预算」L1252 |
| 令牌校验 (HS256 verify + Redis Bloom 撤销位查) | ≤ 100ms | biz §1.5 US-12 「令牌校验 ≤ 100ms」L639 |
| 骨架屏 → VIEW_MASKED 首屏可交互 | ≤ 600ms | biz §2A.3.2 P-SHARED 卡「首屏目标 ≤ 3s」(组合预算 网络 300 + 渲染 300) |
| `POST /api/share/:token:claim` (仅 QUESTION + allowClaim) | ≤ 600ms | biz §2B.14 F06「时延消耗」L1256 |
| LoginSheet 弹出动效（仅前端）| ≤ 200ms | 通用 sheet 动效预算（与 P00 LoginSheet 一致）|

来源：biz §2B.14 SC-13 「时延预算」列 + biz §1.5 US-12 验收标准 + biz §2A.3.2 P-SHARED 卡。

---

## §12 埋点事件

| Event name | When | Properties | 来源 |
|---|---|---|---|
| `anon_share_enter` | route enter `/s/:token` | `{token_jti_hash, entry_source:'share'\|'qr'\|'deeplink'}` | biz §2B.14 F01 + biz §2A.8 (anon_ 事件统一规范) |
| `anon_share_view` | VERIFYING → VIEW_MASKED 渲染成功 | `{type:'EXAM_DAY'\|'QUESTION'\|'REVIEW_NODE', sharer_id_hash, token_age}` | biz §2A.3.2 P-SHARED 卡「埋点事件」+ §2A.8 L680 |
| `anon_share_upgrade_cta` | tap 写按钮 OR tap 吸底「一键加入」 | `{type, cta_variant:'inline-write-tap'\|'sticky-bottom'}` | biz §2A.3.2 + §2A.8 L681 + §2B.14 F04 |
| `anon_share_cta_register` | LoginSheet「立即注册」tap | `{type, return_to}` | biz §2B.14 F05 |
| `anon_share_upgrade_success` | 注册成功 + claim 完成（仅 QUESTION + allowClaim） | `{type, student_id_hash, elapsed_ms}` | biz §2B.14 F06 + §2A.2 北极星指标「分享 → 注册转化率 ≥ 15%」L96 |
| `anon_share_token_expired` | VERIFYING → EXPIRED | `{token_jti_hash}` | biz §2A.3.2 P-SHARED 卡「埋点事件」|
| `anon_share_forward` | (P1) 接收方主动转发分享 | `{type, fwd_channel:'wechat'\|'qq'\|'copy'}` | biz §2A.3.2 P-SHARED 卡「埋点事件」(P1 预留) |
| `shared_view_logged_in` | 已登录态停留 (F07 分支) | `{student_id_hash, type}` | biz §2B.14 F07 |

**埋点合规约束**（biz §2A.8 末尾）：所有 `anon_*` 事件必须携带 `device_fp`，禁止携带原始 PII（不能传 sharer_student_id 原值 · 一律 hash · 不传 nickname 原文）。

来源：biz §2A.3.2 P-SHARED 卡「埋点事件」+ biz §2A.8 埋点字典 L676-L681 + biz §2B.14 SC-13 F01-F07 编排 + biz §2A.2 北极星指标。

---

## §13 testid 表

| testid | 用途 | 出现位置 (mockup 16_shared.html) | E2E 引用 |
|---|---|---|---|
| `p-shared` | 页面根容器 | `.phone` (作为 anon shell 根) | sc-13.spec.ts beforeEach mount |
| `p-shared-statusbar` | iOS 状态栏 | `.statusbar` | — (视觉锚) |
| `sharer-banner` | 分享者横幅 | `.sharer` | sc-13.spec.ts TC-13.01 (`SharedPage.sharedBanner.toContainText('来自')`) |
| `sharer-banner-avatar` | 横幅头像 | `.sharer .av` | — |
| `sharer-banner-text` | 横幅文本块 | `.sharer .txt` | — |
| `masked-question` | 脱敏题卡 | `.qcard` | sc-13.spec.ts TC-13.01 (`SharedPage.maskedCard.toBeVisible()`) |
| `masked-question-stem-clear` | 题干前 12 字 (明文段) | `.qtext` 前段 | sc-13.spec.ts (题干前缀断言) |
| `masked-question-stem-blurred` | 题干 mask span (答案/错因) | `.qtext .mask` (×3) | sc-13.spec.ts (脱敏字段不存在断言) |
| `masked-question-overlay` | 原图磨砂遮罩 | `.qimg::before` + `.qimg .line.blur` + `.qimg .lock` | sc-13.spec.ts (原图脱敏锁断言) |
| `memory-curve-preview` | 记忆曲线预览容器 (REVIEW_NODE) | (mockup 仅 QUESTION 型示例 · 占位) | sc-13.spec.ts REVIEW_NODE 分支 |
| `memory-curve-preview-svg` | 记忆曲线 SVG (打码) | 同上 | 同上 |
| `share-meta` | 审计元数据卡 | `.audit` (令牌 / 有效期 / IP 已记录) | sc-13.spec.ts (审计行可见性断言) |
| `upgrade-cta-fixed` | 吸底 CTA「一键加入我的错题本」 | `.cta-dock .cta-join` | sc-13.spec.ts TC-13.01 (`SharedPage.clickUpgradeCTA()` → 跳 `/auth`) |
| `token-expired-screen` | 过期挡板 | (条件渲染 · 替代 scroll body) | sc-13.spec.ts TC-13.03 (`shared.expiredOverlay.toBeVisible()`) |
| `token-invalid-screen` | 非法挡板 | 同上 | sc-13.spec.ts (签名失败分支) |
| `token-revoked-screen` | 撤销挡板 | 同上 | sc-13.spec.ts (Redis Bloom 命中分支) |

来源：`frontend/packages/testids/src/index.ts` L384-L402 `TEST_IDS.pShared.*` (全部 14 个 key)+ 16_shared.html DOM grep + biz §12.S9.6 Playwright 骨架 L2871-L2898 SharedPage POM。

---

## §14 i18n key

| Key | 中文 | 英文 | 用途 |
|---|---|---|---|
| `shared.banner.from` | 来自同学分享 | Shared by classmate | 横幅次行 |
| `shared.banner.sharedAt` | {n} 分钟前 | {n} min ago | 横幅时间戳 |
| `shared.ribbon.preview` | 预览模式 · 已脱敏显示 · 加入错题本后可查看完整 AI 分析 | Preview · masked · Join to see full AI analysis | 顶部 ribbon |
| `shared.card.lockOriginal` | 原图脱敏 | Original image masked | 题图右下 lock pill |
| `shared.card.lockedKp` | + {n} 个知识点 | + {n} knowledge points | KP locked chip |
| `shared.teaser.title` | AI 错因诊断 · 完整报告 | AI Diagnosis · Full report | teaser 标题 |
| `shared.teaser.lockCta` | 加入错题本查看完整 AI 分析 | Join to view full AI analysis | teaser 锁定层 |
| `shared.teaser.lockDesc` | 含错因 / 正解 / 变式 / 知识点网络 · 自动排 T0-T6 节点 | Includes causes / answers / variants · auto-scheduled T0-T6 nodes | teaser 锁定层副标 |
| `shared.audit.token` | 令牌 · Share Token | Token · Share Token | audit 行 1 |
| `shared.audit.expires` | 有效期 / 过期时间 | Expiry / Expires at | audit 行 2 |
| `shared.audit.ipLogged` | 已记录 IP · 设备指纹 | IP · device fingerprint logged | audit 行 3 (合规告知) |
| `shared.cta.join` | 一键加入我的错题本 | Join my wrongbook | 吸底主 CTA |
| `shared.cta.skip` | 先看看就好 · 不登录 | Browse only · don't sign in | 吸底次 CTA |
| `shared.expired.title` | 这个分享已过期 | This share has expired | EXPIRED 挡板标题 |
| `shared.expired.cta` | 返回看看新功能 | See what's new | EXPIRED 挡板 CTA |
| `shared.invalid.title` | 分享链接无效 | Invalid share link | INVALID 挡板 |
| `shared.revoked.title` | 分享者已撤销此分享 | Sharer has revoked this share | REVOKED 挡板 |
| `shared.loginSheet.title` | 登录后可完整查看 · 立即加入错题本 | Sign in to view full · Join wrongbook | LoginSheet 标题 (F04) |

来源：biz §2A.3.2 P-SHARED 卡「内容形态」+ 16_shared.html 真文案 (`.ribbon` / `.lock` / `.teaser .title` / `.audit .k` / `.cta-join` / `.cta-skip`) + biz §2B.14 F04 「登录后可完整查看 · 立即加入错题本」原文。

---

## §15 关联与影响

- **上游 spec**：(无 spec 文件) SC-09 分享者发出端（`POST /api/share/tokens` 签发令牌 · biz §10.9 L2150）—— 由分享者在 P11 事件页 / P06 单题页点「分享」触发；本页消费该令牌。
- **下游 spec**：
  - **P00 登录页**（spec 待生成）—— `/auth?returnTo=/s/<token>` · LoginSheet 注册 CTA / 吸底 CTA 主出口；登录成功后 returnTo 回锚本页或触发 claim → P-HOME。
  - **P-LANDING.spec.md**（spec 待生成）—— 令牌 EXPIRED / INVALID / REVOKED 三种挡板态的唯一出口（**不回 P00** · biz §2A.3.1 节点 2 降级 + §2A.7 L658）。
  - **P-HOME.spec.md**（已存在）—— type=QUESTION + allowClaim + 登录成功后自动 claim → 跳 P-HOME + Toast "已加入错题本"（biz §2B.14 F07）。
- **关联 SC**：biz §2B.14 SC-13（本页是核心承载页 · F01-F07 全编排）+ biz §2B.10 SC-09（分享者签发端 · 补足闭环）。
- **关联 DDL / 后端**：`share_token` + `share_token_audit`（biz §4.11 · 由 anonymous-service 持有）+ `wb_question`（type=QUESTION 时 backend 拼 maskedPayload 时只读访问 · 不下发原 questionId）。
- **关联网关过滤器**：`AnonFilter`（biz §3 顶端 + §2A.6 安全模型）—— 拦截一切匿名写请求 · 返 `403 ANONYMOUS_WRITE_FORBIDDEN`。
- **关联 mockup**：`design/mockups/wrongbook/16_shared.html`（canonical · QUESTION 型示例 · EXAM_DAY / REVIEW_NODE 型 P1 再补 mockup）。
- **关联合规风险**（biz §13 风险矩阵 L3000 + L3003）：P-SHARED 脱敏规则需过法务 / 合规评审；未成年人保护 → §9 第 6 行强制 240px + 全 blur；小程序版需二次审查。
