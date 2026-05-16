# bugs-found · SC01-MP-HOME-BUG-FIX · attempt-1

本 attempt 修复 8 个 B 类 bug, 每条注现象 / 现状代码 / 根因 / 修法 / 验证脚本。

## Bug B1 · 底部 tabBar 缺失

- **现象**: P-HOME 实景底部空白, mockup `01_home.html` L470-495 有 5 tab (首页/错题本/拍题/复习 badge 8/我的)。
- **现状代码**: `frontend/apps/mp/app.json` 无 `tabBar` 字段。
- **根因**: 早期开发只配置 `pages[]`, 漏配 `tabBar.list`; lint.mjs L105-108 检测 `wx.switchTab` 时也 cover 不到, 因 home 用 `wx.navigateTo` 而非 switchTab。
- **修法**: app.json 加 `tabBar` 5 项 (text-only, vant icon 不能用于 tabBar) + 新建 `pages/me/{index.wxml,wxss,ts,json}` (我的占位)。
- **验证脚本**: `pnpm -F mp lint` 0 error (lint 也会校验 tabBar pagePath 都存在 4 file)。

## Bug B2 · navigationBarTextStyle=black 黑标题条挤压 hero

- **现象**: 顶部出现 "龙凤错题本" 黑标题条, 占走 ~44pt, hero 区被挤压, 与 mockup hero 直接覆盖到屏幕顶部不符。
- **现状代码**: `frontend/apps/mp/app.json` window `navigationBarTextStyle: "black"` 无 `navigationStyle: "custom"`。
- **根因**: 沿用早期默认 nav bar; 虽然 `pages/home/index.json` 已有 `"navigationStyle":"custom"` 兜底, 但部分微信 IDE 版本以 app.json 全局优先, 仍渲染。
- **修法**: app.json window 加 `"navigationStyle":"custom"` (全局); pages/me/index.json 也加同字段 (统一)。
- **验证脚本**: 由 Tester 跑 automator E2E 截图与 mockup hero 上半区对比, 应无黑色 navbar。

## Bug B3 · sparkline 折线缺失

- **现象**: weekly 卡 (`data-test-id="p-home-weekly-sparkline"`) 只显示 4 个数字统计, 缺 mockup L279-292 的 SVG 折线 + 周一-周日 标签。testid 名字暗示 "sparkline" 但内容不符。
- **现状代码**: `frontend/apps/mp/pages/home/index.wxml` L103-125 只有 weekly-row 4 stat, 无 spark 子节点。
- **根因**: 早期偷工省略, 没有把 mockup SVG 翻译到 WXML; MP 原生不支持 `<svg>` 标签, 开发者绕开了。
- **修法**:
  1. `index.ts` 加 `SPARKLINE_SVG` 常量 (path / circle 与 mockup L287-290 1:1) + `SPARKLINE_SVG_URI = data:image/svg+xml;utf8,${encodeURIComponent(...)}`。
  2. `index.wxml` weekly 卡内加 `<view class="spark"><image class="spark-svg" src="{{sparklineSvgUri}}" mode="scaleToFill"/></view>` + `<view class="days">` 7 个 `<text>`。
  3. `index.wxss` 新增 `.spark` `.spark-svg` `.days` `.day-today` 样式 (高度 88rpx 等。
- **验证脚本**: 由 Tester 跑 VRT screenshot 抓 `.spark` 区域与 mockup baseline 像素差 < 500 px。

## Bug B4 · MVP_WEEK_DAYS 周一-周三 d 值 20, 22, 22 重复

- **现象**: P-HOME 本周日程显示 周一 20 / 周二 22 / 周三 22 / 周四 23 ... · 周二与周三同号。
- **现状代码**: `frontend/apps/mp/pages/home/index.ts` L29-31 (旧):
  ```ts
  { w: '一', d: '20', ... },
  { w: '二', d: '22', ... },  // 应为 21
  { w: '三', d: '22', ... },  // 22 重复
  ```
- **根因**: 早期手写 mock 数据时 typo, 没有单测兜底, 流到生产。
- **修法**: 删除整个硬编码 `MVP_WEEK_DAYS`, 改由 `buildCurrentWeekStrip(new Date())` 动态生成 7 天连续日期。
- **验证脚本**: `test/unit/home.spec.ts` 新 case "B4 regression · 周一-周日 d values are 7 distinct consecutive numbers":
  ```ts
  const ds = strip.days.map(d => parseInt(d.d, 10));
  expect(new Set(ds).size).toBe(7);             // 全部不重复
  for (let i = 1; i < ds.length; i++) expect(ds[i] - ds[i-1]).toBe(1); // 严格连续
  ```
  → PASS。任何 22 重复回归都会断言失败。

## Bug B5 · weekLabel + weekDays 硬编码 "4 月 20-26 日"

- **现象**: 今天 2026-05-16 周六 (应显示 5 月 11-17 日), 但 P-HOME 永远显示 "4 月 20-26 日" 且 today 高亮永远在周二 21。
- **现状代码**: `frontend/apps/mp/pages/home/index.ts` L75 (旧): `weekLabel: '4 月 20–26 日'` + L28-36 weekDays 七天里只有 `今` 的 today=true 硬编码在周二。
- **根因**: 早期开发用 mockup 截屏当 mock data 死塞死写, 没做时间动态化。
- **修法**: 新增 `helpers.ts/buildCurrentWeekStrip(now: Date): WeekStrip`:
  - ISO 周 (周一=0 ... 周日=6), JS `getDay()` (0=Sun ... 6=Sat) 转换: `isoIdx = jsDay===0 ? 6 : jsDay-1`
  - 本周一 = `now - isoIdx 天`, 然后循环 7 天填 d / w / today
  - label = `${monday.getMonth()+1} 月 ${monday.getDate()}–${sunday.getDate()} 日`
  - `index.ts` data 改为 `weekLabel: buildCurrentWeekStrip(new Date()).label` + `weekDays: buildCurrentWeekStrip(new Date()).days`
  - onShow 也刷一次 (跨日切换 today 高亮)
- **验证脚本**: `test/unit/home.spec.ts` 5 个新 case:
  ```ts
  expect(buildCurrentWeekStrip(new Date(2026, 4, 16)).label).toBe('5 月 11–17 日');
  expect(buildCurrentWeekStrip(new Date(2026, 4, 16)).label).not.toContain('4 月 20');
  expect(buildCurrentWeekStrip(new Date(2026, 4, 17)).days[6].today).toBe(true); // 周日
  expect(buildCurrentWeekStrip(new Date(2026, 4, 11)).days[0].today).toBe(true); // 周一
  expect(buildCurrentWeekStrip(new Date(2026, 4, 4)).label).toBe('5 月 4–10 日');  // 单数日不 pad
  ```
  → 全 PASS。

## Bug B6 · SUBJECT_COLORS 暗色 chip 在深蓝卡上看不清

- **现象**: review-card 是深蓝渐变背景, rh-sub-chip 3 个学科 chip 用暗色 #C41E3A 数学 / #0057B7 物理 / #9C4F00 英语 → 三色都同深暗调, 与背景 contrast 太低, mockup L236-238 用亮色 #FF6B6B / #FFD166 / #6DE895。
- **现状代码**: `frontend/apps/mp/pages/home/index.ts` L12-17 SUBJECT_COLORS 暗色配置 + wc-legend 也用 #C41E3A 等。
- **根因**: 早期 SUBJECT_COLORS 用国标考试卡色, 没考虑深色卡背景对比度; 与 mockup 设计真相 drift。
- **修法**:
  1. 把 SUBJECT_COLORS 从 index.ts 移到 helpers.ts (export) · 让 unit test 可 import 不触发 `Page()` 全局。
  2. 改成 mockup 真值: `数学 #FF6B6B` / `物理 #FFD166` / `英语 #6DE895`, 化学 mockup 未给 · 沿用 `#30B0C7` teal (与 mockup --teal CSS 变量一致)。
  3. index.wxml wc-legend (本周日程 legend) 也对齐 mockup L344-349 真实排课色: 复习 T1 #FF3B30 / T3 #FF9500 / T6 #34C759 / 考试 #FF2D55 / 家庭 #5856D6 (注意这里是排课分类色, 与 SUBJECT_COLORS 学科色不同 — mockup 也是分开两套)。
- **验证脚本**: `test/unit/home.spec.ts` 4 case:
  ```ts
  expect(SUBJECT_COLORS['数学']).toBe('#FF6B6B');
  expect(SUBJECT_COLORS['数学']).not.toBe('#C41E3A');  // 旧值反向断言, 抓回归
  // 物理 / 英语 同
  expect(Object.keys(SUBJECT_COLORS).sort()).toEqual(['化学','数学','物理','英语'].sort());
  ```
  → 全 PASS。

## Bug B7 · scroll-view scroll-y 无 height MP 中不滚动

- **现象**: 在 MP IDE 真机上, P-HOME 滚不到底, KP 卡 / Quick entries 看不到。
- **现状代码**: `frontend/apps/mp/pages/home/index.wxml` L30 `<scroll-view class="scroll" scroll-y="true">` + `index.wxss` L115-121 `.scroll { position:relative; margin-top:384rpx; flex:1 }`。
- **根因**: MP `<scroll-view>` 必须显式 `height` 才能滚, `flex:1` 在 `.home-page` (min-height:100vh, flex:column) 下不传递 height; 与 H5 web 行为不同。微信开发文档明确写: "使用竖向滚动时, 需要给 scroll-view 一个固定高度"。
- **修法**: `<scroll-view>` → `<view>`, `.scroll` 删 flex:1, padding-bottom 加到 120rpx (留 tabBar 84rpx + 36rpx 视觉留白), 让 page (body) 整页竖向滚动。删 `.scroll::before` 改用 `.scroll` 本身的 `border-top-radius` + `background:#F2F2F7` 模拟"上滑 sheet 圆角"。
- **验证脚本**: 由 Tester 跑 automator e2e 测 page.scrollTo 后能看到 `.quick` / `.kpcard` 元素 (用 `assertPageRenders(mp, '/pages/home/index', minViews=15)` 防 path 对但 wxml 没渲染假 PASS, 见 coder-agent.md 铁律 7)。

## Bug B8 · hero 上半留大块蓝色空白

- **现象**: hero 476rpx + greeting top 116rpx + scroll margin-top 384rpx → hero 顶部约 80rpx + greeting + streak-bar (~200rpx) + 空白 (~200rpx) → 总 476rpx hero · 空白 > 200rpx。mockup hero 紧凑 240px (~480rpx) 但 greeting 紧贴 streak-bar 无空白。
- **现状代码**: `frontend/apps/mp/pages/home/index.wxss` L18-26 `.hero { height:476rpx; linear-gradient(170deg,...)}` + L29-36 `.greeting { top:116rpx }` + L115-121 `.scroll { margin-top:384rpx }`。
- **根因**: 早期换算 240px→rpx 时多加了 navbar 偏移 (~80rpx) · 但 B2 把 navbar 改成 custom 后这个偏移失效, 留下空白。
- **修法**: `.hero` 480rpx (与 mockup 240px×2 = 480rpx 比例一致) + gradient 180deg 三段色 #1E3A8A → #3B5BDB → #5B8DEF 完全对齐 mockup L25; `.greeting` top 80rpx (紧贴顶部安全区下沿); `.scroll` margin-top 360rpx (与新 greeting 80 + hello-row 70 + streakbar 60 + 留白 150 ≈ 360 对齐)。
- **验证脚本**: 由 Tester VRT pixel diff 校 hero/greeting 区域。
