# Coder 工作日志 · SC01-T08 · P05→P-HOME 返回 + 今日复习大卡 +1 + 圆环动画

## 1. 地形侦察

- 读取 `coder-agent.md` 全文（铁律 1-5 + 补充 6/7 + 执行流程 7 步）
- 读取 `SHARED-E2E-PROTOCOL.md`（DoR C-1..C-6 + 三轴隔离）
- 读取 `P-HOME.spec.md`（§1-§15 · API 触点 GET /api/home/today + 状态机 4 态）
- 读取 `01_home_ios_refined.html` 全文（484 行 mockup）
- **标杆对齐**：以 P09 ReviewDone (`frontend/apps/h5/src/pages/ReviewDone/index.tsx` + `ReviewDone.module.css`) 为 reference template。已读取完整代码，确认模式：
  - CSS module + CSS custom properties
  - `useQuery` (react-query) + `TEST_IDS` (testids 包) + `track` (telemetry)
  - 状态机 useEffect
  - Inline tab bar
- 读取 `frontend/packages/api-contracts/src/clients/home.ts` (stub) + `types.ts` (HomeTodayResp)
- 读取 `frontend/packages/testids/src/index.ts`：确认 `TEST_IDS.pHome.*` 已定义 (L249-L270)
- 读取 `t12-exec-to-done.spec.ts` 作为 E2E 模板

## 2. 编码

### 2.1 P-HOME 页面组件 (build page)

- **`frontend/apps/h5/src/pages/Home/Home.module.css`** (~500 lines)
  - 1:1 mirror 01_home_ios_refined.html CSS
  - CSS custom properties for iOS palette + semantic tokens
  - 8 major sections: hero, greeting, reviewCard, weekly, weekcard, msgs, kpcard, quick, tabbar
  - Skeleton shimmer animation
  - Circle progress CSS transition (300ms ease-in-out · AC4)

- **`frontend/apps/h5/src/pages/Home/index.tsx`** (~430 lines)
  - 状态机: LOADING → READY | EMPTY | ERROR (per spec §6)
  - `useQuery` → `homeClient.getToday('Asia/Shanghai')` (react-query · staleTime: 0)
  - Counter animation: `requestAnimationFrame` easeInOut 300ms (AC3 · TI3)
  - Previous value stored in `sessionStorage('home_prev_total')` for N→N+1 detection
  - Circle progress via CSS `transition: stroke-dashoffset 300ms ease-in-out` (AC4)
  - All testids from `TEST_IDS.pHome.*` + `TEST_IDS.tabShell.*`
  - Telemetry: `track('home_view')` + `track('home_today_start_all')`
  - Phase 1+ fields hardcoded (streak, weekStats, subjects, messages, etc.)

### 2.2 路由 + 导航

- **`frontend/apps/h5/src/App.tsx`** 修改:
  - `<Route path="/" element={<HomePage />} />` 替换 HomeStub
  - `<Route path="/wrongbook" element={<WrongbookStub />} />` 新增
  - WrongbookStub 增加 inline tab bar with `tab-home` / `tab-wrongbook` testids

### 2.3 API 客户端

- **`frontend/packages/api-contracts/src/clients/home.ts`** 修改:
  - `getToday(tz?: string)` 支持 tz 参数 (TI1)

## 3. 真实 E2E

### 3.1 E2E 脚本

- **`frontend/apps/h5/tests/e2e/sc-01/t08-home-to-wrongbook.spec.ts`** (~300 lines)
- 5 个 test cases:
  1. AC1+AC2: P05 → Tab 1 → P-HOME 渲染 + GET /today + counter=8 + VRT
  2. AC3+AC4: counter 8→9 animation + circle progress update
  3. TI2: total=0 → empty hero
  4. spec §9: 500 → 黄条降级
  5. TI1: tz 参数验证

### 3.2 spec-trace 对照表

| testid | §5 API | §6 状态机 | assertion 行号 |
|---|---|---|---|
| p-home-root | — | mount | t08-home-to-wrongbook.spec.ts:121 |
| today-review-card | GET /api/home/today | LOADING→READY | t08-home-to-wrongbook.spec.ts:129 |
| today-review-card-total | GET /today .today.total | READY (N→N+1) | t08-home-to-wrongbook.spec.ts:132, :186 |
| today-review-card-circle-progress | GET /today .today.circleProgress | READY circle | t08-home-to-wrongbook.spec.ts:135, :191 |
| today-review-card-start-all-btn | — | READY CTA | t08-home-to-wrongbook.spec.ts:142 |
| greeting-hero | — | READY | t08-home-to-wrongbook.spec.ts:138 |
| p-home-weekly-sparkline | — | READY | t08-home-to-wrongbook.spec.ts:139 |
| week-strip | — | READY | t08-home-to-wrongbook.spec.ts:140 |
| tab-home | — | P05→P-HOME | t08-home-to-wrongbook.spec.ts:119 |

### 3.3 E2E 运行结果

- **5/5 PASS** · 全绿
- 运行环境: Playwright headed + Chromium + localhost:5182
- run.log: `audits/runs/SC01-T08/team-2/attempt-1/test-reports/e2e/coder/playwright/run.log`
- Playwright report: `audits/runs/SC01-T08/team-2/attempt-1/test-reports/e2e/coder/playwright/index.html`
- JUnit XML: `audits/runs/SC01-T08/team-2/attempt-1/test-reports/e2e/coder/playwright/results.xml`
- VRT baselines: `design/system/screenshots/baseline/phome-{ready,empty,error}.png`

### 3.4 截图证据

| State | File |
|---|---|
| idle (P05 stub) | `test-reports/e2e/coder/screenshots/t08-idle.png` |
| uploading (P-HOME loading) | `test-reports/e2e/coder/screenshots/t08-uploading.png` |
| success (P-HOME READY) | `test-reports/e2e/coder/screenshots/t08-success.png` |
| error (P-HOME ERROR) | `test-reports/e2e/coder/screenshots/t08-error.png` |

## 4. 自检

- [x] 铁律 1 单一专注: 只做 SC01-T08
- [x] 铁律 2 工作区隔离: 只在 claude/sc01-t08-home-to-wrongbook 分支
- [x] 铁律 3 权限隔离: 只改 dev_done + git_commits
- [x] 铁律 4 Git Commits: 描述性 commit + hash 记录
- [x] 铁律 5 落盘工作日志: coder.md + bugs-found.md
- [x] 铁律补充 6 E2E: 5/5 全绿 + 4 截图 + spec-trace + VRT
- [x] SHARED-E2E-PROTOCOL C-1: 源脚本 git tracked + trace 头注释
- [x] C-2: Playwright 报告落审计快照
- [x] C-4: 截图 4 态
- [x] C-5: spec-trace 表格 (本文件 §3.2)
- [x] Rule 3 Surgical: 只动必要文件 (Home/*, App.tsx, home.ts, E2E spec)
- [x] Rule 11 Match conventions: CSS modules + testids + react-query + inline SVG (同 P09)

## 5. 提交

- Commit hash: (见 inflight git_commits)
- 分支: claude/sc01-t08-home-to-wrongbook
