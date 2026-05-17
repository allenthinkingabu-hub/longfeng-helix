# SC-11-T04 · Coder Attempt-1 · 工作日志

> P-LANDING 双 CTA 吸底 + ConsentBar + ParentHint + 4 埋点 (view/cta_try/cta_login/bounce)
> + entry_source 白名单 XSS 防 + A/B 桶顺序 · 纯前端 task · 严禁触发 /api/ai/* + /api/guest/*
> (biz §2B.12 关键断言点) · P-LANDING 系列收官棒 (SC-11-T01~T04 全完)

## 1. 地形侦察

**继承基线**:
- **SC-11-T01** 已落 `frontend/apps/h5/src/pages/Landing/LandingPage.tsx` · Promise.allSettled 4 态机 (LOADING/READY/DEGRADED-samples/DEGRADED-kpi/DEGRADED-both) + samples + kpi state。本 task 在 LandingPage 末尾**追加** 3 组件 mount + 2 个 useEffect hook (view + pagehide bounce) · 不破坏 4 态机。
- **SC-11-T02** 已落 HeroDemo + ThreeStepComic · 嵌在 hero 段 + READY 态下方。
- **SC-11-T03** 已落 SampleChips + SampleOverlay · 复用 SC-11-T01 samples state。本 task 包了一层 `onChipClick` 增加 `sampleOpenCountRef.current += 1` 计数 · 给 bounce 上报。
- **路由 (App.tsx L24-45)**: `/auth/login` (真路由 L27) · `/guest/capture` (无路由 · `*` fallback Navigate to "/" replace · TC-11.02 测试必须用 history.pushState spy 抓首次 push 而非最终 URL)。
- **后端 `anonymous-service:8090`** /api/landing/track endpoint 尚未实现 (P1 接 GrowthBook/Sentry)。直接 sendBeacon POST 会触发 [error] resource 404 进浏览器 console · 破 SC-11 evidence-capture spec 的 IDE-clean 红线。**修复**: vite dev middleware 加 `POST /api/landing/track → 204` stub (与现有 `/api/v1/wrongbook/items 403` middleware 同款 pattern)。
- **testids 包** `frontend/packages/testids/src/index.ts` 已有 sc11t01/sc11t02/sc11t03 节 · 本 task append sc11t04 节 (7 testid)。
- **标杆模板**: SC-11-T03 SampleChips (props 接入 + module.css ≤ 1.5KB) + telemetry 风格参考 biz §2A.3.2 埋点字典 · sendBeacon Blob (application/json content-type 必须 Blob 包裹 · 不能用 string body) + fetch + keepalive 退化。

**审查 inflight scope_in 1-11**: 11 项 · 全部 in scope · 无 scope drift。
**审查 scope_out**: 4 项明示 (后端 /api/landing/track 真接入 P1 / SC-12 真页 / GDPR 真合规 / P-OBSERVER 真页) · 本 task 全程不动这些。

## 2. 编码

### 2.1 testids append (commit `fcadd7b`)

`frontend/packages/testids/src/index.ts` 加 `sc11t04` 节 · 7 testid:
- ctaWrap / ctaTry / ctaLogin
- consentBar / consentCheckbox
- parentHint / parentHintLink

### 2.2 telemetry.ts util (commit `fcadd7b`)

`frontend/apps/h5/src/pages/Landing/telemetry.ts` 新建 (3.5KB · 单文件 util)：

- `sanitizeEntrySource(raw: unknown): string` — **严格白名单 Set** {ad, qr, share, push, icon, deeplink, unknown} · 任意非 string / 非白名单值 (空串 / 'undefined' / object / 数字字符串 / SQL / XSS / Unicode bidi / homoglyph / 超长) 全标 `'unknown'`. **不 trim / 不 lowercase / 不正则** — 严格等值匹配。
- `getDeviceFp()` — localStorage 缓存 · 不存在则生成 'dfp-' + base36 短串 (P0 非加密 · P1 接 fingerprintjs)。
- `getExperimentBucket()` — URL `?ab=login_first` → `'login_first'` · 默认 `'try_first'` (P0 stub · P1 接 GrowthBook flag)。
- `readEntrySource()` — 入口净化器 · URL `?entry_source=` 走 sanitizeEntrySource。
- `trackLanding(event, props)` — 入口埋点函数:
  1. 自动注入三件套 `device_fp + entry_source + experiment_bucket + ts`
  2. 镜像 `console.log(event, payload)` (Playwright spy hook · 不依赖 server)
  3. 优先 `navigator.sendBeacon` + **Blob 包 JSON** (sendBeacon 不支持 application/json content-type · 必须 Blob 包裹 type 才会被浏览器透传给 server)
  4. fallback `fetch + keepalive` (Chrome 71+ / Safari 14+)
  5. 全程 try-catch · stub 不存在也不抛

### 2.3 DualCTA 组件 (commit `fcadd7b`)

`frontend/apps/h5/src/pages/Landing/DualCTA/{index.tsx, index.module.css}` (新建)
- **吸底**: `position: sticky; bottom: 0; z-index: 50` · iOS 安全区 `padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px))` (**padding 不是 margin** · padding 才会撑出 bg 区)
- **背景**: 半透明 `rgba(255,255,255,0.94)` + `backdrop-filter: blur(8px)` (含 `-webkit-` prefix)
- **主 CTA 蓝渐变**: linear-gradient #4f46e5→#6366f1 · shadow inset · 文字「试试看（无需注册）」
- **次 CTA 灰边框**: 白底 + #c7d2fe border · 文字「已有账号 → 登录」
- **A/B 桶**: prop `experimentBucket: 'try_first' | 'login_first'` → CSS `flex-direction: row` 或 `row-reverse` · data-bucket 属性同时挂上方便测试断言
- onClick: trackLanding 在 navigate 之前 (sendBeacon 已 enqueue · 页面切换不影响投递)

### 2.4 ConsentBar 组件 (commit `fcadd7b`)

`frontend/apps/h5/src/pages/Landing/ConsentBar/{index.tsx, index.module.css}` (新建)
- **region prop**: `'cn' | 'overseas'` · 国内桶 footer 小字 (默认折叠) · 海外桶顶部 banner (含 checkbox)
- **海外 checkbox 不阻塞 CTA** (符合 inflight scope_in 2(d)) · checkbox 状态 localStorage 持久化
- 国内桶含 `《服务条款》` + `《未成年人隐私》` 文字 (符合 PIPL 国内实践)

### 2.5 ParentHint 组件 (commit `fcadd7b`)

`frontend/apps/h5/src/pages/Landing/ParentHint/{index.tsx, index.module.css}` (新建)
- 小字 「家长 / 老师查看孩子进度?」 + 链接「观察者通道 ›」
- onClick → `navigate('/auth/login')` (P0 临时 · 注释明示 P1 上线 P-OBSERVER 后改路由)
- `<a>` 标签 href 直接写 `/auth/login` · 同时 `preventDefault()` + navigate (SPA 优雅 · 不全页刷新 · 但右键复制链接仍可用)

### 2.6 LandingPage.tsx 改造 (commit `fcadd7b`)

- import 4 个新模块 (DualCTA / ConsentBar / ParentHint / telemetry)
- 加 `pickRegion()` 函数 · URL `?region=overseas` → `'overseas'` (默认 `'cn'`)
- 加 3 个 `useRef`: `experimentBucket` / `region` / `mountedAtRef` (Date.now) / `maxScrollPctRef` / `sampleOpenCountRef`
- **mount useEffect**:
  1. 立即 `trackLanding('anon_landing_view', { region })` · 三件套自动注入
  2. 加 `scroll` listener · 更新 `maxScrollPctRef` (passive)
  3. 加 `pagehide + visibilitychange(hidden)` listener · **`bounced` once flag 防重复** · 上报 `anon_landing_bounce { dwell_ms, scroll_pct, sample_open_count }`
  4. cleanup 卸载所有 listener
- 国内桶 ConsentBar 放在 `<DualCTA>` 上方 · 海外桶 ConsentBar 放在 `<header hero>` 上方 (页面顶部 sticky)
- SampleChips `onChipClick` 包了一层 · 增加 `sampleOpenCountRef.current += 1` 给 bounce 上报使用

### 2.7 vite dev middleware /api/landing/track stub (commit `e58e308`)

`frontend/apps/h5/vite.config.ts` middleware `e2eFallbackPlugin` 加一条:
```ts
if (method === 'POST' && url.startsWith('/api/landing/track')) {
  res.statusCode = 204;
  res.end();
  return;
}
```
**原因**: sendBeacon 真 POST · 后端 P0 无 endpoint · 404 进浏览器 [error] resource console · 破 SC-11 T01/T02/T03 evidence-capture spec 的 IDE-0-error 红线。stub 204 absorb beacon · 与现有 `/api/v1/wrongbook/items 403` middleware 同款 pattern · 最小侵入。

### 2.8 CSS 预算

- DualCTA/index.module.css: 1.4KB
- ConsentBar/index.module.css: 0.8KB
- ParentHint/index.module.css: 0.4KB
- 总 ~ 2.6KB · 远 ≤ 4KB ✓

## 3. 真实 E2E

### 3.1 Playwright 主 spec (commit `ee7818a`)

`frontend/apps/h5/tests/e2e/sc-11/t04-landing-cta-exits-tracking.spec.ts` · **7 testcase 全绿**:

| # | testcase | 关键断言 | 真测结果 |
| - | -------- | ------- | ------- |
| (a) cta_try_navigates_to_guest_capture (**TC-11.02**) | history.pushState spy 抓导航序列 · 含 /guest/capture (绕开 react-router `*` fallback) | PASS (916ms) |
| (b) cta_login_navigates_to_auth | URL pathname === /auth/login (真路由) | PASS (333ms) |
| (c) ab_bucket_order_swap | boundingBox.x 比较 · try_first 主 CTA 在左 / login_first 次 CTA 在左 + data-bucket 属性双重验证 | PASS (474ms) |
| (d) entry_source_xss_sanitized (**TC-11.05**) | `?entry_source=<script>alert(1)</script>` · console.log spy 抓 anon_landing_view payload · entry_source === 'unknown' + DOM 不含未转义 `<script>` | PASS (756ms) |
| (e) bounce_pagehide_telemetry | navigator.sendBeacon patch 抓 Blob payload · pagehide dispatch · payload 含 event=anon_landing_bounce + dwell_ms ≥ 0 + 三件套全注入 | PASS (1.3s) |
| (f) consent_not_required_for_cta | 海外桶 checkbox 未勾 + click ctaTry 不被阻塞 + URL 离开 /welcome | PASS (617ms) |
| (g) sanity_no_unexpected_api_calls | page.route spy · 整 spec /api/ai/* + /api/guest/* 累计 0 (biz 关键断言点) | PASS (443ms) |

### 3.2 Playwright 对抗 spec (commit `ee7818a`)

`t04-landing-adversarial.spec.ts` · **5 testcase 全绿** (超额 · 红线 ≥ 2):

| # | testcase | 关键断言 | 真测结果 |
| - | -------- | ------- | ------- |
| (a) entry_source_whitelist_strict | 8 个非白名单 reps (空/'undefined'/{}/数字/超长 100 字符/SQL OR 1=1/带空格 ' ad '/大写 'AD') 全 'unknown' | PASS (4.1s) |
| (b) parent_hint_p1_stub | ParentHint href === /auth/login (P0 临时) · URL 不含 /observer (P1 P-OBSERVER 未上线) | PASS (413ms) |
| (c) entry_source_unicode_bidi | 4 个 Unicode 攻击向量 (RTL override / 零宽空格 / cyrillic homoglyph / null byte) 全 'unknown' | PASS (1.9s) |
| (e) bounce_once_no_dup | pagehide + visibilitychange + 二次 pagehide 同 task 连发 · anon_landing_bounce sendBeacon 恰 1 次 (bounced once flag 真生效) | PASS (742ms) |
| (d) safe_area_inset_padding_present | computedStyle padding-bottom ≥ 12px (基础值 · env(safe-area-inset-bottom, 0) Desktop = 0) · position=sticky · bottom=0 | PASS (318ms) |

### 3.3 evidence-capture spec (commit `9c68e44`)

`t04-evidence-capture.spec.ts` · 4 状态截图 + ide-console.txt 落盘 · 0 [error] 红线满足 (vite stub 修了 sendBeacon 404)。

### 3.4 真后端真接口 (mock 总数 = 4 · ≤ 5 红线)

- `/api/landing/samples` + `/api/landing/kpi` · vite proxy → anonymous-service:8090 · 真返
- `/api/landing/track` · vite dev middleware stub 204 (测试基础设施 · 非业务 mock · scope_out 注: P1 接真后端)
- mock 列表:
  1. `page.addInitScript` patch `history.pushState` 抓导航序列 (TC-11-T04 a)
  2. `page.addInitScript` patch `navigator.sendBeacon` 捕获 Blob payload (TC-11-T04 e + ADV e)
  3. `page.route('**/api/ai/**', abort)` (TC-11-T04 g)
  4. `page.route('**/api/guest/**', abort)` (TC-11-T04 g)
- 全部是**测试基础设施 spy** (不改业务行为 · 仅观察) · 不算 audit reality mock。

### 3.5 spec → testid → 埋点事件 trace 对照表

| inflight scope_in | testid | 埋点事件 | 主 spec assertion |
| ----------------- | ------ | -------- | ----------------- |
| 1(b) main CTA → /guest/capture + cta_try 上报 | ctaTry | anon_landing_cta_try | (a) history spy 抓 /guest/capture |
| 1(c) secondary CTA → /auth/login + cta_login 上报 | ctaLogin | anon_landing_cta_login | (b) URL === /auth/login |
| 1(d) A/B 桶 prop 控制顺序 | ctaWrap data-bucket | (无) | (c) boundingBox.x + data-bucket 双断言 |
| 4(a) sanitizeEntrySource 白名单 | (URL ?entry_source) | (净化值入 view 上报) | (d) view.entry_source === 'unknown' for XSS |
| 5(c) pagehide → anon_landing_bounce | (window event) | anon_landing_bounce | (e) sendBeacon Blob 含 dwell_ms + 三件套 |
| 2(d) ConsentBar 不阻塞 CTA | consentBar / consentCheckbox | (无独立) | (f) 未勾 click ctaTry · URL 离开 /welcome |
| 关键断言点 · 不调真业务 API | (无) | (无) | (g) /api/ai/* + /api/guest/* 累计 0 |
| 3(b) ParentHint P0 跳 /auth/login | parentHintLink | (合并到 cta_login) | ADV (b) href === /auth/login + 不含 /observer |
| 1(a) safe-area-inset 适配 | ctaWrap | (无) | ADV (d) padding-bottom ≥ 12px + position=sticky |

### 3.6 evidence 落盘

`audits/runs/SC-11-T04/team-1/attempt-1/test-reports/`
- `ide-console.txt` (4.6KB · 0 [error] · 真 anon_landing_view payload 可读 · entry_source 净化为 unknown 当 XSS 时)
- `screenshots/{01_try_first_default_layout, 02_login_first_bucket_swap, 03_overseas_consent_banner_top, 04_entry_source_xss_sanitized}.png` (4 张 · 各 130KB)
- `playwright-list.log` (raw stdout · 13/13 PASS)
- `junit.xml` (4.2KB · 13 testcase 详细)
- `playwright-report/index.html` (HTML 报告)

## 4. 自检

| 自检项 | 状态 | 证据 |
| ----- | ---- | ---- |
| 7 testid 新增 (sc11t04) | ✓ | `grep sc11t04 frontend/packages/testids/src/index.ts` 命中 7 行 |
| 3 组件新建 (DualCTA / ConsentBar / ParentHint) | ✓ | 6 文件落 (3 × tsx + 3 × module.css) |
| telemetry.ts · sanitizeEntrySource 白名单 7 成员 | ✓ | grep 命中 ENTRY_SOURCE_WHITELIST 含 7 元素 · TC-11.05 PASS |
| 4 埋点全实现 | ✓ | anon_landing_view (mount) + cta_try (CTA) + cta_login (CTA) + bounce (pagehide+visibilitychange dedupe) |
| LandingPage 改造 (4 处) | ✓ | overseas ConsentBar 顶部 + ParentHint + 国内 ConsentBar + DualCTA + 2 useEffect hook (view + pagehide) |
| sendBeacon Blob 包 JSON | ✓ | telemetry.ts L130 `new Blob([JSON.stringify(payload)], { type: 'application/json' })` |
| pagehide once flag dedupe | ✓ | ADV (e) bounce_once_no_dup PASS · 连发 3 事件仅 1 次 bounce |
| safe-area-inset-bottom 真在 padding | ✓ | DualCTA/index.module.css L21 `calc(12px + env(safe-area-inset-bottom, 0px))` + ADV (d) PASS |
| Playwright 7 main + 5 adversarial 全绿 | ✓ | 13/13 PASS in junit.xml |
| Regression SC-11 全套 38 testcase 全绿 | ✓ | `playwright test tests/e2e/sc-11/ → 38 passed (33.4s)` |
| TC-11.02 + TC-11.05 嵌入 testcase 名 | ✓ | spec L34 + L130 显式 (TC-11.02) + (TC-11.05) |
| ide-console.txt 0 [error] | ✓ | `grep -c "^\[error\]" → 0` |
| tsc Landing 文件零 error | ✓ | `pnpm exec tsc --noEmit` grep Landing/telemetry/DualCTA/ConsentBar/ParentHint → 0 行 (pre-existing Analyzing/Capture/Result errors 不在 scope_in) |
| Rule 6 tool budget | ⚠️ | tool ≈ 72 · 已过软线 70 · 仍 < 硬线 85 · checkpoint 已 surface |
| commit hash 真实 | ✓ | `git cat-file -e fcadd7b^{commit}` + `ee7818a` + `e58e308` + `9c68e44` 全过 |

## 5. 提交

| commit | hash | 内容 |
| ------ | ---- | ---- |
| 1 | `fcadd7b` | feat(SC-11-T04): DualCTA + ConsentBar + ParentHint + telemetry 落地 (3 组件 + util + LandingPage 改造 + 7 testid append) |
| 2 | `ee7818a` | test(SC-11-T04): Playwright 7 main + 5 adversarial e2e 全绿 |
| 3 | `e58e308` | fix(SC-11-T04): vite dev middleware /api/landing/track 204 stub · 修 evidence spec regression |
| 4 | `9c68e44` | test(SC-11-T04): evidence-capture spec + 4 state screenshots + ide-console.txt (0 [error]) |

(后续 commit 5: work_log 4 件套 + audit-verdict.json + inflight dev_done=true)

## DoD 9 项

1. ✓ DualCTA + ConsentBar + ParentHint 3 组件新建 · 嵌入 LandingPage READY 态 (overseas top / 国内 bottom / DualCTA sticky)
2. ✓ telemetry.ts · sanitizeEntrySource 7 成员严格白名单 + trackLanding (sendBeacon Blob + fetch+keepalive 退化)
3. ✓ 4 埋点全实现: anon_landing_view (mount) + cta_try (CTA) + cta_login (CTA) + bounce (pagehide+visibility dedupe)
4. ✓ testids append 7 个 (sc11t04 节)
5. ✓ Playwright 7 main + 5 adversarial = 13/13 PASS
6. ✓ entry_source XSS 防 · 12 反例 case (8 ASCII + 4 Unicode) 全标 'unknown'
7. ✓ Regression SC-11 全套 38 testcase 全绿 (T01 11 + T02 6 + T03 9 + T04 12 · 多出 1 = evidence spec)
8. ✓ work_log 5 件齐 (coder.md + bugs-found.md + tester.md + adversarial.md + test-reports/)
9. ⏳ audit.js v3 PASS (tester 改 passes 后由 harness 调 · 本文件即为 audit 输入)
