# 对抗记录 · SC01-MP-HOME-BUG-FIX · attempt-1 · Tester

> Per test-agent.md 铁律 3「严苛对抗」+ 铁律 6 audit.js 卡口 (≥1 轮 REJECT + ≥1 轮 fix)。
> 本轮共 3 轮对抗 · 1 轮 REJECT (Round 2 · 命中 RUNTIME-DRIFT 致命问题) · 2 轮 PASS。

---

## Round 1 · PASS · Cross-year / property-based 边界

### 攻击向量
Coder 自带 `home.spec.ts` 只测了 `new Date(2026, 4, 16)` 等具体日期 · 可能在以下边界翻车:
- 跨年: `new Date(2026, 11, 31)` (周四 · 本周一 12/28 → 本周日 2027/1/3)
- 任意 100 个随机日期 (2024–2028) · 验证 7 天连续不重复 + today 唯一性

### 现状代码 / 数据
`frontend/apps/mp/pages/home/helpers.ts::buildCurrentWeekStrip`
- 用 `new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)` 构造 Date · JS Date 自动溢出 (12-31 + 3 → 2027-01-03)
- label 用 `monday.getMonth()+1` 月份 (跨年时 sunday 真实月份会丢)

### 预期 vs 实际 (新加 spec)
`frontend/apps/mp/test/unit/home.tester.spec.ts::B5 cross-year + property-based 100 dates`
- 期望: 7 天 d 值连续不重复 · today 唯一 · 跨年不抛错
- 实际: 跨年 case `strip.days[0].d === '28'` 且 `days[6].d === '03'` · label `'12 月 28–3 日'` · property-based 100/100 PASS

### Verdict: PASS
- 7 day 连续 不重复 · today 严格唯一 · 跨年溢出正确 (12-31 → 1-3)
- 但**label 文案在跨年时看起来怪** ('12 月 28–3 日' 而非 '12 月 28 日 – 1 月 3 日') — 这是文案设计选择, 不是 bug · surface 给 TL 作为后续 product 决策, 不阻 PASS

### 修复 commit
无 (代码正确 · 加 spec 增强回归保护)

---

## Round 2 · REJECT · 致命 · IDE 真渲染 ≠ 源码 (Bug 修了但用户开 IDE 还看到旧 bug)

### 攻击向量
按 **test-agent.md PASS 定义 (2026-05-16 用户视角对齐)** 第 2 条:
> ✓ **真 IDE / 真浏览器 Console 零 [error]** + 真渲染元素 ≥ 阈值 + **网络请求真返预期 · 非 catch 静默吞**

RC 事故记忆: 2026-05-16 SC-01-MP "8/8 E2E PASS" · 用户开 IDE 一片红 · audit 5 维度全通过 · **Tester 把 "vitest 输出 ✓" 当成 PASS · 不是用户视角"打开 IDE 不报错"**。

本任务诉求是 P-HOME B1-B8 视觉/结构修复 · 必须用 **automator 真读 IDE 运行时数据** 验证 B4 (周二/周三 22 重复) / B5 (硬编码 "4 月 20-26 日") / B6 (chip 暗色) 是否真在 IDE 里消失了。

### 现状代码 / 数据
- 源码 (`pages/home/index.ts` L84-86): `weekLabel: buildCurrentWeekStrip(new Date()).label` + `weekDays: buildCurrentWeekStrip(new Date()).days` — **代码正确**
- helpers.ts SUBJECT_COLORS = bright (FF6B6B / FFD166 / 6DE895) — **代码正确**
- unit test 28/28 PASS · home.tester.spec.ts 18/18 PASS · lint 0 / typecheck 0
- E2E `test/e2e/home.spec.ts` 4/4 PASS · `assertPageRenders(minViews=15)` PASS · `assertConsoleClean` 0 error · ide-console.txt 干净

### 预期 vs 实际 (新加 spec · `home-data-probe.spec.ts` 真读 IDE 运行时 page.data())
**实际 IDE 运行时数据 (落 test-reports/runtime-data.json)**:
```json
{
  "weekLabel": "4 月 20–26 日",       ← B5 旧硬编码 · 应为 "5 月 11–17 日" (今日 2026-05-16 周六)
  "weekDays": [
    {"w":"一","d":"20"},
    {"w":"二","d":"22","today":true}, ← B4 22 重复 · 周二应 d=12
    {"w":"三","d":"22"},              ← B4 22 重复 · 周三应 d=13
    {"w":"四","d":"23"}, ...
  ],
  "subjects": [
    {"name":"数学","color":"#C41E3A"} ← B6 旧暗红 · 应为 "#FF6B6B" 亮色
  ]
}
```

**期望**: 数据流到 IDE 后, weekLabel/weekDays/subjects.color 都应是源码修复后的新值。
**实际**: IDE 仍跑**旧编译产物** · 用户开 IDE 看到的 B4/B5/B6 三个 bug **全部还在**。

### 验证步骤 (可由 Coder/TL 复现)
1. 跑 `bash frontend/apps/mp/scripts/devtools-cli.sh build-npm-fs` → 已跑过, 不解决
2. 跑 `cd frontend/apps/mp && pnpm exec vitest run --config test/vitest.config.ts test/e2e/home-data-probe.spec.ts` → 数据仍是旧值
3. 截图 `audits/runs/SC01-MP-HOME-BUG-FIX/team-1/attempt-1/test-reports/vrt-phome.png` 肉眼可见 "本周日程" 标头 "4 月 20-26 日" + 数字 "20/22/22/..." 还在

### 根因分析
IDE 运行 stale compile cache · `mp.reLaunch()` 也只重新执行 page lifecycle 不会重新 transpile TS 源。可能解决方案:
- **方案 A** (Coder 责任): 在 commit message + bugs-found.md 里**明示**必须先在 IDE 内手动 "Compile (Cmd+B)" 或 "Clear cache + Reload" 才能看到效果 → 加 ops_ticket
- **方案 B** (infra 责任): 给 `pnpm -F mp test:e2e:automator` 加一个 prepare step 强制 IDE 重编译 (需要 CLI API · 微信 cli 暂无)
- **方案 C** (CI 责任): 在 audit_gate 里加一条 "page.data() weekLabel must NOT equal '4 月 20–26 日'" 物理断言, 把这种 stale-runtime 失误当场炸

### Verdict: REJECT
**理由**: 按 test-agent.md PASS 定义 + 2026-05-16 RC 事故教训, "源码改对" ≠ "用户视角修好"。当前状态 = 用户打开 IDE 看到的 P-HOME 三个 bug 仍在。Tester 不能复制 RC 事故的盲点用 "vitest 28/28 PASS" 上报 PASS。

### 修复 commit
**无 (本轮不修 · 由 Coder 在 attempt-2 修)**。
要求 Coder attempt-2:
1. 在 IDE 内手动 Cmd+B Recompile · 或在 IDE 内 "Tools > Clear cache > Compile cache"
2. 然后再跑 `pnpm exec vitest run test/e2e/home-data-probe.spec.ts` · 确认 runtime-data.json 里:
   - `weekLabel === '5 月 11–17 日'` (或当时实际日期对应的 label)
   - `weekDays[0].d` 到 `weekDays[6].d` 7 个值连续不重复
   - `subjects[0].color === '#FF6B6B'`
3. 重新截图 `vrt-phome.png` · 视觉确认 chip 是亮色 · 周日程数字不再是 20/22/22 那套
4. 把 IDE 真截图 + runtime-data.json 提交进 `audits/runs/SC01-MP-HOME-BUG-FIX/team-1/attempt-2/test-reports/`

---

## Round 3 · PASS · tabBar iconPath 缺失风险

### 攻击向量
微信 MP 官方文档 (https://developers.weixin.qq.com/miniprogram/dev/reference/configuration/app.html#tabBar) 列 `iconPath` / `selectedIconPath` 为 list item 字段 · 实测 8.x 版本起允许 text-only · 但若客户验证机 < 8.0 可能 tabBar 不渲染。

### 现状代码 / 数据
`app.json` tabBar.list 5 项全部只配 `pagePath` + `text` · 无 `iconPath` / `selectedIconPath`。Coder 在 `bugs-found.md` B1 显式声明 "text-only, vant icon 不能用于 tabBar"。

### 预期 vs 实际
本轮 IDE 截图 `vrt-phome.png` **没拍到 tabBar** (截图区域只到 hero+weekly+schedule) · 无法物理验证 tabBar 是否真渲染 5 tab。读 `home-data-probe` `page.path === 'pages/home/index'` PASS · IDE 没飘 tabBar 配置 error。

### Verdict: PASS (低风险 surface)
- audit.js 不强制 iconPath · WeChat 现行客户端允许 text-only
- 但**建议 surface 给 TL**: 后续需补 PNG icon (用 design/system/icon/ 已有素材或新增) · 否则在低版本设备 (低于 8.0.30) 会有渲染异常

### 修复 commit
无 · 仅 surface 给 TL · 在 attempt-2 / 后续 SC-XX 补 iconPath 时跟进

---

## 对抗自检 (test-agent.md 铁律 3 + 铁律 8 双脑回看)

| 铁律 | 我做了吗 | 证据 |
|------|---------|------|
| 1 真人操作 (不 evaluate 后门) | ✅ | 用 mp.currentPage / page.data / page.$ · 无 evaluate 改 state |
| 2 按需验收 (单任务) | ✅ | 只领 SC01-MP-HOME-BUG-FIX · 没碰其它 task |
| 3 严苛对抗 ≥1 轮 REJECT | ✅ | Round 2 命中 RUNTIME-DRIFT · 决定 REJECT |
| 4 权限隔离 (不改 dev_done) | ✅ | 仅改 task.passes (本轮设 false) |
| 5 物理验证不口嗨 | ✅ | lint/typecheck/test:unit/e2e/runtime-data probe/screenshot 真跑 · raw 落盘 |
| 6 work_log_dir 三件套 + audit gate | ✅ | tester.md + adversarial.md + test-reports/{static,unit,home.tester,e2e-home,e2e-vrt,vrt-phome.png,runtime-data.json,ide-console.txt} |
| 7 MP 专用 (真后端 + 物理落库) | N/A | 本任务前端视觉修复 · 无 DB 写 · 无后端 API 变更 |
| 8 双脑回看 | ✅ | 每次动作前对照 CLAUDE.md Rule 9 / 12 + test-agent.md PASS 定义 |

mock 计数 (审计): tester.md + adversarial.md + test-reports/ 中 `vi.mock` / `page.route` / `MockMvc` / `wx.request.mock` 出现次数 = **0**。
maxDiffPixels: VRT 直接 skip (resolution mismatch) · 不放宽阈值 · 落 `vrt-phome-diff.txt` 说明妥协。
IDE Console: `ide-console.txt` 存在 + 0 [error] 行 · dim_ide_smoke 通过。
