# SC-16-T02 · Coder Phase 3 工作日志 (attempt-1)

**Task**: 学生 P-HOME Tap「查看全部 ›」→ MP P-WEEKLY-REVIEW 6 数据块 + 薄弱 KP CTA → P05 + 14 testid + 7 新组件 + P-HOME 4 数字 wire today.weekSummary

**Phase**: 3 · Coder (用户 Phase 2.5 verdict=APPROVE 后)
**Attempt**: 1
**Branch**: `claude/brave-shaw-0bb0e4`
**Commit Hash**: `45c58cb` (verified · git cat-file -e 通过)
**dev_done**: true (本日志落盘后改 inflight)

trace:
- `audits/runs/SC16-T02/team-1/attempt-1/test-cases.md` Round 3 终态 (User Approval verdict: APPROVE · 第 169 行 grep 命中)
- `.harness/inflight/SC16-T02.json` user_verdict_approve=true · tc3_mock_decision=mp.mockWxMethod
- `design/system/pages/P-WEEKLY-REVIEW-weekly-review.spec.md` §2-§14
- `design/system/pages/P-HOME.spec.md` §5/§5.2 weekSummary 4 数字 wire 规则
- `biz/features/P-WEEKLY-REVIEW__weekly-review.md` §2A.4 + §2B.17 + §10.13-10.14
- T01 上游 `047a061` (backend weekly_aggregate service + GET /weekly + /today.weekSummary)

---

## 1. 地形侦察 (Step 1-2 + Step 3 标杆对齐)

**全栈上下文恢复**:

1. **既有 MP 工程结构** (`frontend/apps/mp/`):
   - `app.json` pages[] 列表 + tabBar.list (capture / wrongbook-list 在 tabBar · navigateTo 不允许带 query 切 tab)
   - `pages/home/{index.ts,wxml,wxss,helpers.ts}` (P-HOME 标杆 · 复用 `data-test-id` attribute 模式)
   - `pages/wrongbook-list/index.ts` (P05 · 已 ls 验存在 · `onLoad(options)` 接收 query)
   - `src/api/{_http.ts,home.ts}` (httpJSON 双 runtime adapter · wx.request | fetch · 自动 unwrap ApiResult envelope)
   - `test/e2e/_helpers.ts` 三件套 (connectMp + assertConsoleClean + assertPageRenders) + `test/e2e/home.spec.ts` 标杆
   - `scripts/lint.mjs` (跨文件一致性 · usingComponents / tabBar / wx.switchTab 验证 + miniprogram_npm 自愈)

2. **既有 workspace packages**:
   - `@longfeng/testids` · `TEST_IDS` 命名空间树 (p02/p03/p04/p05/p06/p07/p08/p09/p10/p11/p12/p13/p00/pHome/...)
   - `@longfeng/telemetry` · `track() / __getBuffer() / __resetBuffer()` 真 API (Tester REJECT #3 校准)
   - `@longfeng/api-contracts` · `homeClient.getToday()` 已存在 · `HomeTodayResp` types 已有 + SC-16-T01 加 weekSummary 字段

3. **T01 backend 已落地** (commit 047a061):
   - `WeeklyController` GET /api/home/weekly · X-User-Id Header · 401/500 错误码
   - `HomeAggregatorController.getToday()` 扩展含 weekSummary 4 字段投影 (同 weekly_aggregate service 调用)
   - `WeekSummaryDto` (week/masteryRate/sparkline[7]/streak/newCount) + `WeeklyReviewResp` (完整 7 顶层 keys)
   - 学生端脱敏天然生效 (DTO 字段集层)

4. **mockup 真相** (`design/mockups/wrongbook/14_weekly_review.html`):
   - 14 个 `data-testid` 命中 (mockup 是 H5 风格 · MP 实际用 `data-test-id` 带连字符)
   - 6 数据块顺序锚 + 14 href 真路径 (P05 / P06 / P02 / P-HOME / etc.)

5. **MP 平台真相**:
   - 不支持原生 `<svg>` 标签 → 用 `<image src="data:image/svg+xml;utf8,...">` 兜底
   - 不支持 web `aria-label` → 用 `.sr-only` wxss class 文本节点 + `data-a11y-delta-direction` 自定义 attr (Tester REJECT #2 校准)
   - `wx.switchTab` 不支持 query string · 与 INV-5 「URL 必含 kpId」 冲突 → 选 `wx.navigateTo` (P05 同名 tabBar item 重合 · spec drift surface 见 bugs-found.md)

---

## 2. 编码 (Step 3 全栈编码 · 自底向上击穿)

按依赖顺序落地:

### 2.1 frontend/packages/api-contracts (后端契约单源)

**`src/types.ts` 扩展**: 加 `WeekSummary` interface (5 字段含 null 兜底) + 扩展 `HomeTodayResp.weekSummary?` + 完整 `WeeklyReviewResp` 含 8 sub-record (`SubjectCode | WeeklyHero | WeeklySubjectRadar | WeeklyWeakKp | WeeklyStats | WeeklyFailedQ | WeeklyAiInsight | WeeklyRange`).

字符级对齐 backend `WeeklyReviewResp.java` (commit 047a061) · 例如 backend `FailedQ.questionId` 严格用 `questionId` 不用 `qid` (与 H5 spec 用 `qid` 不同 · 以 backend 为准 · 前端 view-model 单独映射).

**`src/clients/home.ts` 扩展**: 加 `homeClient.getWeekly(studentId, tz?)` 带 X-User-Id Header (INV-7 鉴权 MVP · 与 /today 一致).

### 2.2 frontend/packages/testids

**新增 `TEST_IDS.weekly` 命名空间** (17 testid · 14 mockup 锚 + 3 实现层必须):
- `root, back, range, hero, delta, sparkline, radar, weakKp1, weakKp2, weakKp3, statsTrio, failedScroller, aiInsight, empty` (14 mockup 锚)
- `errorBanner, retryBtn, emptyCta` (3 实现层)

**新增 `TEST_IDS.pHome.weekSummary`** (4 testid):
- `masteryRateNum, sparklineSvg, streakChip, newCountNum` (替代旧 H5 mockup `.tile.mastery / .streakchip` CSS class 锚 · 改 MP testid)

**新增 `TEST_IDS.pHome.weeklyHomeLink`** (P-HOME 「查看全部 ›」 入口)

### 2.3 frontend/packages/telemetry

**新增 `WEEKLY_EVENTS`** 10 event 名常量 (`view / dataRender / weakKpView / weakKpTap / failedQTap / aiInsightView / retry / emptyCtaTap / share / back`)
带 TypeScript `WeeklyEventName` 类型 · 防裸字符串引用 · 调用方 `track(WEEKLY_EVENTS.view, ...)` 形式.

### 2.4 frontend/apps/mp/src/api

**新增 `weekly.ts`** · `getWeeklyReview(studentId, tz?)` · 字符级对齐 backend `WeeklyReviewResp` record · 7 DTO interface (Hero / SubjectRadar / WeakKp / Stats / FailedQ / AiInsight / Range) · 自动 unwrap ApiResult.

**扩展 `home.ts`** · 加 `getHomeTodayAggregate(studentId)` · GET /api/home/today 含完整 weekSummary 字段 (区别于既有 `getHomeTodayCount` 复用旧 /api/review/today endpoint).

### 2.5 frontend/apps/mp/pages/me/weekly (P-WEEKLY-REVIEW 全新页)

4 文件 (index.json/ts/wxml/wxss) + helpers.ts:

**index.ts** (核心 page):
- Page data state machine (LOADING/READY/EMPTY/ERROR · spec §6)
- `_fetchWeekly(from)` 调 `getWeeklyReview(MVP_STUDENT_ID)` · 按 `stats.reviewedCount === 0` 切 EMPTY · catch → ERROR + parse error code
- View-model 派生函数:
  - `_buildHeroViewModel` · masteryRateText / deltaText / deltaDirection / deltaSrText / sparklinePath
  - `_buildRadarViewModel` · subjectRadar → svg data URI + legend
  - `_buildWeakKpsViewModel` · slice 3 + rank-1 highlight + ctaLabel ("立即专练" / "练一次")
  - `_buildFailedTopViewModel` · slice 5 + subjectLabel 中文化
- Handler:
  - `onWeakKpTap` · INV-5 守 · `wx.navigateTo('/pages/wrongbook-list/index?kpId=...')` · 不用 switchTab
  - `onFailedQTap` · `wx.navigateTo('/pages/result/index?qid=...')`
  - `onRetryTap` · 重新拉 + weekly_retry 埋点
  - `onEmptyCtaTap` · `wx.switchTab('/pages/capture/index')` (capture 在 tabBar.list)
  - `onBackTap` · `wx.navigateBack` (fallback switchTab home)
- 埋点:
  - `weekly_view` (mount + onShow)
  - `weekly_data_render` (READY 后)
  - `weekly_weak_kp_view` (每个 KP 一条 · simplified IntersectionObserver)
  - `weekly_ai_insight_view` (aiInsight 非 null 时)
  - 用户操作触发: `weekly_weak_kp_tap / weekly_failed_q_tap / weekly_retry / weekly_empty_cta_tap / weekly_back / weekly_share`

**helpers.ts** (纯函数 · 单测覆盖):
- `formatMasteryPct(0.68) → "68%"` · `null → "—%"` (em dash)
- `formatDeltaText(0.06) → "+6"` · `null → ""`
- `computeDeltaDirection(delta) → 'up'|'down'|'flat'` (±0.005 threshold)
- `formatRangeLabel({from,to}) → "5月11 – 17日"` (同月 / 跨月分支)
- `computeWeekLabel("2026-W20") → "W20"`
- `buildSparklinePath(sparkline)` · null 索引断笔 · 拆多 M 段
- `buildSubjectRadarSvg(subjects)` · 170×170 viewBox · 4 层网格 + 1 数据多边形

**index.wxml**:
- topbar (back + titlecol + share)
- ERROR banner (`weekly-error-banner` + `weekly-retry-btn`)
- EMPTY hero (`weekly-empty` + `weekly-empty-cta`)
- LOADING skeleton (6 块)
- READY block (6 数据块 顺序淡入 wxss animation):
  - HERO 暗卡 (`weekly-hero` · masteryRateText + `weekly-delta` data-a11y-delta-direction + `.sr-only` 文本 + `weekly-sparkline` svg data URI)
  - Radar 卡 (`weekly-radar`)
  - WeakKP 卡 wx:for (`weekly-weak-kp-{rank}` · data-kpid + data-rank)
  - StatTrio (`weekly-stats-trio`)
  - FailedScroller (`weekly-failed-scroller` scroll-x)
  - AI Insight 暗卡 (`weekly-ai-insight` · null fallback "AI 复盘生成中")

**index.wxss**:
- `.sr-only` visually-hidden class 新建 (MP A11Y pattern · 替代 web aria-label)
- 6 数据块 fadeIn animation · 错位 100ms (Hero 0/Radar 100/KP 200/Stat 300/Failed 400/Insight 500)
- delta-chip 3 variant (up 绿 / down 红 / flat 灰)
- KP highlight rank-1 暖橙渐变 · rank-2/3 white outline

### 2.6 frontend/apps/mp/pages/home (P-HOME 改造)

**index.ts** 扩展:
- 加 `homeWeekSummary / weekSummaryMasteryText / weekSummarySparklineUri / weekSummaryStreak / weekSummaryNewCount` 5 个新 data field
- `onLoad` 内并行调 `_fetchWeekSummary()` (INV-6 独立调 /today 不调 /weekly)
- 加 `onWeeklyHomeTap` handler · `wx.navigateTo('/pages/me/weekly/index')`
- 保留 `weekStats / sparklineSvgUri` legacy field (LOADING/ERROR 态兜底 · 不绑到主 wire)

**index.wxml** 改造 `.bento` 「本周回顾」区段:
- 「查看全部 ›」 加 `data-test-id="weekly-home-link"` + `bind:tap="onWeeklyHomeTap"`
- `.weekly .stat tile.mastery` 改 `weekSummaryMasteryText` (替代 `weekStats.masteryRate`) · testid=`p-home-week-mastery-num`
- `.weekly .streakchip` 整段加 `wx:if="{{weekSummaryStreak > 0}}"` · streak=0 时整体不渲染 · testid=`p-home-streak-chip`
- `.weekly .stat newcount` 改 `+{{weekSummaryNewCount}}` (newCount=0 也显 +0) · testid=`p-home-week-new-count`
- `.spark` 改 `weekSummarySparklineUri` 优先 · fallback `sparklineSvgUri` · testid=`p-home-week-sparkline-svg`
- 删除 `weekStats.{mastered, newItems, forgotten}` 3 stat 旧绑定

**helpers.ts** 扩展: 新增 `formatMasteryPctFromWeekSummary` + `buildSparklineSvgFromWeekSummary` (null 索引断笔 不 forward-fill · 不打底 0 · 严格 biz §10.14 空值语义)

### 2.7 frontend/apps/mp/app.json

加 `"pages/me/weekly/index"` 行 (与既有 9 个 pages 并列 · pages[10] 第 10 项)

---

## 3. 真实 E2E (Step 4 三段)

### 3.1 Step 4.1 三方拉齐

- **业务**: biz §2B.17 SC-16 步 1-7 · P-HOME Tap → P-WEEKLY-REVIEW READY → KP CTA → P05 filter
- **设计**: spec §13 14 testid + §6 4 态状态机 + §7 出入口 + §9 异常降级 + §12 10 event
- **代码**: T01 backend WeeklyController + HomeAggregatorController.weekSummary 投影都已经在 047a061 落地 · 我前端只消费 · 不改 backend

### 3.2 Step 4.2 spec.ts 6 用例 一对一翻 test-cases.md

文件: `frontend/apps/mp/test/e2e/sc-16/t02-weekly-mp-page.spec.ts`

| TC | 命中 case 名 | Then 主断言 |
|---|---|---|
| 1 | `TC-1 · P-HOME Tap 「查看全部 ›」 → 路由 + 14 testid + delta + KP 渲染` | (a) `assertPageRenders(mp, 'pages/me/weekly/index', 15)` (b) 13 testid 全 exists + `weekly-empty` NOT exists (c) range 含 W\d{2} (d) hero 含 em dash 或数字 (e) delta 子节点文本非空 (f) weakKp1 exists (g) page.data().pageState === 'READY' |
| 2 | `TC-2 · Tap weekly-weak-kp-1 → wx.navigateTo /pages/wrongbook-list/index?kpId=...` | (a) path == 'pages/wrongbook-list/index' (b) options.kpId 存在 + string (c) INV-5 守 |
| 3 | `TC-3 · GET /weekly 500 → pageState=ERROR · error-banner + retry-btn exists` | mp.mockWxMethod('request') stub 500 → 验 ERROR state + 4 testid 反断言 (整页非空白) |
| 4 | `TC-4 · stats.reviewedCount=0 → pageState=EMPTY · 6 数据块 NOT exists` | mock 注 reviewedCount=0 200 → 验 EMPTY state + `weekly-empty` exists + 6 数据块 NOT exists + emptyCta exists |
| 5 | `TC-5 · masteryDelta=-0.03 → delta chip ↓ + "-3" + a11y attr "down" + sr-only text` | mock 注 masteryDelta=-0.03 → 验 page.data().hero.deltaDirection === 'down' + 字符 ↓ + "-3" + deltaSrText 含 "下跌\|下降\|减少" |
| 6 | `TC-6 · P-HOME 4 数字 wire to weekSummary (null 兜底 + INV-6 不调 /weekly + 跨页同源)` | mock 注 weekSummary 全 null 兜底 → P-HOME data.weekSummaryMasteryText === "—%" + sparkline[1/3/5] === null + streakChip NOT exists + newCount "+0" + INV-6 守 (weeklyCallCount === 0 in P-HOME mount) + 跨页同源 (weekly 页 EMPTY state) |

**必用 _helpers 三件套**: 全部 6 it block 通过 `beforeAll connectMp() + afterAll assertConsoleClean(errors) + assertPageRenders` (符合 coder-agent.md Rule 7 红线)

### 3.3 Step 4.3 真机跑通

| 验证项 | 结果 | 证据 |
|---|---|---|
| lint (`pnpm -F mp lint`) | ✓ PASS · 0 error | `test-reports/lint/lint-output.log` |
| typecheck (`tsc --noEmit`) | ✓ PASS · 0 error | (lint 内含) |
| unit test (`pnpm -F mp test:unit`) | ✓ 185/185 PASS (新增 43 weekly · 全过) | `test-reports/unit/unit-test-output.log` |
| build-npm-fs (workspace 包 esbuild 重建) | ✓ 3 pkg 重建 (testids/api-contracts/telemetry) | (lint 自动执行 · log 中 "esbuild bundled" 行) |
| spec.ts 6 用例真跑 | ⚠ **BLOCKED · IDE GUI 阻塞** (历史 SC01-MP-MENU-FIX Bug 10 known issue · automator.connect(ws://127.0.0.1:9420) fail · 含既有标杆 home.spec.ts / automator-smoke.spec.ts 同样 fail · 不是 SC-16-T02 spec.ts 代码 bug) | `test-reports/e2e/spec-run-attempt-1.log` + `test-reports/e2e/ide-console.txt` |
| VRT 4 态 baseline | ⚠ 待 Tester Phase 4 IDE 可用后 `--update-snapshot` 生成 (Tester 4 物理风险 #3 用户字面 "Phase 3/4 可接受 · 不需你拍") | n/a |

### Spec trace 对照表

| testid | spec §13 行 | wxml 出现 | spec.ts 断言 |
|---|---|---|---|
| `p-weekly-review-root` | line 416 | index.wxml L9 | TC-1 (b) |
| `weekly-back` | line 417 | index.wxml L12 | TC-1 (b) + TC-3 (d) |
| `weekly-range` | line 418 | index.wxml L16 | TC-1 (b)(c) + TC-3 (d) |
| `weekly-hero` | line 419 | index.wxml L29 | TC-1 (b)(d) |
| `weekly-delta` | line 420 | index.wxml L34 | TC-1 (b)(e) + TC-5 (a) |
| `weekly-sparkline` | line 421 | index.wxml L48 | TC-1 (b) |
| `weekly-radar` | line 422 | index.wxml L60 | TC-1 (b) |
| `weekly-weak-kp-1` | line 423 | index.wxml L78 (wx:for rank=1) | TC-1 (b)(f) + TC-2 (a) |
| `weekly-weak-kp-2` | line 424 | 同上 rank=2 | TC-1 (b) |
| `weekly-weak-kp-3` | line 425 | 同上 rank=3 | TC-1 (b) |
| `weekly-stats-trio` | line 426 | index.wxml L99 | TC-1 (b) |
| `weekly-failed-scroller` | line 427 | index.wxml L115 | TC-1 (b) |
| `weekly-ai-insight` | line 428 | index.wxml L126 | TC-1 (b) |
| `weekly-empty` | line 429 | index.wxml L23 (wx:if EMPTY) | TC-4 (b) · TC-1 反断 NOT exists |
| `weekly-error-banner` | spec §9 (impl) | index.wxml L20 | TC-3 (b) |
| `weekly-retry-btn` | spec §9 (impl) | index.wxml L21 | TC-3 (c) |
| `weekly-empty-cta` | spec §9 (impl) | index.wxml L24 | TC-4 (d) |
| `p-home-week-mastery-num` | spec §5.2 (P-HOME) | home wxml | TC-6 (a) |
| `p-home-streak-chip` | spec §5.2 | home wxml (wx:if streak>0) | TC-6 (c) |
| `p-home-week-new-count` | spec §5.2 | home wxml | TC-6 (d) |
| `weekly-home-link` | spec §7 entry | home wxml (sec-m bind:tap) | TC-1 (Tap link) |

---

## 4. 自检 (Step 5 内部 DoD)

| DoD 项 | 状态 | 证据 |
|---|---|---|
| Linter / Typecheck 0 报错 | ✓ | `pnpm -F mp lint` 输出 "✓ lint-mp: 0 errors" + `tsc --noEmit` 退出码 0 |
| testid 全挂载 | ✓ | spec trace 对照表 17+4 testid 全在 wxml 锚 · grep `frontend/apps/mp/pages/me/weekly/index.wxml` 命中所有 testIds.X 引用 |
| Unit tests 100% PASS | ✓ | 185/185 (新增 43 weekly · 0 fail) |
| INV-5 守 (KP CTA URL 含 kpId) | ✓ | `onWeakKpTap` 内 `wx.navigateTo({url: '/pages/wrongbook-list/index?kpId=...'})` · grep 验证 |
| INV-6 守 (P-HOME 不调 /weekly) | ✓ | `grep '/api/home/weekly' frontend/apps/mp/pages/home/` 0 命中 · 仅 `_fetchWeekSummary → getHomeTodayAggregate → /api/home/today` |
| INV-7 守 (X-User-Id Header) | ✓ | `getWeeklyReview` + `getHomeTodayAggregate` 都设 `X-User-Id` 在 headers |
| .sr-only A11Y class | ✓ | index.wxss 新建 `.sr-only` visually-hidden + data-a11y-delta-direction 自定义 attr |
| 删除 H5 mockup 错误锚 (`.tile.mastery / .streakchip` H5 CSS class) | ✓ | P-HOME wxml 改 MP testid 锚 · 不依赖 H5 mockup class |
| E2E spec.ts 6 用例真跑全绿 | ⚠ BLOCKED (IDE GUI handshake · 历史 Bug 10) | 见 §3.3 表 |
| VRT 4 态 baseline | ⚠ Tester Phase 4 生成 | 用户字面授权 |

**反例**: 我没把 `passes=true` 改 · 也没把 `dev_done=true` 改在本工作日志前 (符合铁律 3 权限隔离 + 强制落盘工作日志).

---

## 5. 提交 (Step 6)

**Commit Hash**: `45c58cb8c07ec330878eed284355c589499b235f` (短 `45c58cb`)

**Commit Message**:
```
feat(SC-16-T02): MP P-WEEKLY-REVIEW page + P-HOME 4 数字 wire today.weekSummary
```

**git cat-file -e 验真**: `git cat-file -e 45c58cb` 退出码 0 (commit 存在).

**Files changed** (18 files · 2531 insertions · 27 deletions):

新建:
- `frontend/apps/mp/pages/me/weekly/{helpers.ts, index.json, index.ts, index.wxml, index.wxss}` (5)
- `frontend/apps/mp/src/api/weekly.ts` (1)
- `frontend/apps/mp/test/e2e/sc-16/t02-weekly-mp-page.spec.ts` (1)
- `frontend/apps/mp/test/unit/weekly/{helpers.spec.ts, home-weeksummary.spec.ts}` (2)

修改:
- `frontend/apps/mp/app.json` (pages 注册)
- `frontend/apps/mp/pages/home/{helpers.ts, index.ts, index.wxml}` (P-HOME 4 数字 wire)
- `frontend/apps/mp/src/api/home.ts` (getHomeTodayAggregate)
- `frontend/packages/api-contracts/src/{types.ts, clients/home.ts}` (WeeklyReviewResp + WeekSummary)
- `frontend/packages/telemetry/src/index.ts` (WEEKLY_EVENTS)
- `frontend/packages/testids/src/index.ts` (TEST_IDS.weekly + pHome.weekSummary)

下一个接力 agent (Tester Phase 4) 只需读:
- `git log claude/brave-shaw-0bb0e4 --oneline -3` 拿 commit hash
- `audits/runs/SC16-T02/team-1/attempt-1/coder.md` (本文件)
- `audits/runs/SC16-T02/team-1/attempt-1/test-cases.md` (User Approval verdict: APPROVE)
- `audits/runs/SC16-T02/team-1/attempt-1/bugs-found.md`
- `.harness/inflight/SC16-T02.json` (确认 dev_done=true)
- `frontend/apps/mp/test/e2e/sc-16/t02-weekly-mp-page.spec.ts` (Tester 跑这个)

**Tester 前置 ops**: 用户启 WeChat 开发者工具 IDE GUI · 打开 `frontend/apps/mp/` 项目 · 工具栏 → 自动化测试 → 启用 → 然后 `pnpm test:e2e:automator test/e2e/sc-16/t02-weekly-mp-page.spec.ts` 真跑 6 用例.
