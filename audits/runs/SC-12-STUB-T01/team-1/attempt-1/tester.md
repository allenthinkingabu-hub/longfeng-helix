# SC-12-STUB-T01 Tester · attempt-1 (TL agent 双角色 · 流水线收官)

## DoR 准入检查 (test-agent.md DoR 1-4)

| # | DoR 项 | 状态 | 证据 |
| --- | --- | --- | --- |
| DoR-1 | E2E 脚本本体存在 | ✓ | `frontend/apps/h5/tests/e2e/sc-12-stub/t01-guest-capture-stub.spec.ts` (4 case) + `t01-guest-capture-stub-adversarial.spec.ts` (4 case) · 真后端通过 route 监听计数 · 不拦截业务 wire shape |
| DoR-2 | 真跑 raw output 存在 | ✓ | `test-reports/junit-sc12-stub.xml` (`tests="8" failures="0" skipped="0" errors="0"`) + `test-reports/playwright-html/` 完整 HTML 报告归档 |
| DoR-3 | 真截图证据 ≥ 4 张 | ✓ | `test-reports/screenshots/` 4 张状态截图: 01-stub-rendered / 02-after-cta-navigated / 03-shell-nav-and-xss-safe / 04-logo-tap-welcome |
| DoR-4 | spec trace 对照表 | ✓ | `coder.md §3` 含逐行表格 · testid + API + 路由 + 状态 → testcase 覆盖映射 |

**DoR PASS · 进入正式测试流程**

## 1. 进场拦截

读 `.harness/inflight/SC-12-STUB-T01.json` · 内化 27 条 scope_in + 9 条 DoD + 触线红线 (audit-gate v3 · `/api/guest/* + /api/ai/* + /api/file/*` 全 0 calls)。

## 2. 全维度提取与跨页串联 (Journey)

| 维度 | 提取 |
| --- | --- |
| 跨端状态流转 (biz §2A.3.2) | 匿名访客 → /guest/capture stub → 「立即注册」 → /auth/login (SC-PHASE-A 接管) → 注册成功落 P-HOME (跨 task scope) |
| 跨端来源 (biz §2B.12 F07A) | P-LANDING DualCTA 「试试看」 (SC-11-T04) → /guest/capture (本 task target) → /auth/login |
| 路由跳转链 | /guest/capture mount → CTA → /auth/login · Logo → /welcome · 登录胶囊 → /auth/login |
| API 触点 (§5) | (无 · 本 stub 不调任何 /api/guest/\* + /api/ai/\* + /api/file/\*) · 仅 trackLanding 调 /api/landing/track (SC-11-T04 已 stub 落) |
| 状态机 | mount → IDLE → onClick → navigate (转换) · 无 loading / error / empty 三态 (stub 占位无业务流) |
| 异常降级 | N/A (无业务 API · 不 mockable) |
| testid 表 | guest-capture-stub-root / guest-capture-stub-cta / anon-shell-logo / anon-shell-login-pill |

## 3. 编写全链路统一验收脚本

实测脚本由 Coder 编 · Tester 复核:
- `t01-guest-capture-stub.spec.ts` (4 主 case) — 覆盖 mount + CTA + no-backend + deeplink
- `t01-guest-capture-stub-adversarial.spec.ts` (4 adversarial) — 超纲对抗: shell-top-nav + no-tabbar + XSS + a11y keyboard

**防作弊审查**:
- ✓ 无 后门 evaluate 改组件 state
- ✓ route spy 仅作累计计数 + 注入 404 (audit dim 5 允许 · 非 business 拦截)
- ✓ 无 maxDiffPixels 调高 (本 stub 不跑 VRT · 无 mockup baseline)
- ✓ 总计 spy 3 个 (TC(c) 三个 `/api/*` 计数) ≤ 5 红线
- ✓ E2E assertion 与生产代码无 silent-fork (testid 严格匹配 src 中真值)

## 4. 内部 DoD 自检死循环

| 拷问点 | 应答 |
| --- | --- |
| 查漏 (步骤 2 全维度) | mount + click + navigate + Logo nav + login pill + XSS + a11y · 已覆盖完整 stub 生命周期 ✓ |
| 防伪 (铁律 1 真人交互) | 全部用 `getByTestId().click()` + `keyboard.press('Enter')` 真人流 · 无 evaluate · 无 Mock 业务 ✓ |
| 破坏 (超纲对抗) | ADV(c) 注入 XSS payload `<script>alert(1)</script>` 到 entry_source · 验证 sanitize → 'unknown' · ADV(d) keyboard Enter 触发 CTA (a11y) ✓ |
| 保真 (VRT) | 本 task scope_out · stub 占位无 mockup · 但 4 张状态截图归档作物理证据 ✓ |
| 定罪 (报错日志) | 若任一 assertion fail · Playwright trace + screenshot + video 都会自动落盘到 `playwright-report/` (config 已配 `trace: 'on-first-retry'`) — 本轮全 PASS · 无需 |

## 5. 物理验证执行

**执行命令** (cwd: `frontend/apps/h5`):
```
pnpm exec playwright test tests/e2e/sc-12-stub/
```

**实际结果**: `8 passed (4.8s)` · 单进程 (workers=1) · 0 retry 0 failure.

**Regression 全量执行**:
```
pnpm exec playwright test
```
**结果**: `116 passed (8.8m)` · 既有 ~50 e2e 全保持绿灯 + 新增 sc-12-stub 8 case 全过 · 0 failure 0 skip.

**ide-console.txt 落盘验证** (audit dim_ide_smoke):
- 命令: 用 playwright-core 自起 chromium 跑完整生命周期 (mount + CTA + XSS + Logo nav) · 抓 console + pageerror
- 文件: `test-reports/ide-console.txt` 17 events
- `grep -c '\[error\]'` → **0** (零错误)
- 仅 `[debug] vite hmr` + `[info] React DevTools` + `[log] 业务埋点` + `[warning] React Router future flag`

**关键断言点 (audit-gate 红线)**:
- TC(c) `/api/guest/*` 累计 spy 计数: **0**
- TC(c) `/api/ai/*` 累计 spy 计数: **0**
- TC(c) `/api/file/*` 累计 spy 计数: **0**

## 6. 决策与宣判 · PASS

**8/8 主 + adversarial e2e 全绿** + **116/116 regression 全绿** + **ide-console.txt 0 [error]** + **核心 3 个 API 红线 0 calls** + **4 张状态截图** + **junit.xml 真证据** + **work_log 5 件齐**.

满足 CLAUDE.md PASS 定义 5 项 (Coder PASS 红线) + test-agent.md 6 步骤 + DoR 4 项 + audit-gate v3 7 dim.

**testcase 数验证** (audit.js v3 dim_test_validity claimed vs xml):
- claimed in tester.md: **8 testcase** (4 主 + 4 adversarial)
- junit.xml `<testsuites tests="8">`: **8**
- 一致 ✓

**spy 数验证** (audit dim_test_reasonable):
- 全部测试代码 grep 路由 spy: 3 次 (TC(c) 三个 API 计数) + ADV(c) 不拦截 · 0 次 ESM 单测桩 · 0 次 后端 IT 模拟器
- 总数 ≤ 5 ✓

**最终判定**: 改 `inflight.task.passes=true`.
