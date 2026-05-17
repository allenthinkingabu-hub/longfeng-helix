# Coder Review · SC16-T02 · Phase 2 · Round 1

**Reviewer**: Coder Agent (general-purpose subagent)
**Date**: 2026-05-16
**Reviewing**: audits/runs/SC16-T02/team-1/attempt-1/test-cases.md
**Verdict**: REJECT

## 必读声明

已完整阅读 `.harness/agents/coder-agent.md` · 内化铁律 1-5 + 补充铁律 6 (E2E DoD 三件套) + 补充铁律 7 (双脑回看) + Phase 2 review 职责 + Phase 2.5 user gate 红线。

读完:
- test-cases.md (6 用例 · Changelog Round 1 初版)
- biz/features/P-WEEKLY-REVIEW__weekly-review.md §2A.4 + §2B.17 + §10.13 + §10.14 (聚合空值/streak 语义)
- design/system/pages/P-WEEKLY-REVIEW-weekly-review.spec.md §2.2/§3/§6/§7/§9/§11/§12/§13 (14 testid 表) /§14 (25 i18n key)
- design/system/pages/P-HOME.spec.md §5.2 weekSummary 字段集
- .harness/feature_list_SC-16.json tasks[1] (T02 · 8 AC · 7 TI · 6 INV)
- frontend/apps/mp/pages/home/index.wxml (Line 95-140 现存 .bento「本周回顾」区段 + sec-m "查看全部 ›")
- 14_weekly_review.html mockup 主要 testid 锚

视角: 站在 Coder Phase 3 翻译 6 用例为 spec.ts it block + 实施 .ts/.wxml/.wxss 的角度审视可实现性。

---

## 可实现性评审 (6 用例逐条)

### TC-1 happy (View ≥ 18 · 18 testid 全集 + 6 块顺序淡入 + 2 埋点)

判定: ⚠ 大致可实现 · 但 **View ≥ 18 缺乏 deterministic derivation**

- ✓ Given 14 字段全 (kpId/kpName/recentMissCount/masteryRate/sparkline/streak/newCount/reviewedCount) · GET path + status 明确 · 我可翻译为 mockNetwork stub + 18 行 expect
- ✓ Then 14 testid 字面对齐 spec §13 表 (root/back/range/hero/delta/sparkline/radar/weakKp1/weakKp2/weakKp3/statsTrio/failedScroller/aiInsight + 用例隐去 root · 但明示 14 个 testid)
- ⚠ **View ≥ 18 数字源不明**: spec §13 表是 14 个 testid (root + 13). TC-1 Given 仅 weakKPs[0] 单条 · 但 Then 提到 weak-kp-1/2/3 三卡都渲染 · 暗示 Given 应额外列 `weakKPs.length === 3`. Coder Phase 3 跑 mp.$$('view') 实际 count 取决于 wxml 实现层 (每个组件内部 view 嵌套数 · 比如 weekly-radar 内含 5 个 legend view + 1 个 svg-image view → 单组件就 ≥ 6 view) · 18 数字既不是 14 testid · 也不是 spec §13 行数 · 也不是 mockup .phone DOM 元素数 · **不可 deterministic 校准**. **必须 surface**: View ≥ N 应取 spec 可推导的下限 (如 14 testid · 或某种"6 块各 ≥ 2 view = ≥ 12"工程量级估算) · 写死 18 容易跑出 17 fail / 跑出 25 也 pass (无诊断价值).
- ⚠ TC-1 Given 未明示 `weakKPs.length === 3` · 但 Then 引用 weakKp1/2/3 三卡 · TestDesigner 暗设 length=3 但未写. Coder Phase 3 实施时若 weakKPs 只给 [0] 一条 · Then weakKp2/weakKp3 渲染条件未规约 → 用例同形复制盲区 (Fix-2 RC).
- ✓ 6 块顺序淡入时序 (0/100/200/300/400/500ms) 与 spec §6 字面对齐 · 可在 spec.ts 用 waitFor + delay 测.

### TC-2 KP CTA → P05 (View ≥ n/a · 路由+埋点+性能)

判定: ⚠ 路由可实现 · 但 **「立即专练」CTA selector 不明** + 路由目标 P05 路径未在 MP 验证存在

- ✓ Then 1 条断言 "URL query 字面含 kpId" 对齐 INV-5 · 可 grep wxnav stub URL · Then 4 条断言 (路由/性能/埋点/淡出) 可独立测.
- ⚠ **「立即专练」CTA 没有独立 testid**: TC-2 When 写 "Tap weekly-weak-kp-1 卡的「立即专练」CTA" · 但 spec §13 14 testid 表里 `weekly-weak-kp-1` 是整个卡 · CTA 按钮是卡内部子 view (mockup .wkp-cta 或 .kpbtn · 没单独 testid). Coder Phase 3 想找 selector 必须 `wkp1.findChild('button')` 或加 child testid (e.g. `weekly-weak-kp-1-cta`). **必须 surface**: TC-2 应明示是 Tap `weekly-weak-kp-1` 卡整体 (整卡可点) · 还是 Tap 卡内子按钮 (需新 testid `weekly-weak-kp-1-cta` 加到 §13 表 → 这是 spec 增补而非用例缺陷).
- ⚠ **路由目标 P05 路径未验证**: 路由 `/pages/wrongbook-list/index` 是 spec §7 写法 · 但 MP 仓库是否真有 `frontend/apps/mp/pages/wrongbook-list/index.{ts,wxml}` · TestDesigner 未 grep 验过 · Coder Phase 3 若该页未存在 · `wx.navigateTo` 会 fail. **必须 surface**: 添加 Given 前置条件 "pages/wrongbook-list/index 已存在 (P05 task done)" 或 declarative skip.
- ✓ 性能预算 ≤ 500ms 对齐 spec §11. 可测.
- ✓ "P-WEEKLY-REVIEW 页淡出 (不再卸载前不渲染陈旧数据)" 对应 TI1 但 mp page stack 默认行为是保留前页 · TestDesigner 这里语义需澄清: 是 wx.navigateTo 栈推进 · 还是 wx.redirectTo 卸载 (与 wxnav 类型有关 · spec §7 写 navigateTo · 那"淡出"措辞是视觉态非状态机).

### TC-3 ERROR (View ≥ 8 · 黄条 + retry · 不白屏)

判定: ⚠ 大致可实现 · 但 **"6 块骨架占位保留"与 spec §6 状态机可能矛盾**

- ✓ HTTP 500 → state=ERROR · 顶部黄条 + retry button · i18n key 字面对齐 §14 表 · 可测.
- ⚠ **Then "6 块骨架占位保留 (不白屏 不卸载)"** 与 spec §6 状态机字面冲突. Spec §6 写 LOADING → ERROR · LOADING 时本就是骨架 · 转到 ERROR 后是否继续显示骨架 spec 未明示. Spec §9 异常表写"不白屏" · 但"骨架保留"是 TestDesigner 的实现想法 · 不一定是 spec 真意 (也可能 ERROR 态是 6 块全消 + 中间显大 retry · 类似 H5 ErrorBoundary). **必须 surface**: 这是 Coder/UI 决策 · 不该在 test-cases.md 锁死成 "保留骨架" · 应改为 "6 数据块 testid 在 ERROR 态可渲染可不渲染 · 但顶部黄条必现 · retry 按钮必现 · 整页非空白" 才符合 §9 字面.
- ⚠ View ≥ 8 同 TC-1 问题: 数字来源不明 · 若骨架保留 8 = 6 块 + 黄条 + retry · 若骨架不保留 8 = back + range + hero (作为骨架根) + 黄条 + retry + 3 个 ?  无 deterministic.
- ✓ retry 埋点时机 (mount=0 · Tap retry=1) 防 reviewer 挑 weekly_view 事件触发条件 · 正确锚 §12 表.
- ✓ "不允许 wx.showToast 即消 不允许整页白屏" 是 fail-loud · 对齐 TI2.

### TC-4 EMPTY (View ≥ 6 · empty-hero + CTA → P02 capture)

判定: ✗ **TC-4 View ≥ 6 公式包含 tabbar 是错误的 (MP tabbar 在 page DOM 之外 · 不进 mp.$$('view'))**

- ✗ **致命缺陷**: TC-4 Then 列出 "View ≥ 6" 的展开是 "weekly-back + weekly-range + weekly-empty + empty CTA + topbar share + tabbar" 共 6 项. 其中:
  - **tabbar** 在 MP 是系统级 (page.json tabBar 配置 · 不属于 page wxml 的 view 树) · `mp.$$('view')` 不会数到 tabbar (它是 wx tabBar 而非 view 元素) · 计入 count = 0
  - **topbar share** 是 spec §2 Wireframe 一员 · 但 spec §13 testid 表没列 share button · mockup 14_weekly_review.html 也无 `data-testid="share"` (mockup L99 只 `.back` 一处)
  - 实际 EMPTY 态可数 view ≤ 4-5 (back + range + empty-hero 容器 + empty CTA · 加上某 hero 根 view = 5) · **写 ≥ 6 用例必 fail**.
- ⚠ Coder Phase 3 翻译时若按字面跑 mp.$$('view').length >= 6 · TC-4 必 fail · 然后被迫"打开 wxml 多塞几个 wrapper view 凑 6" → 反作弊红线 (Rule 9 Tests verify intent · 不是凑数).
- ✓ 状态切 EMPTY · 整页换 weekly-empty · 不混合渲染 · 对齐 AC5 + spec §9 + INV-EMPTY 条 · 可测.
- ✓ CTA → /pages/capture/index 是 P02 page · 同 TC-2 路径假设问题 (但 capture 是 MVP 已存在页 · 风险低).
- ✓ 埋点 weekly_view{empty:true} + weekly_empty_cta_tap 各 1 条 对齐 §12.

### TC-5 A11Y delta chip (View ≥ 18 · icon + aria-label)

判定: ⚠ 大致可实现 · 但 **MP aria-label 支持需明示** + **A11Y 用例不该走 mp.$$('view') 而是 attribute 检查**

- ⚠ **MP `aria-label` 支持限定**: 微信小程序自基础库 2.10.4 起支持 `aria-label` 作为通用属性 · Skyline 渲染层完整支持 · WebView 渲染层退化 · 用例未给基础库要求. Coder Phase 3 实施时挂 `aria-label="较上周 -3 pts"` 到 view · spec.ts mount 后 `view.attribute('aria-label')` 可读. **必须 surface**: TC-5 Given 应加 "MP 基础库 ≥ 2.10.4 · 渲染层 Skyline (worklet 模式)" 前提.
- ⚠ View ≥ 18 与 TC-1 一样 · TC-5 重点是 chip 的 aria-label 属性内容 · 不是 view 总数 · View ≥ 18 在此 TC 没诊断价值. **建议**: TC-5 View ≥ 列改 `n/a (focus on chip attribute)` · 或 写 `1 (delta-chip 存在)`.
- ✓ "↓ icon (字符或独立 view 元素 · 非纯颜色)" 是反作弊好措辞 · 防 Coder 仅用红色绿色传达 (WCAG AA 违例).
- ✓ aria-label 字面 "较上周 -3 pts" 来源 §14 i18n key `weekly.hero.delta.down` · Changelog Round 1 已 surface 此字符级争议 · 接受.
- ⚠ "colorblind 用户能从 icon+aria-label 独立判断方向 (不允许仅靠红色)" 是 Coder 主观自检条款 · spec.ts 自动化测无法跑色盲断言. **建议**: 改为 "icon 字符存在 ∈ {↑,↓} 且 aria-label 字面包含 '+' 或 '-' 数字" 两条机器可断言.

### TC-6 P-HOME 4 数字 wire (View ≥ 15 · AC8 a/b/c/d 全集)

判定: ✗ **致命缺陷 · TC-6 Then 引用的 DOM 锚在 MP 现存代码中不存在**

- ✗ **TC-6 Then 字面引用 `.tile.mastery .big` / `.tile.mastery .spark svg` / `.streakchip` / 「本周新增」 tile** · 这些是 mockup `01_home_v2.html` (H5) 的 CSS class · **不是 MP 现存 wxml 的真实 class**. 我已 grep `frontend/apps/mp/pages/home/index.wxml` 全文 (240 行 · Line 95-140 .bento「本周回顾」区段):
  - MP 现状 class: `.weekly` (container) · `.weekly-row` · `.stat` × 4 (mastered/newItems/forgotten/masteryRate · 字段名都不对) · `.spark > .spark-svg` (是 image src 不是 svg) · `.days` · `.streakchip` **完全不存在**
  - **字段绑定也错**: 现状用 `{{weekStats.mastered}}` `{{weekStats.newItems}}` `{{weekStats.forgotten}}` `{{weekStats.masteryRate}}` + `{{sparklineSvgUri}}` 4 字段 · **不是** spec §5.2 / AC8 字面的 `weekSummary.{masteryRate,sparkline,streak,newCount}` 4 字段
  - 没有 streak/newCount 渲染 · 没有 .tile.mastery / .streakchip / 「本周新增」 DOM 锚

- ✗ **TC-6 隐式假设**: Coder Phase 3 必须**先重写 MP P-HOME .bento 区段** (替换字段名 + 重塑 DOM 结构) 才能让 TC-6 Then 字面可断言. 这是大改造 · 不是简单 wire. test-cases.md 未明示此前置 · Coder 易陷入"按 TC-6 Then 字面找 .tile.mastery → grep 不到 → 卡住"的盲区 (RC Fix-2 同形复制).

- ⚠ **AC8 a/b/c/d 4 子条覆盖准确**: 但子条断言形式不统一:
  - (a) "字面 '—%'" → 文本断言 ✓
  - (b) "svg path d 属性必含 ≥ 4 个 'M' 起笔字符" → MP 用 `<image src="data:image/svg+xml;..." />` 而非原生 svg · path d 属性藏在 base64-encoded data URI 里 · 反查需 decode data URI 再 grep · 实际可行但很 fragile. spec.ts 该用 helpers 解码 · 不是直接 attribute('d').
  - (c) "整 chip 不渲染" → mp.exists() 断言 false ✓
  - (d) "字面 '+0'" → 文本断言 ✓
  - 4 子条 OR/AND 关系: TestDesigner 用 ";" 分隔 · 暗示 4 子条都要满足 · 但 Then 内 "整个 P-HOME 页面源码 grep 不含 /api/home/weekly" 是**源码级 grep 而非渲染级断言** · 跟用户视角 ≠ 渲染态 · 这条应分离到 TI7 测试 (架构不变量 · 不该走 UI spec.ts).

- ✗ **TC-6 View ≥ 15**: P-HOME 整页 view 数远 > 15 (header + bento × N + sec × N + msg + kpcard + quick × N · 240 行 wxml 数十个 view) · 写 ≥ 15 是下限松到无诊断价值. 同 TC-1 数字源不明问题.

- ✓ AC8 反 anti_pattern (空周 null 显 '—' 不显 '0%' · sparkline null 索引断点) 锚正确 · 用户 2026-05-16 决策严格执行.

---

## trace 链评审

| TC | biz | spec | feature_list | mockup | 完整性 |
|---|---|---|---|---|---|
| TC-1 | §2B.17 步 1-5 ✓ | §2/§6/§7/§11/§12 ✓ | AC1+AC2+AC7+TI4+TI5 ✓ | 14_weekly L99/L116/L162/L256 ✓ | ✓ |
| TC-2 | §2B.17 步 6-7 ✓ | §7/§11 ✓ | AC3+TI3+INV-5 ✓ | 14_weekly L220 ✓ | ⚠ P05 page 存在性未验 |
| TC-3 | §2B.17 (TC-16.02) ✓ | §9 ✓ | AC4+TI2 ✓ | (无 mockup ERROR 态) | ⚠ §6 状态机骨架是否保留模糊 |
| TC-4 | TC-16.03 ✓ | §9 ✓ | AC5 ✓ | 14_weekly L344 .empty-hero ✓ | ✓ |
| TC-5 | §2A.4 可访问性 ✓ | §3 DeltaChip ✓ | AC6 ✓ | (无 mockup A11Y 态) | ⚠ MP 基础库版本前提缺 |
| TC-6 | §10.13/§10.14 ✓ | P-HOME §5.2 ✓ | AC8+TI6+TI7+INV-6 ✓ | 01_home_v2.html L291/296/305/227/338 ✓ (但 mockup ≠ MP 实现) | ✗ MP 现状字段名/DOM 全错 |

**重大 trace 缺陷**: TC-6 trace 锚的是 H5 mockup 01_home_v2.html · 但本 task scope 是 MP only (feature_list.frontend_scope_constraint = "wechat_miniprogram_only" + "frontend/apps/h5/ exclude"). TestDesigner 引用 mockup 没错 · 但 Then 字面用 mockup DOM 锚 (.tile.mastery / .streakchip) 而非 MP 现存 wxml 锚 (.weekly / .stat / .spark) · 是抽象层弄混了. 必须在 Round 2 显式区分: "mockup 是设计意图 · MP wxml 是落地形态 · TC-6 Then 必须用 MP testid (待 Coder Step 0 注册 `TEST_IDS.home.weeklySection.*`) · 不能用 mockup CSS class".

---

## 覆盖盲点

- 8 AC 覆盖矩阵:
  - AC1 (entry+mount) → TC-1 ✓
  - AC2 (READY 6 块 + 14 testid) → TC-1 ✓
  - AC3 (KP CTA → P05) → TC-2 ✓
  - AC4 (ERROR 黄条+retry) → TC-3 ✓
  - AC5 (EMPTY empty-hero) → TC-4 ✓
  - AC6 (A11Y delta chip) → TC-5 ✓
  - AC7 (埋点 7 事件全集) → TC-1/2/3/4 部分覆盖 · 完整 7 事件未单独验. **缺**: `weekly_weak_kp_view` (IntersectionObserver KP 卡进视野) + `weekly_back` (返回按钮) 两个事件无 TC 覆盖. **建议**: TC-1 Then 已含 weekly_view + weekly_data_render 2 个 · 其他 5 个 (weekly_weak_kp_view/weekly_weak_kp_tap/weekly_retry/weekly_empty_cta_tap/weekly_back) 散落 TC-2/3/4 · `weekly_weak_kp_view` (IO scroll 触发) 实际没覆盖 · token budget 不允许加 TC-7 但应在 Round 2 把 weekly_weak_kp_view 加到 TC-1 Then 的埋点列表 (1 行字面增补 · 不耗 budget).
  - AC8 (P-HOME 4 数字 wire) → TC-6 ✓ (但实施有重大缺陷 · 见上)

- 7 TI 覆盖:
  - TI1 (LOADING 不渲染陈旧数据) → TC-2 隐式 (Then 末) · TC-1 mount 流程 LOADING 态未单独验. **可接受 token budget**.
  - TI2 (ERROR 不白屏) → TC-3 ✓
  - TI3 (KP URL kpId) → TC-2 ✓
  - TI4 (VRT 4 态像素对齐) → **缺**. 6 用例无一个走 screenshot baseline diff (mockup 14_weekly_review.html ≥ 95% 像素对齐 · TI4 字面). **建议**: token budget 允许的话补一句 "TC-1 Then 末加 `expect(page).toHaveScreenshot('weekly-ready-baseline.png')` 与 14_weekly_review.html 像素 Diff" · 否则在 Round 2 surface "VRT 由 Coder Phase 3 自行加 helper · 不放 test-cases.md".
  - TI5 (14 testid 命名空间 · grep 验) → TC-1 隐式 (Then 写 "14 testid 全部从 TEST_IDS.weekly.* 命名空间引用"). **建议**: 加一句更具体的 grep 反断言 "MP wxml 文件 0 命中裸字符串 `data-test-id="weekly-`" · 否则用例只验"通过 TEST_IDS 引用" · 不验 "没有裸字符串绕过".
  - TI6 (P-HOME 与 P-WEEKLY-REVIEW hero 同源) → TC-6 部分 (TC-6 Given mock today 返 4 字段 · 但没验 P-WEEKLY-REVIEW hero 等于 P-HOME 大数字). **可接受**: TI6 偏 contract test · 应在 T01 backend AC6 contract test 覆盖 · 不该 MP TC 覆盖.
  - TI7 (P-HOME 不调 /weekly · grep 反断言) → TC-6 ✓ (但反断言形式 mixed 在 UI Then 里 · 见上)

- 6 INV 覆盖:
  - INV-5 (kpId in URL) → TC-2 ✓
  - INV-6 (P-HOME 4 数字 wire today.weekSummary · 不调 /weekly) → TC-6 ✓
  - 14 testid 命名空间 → TC-1 ✓
  - ERROR 不白屏 → TC-3 ✓
  - EMPTY 整页换 empty-hero → TC-4 ✓
  - P-HOME 空值兜底 (4 子条 a/b/c/d) → TC-6 ✓

**结论**: 6 用例覆盖 8 AC 全集 + 大部分 TI + INV · token budget 已用满 · 不要求加新 TC. 但**必须**在 Round 2 把 TI4 VRT / TI5 grep 反断言形式 / AC7 weekly_weak_kp_view 埋点写清楚 · 是 Then 列字面调整级别 · 不挤 TC 数量.

---

## 反作弊审视

| 维度 | 命中 | 详情 |
|---|---|---|
| Then 写实现细节 (setData/onLoad/component method) | 0 处 | ✓ TestDesigner 严守"用户观察到什么" |
| View ≥ 数字 deterministic 可执行 | **多处问题** | TC-1=18 / TC-3=8 / TC-4=6 / TC-5=18 / TC-6=15 · **没有一个数字能从 spec §13 testid 表或 wxml 结构推导出来** · 全凭工程量级直觉. Coder Phase 3 mount 后跑 `mp.$$('view').length` 实际值取决于组件内部 view 嵌套数 · 任何小重构 (比如 weekly-radar 内多一个 wrapper view) 就破坏 TC-1 18 阈. **建议**: View ≥ 列改为 "14 个 testid 全部 exists" (基于 spec §13 表 · deterministic) · 而非 view 总数硬阈. |
| 不可能发生的 edge | TC-4 tabbar 计入 | ✗ TC-4 View ≥ 6 公式包含 tabbar · MP tabbar 不在 page DOM 树 · mp.$$('view') 不计 · 实际只能数到 4-5 · 用例必 fail |
| Then 列引用真实 DOM 锚 | TC-6 fail | ✗ TC-6 Then 引用 .tile.mastery / .streakchip 是 H5 mockup CSS class · MP 现存 wxml 完全没这些 class. Coder Phase 3 翻译时找不到 selector |
| MP 平台特性 (aria-label/svg/tabbar) 前提 | TC-5 missing 基础库前提 | ⚠ MP `aria-label` 在 Skyline 渲染层和 WebView 渲染层支持度不同 · 基础库 < 2.10.4 不支持 |
| 路由目标页存在性 | TC-2 P05 未验 | ⚠ /pages/wrongbook-list/index 是 spec §7 写法 · MP 仓库是否真有该页未 grep 验 |

---

## REJECT 详细 (必修项)

### 必修 #1 [TC-6 致命] · Then 列 DOM 锚错位

**问题**: TC-6 Then 字面引用 `.tile.mastery .big` / `.tile.mastery .spark svg` / `.streakchip` / 「本周新增」 tile · 这些是 H5 mockup `01_home_v2.html` 的 CSS class. MP 现存 `frontend/apps/mp/pages/home/index.wxml` Line 95-140 的实际 class 是 `.weekly` / `.stat` / `.spark` / `.days` · **完全不对应**.

**修法 (Round 2 选 1)**:
- 方案 A (推荐): TC-6 Then 改用 MP testid (要求 Coder Step 0 新注册 `TEST_IDS.home.weekSummary.{masteryBig, sparklineSvg, streakChip, newCountTile}` 4 个) · Then 写 "weekSummary-mastery-big 文本字面 '—%'" 等. 同时在 test-cases.md 标头 trace 加一行 "本 TC 要求 Coder Phase 3 给 P-HOME .bento 4 数字 wire 新加 4 个 home weekSummary testid (跟 weekly.* 命名空间区分)".
- 方案 B: TC-6 Then 描述用户视角 (不引 selector) · 比如 "用户在 P-HOME 本周回顾区段看到掌握率位置显示 '—%' 而非 '0%' 也非 'null%'" · 让 Coder Step 0 自行决定 wxml 实现的 DOM 锚.

### 必修 #2 [TC-6 致命] · MP 现状字段名错位 · 需明示重写

**问题**: TC-6 Given 写 "weekSummary={masteryRate:null, sparkline:[...], streak:0, newCount:0}" · 但 MP 现状 `frontend/apps/mp/pages/home/index.wxml` 使用的字段是 `weekStats.{mastered, newItems, forgotten, masteryRate}` + `sparklineSvgUri` · **字段集完全不一样** (现状是 4 个 stat 类的计数 + 1 个 data URI · 不是 spec §5.2 / AC8 的 4 字段).

Coder Phase 3 必须**先重写** MP P-HOME .bento 区段的字段绑定 (替换 `weekStats.mastered` → `weekSummary.masteryRate · null 显 '—'` 等) 才能让 TC-6 Then 可执行. 这是大改造 · 不是 wire 一个数字.

**修法**: TC-6 Given 前置补一句 "MP P-HOME pages/home/index.wxml 的本周回顾区段已重写: 移除 `weekStats.{mastered,newItems,forgotten,masteryRate}` + `sparklineSvgUri` 字段 · 改用 `weekSummary.{masteryRate, sparkline, streak, newCount}` 4 字段 (锚 AC8 + spec §5.2)" · 让用例明示前置改造范围. 或者把 "重写 .bento 字段绑定" 作为 TC-6 Given 的依赖前置 (Coder Step 0 先做).

### 必修 #3 [TC-4 致命] · View ≥ 6 公式包含 tabbar 错

**问题**: TC-4 Then 列出 "View ≥ 6" 展开包括 tabbar. MP tabbar 在 page wxml 之外 (page.json tabBar 配置 · 由 wx 框架渲染) · `mp.$$('view')` 不会计入 tabbar. 实际 EMPTY 态 view 数 ≤ 4-5 (back / range / empty-hero 容器 / empty CTA 按钮 · 可能加 1 个 hero 根 wrapper view = 5). 用例必 fail.

**修法**: 删除 tabbar 项 · 重算: weekly-back (1) + weekly-range (1) + weekly-empty 容器 (1) + empty CTA button (1) + 可能的 topbar 容器 view (1) = 4-5. **建议把 View ≥ 列改为 "weekly-empty testid exists AND weekly-hero testid NOT exists" 两条 deterministic 断言 · 而非 view 总数硬阈**.

### 必修 #4 [TC-1/3/5/6 一致性问题] · View ≥ N 数字 deterministic 推导缺失

**问题**: 5 个 TC 用了 View ≥ N (n=6/8/15/18) · 但**没有一个能从 spec §13 testid 表 或 wxml 结构 deterministic 推导**. 18 / 15 / 8 / 6 是 TestDesigner 工程量级直觉. Coder Phase 3 mount 后跑 `mp.$$('view').length` 实际值随组件内部 wrapper view 嵌套数变化 (比如 weekly-radar 内含 5 个 legend view + 1 个 svg-image wrapper = 6 个 view · 单组件) · 18 数字易跑出 17 fail (small refactor 后) 或 跑出 25 也 pass (无诊断价值 · Rule 9 Tests verify intent 违例).

**修法**: View ≥ 列**改用基于 spec §13 testid 表的 deterministic 命题**:
- TC-1: "14 testid (spec §13) 全部 exists 且 weekly-weak-kp-1/2/3 都渲染" (因为 Given weakKPs.length=3)
- TC-3: "weekly-error-banner exists AND weekly-retry-btn exists AND weekly-hero (或骨架根) exists"
- TC-4: "weekly-empty exists AND weekly-hero NOT exists" (整页换 empty-hero · 锚 §9)
- TC-5: "weekly-delta exists AND view.attribute('aria-label') 字面含 '较上周 -3 pts'"
- TC-6: 4 子条 a/b/c/d 各自命题 deterministic (不靠 view 总数)

这一项也修复了 TC-4 的 tabbar 错误.

### 必修 #5 [TC-2] · 「立即专练」 CTA selector 不明

**问题**: TC-2 When "Tap weekly-weak-kp-1 卡的「立即专练」CTA" · 但 spec §13 14 testid 表里 weekly-weak-kp-1 是整卡 · CTA 按钮无独立 testid.

**修法 (Round 2 选 1)**:
- 方案 A: When 改为 "Tap weekly-weak-kp-1 卡 (整卡可点)" · 不强制 CTA 子按钮.
- 方案 B: 在 spec §13 表加一行 `weekly-weak-kp-1-cta` · 同时 test-cases.md 标头 trace 增补此 testid (强制 Coder Step 0 注册).

### 必修 #6 [TC-3] · "6 块骨架占位保留" 与 spec §6 状态机模糊

**问题**: TC-3 Then "ERROR 态 6 块骨架占位保留 (不白屏 不卸载)" 是 TestDesigner 实现想法 · spec §6 状态机字面没说骨架保留. Spec §9 异常表只说 "不白屏" · 也允许 6 块全消 + 中间显大 retry (类似 H5 ErrorBoundary 全屏 retry).

**修法**: Then 改为 "ERROR 态: 整页非空白 (至少 weekly-back + weekly-range + weekly-error-banner + weekly-retry-btn 4 testid 渲染) · 6 数据块 (weekly-hero/radar/weakKp/statsTrio/failedScroller/aiInsight) 渲染与否由 Coder 自行决定 · 不锁死". 这样既守 spec §9 "不白屏" 红线 · 又给 Coder UI 决策自由.

### 必修 #7 [TC-5] · MP 基础库 / aria-label 前提缺

**问题**: TC-5 没规约 MP 基础库版本 · aria-label 仅 ≥ 2.10.4 支持 · Skyline 渲染层完整 · WebView 渲染层退化.

**修法**: TC-5 Given 加 "MP 基础库 ≥ 2.10.4 · 渲染层 Skyline (worklet 模式 · 锚 spec §2A.4 可访问性段)" 前提.

### 必修 #8 [TC-2] · P05 路由目标页存在性未验

**问题**: /pages/wrongbook-list/index 是 spec §7 写法 · 但 MP 仓库是否已有该 page (P05 task 是否 done) 未 grep 验过 · 若不存在 wx.navigateTo fail.

**修法**: TC-2 Given 加 "frontend/apps/mp/pages/wrongbook-list/index.{ts,wxml,wxss,json} 已存在 (P05 task done)" 前置 · 或在 test-cases.md 标头 trace 加 "本 TC 依赖 P05 page 存在 · 若 P05 未 done 则 TC-2 skip + 标记 BLOCKED".

### 选改 #9 [AC7 埋点] · weekly_weak_kp_view 事件无 TC 覆盖

**问题**: AC7 要求 7 个埋点事件全集 (weekly_view / weekly_data_render / weekly_weak_kp_view / weekly_weak_kp_tap / weekly_retry / weekly_empty_cta_tap / weekly_back). 6 用例覆盖了 6 个 · **缺 `weekly_weak_kp_view` (IntersectionObserver KP 卡进视野)**.

**修法 (轻量 · 不耗 token budget)**: TC-1 Then 末加一句 "scroll 到 weakKp 区段后 · weekly_weak_kp_view{kpId,rank} × 3 (3 个 KP 卡各 1 条 · IntersectionObserver 触发) 入 telemetry buffer". 或在 Round 2 Changelog 显式 surface "weekly_weak_kp_view 由 Coder Phase 3 unit test 单独验 · 不放 spec.ts" (token budget 妥协).

### 选改 #10 [TC-5] · A11Y colorblind 断言不机器可执行

**问题**: TC-5 Then "colorblind 用户能从 icon+aria-label 独立判断方向 (不允许仅靠红色)" 是主观自检条款 · spec.ts 无法跑.

**修法**: 改为 "weekly-delta view: 1) 字符 ∈ {'↑','↓'} 至少 1 个 (innerText 或 child text node grep); 2) aria-label 属性字面含 '+' 或 '-' 数字字符 (e.g. '+6' '-3'); 3) view.style.backgroundColor 不是绿/红单独传达 (允许同时有颜色 · 但不允许仅有颜色)" · 3 条机器可断言命题.

---

## Verdict 总结

**verdict: REJECT**

理由: 6 用例覆盖矩阵基本 OK (8 AC + 6 INV + 大部分 TI 命中) · TestDesigner Changelog Round 1 已主动 surface 5 处争议 · 工作质量优于平均. 但**必修项 #1 / #2 / #3 / #4 是 Coder 视角致命的可实现性缺陷**:

- **TC-6** Then 引用了 H5 mockup CSS class · MP 现存 wxml 没有 `.tile.mastery / .streakchip / 本周新增 tile` 这些 DOM 锚 · Coder Phase 3 翻译时直接找不到 selector (Fix-2 RC 同形复制盲区);
- **TC-6** Given mock 字段 (`weekSummary.{masteryRate,sparkline,streak,newCount}`) 与 MP 现状字段 (`weekStats.{mastered,newItems,forgotten,masteryRate}` + `sparklineSvgUri`) 完全错位 · 必须先重写 .bento 区段的字段绑定 (大改造) · 用例未明示此前置;
- **TC-4** View ≥ 6 公式错误地把 tabbar 计入 · MP tabbar 不在 page.wxml DOM 树 · 用例必 fail;
- **TC-1/3/5/6** View ≥ N 5 个数字全无 deterministic 推导 · 任何小重构破坏阈值 · 违反 Rule 9 Tests verify intent.

**Round 2 主要工作**: TestDesigner 修必修 #1-#4 (致命四项) + #5-#8 (前提/路由/状态机/平台) · #9-#10 (轻量) 可选. 修完后**预期 Coder Round 2 review APPROVE** (前提是必修 #1-#4 真改) · 然后进 Phase 2.5 user gate.

**self-checkpoint**: tool use ≈ 13 次 · 估 token < 50K · 未触 Rule 6 软线. verdict=REJECT · 必修项 8 条 (4 致命 + 4 重要) + 选改 2 条. 一句话给 TL: TC-6 引用 H5 mockup class 在 MP 完全不存在 · TC-4 tabbar 计入 view 数错 · TC-1/3/5/6 View ≥ N 全无 deterministic 推导 · TestDesigner 必须 Round 2 重写这几条用例.

---

# Round 2 Review (TestDesigner 修后审复)

**Date**: 2026-05-16
**Reviewer**: Coder Agent (Round 2 · 审复)
**Reviewing**: audits/runs/SC16-T02/team-1/attempt-1/test-cases.md (Round 2 修后 · 含 Round 1+2 双 Changelog)
**Verdict**: APPROVE

## 必读声明

已完整阅读 `.harness/agents/coder-agent.md` Round 2 review 职责 + Phase 2 多 Round 循环铁律 (APPEND 不 overwrite · audit ≥ 1 REJECT 已 Round 1 满足) + 本文 Round 1 review (8 必修 + 2 选改) + Round 2 test-cases.md 全文 (含 Round 1+2 双 Changelog + Framework Mapping 表 + 反作弊审视段) + Tester Round 1 review (对照不影响 · 仅参考). Round 2 评审视角: TestDesigner 是否真改了我 Round 1 提的 10 项 · 是否引入新技术问题 · 是否破坏前轮 APPROVE 的假设.

## Round 1 必修一对一审复 (字面 grep verify · 不应付式 APPROVE)

### #1 [TC-6 致命] · Then 列 DOM 锚错位 → 改用 MP testid

**Round 2 修法**: TC-6 Then (a)(c)(d) 字面改用 `p-home-week-mastery-num` / `p-home-streak-chip` / `p-home-week-new-count` 3 个 MP testid · 不再字面引 H5 mockup `.tile.mastery .big` / `.streakchip` / 「本周新增」 tile CSS class. Changelog Round 2 第 1 条明示 "选 Coder REJECT 方案 A · 要求 Coder Step 0 注册 TEST_IDS.home.weekSummary.* 4 个新 testid · trace 注 '本 TC 是 H5 mockup 视觉锚 vs MP wxml 落地锚区分'".

**grep verify**: L41 TC-6 行命中 `p-home-week-mastery-num` `p-home-streak-chip` `p-home-week-new-count` 三 testid 字面. 0 处遗留 `.tile.mastery .big` (仅 trace L9 一处 mockup 来源说明 + Changelog L80 修法描述 · 都是文档说明 · 不是 Then 列字面断言).

**审复结论**: ✓ 真改 · 修法干净 · 我的 Round 1 #1 方案 A 被字面采纳.

### #2 [TC-6 致命] · MP 现状字段名错位 · 需明示重写

**Round 2 修法**: TC-6 Given 加显式前置 "Coder Phase 3 Step 0 必做: 重写 MP P-HOME .bento 区段字段绑定 (frontend/apps/mp/pages/home/index.wxml L98-L140) · **移除** `weekStats.{mastered,newItems,forgotten,masteryRate}` + `sparklineSvgUri` 5 字段 · **改用** `weekSummary.{masteryRate, sparkline, streak, newCount}` 4 字段绑定 + 新建 4 个 testid `data-test-id="p-home-week-mastery-num/sparkline-svg/streak-chip/new-count-num"` (TEST_IDS.home.weekSummary.* 命名空间)".

**grep verify**: L41 Given 列字面命中 "前置 (Coder Phase 3 Step 0 必做): 重写 MP P-HOME .bento 区段字段绑定" + L14 trace 段加补充注 "TC-6 隐式要求 Coder Phase 3 Step 0 先重写绑定". 重写范围明确到行号 (L98-L140) · 移除/改用字段集字面列全.

**审复结论**: ✓ 真改 · 明示前置 + 现状对照 + 新字段集 + 新 testid 四方位锁死 · 我 Round 1 #2 提的"必明示此前置"采纳到位. Coder Phase 3 Step 0 翻 it block 前就能看到此前置 · 不会陷入 RC Fix-2 同形复制盲区.

### #3 [TC-4 致命] · View ≥ 6 公式包含 tabbar 错

**Round 2 修法**: TC-4 View ≥ 列改 `weekly-empty exists + weekly-hero NOT exists + weekly-weak-kp-1 NOT exists` 3 条 testid 命题 · 完全删除 tabbar 项 + topbar share 项 + 数字总数硬阈. Changelog Round 2 第 3 条 "删除 'tabbar' 项 · View ≥ 列改命题 ... 不是 view 总数".

**grep verify**: L39 TC-4 View ≥ 列字面 `weekly-empty exists + weekly-hero NOT exists + weekly-weak-kp-1 NOT exists (3 条 testid 命题 · TC-4 致命缺陷修复 · Coder REJECT #3)`. 全文 tabbar 字面 grep 仅 L71 Changelog Round 1 撞坑说明 + L110 Changelog #10 switchTab 区分 · 没有任何 Then / View ≥ 列字面把 tabbar 当 view 数计入. TC-4 Then (c) 还顺便加了反作弊命题 "不靠 visibility:hidden 隐藏 · 必须真 wx:if 移除节点".

**审复结论**: ✓ 真改 · 反例形式明确 (Coder 写 visibility:hidden 偷懒 → $$.length 命题直接 fail).

### #4 [TC-1/3/5/6 一致性] · View ≥ N 数字 deterministic 推导缺失

**Round 2 修法**: 全部 5 个 TC 的 View ≥ 列重写为 deterministic testid 命题 · 不再依赖工程量级直觉数字:
- TC-1: `14 testid 全 exists + weekly-empty NOT exists + assertPageRenders minViews=15` (与 home.spec.ts L29 同 pattern · low-water mark 防 mount 全 fail)
- TC-3: `weekly-error-banner + weekly-retry-btn + weekly-back + weekly-range 4 testid exists` (整页非空白反断言)
- TC-4: 同 #3
- TC-5: `weekly-delta exists + data-a11y-delta-direction == "down" attr 命题 + .sr-only text node exists`
- TC-6: `p-home-week-mastery-num exists + p-home-week-new-count exists + p-home-streak-chip NOT exists` 3 条命题

**grep verify**: 表头 L23 "View ≥ 列必填: 命题形式 (testid exists / NOT exists / 计数) · 不写凭直觉的工程量级数字". TC-1/3/4/5/6 View ≥ 列 5 处字面均为 testid 命题 + assertPageRenders 数 (仅 TC-1 保留 minViews=15 安全锚 · 锚 home.spec.ts 同 pattern · 是 low-water mark 而非精确节点数 · 明确注明). TC-2 View ≥ 列 `n/a (前端纯路由 · 不验渲染 view 数)` · 路由 case 合理 n/a.

**审复结论**: ✓ 真改 · 全部 deterministic · 任何 Coder 小重构 (比如 weekly-radar 内多一个 wrapper view) 都不破坏 testid 命题 · Rule 9 Tests verify intent 守住.

### #5 [TC-2] · 「立即专练」 CTA selector 不明

**Round 2 修法**: When 改 "Tap `weekly-weak-kp-1` 整卡 (整卡可点 · 不假设 sub-testid CTA · spec §13 表无 weekly-weak-kp-1-cta 行)" · 选 Coder REJECT 方案 A · 不要求新增 weekly-weak-kp-1-cta testid (尊重 spec §13 表字面 · 不改 spec).

**grep verify**: L37 TC-2 When 列字面 "Tap `weekly-weak-kp-1` 整卡 (整卡可点 · 不假设 sub-testid CTA · Coder REJECT #5 · spec §13 表无 weekly-weak-kp-1-cta 行)". Coder REJECT #5 编号字面引用 · 明示采纳源头.

**审复结论**: ✓ 真改 · 方案选 A 合理 · 不增 spec drift · Coder Phase 3 实施时直接给 weekly-weak-kp-1 整卡挂 bindtap 即可.

### #6 [TC-3] · "6 块骨架占位保留" 与 spec §6 状态机模糊

**Round 2 修法**: Then (d) 改 "整页非空白 反断言: weekly-back + weekly-range + weekly-error-banner + weekly-retry-btn 4 条 testid 都 PASS (spec §9 字面 '不白屏')" · Then (e) 显式 "6 数据块 (hero/radar/weakKp/statsTrio/failedScroller/aiInsight) 渲染与否由 Coder 决定 · 不锁死骨架保留 (Coder REJECT #6 · 状态机模糊点交 Coder UI 决策)".

**grep verify**: L38 TC-3 Then (e) 字面 "6 数据块 ... 渲染与否由 Coder 决定 · 不锁死骨架保留". Then (d) 守 spec §9 "不白屏" 红线 (整页非空白 4 testid). 双方都尊重: 红线 (不白屏 · 4 testid 必现) 守 spec · 模糊点 (6 数据块骨架是否保留) 交 Coder.

**审复结论**: ✓ 真改 · 此修法是我 Round 1 #6 的精准复述 (我给的修法字面 "整页非空白 (至少 weekly-back + weekly-range + weekly-error-banner + weekly-retry-btn 4 testid 渲染)" 与 Round 2 几乎逐字一致).

### #7 [TC-5] · MP 基础库 / aria-label 前提缺

**Round 2 修法**: TC-5 Given 字面加 "MP 基础库 ≥ 2.10.4 · 渲染层 Skyline (worklet 模式 · 锚 spec §2A.4 可访问性段 · Coder REJECT #7)" 前提.

**grep verify**: L40 TC-5 Given 列字面命中 "MP 基础库 ≥ 2.10.4 · 渲染层 Skyline (worklet 模式)". 锚 spec §2A.4 可访问性段 + Coder REJECT #7 编号双重 trace.

**审复结论**: ✓ 真改 · 顺便 Tester REJECT #2 联动改: aria-label 整段删 · 改 `<text class="sr-only">` visually-hidden + 自定义 `data-a11y-delta-direction` attr (我 Round 1 #7 关注的是基础库版本 · 但 Tester 揪出更深的"MP 根本不支持 web aria-label" 平台缺陷 · Round 2 双方合一修 · 这是 Tester 视角加分 · 不冲突).

### #8 [TC-2] · P05 路由目标页存在性未验

**Round 2 修法**: TC-2 Given 字面加 "前置依赖 P05 page 存在 (`frontend/apps/mp/pages/wrongbook-list/index.{ts,wxml}` 已落 · ls 验)" + Then (c) 把 spec drift 显式 surface "wx.navigateTo (非 wx.switchTab · 因 INV-5 URL 必含 kpId · 而 switchTab 不支持 query · 与 app.json tabBar.list 中 `pages/wrongbook-list/index` 重合的 spec drift 由 Coder Phase 3 实施时 surface 给 TL)".

**grep verify**: L37 TC-2 Given 字面命中 P05 page 存在前置. L37 Then (c) 字面 "spec drift 由 Coder Phase 3 实施时 surface 给 TL". L15 trace 段额外补充: "P05 路由 ... 在 app.json tabBar.list · wx.switchTab 不支持 query string · 与 INV-5 矛盾 → TC-2 拍板用 wx.navigateTo".

**审复结论**: ✓ 真改 · 而且**比我 Round 1 #8 要求的更深一步**: TestDesigner 不只是验存在 · 还主动 grep 出 app.json L39 P05 在 tabBar.list 的实际 spec drift · 明确给 Coder Phase 3 留 surface 责任. 这是 Round 2 加分项 · 不是回退.

## 选改吸收审视 (#9 #10)

### #9 [AC7 weekly_weak_kp_view 埋点无覆盖] · 选改

**Round 2 修法**: TC-1 Then (i) 字面加 "filter `e.name === 'weekly_weak_kp_view'` length === 3 (3 个 KP 卡 IntersectionObserver 触发 · 锚 AC7 全集 · Coder REJECT 选改 #9)" · 1 行 Then 增补 · 不挤 TC 数量.

**grep verify**: L36 TC-1 Then (i) 字面命中 `weekly_weak_kp_view` + length === 3 + IntersectionObserver 触发. Changelog L92 第 9 条字面 "吸收".

**审复结论**: ✓ 吸收清晰 · 我 Round 1 给的两个备选 (TC-1 增补 OR Coder unit test 单独验) 中选了 TC-1 增补 · 这是更高强度的方案 · Phase 4 自动化覆盖 · 不依赖 Coder unit test 自觉.

### #10 [TC-5 A11Y colorblind 主观] · 选改

**Round 2 修法**: TC-5 Then (f) 字面 "删除 'colorblind 用户能独立判断' 主观断言 (无 colorblind simulator API · 不可机器验证 · Tester REJECT 选做 #2) · 仅留 (b)+(c)+(d)+(e) 4 条机器可断言命题".

**grep verify**: L40 TC-5 Then (f) 字面命中删除主观断言. 4 条机器可断言命题: (b) 字符 `↓` · (c) 数字 "-3" · (d) `data-a11y-delta-direction == "down"` attr · (e) `.sr-only` text node 字面 "较上周下跌 3 个百分点" · 全部可执行.

**审复结论**: ✓ 吸收 · 而且**比我 Round 1 #10 提的 3 条机器可断言更强**: 增到 4 条 (多 1 条 sr-only 文本节点 · 防 Coder 仅靠 icon 字符不给屏幕阅读器文案 · 锚 WCAG AA 4 重防御).

## 新问题扫描

### token budget 6 行: ✓

**grep verify**: Gherkin 表 6 行 (`grep -cE '^\| [0-9] \|' = 6`) · 守 token budget 上限 · 没扩到 7 (TestDesigner 主动决定 TI1 由 Coder unit test 单独验 · 不挤 TC).

### 是否破坏 Round 1 已 APPROVE 的某条: 无

我 Round 1 review 中 "✓ 大致可实现" 的条目 (TC-1 时序 / TC-2 路由 / TC-3 文案 / TC-4 状态切 / TC-5 ↓ 字符 / TC-6 (b) sparkline) 在 Round 2 全部保留或加强:
- TC-1 时序 (淡入 0/100/200/300/400/500ms) 改归 TI4 VRT (Tester 选做 #1) · 不在 timer assert · 这是**软化**不是**回退** (我 Round 1 默认接受 · 现 Tester 揪出 automator 无 fps timeline API · 改 VRT 是更可执行的修法 · 不破坏 spec §6 字面)
- TC-3 文案 i18n key 标注 "MP 端 i18n 未接 · Coder Phase 3 hardcode 字面文本" (L38 (b)) · 这是工程现实补丁 · 不破坏 AC4 字面
- TC-6 (b) sparkline 从 svg path d 改 `page.data().homeWeekSummary.sparkline[1] === null AND [3] === null AND [5] === null` 数据模型断言 (Tester REJECT #4) · 这是**升级**不是**回退** (因 MP 无原生 svg 标签 · 原 svg path d 在 MP 不可执行 · 改 page.data 更准抓 anti_pattern: Coder 错把 null forward-fill 上一个值)

### 残留 spec drift (TestDesigner Round 2 self-checkpoint 主动 surface 3 个)

TestDesigner Round 2 在 trace 段 (L11-L19) + Changelog Round 2 Token budget 取舍段主动暴露 3 个 spec drift · 我视为 surface 而非阻塞:

1. **TC-2 P05 路由 vs tabBar.list 矛盾** (spec §7 navigateTo · 但 app.json tabBar.list 含 P05 → switchTab 不支持 query → 与 INV-5 矛盾) · TestDesigner 拍板 wx.navigateTo (尊重 spec §7 + INV-5 字面) · 让 Coder Phase 3 surface 给 TL. **我接受**: 这不是用例缺陷 · 是上层 spec 与代码 drift · TL/PM 层决定 (修 spec 还是改 app.json tabBar 去掉 P05). TestDesigner 没替 Coder/TL 拍板修法 · 守了 Phase 2 review 边界.

2. **TC-5 spec §3 DeltaChip props 缺 srText: string** (TC-5 Then (h) 字面 "spec §3 DeltaChip props 必须新增 `srText: string` prop · 这是 spec drift surface 给 TestDesigner Round 2 后续 P3 propagation · 不阻塞本 task"). **我接受**: 这是 spec 不全 · 不是用例缺陷. TestDesigner 给 Coder Phase 3 留 i18n prop 接口 · 不阻塞本 task 落地.

3. **TC-6 P-HOME wxml 字段名错位** (Coder Phase 3 Step 0 必做重写 .bento 区段 · 见 #2 修法). **我接受**: 这是真存在的 spec drift (spec §5.2 vs 现状 wxml 字段名错位) · TestDesigner 把"重写绑定"显式列为 TC-6 Given 前置 · 让 Coder 在 Step 0 就处理 · 不阻塞.

**结论**: 3 个 spec drift 均是真实存在的上层问题 · TestDesigner 主动暴露 (而不是 silent fork 用例去 patch) · 守了 Rule 12 Fail loud. **不要求 Round 3 修** · 这些应在 Coder Phase 3 / TL 决策层处理 · 不该挤进 test-cases.md.

### 加分项

Round 2 不只是修我 Round 1 提的 · 还顺便:
- 把 Tester 10 必修 + 3 选做 全部吸收 (testid attribute 拍板 `data-test-id` / aria-label → sr-only / telemetryBuffer → __getBuffer / svg → page.data / View ≥ 重算 / TI1+TI4+TI6 补 / TC-3 mock 策略 / TC-2 query API / Framework Mapping 表 / switchTab vs navigateTo)
- 加 Framework Mapping 表 (L46-L52) · 给 Phase 4 Tester 直接 copy
- 加 common preamble (L54) · 统一 `__resetBuffer()` beforeEach
- 加反作弊审视段 (L130-L136) · 列出反例形式给 Phase 4 防 Coder 偷懒

User Approval section 未预填 · 符合 Phase 2.5 红线 (锚 test-designer-agent.md 铁律 8). Round 1 / Round 2 Changelog 双段并存 · 无 overwrite (锚 coder-agent.md Phase 2 多 Round 循环 APPEND 铁律).

## Round 2 Verdict

**verdict: APPROVE**

**理由**: Round 1 提的 8 必修 + 2 选改 **逐条 grep verify 命中** · 没有一条 silent revert 或改错. 4 致命项 (#1 #2 #3 #4) 修法精准 · 4 重要项 (#5 #6 #7 #8) 字面采纳我 Round 1 提的方案 · 2 选改 (#9 #10) 比我建议的更高强度吸收. Round 2 还顺带吸收了 Tester 10 必修 + 3 选做 · 双方 review 合一修. 残留 3 个 spec drift 是真实上层问题 · TestDesigner 主动 surface 而非 silent fork · 不阻塞本 task · 应在 TL/Coder Phase 3 层处理. Token budget 守住 6 用例上限. 无破坏前轮 APPROVE 假设的回退.

**给 TL 一句话**: TestDesigner Round 2 修齐 Coder 8 必修 + Tester 10 必修 (18 项全过) · 6 用例 Then 列全 deterministic + 全 MP 平台可执行 · 我 APPROVE 进 Phase 2.5 用户签字门. 3 个上层 spec drift (P05 tabBar/INV-5 矛盾 · DeltaChip srText prop 缺 · P-HOME wxml 字段名错位) 应在用户 APPROVE 后由 Coder Phase 3 实施时 surface 给 TL · 不在用例层修.

**self-checkpoint**: tool use ≈ 8 次 (Round 2 only) · 估 token < 30K · 未触 Rule 6 软线. verdict=APPROVE · 必修项 10 条全 grep verify 命中 · 无 silent revert · 加分项 4 处 (Framework Mapping / common preamble / 反作弊审视段 / Tester 联动修). 一句话给 TL: Coder Round 2 APPROVE · 等 Tester Round 2 review · 双方 APPROVE 后 TestDesigner append User Approval section 等用户签字.
