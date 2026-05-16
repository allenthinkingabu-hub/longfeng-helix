# Tester 日志 · SC01-MP-HOME-BUG-FIX · team-1 · attempt-1

> Tester Agent attempt-1 · 2026-05-16
> 上游 Coder commit: **d31d2ca** (dev_done=true)
> 本 attempt Verdict: **REJECT (passes=false)** · 见 §6 决策

## 0. 启动纪律 + 双脑回看声明

已完整阅读:
- `CLAUDE.md` 全文 (12 条工程德行 + AI Agent 启动纪律 + 双脑回看 + audit.js 卡口 + Rule 6 tool budget)
- `.harness/agents/test-agent.md` 全文 (铁律 1-7 + 铁律补充 8 双脑回看 + DoR 准入 + 执行流程 0-6 + 2026-05-16 PASS 定义新红线)
- `.harness/inflight/SC01-MP-HOME-BUG-FIX.json` (work_log_dir / log_requirements / audit_gate / scope_in/out)
- Coder 产物三件套: `coder.md` + `bugs-found.md` + commit `d31d2ca`
- `design/mockups/wrongbook/01_home.html` (target mockup)
- `git show d31d2ca --stat` + 各文件 diff

本文铁律 7 条 + DoR 4 项 + 执行流程 0-6 步已内化。Rule 6 tool budget 自查: 本 attempt 估 ~35 次 tool use · 未触 50 软线。

## 1. 侦察 (Coder 改动总览)

Coder d31d2ca 在 7 个文件落地 8 项 B 修复:
- `app.json` +13 -1: tabBar 5 list (含 pages/me) + window.navigationStyle=custom
- `pages/home/helpers.ts` +77 -1: 新增 WeekDay/WeekStrip 类型 + SUBJECT_COLORS 亮色 export + buildCurrentWeekStrip 纯函数
- `pages/home/index.ts` +35 -28: 删旧 SUBJECT_COLORS 暗色 + 删硬编码 MVP_WEEK_DAYS + data 改用 buildCurrentWeekStrip · onShow 同步刷新
- `pages/home/index.wxml` +20 -11: scroll-view → view (B7) · weekly 卡内加 spark image + days bar (B3) · legend 改排课色 (B6 配套)
- `pages/home/index.wxss` +57 -28: hero 476→480rpx + gradient 180deg (B8) · greeting top 116→80 (B8) · scroll margin-top 384→360 (B8) · 删 .scroll::before · 新增 .spark/.days/.day-today (B3)
- 新建 `pages/me/{index.wxml,wxss,ts,json}` (B1 占位 page)
- `test/unit/home.spec.ts` +96 -2: 14 个新 testcase (B4/B5/B6)

DoR (Definition of Ready) 检查 · 本任务为前端视觉修复 · DoR-1/2/3/4 调整说明:
- DoR-1 E2E 脚本本体: ✅ `test/e2e/home.spec.ts` 已存在 · 用 connectMp 三件套 · 真后端 (本任务无后端调用)
- DoR-2 真机跑通 raw: ✅ 我重跑了 `home.spec.ts` → 4/4 PASS · `ide-console.txt` 0 error
- DoR-3 真截图: ✅ 我截了 `vrt-phome.png` (438KB · 真 MP IDE) · 与 mockup 对比定性差异
- DoR-4 spec trace: ✅ coder.md §2 B1-B8 与 file:line 一一对应 · 可追溯
**DoR 通过 → 进入正式测试**。

## 2. 物理验证 (raw 命令 + 结果)

```
$ pnpm -F mp lint
> @longfeng/mp@0.1.0 lint
> node scripts/lint.mjs && tsc --noEmit
✓ lint-mp: 0 errors
EXIT=0
```
raw: `test-reports/static.txt`

```
$ pnpm -F mp typecheck
> tsc --noEmit
EXIT=0  (无输出 = 0 error)
```
raw: `test-reports/static.txt`

```
$ pnpm -F mp test:unit
 Test Files  8 passed (8)
      Tests  122 passed (122)
   Duration  321ms
EXIT=0
```
raw: `test-reports/unit.txt`

```
$ pnpm exec vitest run test/unit/home.tester.spec.ts  (Tester 独立 spec · 18 case)
 Test Files  1 passed (1)
      Tests  18 passed (18)
EXIT=0
```
raw: `test-reports/home.tester.spec.ts.txt`

```
$ pnpm exec vitest run test/e2e/home.spec.ts  (Coder 既有 E2E · 真 IDE automator)
 Test Files  1 passed (1)
      Tests  4 passed (4)  ← 但参见 §6 决策 · 这 4 个 PASS 不能掩盖 RUNTIME-DRIFT
EXIT=0
```
raw: `test-reports/e2e-home.txt`

```
$ pnpm exec vitest run test/e2e/home-vrt-tester.spec.ts  (Tester 真截图)
 Test Files  1 passed (1)
      Tests  2 passed (2)
EXIT=0
```
raw: `test-reports/e2e-vrt.txt` + 截图 `test-reports/vrt-phome.png` (438 KB)

```
$ pnpm exec vitest run test/e2e/home-data-probe.spec.ts  (Tester 真读 page.data())
 Test Files  1 passed (1)
      Tests  1 passed (1)
EXIT=0
```
raw: `test-reports/runtime-data.json` ← **核心 REJECT 证据 · 见 §5**

测试总数 (本 attempt Tester 独立 + Coder 复跑):
- unit: 122/122 PASS · 含 home.spec.ts 28 + home.tester.spec.ts 18 (我新加) + 其它 76
- e2e: 7/7 PASS (home.spec 4 + home-vrt-tester 2 + home-data-probe 1)

mock 计数 (审计要求 ≤ 5): tester.md + adversarial.md + test-reports/ 全文搜 `vi.mock` / `page.route` / `MockMvc` / `wx.request.mock` / `miniprogram-simulate` / `wx.cloud.mock` / `mockRequest` = **0 次**。
maxDiffPixels: 未在脚本中放宽 · `compareScreenshot` 默认 threshold:0.1 · 因 baseline / IDE 分辨率不一致 pixelmatch 抛 "Image sizes do not match" · 已 catch 并落盘 `vrt-phome-diff.txt` 说明妥协 · 不放任何阈值。
IDE Console (dim_ide_smoke 卡口): `test-reports/ide-console.txt` **存在** + **0 [error] 行** (文件内容: `# no console errors observed during home VRT spec`)。

## 3. 回归断言 (8 个新断言 file:line)

**Tester 独立加 spec** (Coder 没写过的角度) — `frontend/apps/mp/test/unit/home.tester.spec.ts` 18 case:

| 断言 | file:line | 抓哪种回归 |
|------|----------|----------|
| B1 anti-regression · tabBar.list.length === 5 | home.tester.spec.ts:24 | 5 tab 任一丢失或多出 |
| B1 anti-regression · tabBar 含 pages/me/index + pages[] 也含 | home.tester.spec.ts:30 | 漏注册 page 导致 lint fail / 运行时 404 |
| B1 · pages/me 4 必备文件齐 + 非空 | home.tester.spec.ts:39 | 静默部分创建 |
| B2 · app.json window.navigationStyle === "custom" | home.tester.spec.ts:50 | navbar 配置回退 |
| B3 · testid p-home-weekly-sparkline 未被静默移除 | home.tester.spec.ts:60 | 重命名/删除 testid |
| B3 · spark image bound to sparklineSvgUri | home.tester.spec.ts:64 | sparkline 静默改成静态资源 |
| B3 · days bar 7 day label 齐 | home.tester.spec.ts:70 | 缺少周一/...周六/今天 |
| B6 · 数学 R channel > 200 (亮色) | home.tester.spec.ts:90 | 改成另一暗红 #C41E3F 而非旧的 #C41E3A |
| B6 · 物理 R channel > 200 | home.tester.spec.ts:95 | 同上反向 |
| B6 · 英语 G channel > 200 | home.tester.spec.ts:100 | 同上 |
| B5 · different now → different label | home.tester.spec.ts:111 | 又被某次重构改回硬编码 |
| B5 · cross-year 2026-12-31 → 12 月 28–3 日 + Sunday d='03' | home.tester.spec.ts:118 | JS Date 溢出未处理 |
| B7 · main wrapper === `<view class="scroll">` · NOT scroll-view | home.tester.spec.ts:134 | 回退 scroll-view 引爆"无 height 不滚" |
| B7 · 不允许 home wxml 中残留任何 `<scroll-view>` | home.tester.spec.ts:140 | 局部偷偷包 scroll-view |
| B8 · .hero height ≤ 480rpx | home.tester.spec.ts:158 | 又被改大放回空白 |
| B8 · .greeting top ≤ 100rpx | home.tester.spec.ts:163 | 顶部空白回弹 |
| B8 · .scroll margin-top ≤ 380rpx | home.tester.spec.ts:168 | 同 |
| B4 · 100 random dates property-based · 全 7 distinct consecutive | home.tester.spec.ts:177 | helper 在某些日期翻车 |

每条断言注释里写了 "WHY" (CLAUDE.md Rule 9 Tests verify intent) · 业务漂移会真失败。

## 4. VRT 状态

- 截图: `test-reports/vrt-phome.png` 真 MP IDE 截图 (经 mp.screenshot() base64 → buffer) · 438 KB
- pixelmatch 对比: 因 baseline `design/system/screenshots/mp-vrt-baseline/01_home.png` 是 HTML mockup 截图 · 分辨率与 MP IDE 模拟器不同 · `pixelmatch` 抛 "Image sizes do not match" · 已 catch 不当作失败
- 妥协说明 (test-agent.md 铁律 6 要求): VRT 像素 diff **跳过** · 不放阈值 · 改用**视觉读图 + page.data() runtime probe** 双重验证
  - 视觉读图 (人眼对 vrt-phome.png + 原 mockup 01_home.html): hero 上半空白确实减少 (B8 ok) · 但 "本周日程" 区显示 "4 月 20–26 日" 与 d=22 重复 (B4/B5 视觉失败)
  - runtime probe (mp.page.data()): see §5 · 三个 B 不修

## 5. 关键发现 · IDE 运行时 stale (REJECT 决定性证据)

详见 `adversarial.md Round 2`。

**`test-reports/runtime-data.json` (`mp.currentPage().data()` 实际返回)**:
```
weekLabel:        "4 月 20–26 日"               ← B5 旧硬编码 (应: 5 月 11–17 日 · 因今日 2026-05-16)
weekDays d 值:    ["20","22","22","23","24","25","26"]  ← B4 22 重复 (应: 11/12/13/14/15/16/17)
subjects[0]:      {name:"数学", color:"#C41E3A"}    ← B6 旧暗红 (应: #FF6B6B)
```

**`test-reports/vrt-phome.png` 肉眼可见**:
- "本周日程 · 4 月 20–26 日" 标头 · "20/22/22/23/24/25/26" 日数 · 22 重复
- review-card 上数学/物理/英语 chip 仍是暗调红/蓝/棕
- (注: B8 hero 紧凑、B7 整页可滚、B3 sparkline 已 visually OK)

**根因**: WeChat IDE 跑的是 **stale compile cache** · `bash scripts/devtools-cli.sh build-npm-fs` 不解决 (它只刷 miniprogram_npm 不重 transpile pages TS)。Coder 在源码上修对了 · 但用户实际打开 IDE 看到的还是旧 bug — 完全对应 2026-05-16 RC "8/8 PASS 用户开 IDE 一片红" 同型事故。

## 6. 对抗 (引用 adversarial.md)

3 轮对抗:
- Round 1 PASS · Cross-year / property-based · helper 跨年算法正确
- **Round 2 REJECT** · IDE 运行时数据 ≠ 源码 · B4/B5/B6 三个 bug 在用户 IDE 视角全部还在
- Round 3 PASS (low-risk surface) · tabBar 缺 iconPath · WeChat 新版兼容 · 后续补

## Verdict (给 audit.js)

**REJECT (passes=false)**

### redo_reason
源码 (commit d31d2ca) 修对 + 单测 + lint + typecheck 全过 · 但 **WeChat 开发者工具 IDE 运行时仍跑旧编译产物** · `page.data()` 实际返回的 weekLabel = "4 月 20–26 日" / weekDays d 值含 22 重复 / subjects[0].color = #C41E3A 暗红 · 三项 (B4/B5/B6) 在用户实际打开 IDE 时**完全没修**。同型于 2026-05-16 SC-01-MP "8/8 PASS · 用户开 IDE 一片红" RC 事故。

按 test-agent.md PASS 定义 #2 "真 IDE / 真浏览器 Console 零 [error]" 扩展精神 (用户视角 ≠ vitest ✓): **Tester 不能用 "代码改对 + 单测过" 上报 PASS · 必须 IDE 真渲染呈现新值**。

### attempt-2 必做清单 (映射 redo_target)
1. (Coder) 在 WeChat 开发者工具内手动触发 "项目 > 编译 (Cmd+B)" 或 "工具 > 清理缓存 > 全部清理 + 重新编译"
2. (Coder) 重跑 `pnpm exec vitest run test/e2e/home-data-probe.spec.ts` · 落新 runtime-data.json · 验:
   - `data.weekLabel === '5 月 11–17 日'` (或当时今天对应 label)
   - `data.weekDays.map(d => d.d)` 7 个值不重复连续
   - `data.subjects[0].color === '#FF6B6B'`
3. (Coder) 重截 `vrt-phome.png` · 视觉确认: 本周日程标头 ≠ "4 月 20–26 日" + chip 是亮色
4. (Coder) 把新 runtime-data.json + 新 vrt-phome.png 放 `audits/runs/SC01-MP-HOME-BUG-FIX/team-1/attempt-2/test-reports/`
5. (Coder · 防再犯) 考虑在 `home.spec.ts` E2E 加 1-2 条物理断言: `expect(data.weekLabel).not.toBe('4 月 20–26 日')` + `expect(data.subjects[0].color).toBe('#FF6B6B')` · 让 stale-runtime 当场炸不被静默吞
6. (TL / surface) tabBar 缺 iconPath · 后续 SC-XX 补真实 PNG icon

### 不在本轮 REJECT 范围 (Round 1/3 PASS 的部分)
- B1 (tabBar config + pages/me 占位) ✅
- B2 (navigationStyle=custom) ✅
- B3 (sparkline image + days bar) ✅ (源码与渲染都在)
- B7 (scroll-view → view) ✅ (源码与渲染都在 · 现在可整页滚)
- B8 (hero / greeting / scroll 尺寸) ✅ (源码与渲染都在 · 视觉空白消失)

剩 B4 / B5 / B6 三项是 IDE stale-runtime 阻塞。

## 7. 反省自检 (test-agent.md 铁律 8 双脑回看 + CLAUDE.md 启动纪律第 4 步)

| 步骤 | 我做了吗 | 证据 | 哪一步偷懒/打折 |
|------|---------|-----|---------------|
| 0 DoR 准入 | ✅ | §1 末段 4 项检查 (E2E 脚本 + raw + 截图 + spec trace) | 无 |
| 1 进场拦截 | ✅ | 只读 inflight 不动 feature_list.json 总表 | 无 |
| 2 全维度提取 | ✅ | 读 coder.md + bugs-found.md + 01_home.html + 8 B 改动 git diff | 无 |
| 3 编写脚本 (含破坏性边界) | ✅ | home.tester.spec.ts 18 case (含 100 random property + cross-year) · home-data-probe.spec.ts 物理真读 runtime · home-vrt-tester.spec.ts 真截图 | 无 |
| 4 内部 DoD 死循环 | ✅ | 自检过: 查漏 (跨年 + 真渲染 ≠ vitest) · 防伪 (0 mock 0 evaluate) · 破坏 (100 random) · 保真 (截图 + runtime probe) · 定罪 (Round 2 铁证) | 无 |
| 5 物理验证 (真终端真命令) | ✅ | lint/tc/unit/e2e 全亲手敲过 · raw 落盘 | 无 |
| 6 决策与宣判 | ✅ | REJECT (passes=false) + redo_reason + 改 `task.passes` 在 inflight | 无 |
| 铁律 1 真人操作 | ✅ | 用 mp.currentPage / page.data · 无 evaluate 改 state | 无 |
| 铁律 3 严苛对抗 ≥1 REJECT | ✅ | Round 2 REJECT · 用 page.data() 真证据 · 不妥协 | 无 |
| 铁律 4 权限隔离 (不动 dev_done) | ✅ | 仅改 task.passes · dev_done 保持 Coder 的 true | 无 |
| 铁律 6 work_log_dir 三件套 + 0 mock + 0 error | ✅ | tester.md + adversarial.md + test-reports/ 都落盘 · mock=0 · ide-console.txt 干净 | 无 |
| 铁律 8 双脑回看 | ✅ | 每次动作前对照 CLAUDE.md Rule 9 (intent encoded) / Rule 12 (fail loud) · 不静默 PASS | 无 |
| Rule 6 tool budget | ✅ | 估 ~35 次 tool use · 未触 50 软线 | 无 |
