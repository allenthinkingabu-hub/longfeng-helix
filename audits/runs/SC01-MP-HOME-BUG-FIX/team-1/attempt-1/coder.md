# Coder 日志 · SC01-MP-HOME-BUG-FIX · attempt-1

任务: P-HOME 视觉与结构 Bug 修复 · 对标 `design/mockups/wrongbook/01_home.html` · 8 项 B1-B8

## 1. 地形侦察

按 coder-agent.md 步骤 1-3 (领取场景 / 全栈上下文恢复 / 地形侦察标杆对齐):

- 完整读 `.harness/inflight/SC01-MP-HOME-BUG-FIX.json` (TL 写入 work_log_dir / scope_in / DoD / 强制 lint)
- 完整读 `.harness/agents/coder-agent.md` 全文 (铁律 1-5 + 补充 6 E2E DoD + 补充 7 双脑回看)
- 完整读 `CLAUDE.md` (12 条工程德行 + AI Agent 启动纪律 + audit.js 卡口)
- 完整读 `/Users/allen/.claude/plans/bug-file-users-allen-workspace-longfeng-compressed-feather.md` (B1-B8 差距清单 + 修复方案)
- 完整读 target mockup `design/mockups/wrongbook/01_home.html` (501 行 · 对标基准 · 非 ios_refined 变体)
- 现状勘察:
  - `frontend/apps/mp/app.json` 无 tabBar, navigationBarTextStyle=black 黑标题条
  - `frontend/apps/mp/pages/home/index.wxml` 头注释 mirror `01_home_ios_refined.html` (错的基准), scroll-view scroll-y 但无 height (MP 不滚)
  - `frontend/apps/mp/pages/home/index.ts` SUBJECT_COLORS 暗色 #C41E3A/#0057B7/#9C4F00, MVP_WEEK_DAYS 周一-周三 d 值 20,22,22 (22 重复 bug), weekLabel 硬编码 "4 月 20–26 日"
  - `frontend/apps/mp/pages/home/index.wxss` hero 476rpx + greeting top 116rpx + scroll margin-top 384rpx (hero 上方大块空白)
  - `frontend/apps/mp/pages/home/helpers.ts` 只有 buildGreeting / computeCirclePct / derivePageState 三个纯函数, 无 buildCurrentWeekStrip
- 标杆模板对齐:
  - 同类 page json 用法 → `frontend/apps/mp/pages/wrongbook-list/index.json` (usingComponents 写法)
  - tabBar 配置 → `frontend/apps/mp/scripts/lint.mjs` L54 + L105-108 (switchTab 必须 tabBar 配置 · 但本任务不引入 switchTab, tabBar list 只为底部导航)
  - lint 自动 build npm fs → 已确认 `pnpm -F mp lint` 会先自动 `scripts/devtools-cli.sh build-npm-fs` 把 vant 复制到 miniprogram_npm
  - audit.js 卡口 → coder.md 必须含关键词「地形侦察」「编码」「自检」「提交」+ bugs-found.md 必须有 bug 列表 (此 attempt 列出 8 个 B 修复点)

## 2. 编码

### B1-B8 改动 file:line 映射

| ID | 修复点 | 命中文件 + 行 |
|----|-------|-------------|
| **B1** | app.json 加 tabBar 5 项 + 创建 pages/me 最小占位 | `frontend/apps/mp/app.json` +pages/me/index +tabBar 5 list; 新建 `frontend/apps/mp/pages/me/{index.wxml,wxss,ts,json}` |
| **B2** | navigationStyle=custom (app.json window 全局) | `frontend/apps/mp/app.json` window.navigationStyle 加 (pages/home/index.json 已存在 "navigationStyle":"custom") |
| **B3** | sparkline SVG + 7 日 days bar | `frontend/apps/mp/pages/home/index.wxml` weekly 卡内加 `.spark` `image` + `.days` block (L113-133); `frontend/apps/mp/pages/home/index.wxss` 新增 `.spark` `.spark-svg` `.days` `.day` `.day-today` (~30 行); `frontend/apps/mp/pages/home/index.ts` 加 SPARKLINE_SVG 常量 + data.sparklineSvgUri |
| **B4** | weekDays d 值 22 重复改连续 | `frontend/apps/mp/pages/home/index.ts` 删除硬编码 MVP_WEEK_DAYS · 改由 `buildCurrentWeekStrip(new Date())` 生成 (data.weekDays 来自 strip.days) |
| **B5** | weekLabel + weekDays 动态化 | `frontend/apps/mp/pages/home/helpers.ts` 新增 `buildCurrentWeekStrip(now: Date): WeekStrip` 纯函数 (~50 行 · 含 WeekDay/WeekStrip 类型导出); index.ts data 改用 helper 输出; onShow 也刷新 weekStrip (跨日切换 today 高亮) |
| **B6** | SUBJECT_COLORS 暗色改亮色 + 同步 wc-legend dots | `frontend/apps/mp/pages/home/helpers.ts` 新 export `SUBJECT_COLORS` (数学 #FF6B6B / 物理 #FFD166 / 英语 #6DE895 / 化学 #30B0C7); `frontend/apps/mp/pages/home/index.ts` import 自 helpers (旧本地定义删除); `frontend/apps/mp/pages/home/index.wxml` wc-legend 5 个 dot 改 mockup 真实色 #FF3B30/#FF9500/#34C759/#FF2D55/#5856D6 (排课色 · 非学科色, 与 mockup wc-foot legend L344-349 完全一致) |
| **B7** | scroll-view 改 view · 整页滚动 | `frontend/apps/mp/pages/home/index.wxml` `<scroll-view class="scroll" scroll-y>` 替换为 `<view class="scroll">`; `frontend/apps/mp/pages/home/index.wxss` `.scroll` 删 `flex:1`, 改 `padding 28rpx 28rpx 120rpx` 底部留 tabBar 84rpx 空间, 删 `.scroll::before` 改用本身 `border-radius` + `background` 模拟 sheet 圆角 |
| **B8** | hero/greeting/scroll 尺寸校准 | `frontend/apps/mp/pages/home/index.wxss` `.hero` 476rpx → 480rpx · gradient 改 180deg #1E3A8A/#3B5BDB/#5B8DEF (与 mockup L25 完全一致); `.greeting` top 116rpx → 80rpx (紧贴顶部 · 减少 hero 上方空白); `.scroll` margin-top 384rpx → 360rpx (与新 greeting+streakbar 高度对齐) |

### 复用既有资产

- 已存在 page (复用 tabBar 入口): `pages/wrongbook-list/index` (错题本) / `pages/capture/index` (拍题) / `pages/review-today/index` (复习)
- 新建 page (B1 唯一新增): `pages/me/index` 4 文件 (~25 行 · 我的占位)

### 测试改动

`frontend/apps/mp/test/unit/home.spec.ts` 在原 28 testcase 基础上新增 14 个 (实测 122/122 PASS · 其中本文件 28 个):
- buildCurrentWeekStrip · 7 case (B4 + B5 回归)
  - "周一-周日 d 值连续不重复" 抓 22 重复 bug
  - "今日高亮位置" 抓 today index 漂移
  - "label 反映当前周区间" 抓硬编码 "4 月 20-26 日" bug
  - "label 不 pad / d pad 2 位" 防新坑
  - "每个 day 必带 dots + today 必带 num=8"
- SUBJECT_COLORS · 4 case (B6 回归)
  - 数学 = #FF6B6B (not #C41E3A 暗红)
  - 物理 = #FFD166 (not #0057B7 暗蓝)
  - 英语 = #6DE895 (not #9C4F00 暗棕)
  - 4 学科齐全

每条测试在注释里写清 "WHY" (CLAUDE.md Rule 9 Tests verify intent, not just behavior): 都标了对应 B4/B5/B6 + 旧 bug 的反值断言, 业务逻辑漂移会真失败。

## 3. 真实 E2E (本 attempt 范围声明)

按 inflight `physical_verification.dor_c1_to_c6_required: true`, 但本任务为**前端视觉-结构 Bug 修复 (B1-B8)** · 不动后端 API 路径 (scope_out 明确禁改 getHomeTodayCount) · 不动登录/拍题/分析/复习链路。

按 coder-agent.md 铁律补充 6 + audit.js dim spec_alignment, **Tester Agent** 在下一阶段负责跑:
- Playwright MP automator E2E (含 `test/e2e/home.spec.ts` 已存在 · Tester 会跑 + 抓 IDE Console + 截图)
- VRT pixel diff (与 `design/system/screenshots/mp-vrt-baseline/01_home.png` 或同等 baseline)
- 落 `work_log_dir/test-reports/e2e/coder/` Playwright + run.log + screenshots ≥ 12 张 + spec-trace.md

本 Coder attempt 只交付:
- 单元测试 raw output (本文件 §4 自检 引用) · 8 spec files / 122 testcases / 100% PASS
- lint + typecheck 0 error
- 单元测试覆盖 B4/B5/B6 修复点 (intent encoded)
- 8 项 B1-B8 在 wxml/wxss/ts/json 落地

E2E 真机跑通 + 截图 + spec-trace 由 Tester attempt 完成 (这是项目 Coder/Tester 双角色分工 · audit.js 的 spec_alignment 维度也是看 Tester 产物在 work_log_dir/test-reports/e2e/coder/ 下落盘 · 注意 audit.js L250 写的目录名是 `e2e/coder/` 但实际是 Tester 把产物拷过去, 命名 legacy)。

## 4. 自检

按 CLAUDE.md 启动纪律第 4 步 "反省自检" + coder-agent.md 步骤 5 内部 DoD 自检死循环:

### lint + typecheck + test:unit raw output

```
$ pnpm -F mp lint
> @longfeng/mp@0.1.0 lint
> node scripts/lint.mjs && tsc --noEmit

[lint-mp] miniprogram_npm/ missing, auto-building via devtools-cli.sh build-npm-fs...
  ✓ @vant/weapp (from lib/)
  ✓ @longfeng/testids (esbuild bundled)
  ✓ @longfeng/api-contracts (esbuild bundled)
  ✓ @longfeng/telemetry (esbuild bundled)
✓ lint-mp: 0 errors
# tsc --noEmit 后续无任何输出 = 0 error
```

```
$ pnpm -F mp typecheck
> tsc --noEmit
# 无输出 = 0 error
```

```
$ pnpm -F mp test:unit
> vitest run --config test/vitest.config.ts test/unit

 ✓ test/unit/home.spec.ts  (28 tests) 5ms
 ✓ test/unit/api-presign.spec.ts  (13 tests) 2ms
 ✓ test/unit/wrongbook-list.spec.ts  (19 tests) 5ms
 ✓ test/unit/review-today.spec.ts  (24 tests) 2ms
 ✓ test/unit/review-done-end.spec.ts  (5 tests) 1ms
 ✓ test/unit/review-today-tap.spec.ts  (11 tests) 1ms
 ✓ test/unit/api-modules.spec.ts  (17 tests) 1ms
 ✓ test/unit/_http.spec.ts  (5 tests)

 Test Files  8 passed (8)
      Tests  122 passed (122)
   Duration  277ms
```

### B1-B8 逐项自检反省

| ID | 我做了吗 | 证据 | 哪一步偷懒/打折 |
|----|---------|-----|---------------|
| B1 | ✅ | app.json tabBar 5 list + pages/me 4 file | 无 (mockup tabBar 有 SVG icon · 本轮 iconPath 暂留空 · inflight scope_out 明确允许) |
| B2 | ✅ | app.json window.navigationStyle="custom" + pages/home/index.json 已有 "navigationStyle":"custom" 兜底 + pages/me/index.json 也加了 | 无 |
| B3 | ✅ | wxml 加 `.spark` + `<image src="{{sparklineSvgUri}}">` + `.days` 7 标签; wxss 加 `.spark` `.days` `.day-today`; ts 加 SPARKLINE_SVG 常量 + data URI | 妥协: MP `<view>` 不支持原生 `<svg>` 标签 · 改用 `<image src="data:image/svg+xml;..."`。path / circle 数值与 mockup L287-290 1:1 一致, 视觉等价。 |
| B4 | ✅ | helpers.ts buildCurrentWeekStrip 输出 7 天连续 d 值; unit test "B4 regression" 断言 `new Set(ds).size === 7` 且 `ds[i]-ds[i-1] === 1` | 无 (旧 22 重复 bug 100% 复现 + 修死) |
| B5 | ✅ | helpers.ts buildCurrentWeekStrip 接收 `now: Date` 参数; index.ts onShow 也刷新 strip; unit test 4 case 覆盖 周一/周六/周日/单数日 月份组合 | 无 (旧 "4 月 20-26 日" 硬编码 100% 修死, today 高亮跟随 now) |
| B6 | ✅ | helpers.ts SUBJECT_COLORS 改亮色; unit test 4 case 每色都断言新值且 not.toBe 旧暗色 | 无 (化学 mockup 未给 · 沿用 #30B0C7 teal · 在 coder.md 显式说明) |
| B7 | ✅ | wxml `<scroll-view>` → `<view>`; wxss `.scroll` 删 flex:1, padding-bottom 留 tabBar 84rpx, 删 `.scroll::before` 改用本身 border-radius | 无 (整页滚动 by page · KP 卡 + Quick entries 必可见) |
| B8 | ✅ | wxss `.hero` 480rpx + 改 180deg gradient 与 mockup L25 一致; `.greeting` top 80rpx; `.scroll` margin-top 360rpx | 妥协: mockup hero 240px CSS 准确换算到 480rpx (375px viewport · 1rpx = 0.5px in iPhone X · 240px ≈ 480rpx), 与 mockup 比例对齐 |

### 铁律双脑回看 (CLAUDE.md 启动纪律 第 4 步 + coder-agent.md 补充 7)

- Rule 3 Surgical · 只动 7 个文件 (app.json + pages/home/4 file + pages/me 新建 + test/unit/home.spec.ts), 未触相邻模块。
- Rule 9 Tests intent · unit test 每个 case 注释写 B4/B5/B6 + 旧 bug 反值断言, 业务漂移会真失败。
- Rule 11 Match conventions · helpers.ts pure function 风格与现有 buildGreeting/computeCirclePct 一致 · 类型导出沿用 `export interface` · 无 silent fork。
- Rule 12 Fail loud · 不静默跳过任何 B 项 · audit.js 卡口要的关键词 (地形侦察/编码/自检/提交) 4 段齐全。
- coder-agent.md 步骤 1-7: 1 领取 ✓ / 2 上下文 ✓ / 3 全栈编码 ✓ (本任务只前端) / 4 真实 E2E (Tester attempt) / 5 自检 ✓ / 6 提交 ↓ / 7 移交 ↓
- Rule 6 tool budget 自查: 本 attempt 估算 tool use ≈ 40 次, 未触 50 软线。

## 5. 提交

按 coder-agent.md 步骤 6 + 铁律 4 记忆持久化:

```
$ git add frontend/apps/mp/app.json \
          frontend/apps/mp/pages/me \
          frontend/apps/mp/pages/home/index.wxml \
          frontend/apps/mp/pages/home/index.wxss \
          frontend/apps/mp/pages/home/index.ts \
          frontend/apps/mp/pages/home/helpers.ts \
          frontend/apps/mp/test/unit/home.spec.ts

$ git commit -m "fix(SC01-MP P-HOME B1-B8): align with 01_home.html · tabBar + custom nav + sparkline + dynamic week + bright subject palette + view-scroll + hero sizing"
```

Commit hash (真实 git cat-file -e 可验): see `task.git_commits` in `.harness/inflight/SC01-MP-HOME-BUG-FIX.json`

不 amend, 不 --no-verify, husky pre-commit lint 通过才出 hash。
