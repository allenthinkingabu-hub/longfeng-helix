# Skill: gen-mockup

> **用途**：把一个页面 (master §2A.4 卡 或 satellite §2A.4 卡) → `design/mockups/wrongbook/${NN}_${slug}.html` (独立可开 HTML mockup · 风格基准对齐已有 mockup 设计语言 · ≥14 testid · 0 个 `href="#"` 占位 · 同步 patch biz doc 移除「待补 mockup」标记)
> **触发**：用户说「为 P-XXX 画 mockup」/「设计 ${PAGE_ID} 的 HTML 稿」/「按 01_home_v2.html 风格生成 mockup」/「补 mockup HTML」
> **owner**：user · 首版于 2026-05-16 与 P-WEEKLY-REVIEW spec 同次会话产出
> **配套**：上游 [gen-biz-doc.md](gen-biz-doc.md) (satellite biz · 含页面卡) · 平级或下游 [gen-page-spec.md](gen-page-spec.md) (spec.md §13 testid 表反向抽自本 mockup) · 下游 [gen-feature-list.md](gen-feature-list.md) (task AC 引用本 mockup 视觉锚)

---

## 0 · 调用参数

| 参数 | 必填 | 示例 | 默认 |
|---|---|---|---|
| `PAGE_ID` | ✓ | `P-WEEKLY-REVIEW` / `P14` / `P-LANDING` | — |
| `SLUG` | ✓ | `weekly-review` / `parent-bind` / `landing` | kebab-case · 必须与 PAGE_ID 语义一致 |
| `BIZ_DOC` | — | `biz/features/P-WEEKLY-REVIEW__weekly-review.md` (satellite) 或 `biz/业务与技术解决方案_AI错题本_基于日历系统.md` (master) | 默认 master · 若 PAGE_ID 在 master §2A.3 不存在 → 自动 fallback 到对应 satellite (`grep -rn "${PAGE_ID}" biz/features/`) |
| `STYLE_BASELINE` | — | `design/mockups/wrongbook/01_home_v2.html` | 默认 `01_home_v2.html` (登录态主页风格) · 匿名态 mockup 改 `14_landing.html` (P1+) · capture 类改 `02_capture.html` |
| `NN` | — | `14` / `15` / `16` | 自动 = `ls design/mockups/wrongbook/*.html \| wc -l + 1` · 与 master §2A.3 IA 路由表「源 HTML 稿」列编号一致 |
| `OUTPUT_PATH` | — | `design/mockups/wrongbook/14_weekly_review.html` | `design/mockups/wrongbook/${NN}_${SLUG}.html` |
| `FORCE` | — | `--force` 覆盖已存在文件 | 不传则先 Read + 询问 |

---

## 1 · 方法论（6 步 · 严格按序 · Step 1+3 可并发 spawn sub-agent）

### Step 1 · 深扫风格基准 (STYLE_BASELINE)

Read 整份 `STYLE_BASELINE` HTML · 完整抽取：
- **CSS 变量** (`:root { --bg / --ink / --indigo / --peach / --mint / ... }` 全部 · 含十六进制值)
- **字体栈** (主栈 + 衬线 display 栈)
- **字号梯度** (9 / 10 / 11 / 12 / 13 / 14 / 15 / 17 / 20 / 22 / 26 / 28 / 32 / 48 / 56 / 84px 几档)
- **圆角体系** (4 / 11 / 14 / 18 / 20 / 999 / 50%)
- **阴影体系** (内嵌 · 卡片 · 微阴 三档)
- **渐变语言** (radial ambient wash + linear gradient + SVG 渐变 fill)
- **容器结构** (`.phone` 393×852 + statusbar 54px + topbar + scroll + tabbar 84px)
- **重复组件 class 名清单** (`.hero` / `.bento` / `.tile` / `.weekcard` / `.insight` / `.msgs` / `.quicks` / `.sec` / `.tabbar` 等 · 必须照抄不改名)
- **SVG 图形语言** (描边宽度 1.3 / 1.4 / 1.6 / 1.8 · stroke-linecap:round)
- **micro-interaction 暗示** (cursor:pointer / backdrop-filter / pointer-events 等)

**输出**：风格基准摘要表 (≤ 50 行) · 后续 Step 4 draft HTML 时所有 class 名 / CSS 变量 / 字号必须从这张表里挑选。

### Step 2 · 锚定 biz 页面卡

`grep -n "#### ${PAGE_ID} ·" $BIZ_DOC` 找到该页规格卡。Read 完整卡 (15 维度 · 含布局分区 / 核心组件 / 状态集 / 跳转 / 异常态 / 性能预算 / 优先级)。

提取「布局分区」字段 → 拆成 N 个独立的 zone (典型 6-9 zone)：
- zone 1: topbar (返回 + 标题 + 操作)
- zone 2-N: 业务内容分区
- zone N+1: tabbar (底部 5 tab)

**输出**：zones 表 · N 行 · 每行: zone 名称 / 来自 biz 哪行 / 主要 UI 元素 / 内嵌 testid 候选名。

### Step 3 · 并发跨 mockup 复用扫描 (spawn 1-3 Explore agents)

派 Explore agent 扫描 `design/mockups/wrongbook/` 下**已有** mockup · 找可复用组件：
- 雷达图 / 折线图 / 进度环 → 看 06 / 07 / 09 哪个有
- KP 卡 / question 卡 / item 卡 → 看 05 / 06 / 07 / 09 哪个有
- 横滑 scroller / 网格 grid → 看哪个 mockup 有
- AI 气泡 / insight 卡 → 看 01_home_v2 / 04 / 09 哪个有
- delta / stat trio → 看 01_home / 09 哪个有

**输出**：复用对标表 · 每行: 我要的组件 / 哪份 mockup 有近似 / selector / 复用建议 (照抄 / 微改 / 新创) / 截取代码片段路径。

### Step 4 · 草拟 HTML 骨架

按 Step 1 风格 + Step 2 zones + Step 3 复用对标 · 草拟 mockup HTML：

**强制骨架**：
```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
  <title>${PAGE_ID} · ${中文页面名}</title>
  <style>
    /* 必须含 ≥ 10 个 CSS 变量 · 复用 STYLE_BASELINE 的 :root */
    :root { --bg:#F6F3EC; --ink:#0E0E10; /* ... */ }
    /* 必须含 phone shell + statusbar + ambient + scroll + tabbar */
    .phone { width:393px; height:852px; ... }
  </style>
</head>
<body>
  <div class="phone" data-testid="p-${LOWERCASE_FEATURE}-root">

    <!-- ambient wash · 必装 -->
    <div class="ambient" aria-hidden="true">...</div>

    <!-- statusbar 54px · 必装 -->
    <div class="statusbar">9:41 · 信号 / WiFi / 电池</div>

    <!-- topbar · 必装 (3 列: back + title + share/action) -->
    <div class="topbar">
      <a class="back" href="${上游 mockup}" data-testid="${PREFIX}-back">←</a>
      <div class="titlecol">
        <div class="t">${中文标题}</div>
        <div class="s" data-testid="${PREFIX}-subtitle">${副标题}</div>
      </div>
      <div class="action">…</div>
    </div>

    <!-- scroll · 主内容 -->
    <div class="scroll">
      <!-- zone 1: HERO 暗卡 (.hero) -->
      <div class="hero" data-testid="${PREFIX}-hero">...</div>

      <!-- zone 2-N: sec 标题 + 内容卡 -->
      <div class="sec"><div class="t">section 标题 <em>English</em></div><a class="m" href="...">查看 ›</a></div>
      <div class="...">...</div>

      <!-- EMPTY hero 变体 (默认隐藏 · 数据为空时显示) -->
      <div class="empty-hero" data-testid="${PREFIX}-empty">…</div>
    </div>

    <!-- tabbar · 必装 (5 tab · 标 active=该页所属 tab) -->
    <nav class="tabbar">…</nav>
  </div>
</body>
</html>
```

**testid 命名约定** (与 frontend/packages/testids/src/index.ts 命名空间一致):
- 页面根: `p-${LOWERCASE_FEATURE_ID}-root` (e.g. `p-weekly-review-root`)
- 子组件: `${PREFIX}-${component}` (e.g. `weekly-hero` / `weekly-back` / `weekly-radar` / `weekly-weak-kp-1`)
- 同类多实例: `${PREFIX}-${component}-${index}` (e.g. `weekly-weak-kp-1/2/3`)
- ≥ 14 个 testid (root + 主要交互元素 + 主要数据可视化区域)

**href 命名约定** (跳转锚必须真实可点击):
- 上游 mockup: `01_home_v2.html` (P-HOME) · 不允许 `href="#"`
- 下游 mockup: `05_wrongbook_list.html?kpId=KP-XXX` (带 query) · 不允许 `href="javascript:void(0)"`
- 当前页内 anchor: `#section-id` 允许 · 但建议改 scroll-into-view JS (本 mockup 阶段不用 JS)
- 暂时未实装的下游: 写 `href="${NN}_${slug}.html"` 即使该文件还不存在 (后续生成时占位有效)

### Step 5 · 强制 AskUserQuestion 闸 (落盘前)

把以下 3 张表 surface 给用户：
1. **zones 大纲** (N 个 zone · 每行: zone 名 / 主元素 / testid)
2. **testid 全清单** (≥ 14 · 与 frontend/packages/testids 命名约定一致)
3. **href 跳转表** (所有跳转 anchor · 每行: 触发元素 / 目标 mockup / query 参数)

调 `AskUserQuestion` 询问至少这 3 件事：
- "zones 顺序对吗 / 漏了什么模块?"
- "testid 命名是否符合 frontend/packages/testids 已有约定?"
- "跳转 href 都指向真 mockup 吗 (或带占位 query)?"

**用户 OK 后才进 Step 6 落盘**。

### Step 6 · 落盘 mockup + 同步 patch biz doc

`Write ${OUTPUT_PATH}` 落地 HTML (一次性 · 不分文件)。

落盘成功后**立即**：
- **patch biz doc** ：用 `Edit` 把 `${BIZ_DOC}` 里所有 `${NN}_${slug}.html (待补 mockup)` 字面替换成 `${NN}_${slug}.html` (双向治理 · 防 mockup 孤立)
- **不** patch master §15 (本 skill 是 design/ 域 · 不写 biz · 不写 spec)

**输出**：mockup 路径 + biz patch 行数 + 触发下游 skill 命令 (gen-page-spec / gen-feature-list)。

---

## 2 · mockup HTML 模板骨架 (完整可复制 · 严格遵守 baseline class 名)

### 2.1 标准 <head> 块

```html
<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<title>${PAGE_ID} · ${中文页面名}</title>
<style>
  /* CSS 变量 · 必须从 STYLE_BASELINE :root 全量复制 · 不允许自创 */
  :root{
    --bg:#F6F3EC; --bg-2:#EFEAE0;
    --card:#FFFFFF;
    --ink:#0E0E10; --ink-2:#4A4A52; --ink-3:#8A8A94;
    --line:rgba(14,14,16,.08); --line-2:rgba(14,14,16,.14);
    --indigo:#3730A3; --indigo-2:#6366F1; --indigo-soft:#EEF0FF;
    --peach:#F97316; --peach-soft:#FFECD6;
    --rose:#E11D48; --rose-soft:#FFE1E7;
    --mint:#059669; --mint-soft:#D9F5E7;
    --amber:#D97706;
    --serif:"New York","Canela","Noto Serif SC",Georgia,serif;
  }
  *{box-sizing:border-box;margin:0;padding:0;-webkit-font-smoothing:antialiased;}
  html,body{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang SC",sans-serif;color:var(--ink);background:#2A2A30;}
  body{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;}

  /* phone shell · 393×852 iPhone 14 Pro · 必装尺寸 不允许自创 */
  .phone{position:relative;width:393px;height:852px;border-radius:54px;background:var(--bg);overflow:hidden;box-shadow:inset 0 0 0 6px #111, 0 24px 64px rgba(0,0,0,.22);}
  .phone::before{content:"";position:absolute;left:50%;top:11px;transform:translateX(-50%);width:126px;height:37px;background:#000;border-radius:24px;z-index:30;}
  .phone::after{content:"";position:absolute;left:50%;bottom:8px;transform:translateX(-50%);width:134px;height:5px;background:#000;border-radius:3px;opacity:.85;z-index:30;}

  .statusbar{position:absolute;top:0;left:0;right:0;height:54px;display:flex;align-items:flex-end;justify-content:space-between;padding:0 24px 6px;font-size:17px;font-weight:600;letter-spacing:.2px;}

  .ambient{position:absolute;inset:0;pointer-events:none;z-index:0;overflow:hidden;}
  .ambient .sphere{position:absolute;border-radius:50%;filter:blur(10px);}

  .topbar{position:absolute;top:58px;left:20px;right:20px;display:flex;align-items:center;gap:12px;z-index:10;}

  .scroll{position:absolute;top:120px;bottom:84px;left:0;right:0;overflow-y:auto;padding:8px 16px 30px;z-index:5;}
  .scroll::-webkit-scrollbar{display:none;}

  .sec{display:flex;align-items:center;justify-content:space-between;margin:22px 4px 10px;}
  .sec .t{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--ink-3);display:flex;align-items:center;gap:8px;}
  .sec .t em{font-family:var(--serif);font-style:italic;font-size:15px;color:var(--ink);text-transform:none;letter-spacing:0;font-weight:400;}
  .sec .m{font-size:12px;color:var(--indigo);text-decoration:none;font-weight:600;}

  /* 暗 Hero 卡 · 模板范本 (必装 · 除非该页不需要数字概览) */
  .hero{position:relative;background:#0E0E10;color:#fff;border-radius:20px;padding:20px;overflow:hidden;box-shadow:0 20px 40px -20px rgba(14,14,16,.45);}
  .hero::before{content:"";position:absolute;width:240px;height:240px;border-radius:50%;background:radial-gradient(circle,rgba(217,222,255,.18) 0%,transparent 65%);left:-50px;top:-80px;filter:blur(20px);}
  .hero::after{content:"";position:absolute;width:200px;height:200px;border-radius:50%;background:radial-gradient(circle,rgba(255,214,181,.16) 0%,transparent 65%);right:-40px;bottom:-60px;filter:blur(20px);}

  /* tabbar · 必装 */
  .tabbar{position:absolute;left:0;right:0;bottom:0;height:84px;backdrop-filter:blur(22px) saturate(180%);background:rgba(255,255,255,.78);border-top:1px solid var(--line);display:grid;grid-template-columns:repeat(5,1fr);padding:8px 0 30px;z-index:20;}
  .tab{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:4px;font-size:10px;color:var(--ink-3);font-weight:600;text-decoration:none;position:relative;}
  .tab.active{color:var(--ink);}

  /* —— 以下是页面专属样式 · 按 zones 一一定义 —— */
  /* ... */
</style>
</head>
```

### 2.2 标准 <body> 骨架

```html
<body>
<div class="phone" data-testid="p-${LOWERCASE_FEATURE_ID}-root">

  <!-- ambient wash (复用 STYLE_BASELINE 同款渐变颜色) -->
  <div class="ambient" aria-hidden="true">
    <div class="sphere s1"></div>
    <div class="sphere s2"></div>
  </div>

  <!-- statusbar (复用 STYLE_BASELINE 同款 9:41 + signal icons) -->
  <div class="statusbar">
    <span>9:41</span>
    <span class="ic">…signal/wifi/battery SVG…</span>
  </div>

  <!-- topbar (返回 + 标题 + 副标题 + action) -->
  <div class="topbar">
    <a class="back" href="${上游 mockup}" data-testid="${PREFIX}-back" aria-label="返回">
      <svg>...</svg>
    </a>
    <div class="titlecol">
      <div class="t">${中文标题}</div>
      <div class="s" data-testid="${PREFIX}-subtitle">${副标题/周次/状态}</div>
    </div>
    <div class="${action_class}">…action SVG…</div>
  </div>

  <!-- ============== SCROLL · 业务内容 zones ============== -->
  <div class="scroll">

    <!-- zone 1: HERO 暗卡 (数字概览 · 大字 + delta + sparkline) -->
    <div class="hero" data-testid="${PREFIX}-hero">
      …kicker / display / sub / sparkline…
    </div>

    <!-- zone 2..N: sec 标题 + 内容卡 -->
    <div class="sec">
      <div class="t">${中文标题} <em>${English}</em></div>
      <a class="m" href="${跳转目标}">${右链文案} ›</a>
    </div>
    <div class="${section_card_class}" data-testid="${PREFIX}-${section_name}">
      …内容…
    </div>

    <!-- EMPTY hero 变体 (默认隐藏 · 数据为空时整页换) -->
    <div class="empty-hero" id="empty-hero" data-testid="${PREFIX}-empty">
      …空态文案 + CTA…
    </div>

  </div>

  <!-- ============== TabBar (5 tab · 标 active=该页所属 tab) ============== -->
  <nav class="tabbar">
    <a class="tab ${active_if_home}" href="01_home_v2.html">…首页…</a>
    <a class="tab ${active_if_wb}" href="05_wrongbook_list.html">…错题本…</a>
    <a class="tab ${active_if_capture}" href="02_capture.html">…拍题…</a>
    <a class="tab ${active_if_calendar}" href="10_calendar_month.html">…日历…</a>
    <a class="tab ${active_if_me}" href="13_settings.html">…我的…</a>
  </nav>
</div>
</body>
</html>
```

---

## 3 · 反作弊红线 (CLAUDE.md Rule 1/3/9/11/12 项目化)

1. **禁 fabricate CSS 变量**：`:root {}` 里的所有 `--xxx` 必须能在 STYLE_BASELINE 的 `:root` 找到字符级匹配。新加变量 → 阻断落盘 + 先 surface 给用户确认是否扩 baseline。
2. **禁 break style baseline class 名**：`.phone` / `.hero` / `.bento` / `.tile` / `.weekcard` / `.insight` / `.msgs` / `.quicks` / `.sec` / `.tabbar` / `.tab` 必须照抄。要新 class 用 `.<feature_prefix>-xxx` 命名空间避免冲突 (例 `.wkp` for weak KP 卡)。
3. **禁 invent phone 尺寸**：必须 `width:393px; height:852px; border-radius:54px;` (iPhone 14 Pro · 与所有现有 mockup 一致)。非标尺寸 → 阻断。
4. **强制 ≥ 14 testid**：`data-testid="..."` 数量 ≥ 14 (含 1 个 root + 主要交互元素 + 主要可视化区域)。`grep -c 'data-testid="' ${OUTPUT_PATH}` < 14 → 阻断。
5. **强制 testid 命名空间**：所有 testid 以 `${PREFIX}-` 开头 (PREFIX = SLUG 去 kebab · e.g. `weekly-`)；唯一例外是页面根用 `p-${PREFIX}-root`。命名违反 → 阻断。
6. **禁 href="#" / href="javascript:..." 占位**：所有 `<a href="...">` 必须指向 existing mockup (或带 query 参数的 existing mockup)。`grep 'href="#"' ${OUTPUT_PATH}` > 0 → 阻断。
7. **强制 mockup 独立可开**：不允许引用外部 CSS / JS / 字体 (除 Google Fonts 直接 import 显式声明)。浏览器直接打开必须能完整渲染所有视觉。
8. **强制双向治理 (patch biz)**：落盘 mockup 后必须 `Edit ${BIZ_DOC}` 把 `${NN}_${SLUG}.html (待补 mockup)` 字面全部替换成 `${NN}_${SLUG}.html` (`grep -c "待补 mockup" ${BIZ_DOC}` 必须 = 0 · 否则阻断 + 回滚 mockup 文件)。
9. **强制顺序对齐 master §2A.3 IA 路由表**：mockup 编号 NN 必须与 master §2A.3 路由表「源 HTML 稿」列一致。如 master 写 `14_weekly_review.html` → 必须用 14 · 不允许用 15/16。
10. **禁 emoji 滥用**：mockup 文案不允许 emoji 装饰 (除用户明示场景需要 · e.g. P-LANDING 营销页)。用 SVG icon 代替。

---

## 4 · 与其他工具的边界

- 本 skill **只产 HTML mockup**。不产 spec.md (那是 [gen-page-spec.md](gen-page-spec.md) 下游)、不产 feature_list (那是 [gen-feature-list.md](gen-feature-list.md) 下游)、不产 React 组件 / Vue 组件 (那是 Coder agent 的实装)。
- 本 skill **是 gen-page-spec.md 的视觉真相源**：spec.md §13 testid 表 / §2 视觉锚表 / §3 核心组件 全部反向抽自本 skill 产物。两者必须 testid 字面一致 · gen-page-spec 跑时若发现 mockup 的 testid 与 spec.md 不符 → 信 mockup (mockup 是 ground truth)。
- 本 skill **是 gen-biz-doc.md 的下游**：satellite biz doc §2A.4 卡的「源 HTML 稿」字段若写 `(待补 mockup)` · 本 skill 跑完必须 patch 掉。两者必须文件路径字面一致。
- 本 skill **不写 Figma / Sketch / 视频原型**。本 skill 只产 HTML (browser-renderable static mockup)。高保真设计稿是另一个工具 (设计师的事)。
- 与 master biz §2A.3 IA 路由表的关系：本 skill 不修改路由表 · 只复用其编号 (NN 与「源 HTML 稿」列一致)。如果 master 路由表里 PAGE_ID 不存在 → 必须 fallback 到 satellite biz doc 的 §2A.3.1 新路由行 · 取其编号。

---

## 5 · 用法示例 (P-WEEKLY-REVIEW 走 6 步)

```
用户: 为 P-WEEKLY-REVIEW 画 mockup
```

执行步骤：

1. **Step 1 风格基准**: Read `design/mockups/wrongbook/01_home_v2.html` (默认 baseline) · 抽 14 CSS 变量 / phone shell 尺寸 / 9 个重复 class 名 / 13 个内联 SVG 模式 / 字号梯度
2. **Step 2 锚定**: `grep -n "#### P-WEEKLY-REVIEW ·" biz/features/P-WEEKLY-REVIEW__weekly-review.md` → 锁定 §2A.4 卡 · Read 完整 15 行表 · 拆出 7 zones (topbar / hero / radar / weakKP / stat3 / failedScroller / aiInsight)
3. **Step 3 并发**: spawn agent 扫描 06/07/09 · 找到雷达图 (06.html L209-234 直接照抄) + 三联 stat (09.html L89-96 直接照抄) + 横滑卡 (07.html L67-88 微改) + AI 气泡 (无参照 · 新创但用 .insight 风格)
4. **Step 4 draft**: 草拟 462 行 HTML · 含 14 testid (p-weekly-review-root / weekly-back / weekly-range / weekly-hero / weekly-delta / weekly-sparkline / weekly-radar / weekly-weak-kp-1/2/3 / weekly-stats-trio / weekly-failed-scroller / weekly-ai-insight / weekly-empty) · 14 href 真路径 (01_home_v2.html / 05_wrongbook_list.html?kpId=KP-XXX / 06_wrongbook_detail.html?qid=Q-XXXX / 02_capture.html / 10_calendar_month.html / 13_settings.html)
5. **Step 5 AskUserQuestion**: surface zones 大纲 + 14 testid 表 + 14 href 跳转表 · 用户 OK
6. **Step 6 落盘 + patch**:
   - `Write design/mockups/wrongbook/14_weekly_review.html` (462 行)
   - `Edit biz/features/P-WEEKLY-REVIEW__weekly-review.md` 把 4 处 `14_weekly_review.html (待补 mockup)` 替换成 `14_weekly_review.html`
7. **报告**: mockup 路径 + biz patch 4 处 + 下游命令 (`为 P-WEEKLY-REVIEW 写 spec.md`)

---

## 6 · Skill 自检 checklist (落盘前必跑)

- [ ] 文件可在浏览器直接打开 (`<!doctype html>` + `<meta viewport>` 齐 · 无外链 CSS/JS)
- [ ] `grep -c 'data-testid="' ${OUTPUT_PATH}` ≥ 14
- [ ] `grep -E 'data-testid="(?!p-${PREFIX}|${PREFIX}-)' ${OUTPUT_PATH}` = 0 (所有 testid 在命名空间内)
- [ ] `grep -c 'href="#"' ${OUTPUT_PATH}` = 0 (无占位 anchor)
- [ ] `grep -c 'href="javascript:' ${OUTPUT_PATH}` = 0
- [ ] `.phone` 尺寸 = `width:393px; height:852px; border-radius:54px;`
- [ ] CSS 变量 `:root {}` 全部能在 STYLE_BASELINE 找到字符级匹配 (`diff <(grep -oE -- '--[a-z-]+' STYLE_BASELINE) <(grep -oE -- '--[a-z-]+' ${OUTPUT_PATH}) | grep '^>'` 为空)
- [ ] statusbar + topbar + scroll + tabbar 四件套齐
- [ ] tabbar 5 个 tab 各自 href 指向真 mockup (01_home_v2.html / 05_wrongbook_list.html / 02_capture.html / 10_calendar_month.html / 13_settings.html)
- [ ] tabbar 有且仅有 1 个 `.tab.active` (语义对齐该页所属 tab)
- [ ] 至少 1 个 `.sec` section header (中英双标题 + 右链)
- [ ] EMPTY hero 变体存在 (`grep -c "empty-hero" ${OUTPUT_PATH}` ≥ 1 · 即便默认 display:none)
- [ ] satellite/master biz `(待补 mockup)` 字面已移除 (`grep -c "${NN}_${SLUG}.html (待补 mockup)" ${BIZ_DOC}` = 0)
- [ ] 行数 ∈ [300, 800] (太小 = 内容太薄 · 太大 = 该拆 sub-component)
- [ ] markdown 合法 (无悬挂代码块) · HTML 合法 (无未闭合 tag)

打钩全过 → 报告 mockup 路径 + biz patch 数 + 14 testid 全清单 + 下游 skill 命令 (用户复制即跑)。

---

**修订表**

| 版本 | 日期 | owner | 摘要 |
|---|---|---|---|
| v1 | 2026-05-16 | user (gen-mockup 首次实战) | 首版 · 与 gen-page-spec satellite 支持同次会话产出 · 14_weekly_review.html 首次实战 (462 行 · 14 testid · 14 href 真路径 · 0 占位 · 同步 patch satellite biz doc 4 处) · 三件套补全 (gen-biz-doc → gen-mockup → gen-page-spec → gen-feature-list 四件套上下游闭环) |
