# P-LANDING · 访客落地页（Landing · 价值橱窗）

**Status**: Active
**Owner**: design + frontend + backend (anonymous-service · landing-aggregator · 待建)
**Last-updated**: 2026-05-14
**Mockup**: `design/mockups/wrongbook/14_landing.html`
**Biz refs**: biz §2A.3.2（P-LANDING 规格卡 · L372）+ biz §2A.3.1（登录态决策树节点 2/3）+ biz §2B.12 SC-11（陌生访客 → 落地页 → 样例预览）
**Related tasks**: feature_list.json SC-11 T01（landing-bootstrap-resolve）/ T02（samples-cdn-strong-cache）/ T03（dual-cta-routing）— 编号占位 · 待 gen-feature-list 落地后回填

---

## §1 页面目的

P-LANDING 是冷启动漏斗第一环 · 替代"统一跳 P00 登录墙"的新落位入口。当未登录用户从广告 / 微信分享卡 / 扫码 / 深链 `wb://welcome` 进入、且决策树节点 1（JWT）+ 节点 2（shareToken）+ 节点 3（设备指纹回查）都未命中时，落到本页。它要在 30s 内让访客理解"这是能自动排复习的拍题工具" + 看到 3 组真实样例 + 做出"试一次（无需注册）" / "已有账号 → 登录" 的选择，跳出率目标 ≤ 65%、首周转化漏斗基线 35% / 25% / 15%（landing_view → cta_try → guest_analyze_done）。

---

## §2 布局分区 + Wireframe

### 2.1 布局分区（从上到下 · 来源：biz §2A.3.2「布局分区」+ 14_landing.html 视觉真相）

```
┌─────────────────────────────────────────────┐
│ statusbar (54px · 白字 on hero 极光底)        │
├─────────────────────────────────────────────┤
│ anon-nav (62px · Logo 左 + "登录" 胶囊 右)    │ ← AnonymousShell 顶栏 · 无 Tab Bar
├─────────────────────────────────────────────┤
│ HERO (380px · 极光渐变 #0F1A3D → #8B87F6)     │
│   · eyebrow chip "0 注册成本 · 先看看值不值"  │
│   · h1 "拍一张错题 / AI 给你一条<记忆曲线>"   │
│   · sub 30 字产品价值 · 多模态 / 6 节点 / 触达 │
│   · 3 mchip KPI (P95 4.2s / T0-T6 / 触达 98%) │
├─────────────────────────────────────────────┤
│ scroll 区 (BG #F2F2F7 · 顶部圆角 26px)        │
│   · §样例 chips 横滑 (数学 / 物理 / 英语 · 3 卡)│ ← Tap 开 P-SAMPLE 浮层 (F04)
│   · §features 3 行 (拍 / 排 / 触达)           │
│   · §social proof "本周 2,471 位同学"         │
│   · §how 三步漫画 (拍 → 诊断 → 排期)          │
├─────────────────────────────────────────────┤
│ cta-dock (sticky · 底部吸底 · 双 CTA)          │
│   · cta-try "试一次 · 无需注册" + "免费 1 题"  │ ← 主 · 跳 P-GUEST-CAPTURE
│   · cta-login "已有账号? 直接登录"             │ ← 次 · 跳 P00
│   · cta-hint "点击试一次即同意 < 未成年人保护 >"│
├─────────────────────────────────────────────┤
│ homebar (134×5 · iOS 手势栏)                  │
└─────────────────────────────────────────────┘
```

### 2.2 关键视觉锚（mockup 14_landing.html 真 selector + testids/index.ts 命中）

| Zone | DOM selector / class | testid（`TEST_IDS.pLanding.*`） | 用途 |
|---|---|---|---|
| 页面根 | `.phone` | `landing-page` | 路由 outlet（AnonymousShell 子节点） |
| 顶部匿名导航 | `.anon-nav` | `anon-shell-nav` | Logo + 登录胶囊（属 AnonymousShell · 见 `TEST_IDS.anonShell.*`） |
| Logo | `.brand .logo` | `landing-hero-logo` | 品牌锚 |
| 登录胶囊（顶部） | `.signin` | `anon-shell-login-btn` | 右上副入口 → P00 |
| Hero 区 | `.hero` + `.hero-copy` | `landing-hero` | 极光 + Slogan + KPI 容器 |
| Hero 标题 | `.hero-title` | `landing-hero-headline` | h1 文案 |
| Hero CTA（顶部副本 · 可选） | — | `landing-hero-cta-try` / `landing-hero-cta-login` | 双 CTA 顶部副本（A/B 实验 `cta_order_*` 触发渲染时启用） |
| KPI 容器 | `.metrics` | `landing-kpi` | 3 个 mchip |
| KPI · AI P95 | `.metrics .mchip:nth-child(1)` | `landing-kpi-total` | "4.2s · AI 分析 P95" |
| KPI · 触达率 | `.metrics .mchip:nth-child(3)` | `landing-kpi-retention` | "98% · 到点触达率" |
| 样例横滑 | `.samples` | `landing-samples` | 3 张样例卡（SampleChips） |
| 三步漫画 | `.how` | `landing-three-step` | "拍 → AI 诊断 → 排期" |
| 底部 CTA dock | `.cta-dock` | `landing-cta-bottom` | sticky 双 CTA 容器 |
| 主 CTA "试一次" | `.cta-try` | `landing-cta-bottom-btn` | F07A → P-GUEST-CAPTURE |
| 次 CTA "直接登录" | `.cta-login` | （TBD · 测 ids 未定义专属 · 复用 `anon-shell-login-btn` 或新增 `landing-cta-bottom-login`） | F07B → P00 |

> **注**：14_landing.html mockup 当前**未植入 `data-testid` 属性**，§13 testid 表是按 `frontend/packages/testids/src/index.ts` `TEST_IDS.pLanding.*` + `TEST_IDS.anonShell.*` 反向标注。落地实现时前端必须把 testid 注入到上述 DOM。

---

## §3 核心组件

| 组件 | 来源 | 接受 props | 说明 |
|---|---|---|---|
| `<AnonymousShell>` | `frontend/packages/shells/AnonymousShell` | `{children, hideTabBar=true}` | 匿名页统一外壳 · Logo + 登录胶囊 · 无 Tab Bar |
| `<HeroDemo>` | `frontend/packages/ui-kit/landing` | `{copyVariant: 'v1'\|'v2', demoSrc, kpiList}` | 极光 hero + Slogan + 30s 动图 + 3 KPI chips |
| `<ThreeStepComic>` | `frontend/packages/ui-kit/landing` | `{steps: [{icon, label}]}` | 三步漫画（拍 / 分析 / 排期） |
| `<SampleChips>` | `frontend/packages/ui-kit/landing` | `{samples: SampleVO[], onOpen}` | 横滑 3 张样例卡 · Tap → 开 P-SAMPLE 浮层 |
| `<DualCTA>` | `frontend/packages/ui-kit/landing` | `{onTry, onLogin, order: 'try_first'\|'login_first'}` | sticky 底部双 CTA |
| `<ParentHint>` | `frontend/packages/ui-kit/landing` | `{onClick}` | 家长 / 老师入口（P1） |
| `<ConsentBar>` | `frontend/packages/ui-kit/legal` | `{region: 'CN'\|'GDPR'}` | 未成年人保护提示 · GDPR 区域置顶 |

来源：biz §2A.3.2「核心组件」字段（HeroDemo · ThreeStepComic · SampleChips · DualCTA · ParentHint · ConsentBar）+ 14_landing.html 真 DOM 结构。

---

## §4 数据绑定 (Entity / DTO)

### 4.1 Page-level State 绑定

```typescript
{
  landing: {
    state: 'LOADING' | 'READY' | 'DEGRADED' | 'TO_GUEST' | 'TO_LOGIN',
    samples: Array<{
      qid: string,           // 静态样例 qid（非真实 wb_question）
      subject: 'math' | 'physics' | 'english',
      thumb: string,         // 缩略图 URL（CDN）
      stemSnippet: string,   // 题干前 ~20 字
      err: string,           // 错因摘要
      kp: string,            // 知识点
      tHint: string,         // "T1 · 1h 后复习" 等
    }>,
    kpi: { aiP95Sec: number, ebbinghausNodes: string, deliveryPct: number } | null,
    anonToken: string | null,         // POST /api/anon/visit 返回的 anon_token
    deviceFingerprint: string | null, // IndexedDB + Canvas + UA 组合
    entrySource: 'ad' | 'qr' | 'share' | 'direct' | 'unknown',
    experimentBucket: {
      heroCopy: 'v1' | 'v2',
      sampleCount: 3 | 5,
      ctaOrder: 'try_first' | 'login_first',
    },
  },
}
```

### 4.2 涉及的后端 Entity

- `anon_visit`（anonymous-service · `device_fp` / `anon_token` / `entry_source` / `created_at`）— 由 `POST /api/anon/visit` 写入
- `landing_sample`（静态预置 · 不入 RDB；CDN 强缓存 JSON · 由 `GET /api/anon/samples` 返回）
- `guest_session`（仅 F07A 跳 P-GUEST-CAPTURE 后由 `POST /api/guest/session` 创建 · 见 P-GUEST-CAPTURE spec）

来源：biz §2A.3.2「API 触点」+ biz §4.10 `guest_session` 表 + biz §2A.3.2 设备指纹方案。

---

## §5 API 触点

> 字符级精准 · 与 biz §2A.3.2 + §2B.12 SC-11 对齐 · audits/SC-11-PHASE-0/ 暂未生成 · 待 PHASE-0 audit 补字符级核验后回标。

| # | Method | Path | Headers (req) | Body (req) | Response | P95 预算 | 失败降级 |
|---|---|---|---|---|---|---|---|
| 1 | POST | `/api/anon/visit` | `X-Request-Id`, `X-Device-Fp`（设备指纹 base64） | `{deviceFp, entrySource, experimentBuckets, ua}` | `200 {anonToken, fingerprintMatched:false, ttlSec}` | ≤ 200ms | 5xx → 重试 1 次 · 仍失败则用 `anonToken=local-${uuid}` 兜底 · 不阻塞渲染 |
| 2 | GET | `/api/anon/samples?bucket=default` | `Cache-Control: max-age=3600` | — | `200 {samples: SampleVO[], etag}` | ≤ 200ms（CDN 命中 ≤ 50ms） | 5xx → `state=DEGRADED` · 降级到前端 `assets/landing/samples-fallback.json` 本地默认 |
| 3 | GET | `/api/landing/kpi` | — | — | `200 {totalQuestions, dailyAnalyze, deliveryPct, ts}` | ≤ 200ms | 5xx → KPI chip 显示静态文案 "4.2s · T0-T6 · 98%" |
| 4 | GET | `/api/session/resolve` | `X-Device-Fp` | — | `200 {fingerprintMatched: boolean, hasJwt: boolean}` | ≤ 200ms | 仅 bootstrap 阶段调用；本页本身不再调用（已落位完成） |

**注 §5 与 biz §2A.3.2 的差异**：biz 原文写的是 `GET /api/landing/samples`（路径前缀 `landing`）· 本 spec 采纳任务 brief 指定的 `GET /api/anon/samples`（前缀 `anon`，与 anonymous-service + AnonFilter 命名一致 + biz §20 微服务名一致）· 视为命名收敛 · biz 文档需在下一版回改对齐。

来源：biz §2A.3.2「API 触点」（高层）+ biz §2A.3.1「`GET /api/session/resolve`」+ biz §2B.12 F01-F03 编排 + 任务 brief §关键约束。

---

## §6 状态机

```
                ┌─────────┐  bootstrap done  ┌──────────┐
                │ LOADING │─────────────────→│  VIEW    │
                └─────────┘  samples 200     │ (READY)  │
                    │                        └────┬─────┘
                    │ samples 5xx               │ │ │
                    ▼                            │ │ │
                ┌──────────┐                    │ │ │
                │ DEGRADED │ ←──── hero only ───┘ │ │
                └──────────┘                       │ │
                    ▲                              │ │
                    │ retry samples (manual)       │ │
                    │                              │ │
                    │       cta_try.tap            │ │
                    │   ┌──────────────────────────┘ │
                    │   ▼                            │
                    │ ┌──────────┐ navigate         │
                    │ │TO_GUEST  │────► P-GUEST-CAPTURE
                    │ └──────────┘                  │
                    │       cta_login.tap           │
                    │   ┌────────────────────────────┘
                    │   ▼
                    │ ┌──────────┐ navigate
                    │ │TO_LOGIN  │────► P00
                    │ └──────────┘
```

### 6.1 状态转移规则

| From | To | Trigger | Side effect |
|---|---|---|---|
| (init) | LOADING | route mount + bootstrap 决策树落位本页 | 并发发起 `/api/anon/visit` + `/api/anon/samples` + `/api/landing/kpi` |
| LOADING | VIEW | samples 200 + visit 200（kpi 可降级） | 渲染 hero + samples + how + dual CTA · 埋 `anon_landing_view{entry_source}` |
| LOADING | DEGRADED | samples 5xx 或网络超时 > 1.5s | 仅渲染 hero + dual CTA · 埋 `anon_landing_degrade{reason}` + 监控告警 |
| DEGRADED | VIEW | 用户下拉手动 retry · samples 200 | 增量渲染 samples + features |
| VIEW | TO_GUEST | tap `cta-try`（主 CTA） | 埋 `anon_landing_cta_try` · `router.push('/guest/capture')` |
| VIEW | TO_LOGIN | tap `cta-login`（次 CTA）或顶部 `anon-shell-login-btn` | 埋 `anon_landing_cta_login` · `router.push('/login?redirect=/welcome')` |
| VIEW | (exit) | 用户直接关闭 H5 / 后退 | 埋 `anon_landing_bounce{dwell_ms}` |
| 任意 | LOADING | `anon_token` 已存在但 `entry_source=share` 重入 | 跳过本页 · 直接 router.replace 到 P-GUEST-CAPTURE（见 §9 异常 4） |

来源：biz §2A.3.2「状态集」(`LOADING/READY/DEGRADED`) + biz §2B.12 SC-11 F07A/F07B/F07C + 任务 brief §6 状态机扩展（增加 TO_GUEST / TO_LOGIN 终态以匹配双 CTA 路由）。

---

## §7 跳转

| 入口 | 来源 | 触发条件 |
|---|---|---|
| 冷启动决策树落位 | `bootstrap/resolve-entry.ts` | 节点 1 无 JWT + 节点 2 无 shareToken + 节点 3 设备指纹未回查到 student_id（biz §2A.3.1 ⬇ P-LANDING 分支） |
| 深链 `wb://welcome` | 微信小程序 / H5 / App | URL 直访 `/welcome` |
| 分享链令牌失效降级 | P-SHARED 节点 2 校验失败 | shareToken 过期 / 签名无效 / `revoke_list` 命中（biz §2A.3.1 回退细则 "节点 2 令牌失效 → 直接 P-LANDING"） |
| P00 「没有账号？先看看」 | P00 登录页副入口 | 用户从 P00 主动后退到本页 |
| P-SHARED `TOKEN_EXPIRED` 挡板 CTA | P-SHARED 异常态 | biz §2A.3.2 P-LANDING「跳转-入」字段 |

| 出口 | 目标 | 触发条件 |
|---|---|---|
| 主 CTA「试一次」 | P-GUEST-CAPTURE (`/guest/capture`) | F07A · 不要求登录（TC-11.02） |
| 次 CTA「已有账号」 | P00 (`/login?redirect=/welcome`) | F07B |
| 顶部 `登录` 胶囊 | P00 (`/login?redirect=/welcome`) | AnonymousShell 右上副入口 |
| 家长 / 老师入口（P1） | P-OBSERVER 说明页 | `<ParentHint>` tap |
| 关闭 / 后退 | 浏览器历史 / 微信 webview close | F07C |

来源：biz §2A.3.2「跳转」+ biz §2A.3.1 决策树 + biz §2B.12 SC-11 F01-F07。

---

## §8 Wire format (SSE / WebSocket 事件)

本页无 SSE / WebSocket 通道 · 事件通讯全部走 §5 HTTP 触点。落地页是纯静态聚合 + 路由决策 · AI 流式分析在下游 P03（P-GUEST-CAPTURE 提交后跳 P03）。

---

## §9 异常 & 降级

| # | 异常 | 触发条件 | UI 反馈 | 系统行为 | 关联 TC |
|---|---|---|---|---|---|
| 1 | 设备指纹生成失败 | IndexedDB 禁用 / Canvas API 不可用 / Safari 隐私模式 | 静默 · 不弹 toast | `deviceFp=fallback-${random()}` + `anon_token` 仍可发 · 标 `entry_source` 不变 · 埋 `anon_landing_fp_fail` | — |
| 2 | `GET /api/anon/samples` 5xx | 后端 anonymous-service down / 超时 > 1.5s | `state=DEGRADED` · 只露 hero + 双 CTA · samples 区显示骨架占位 + "样例加载失败 · 直接试试看 →" | 监控告警 + 走 CDN edge 兜底（如可用）+ 降级 `assets/landing/samples-fallback.json` | TC-11.03 |
| 3 | 弱网（3G / 卡顿） | hero 动图加载 > 1.5s | hero 退为静态海报（mockup `.hero` 渐变 + 文案立即显示）· CTA 必须在 1.5s 内可点 | 动图懒加载 · CTA 渲染优先级最高 · TTI ≤ 1.0s | TC-11.04 |
| 4 | 已是匿名态（`anon_token` 已存在） | 用户从 P-LANDING 出 → P-GUEST-CAPTURE → 后退回 P-LANDING | 不重新走 LOADING · 直接 router.replace 到 P-GUEST-CAPTURE（避免重复消费 visit 额度） | 读 `localStorage.anon_token` · 若 < TTL 直接跳；若过期则正常 LOADING | — |
| 5 | `entry_source` 被篡改为 `<script>` 等 XSS | URL query `?from=<script>` | 前端白名单校验：仅接受 `ad/qr/share/direct` · 其他归入 `unknown` | 服务端二次校验 · 非白名单值不入 ClickHouse | TC-11.05 |
| 6 | 地区合规（海外 GDPR） | IP / locale 判定为 EU | `<ConsentBar>` 置顶 + cookie banner | 必须显式 opt-in 才能写设备指纹 cookie | — |
| 7 | `GET /api/landing/kpi` 5xx | 后端 kpi 聚合 down | KPI chips 显示静态文案 `4.2s / T0-T6 / 98%` | 不阻塞页面 · 不进 DEGRADED · 静默降级 | — |
| 8 | 节点 2 shareToken 失效降级入 | `wb://s/:token` 签名无效 / 过期 | 直接落 P-LANDING · 顶部增加 banner "这个分享已过期" + 副本 CTA "看看产品" | 不回 P00 · 不透传 `relation_id`（biz §2A.7 异常路径降级矩阵） | — |

来源：biz §2A.3.2「异常态」+ biz §2A.7 异常路径降级矩阵 + biz §2B.12 SC-11 TC 表 + 任务 brief §9 异常 3 条扩展。

---

## §10 验收点 (TC → AC 映射)

| TC ID | 类型 | GIVEN | WHEN | THEN | 关联 task AC |
|---|---|---|---|---|---|
| TC-11.01 | 正常 | 新设备首次打开 H5 · `device_fp=new` | 冷启动 → 决策树落位 P-LANDING → 看完 hero → tap 样例 | 落地页 TTI ≤ 1.0s · 浮层开合顺畅 · 埋点 `anon_landing_view → anon_landing_sample_open` 连续 | T01 AC（landing-bootstrap-resolve · 编号待 gen-feature-list 回填） |
| TC-11.02 | 正常 | 已进入 P-LANDING（`state=VIEW`） | tap「试一次 · 无需注册」 | 跳转 P-GUEST-CAPTURE · URL `/guest/capture` 正确 · 埋点 `anon_landing_cta_try` · 不要求登录 | T03 AC（dual-cta-routing） |
| TC-11.03 | 异常 | `GET /api/anon/samples` 返回 500 | 进入 P-LANDING | `state=DEGRADED` · 只露 hero + 双 CTA · 不卡整页 · 监控告警 `anon_landing_degrade{reason}` | T02 AC（samples-cdn-strong-cache） |
| TC-11.04 | 边界 | 弱网 3G（Chrome DevTools 节流 `Slow 3G`） | 进入 P-LANDING | hero 动图不阻塞 CTA 渲染 · CTA 在 1.5s 内可点 | T01 AC（性能预算） |
| TC-11.05 | 安全 | URL query `?from=<script>alert(1)</script>` | 进入 P-LANDING | 前端白名单过滤 · `entry_source` 落 `unknown` · 服务端二次校验 · 不入 ClickHouse | T01 AC（埋点 XSS 防护） |

来源：biz §2B.12 SC-11 QA 用例表 TC-11.01..05（字符级一致 · 不允许 fabricate 新 TC 番号）。

---

## §11 性能预算

| 操作 | P95 budget | 来源 |
|---|---|---|
| 首屏 TTI（hero + double CTA 可点） | ≤ 1.0s | biz §2A.3.2「性能预算」 |
| CTA 可点（弱网 3G） | ≤ 1.5s | biz §2B.12 TC-11.04 |
| `POST /api/anon/visit` | ≤ 200ms | biz §2B.12 F01 时延预算 |
| `GET /api/anon/samples`（CDN 命中） | ≤ 50ms | biz §2B.12 关键断言"CDN 命中率 ≥ 95%" |
| `GET /api/anon/samples`（CDN miss） | ≤ 200ms | biz §2B.12 F02 |
| Hero 动图体积 | ≤ 300KB（WebP / APNG） | biz §2A.3.2「性能预算」 |
| 总包体积（不含动图） | ≤ 180KB | biz §2A.3.2「性能预算」 |
| 样例浮层开 / 关 | ≤ 200ms | biz §2B.12 F04 时延预算 |

来源：biz §2A.3.2「性能预算」+ biz §2B.12 关键断言点 + biz §2B.12 时延预算列。

---

## §12 埋点事件

| Event name | When | Properties | 来源 |
|---|---|---|---|
| `anon_landing_view` | 路由 mount + `state=VIEW`（不在 LOADING / DEGRADED 发） | `{entry_source, experiment_bucket: {heroCopy, sampleCount, ctaOrder}, device_fp_hash}` | biz §2A.3.2 + biz §2B.12 F02 |
| `anon_landing_demo_play` | hero 动图自动播放完毕 | `{sec: 30}` | biz §2A.3.2 + biz §2B.12 F03 |
| `anon_landing_sample_open` | tap 样例卡 → 开 P-SAMPLE 浮层 | `{subject: 'math'/'physics'/'english', qid}` | biz §2A.3.2 + biz §2B.12 F04 |
| `anon_landing_cta_try` | tap 主 CTA "试一次" | `{entry_source, experiment_bucket}` | biz §2A.3.2 + biz §2B.12 F07A |
| `anon_landing_cta_login` | tap 次 CTA "已有账号" 或顶部登录胶囊 | `{entry_source, experiment_bucket, source: 'bottom'/'top'}` | biz §2A.3.2 + biz §2B.12 F07B |
| `anon_landing_bounce` | beforeunload + dwell_ms > 0 | `{dwell_ms, scroll_depth_pct}` | biz §2B.12 F07C |
| `anon_landing_degrade` | `state=LOADING → DEGRADED` | `{reason: 'samples_5xx'/'samples_timeout'}` | biz §2A.3.2 异常态 + TC-11.03 |
| `anon_landing_fp_fail` | 设备指纹生成失败兜底 | `{fallback_reason: 'indexeddb_disabled'/'canvas_blocked'/...}` | 任务 brief §9 异常 1 |

**通用属性**（所有 `anon_*` 事件必带 · biz §2A.3.2 章节开头规约）：`{device_fp, entry_source, experiment_bucket}`

来源：biz §2A.3.2「埋点事件」 + biz §2A.8 埋点字典 + biz §2A.3.2 匿名 Shell 顶端"埋点事件前缀统一为 `anon_`，事件需附带 `device_fp / entry_source / experiment_bucket` 三个通用属性"。

---

## §13 testid 表

| testid | 用途 | 出现位置（来源） | E2E 引用（待写） |
|---|---|---|---|
| `landing-page` | P-LANDING 页面根 | `TEST_IDS.pLanding.root` · `frontend/packages/testids/src/index.ts:369` | `sc-11.spec.ts` beforeEach mount |
| `landing-hero` | Hero 容器（极光 + Slogan + KPI） | `TEST_IDS.pLanding.hero` · L370 | `sc-11.spec.ts` F02 assertReady |
| `landing-hero-logo` | 品牌 Logo | `TEST_IDS.pLanding.heroLogo` · L373 | — |
| `landing-hero-headline` | Hero h1 标题 | `TEST_IDS.pLanding.heroHeadline` · L374 | `sc-11.spec.ts` F02 |
| `landing-hero-cta-try` | Hero 顶部副本 "试一次"（A/B `cta_order_try_first`） | `TEST_IDS.pLanding.heroCataTry` · L372 | TC-11.02 副路径 |
| `landing-hero-cta-login` | Hero 顶部副本 "已有账号"（A/B 同上） | `TEST_IDS.pLanding.heroCataLogin` · L371 | — |
| `landing-kpi` | KPI 3 chip 容器 | `TEST_IDS.pLanding.kpi` · L377 | — |
| `landing-kpi-total` | KPI 第 1 chip "AI P95 4.2s" | `TEST_IDS.pLanding.kpiTotal` · L378 | — |
| `landing-kpi-retention` | KPI 第 3 chip "触达 98%" | `TEST_IDS.pLanding.kpiRetention` · L379 | — |
| `landing-samples` | 样例横滑容器 | `TEST_IDS.pLanding.samples` · L375 | TC-11.01 F04 |
| `landing-three-step` | 三步漫画区 | `TEST_IDS.pLanding.threeStep` · L376 | — |
| `landing-cta-bottom` | 底部吸底 CTA dock 容器 | `TEST_IDS.pLanding.ctaBottom` · L380 | — |
| `landing-cta-bottom-btn` | 底部主 CTA "试一次"（默认主路径） | `TEST_IDS.pLanding.ctaBottomBtn` · L381 | TC-11.02 主路径 |
| `anon-shell-root` | AnonymousShell 外壳 | `TEST_IDS.anonShell.root` · L322 | — |
| `anon-shell-nav` | 顶部 nav（Logo + 登录胶囊） | `TEST_IDS.anonShell.nav` · L323 | — |
| `anon-shell-login-btn` | 顶部登录胶囊（次入口 → P00） | `TEST_IDS.anonShell.loginBtn` · L325 | F07B 副路径 |
| `landing-cta-bottom-login` | 底部次 CTA "已有账号 → 登录" | **TBD** · testids/index.ts 未定义 · 实现时需新增 | F07B 主路径 |

来源：`frontend/packages/testids/src/index.ts` L321-382（`anonShell` + `pLanding` 两个命名空间）+ 14_landing.html DOM 反向标注。**注**：mockup 当前未植入 `data-testid` · 落地实现时前端需把 testid 注入到上述 DOM；`landing-cta-bottom-login` 需补充进 testids 包。

---

## §14 i18n key

| Key | 中文 | 英文 | 用途 |
|---|---|---|---|
| `landing.eyebrow` | 0 注册成本 · 先看看值不值 | No signup · see the value first | Hero eyebrow chip |
| `landing.title.line1` | 拍一张错题 | Snap a wrong question | Hero h1 第 1 行 |
| `landing.title.line2.prefix` | AI 给你一条 | And AI delivers a | Hero h1 第 2 行前缀 |
| `landing.title.line2.highlight` | 记忆曲线 | memory curve | Hero h1 第 2 行高亮（渐变色） |
| `landing.subtitle` | 多模态识别题干 · 诊断错因 · 自动排 6 次艾宾浩斯复习 · 到点全平台提醒。无需登录即可试一次。 | Multimodal OCR · root-cause diagnosis · 6 Ebbinghaus reviews · cross-channel reminders. No login required. | Hero sub |
| `landing.kpi.aiP95` | AI 分析 P95 | AI P95 | 第 1 chip label |
| `landing.kpi.nodes` | 7 节点自动排期 | 7-node auto-schedule | 第 2 chip label |
| `landing.kpi.delivery` | 到点触达率 | On-time delivery | 第 3 chip label |
| `landing.samples.title` | 真实样例 · 匿名脱敏 | Real samples · anonymized | 样例区 section title |
| `landing.samples.swipeHint` | 滑动查看 → | Swipe → | 副本 |
| `landing.cta.try` | 试一次 · 无需注册 | Try once · no signup | 主 CTA |
| `landing.cta.try.badge` | 免费 · 1 题 | Free · 1 question | 主 CTA 标签 |
| `landing.cta.login` | 已有账号？直接登录 | Already have an account? Log in | 次 CTA |
| `landing.cta.hint` | 点击「试一次」即表示同意 <未成年人保护条款> · 结果保留 24 小时 | By tapping "Try once" you agree to <Minor Protection Terms> · result kept 24h | CTA 下方法律 hint |
| `landing.degraded.tip` | 样例加载失败 · 直接试试看 → | Samples failed to load · try it now → | DEGRADED 态副本 |
| `landing.share.expired.banner` | 这个分享已过期，看看产品本身 | This share expired · explore the product | 节点 2 降级 banner |

来源：14_landing.html 真文案 + biz §2A.3.2「i18n Key」字段（biz 卡未明列 key 名 · 此处按 `landing.*` 命名空间约定补全）+ frontend/packages/i18n（待建）。

---

## §15 关联与影响

- **上游 spec**: 无（本页是冷启动决策树最末端的"未命中"落位）· 调用源 `bootstrap/resolve-entry.ts`
- **下游 spec**:
  - P-GUEST-CAPTURE（主路径 F07A · `/guest/capture`）— 游客拍题 · 1 题免费额度 · 见 biz §2A.3.2 P-GUEST-CAPTURE 卡
  - P00（次路径 F07B · `/login?redirect=/welcome`）— 标准登录
  - P-OBSERVER（家长 / 老师 P1 入口）— 见 biz §2A.3.2 P-OBSERVER 卡
- **关联 SC**: SC-11（本页主场景）· SC-12（接 F07A）· SC-13（节点 2 失效降级入）· SC-14（P-WELCOMEBACK 自动超时回本页）
- **关联 task**: feature_list.json SC-11（待 gen-feature-list 落地）— 预计涉及 landing-bootstrap-resolve / samples-cdn-strong-cache / dual-cta-routing 3 个 task
- **关联 audit**: audits/SC-11-PHASE-0/ （待 PHASE-0 audit · 届时回标 §5 字符级 path）
- **关联 mockup**: design/mockups/wrongbook/14_landing.html
- **关联微服务**: anonymous-service（待建 · biz §20 + §2A.3.2）+ AnonFilter 网关过滤器（biz §20 introduction）
- **关联 entity / migration**: `anon_visit`（V20260421_02 · biz §1.2 introduction）+ `guest_session`（biz §4.10 · 由下游 P-GUEST-CAPTURE 创建）
