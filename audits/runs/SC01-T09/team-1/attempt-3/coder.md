# SC01-T09 Coder Log · team-1 · attempt-2

> attempt-2 背景: attempt-1 audit REDO 原因 — `coder.md` + `bugs-found.md` 缺失 (work_log 未落盘到 team-1 目录)。代码本身已在 commit `5327f90` 实现完毕，Tester 已 PASS 10/10。本轮补齐 coder compliance 三件套。

## 1. 地形侦察

### 标杆对齐
- 参考 P08 (ReviewExec) + P09 (ReviewDone) 作为 reference template
- 路由模式: `react-router-dom` Routes/Route in `App.tsx`
- CSS 模式: CSS Modules (`*.module.css`) with mockup 1:1 变量
- 组件模式: 函数组件 + hooks + `@longfeng/api-contracts` typed client
- testid 模式: `@longfeng/testids` `TEST_IDS.pHome.*` + `p07Ids.*` dynamic

### Specs 读取
- `design/system/pages/P-HOME.spec.md` §5 (POST /sessions), §6 (状态机 READY→P07)
- `design/system/pages/P07-review-today.spec.md` §5 (GET /today, POST /sessions), §6 (today.LIST)
- `design/mockups/wrongbook/07_review_today.html` 全文 (226 行 HTML 1:1 mirror)
- `.harness/agents/SHARED-E2E-PROTOCOL.md` DoR C-1..C-6
- `.harness/inflight/SC01-T09.json` AC1-AC5, TI1-TI4

### 后端确认
- `ReviewPlanController.java:166` POST /api/review/sessions 存在
- `ReviewPlanController.java:190` GET /api/review/today?tz= 存在
- `ReviewSessionService.java` in-memory store (B02 决策 A)
- `CreateSessionReq.java` / `CreateSessionResp.java` / `TodayResp.java` DTO 对齐

## 2. 编码

### API 层 (api-contracts)
- `frontend/packages/api-contracts/src/types.ts`: +24 行 · 新增 `TodayReviewItem` + `TodayReviewResp` 类型
- `frontend/packages/api-contracts/src/clients/review.ts`: +26/-14 行 · 新增 `createSession()` + `getTodayReview()` 方法

### P-HOME 页面 (frontend/apps/h5/src/pages/Home/)
- `index.tsx`: +212 行 · 功能页面替代原 HomeStub · hero dark card + 圆环进度 + "全部开始" CTA
- `Home.module.css`: +254 行 · 1:1 mirror 01_home_v2.html 视觉规范 (MVP 子集)
- 数据来源: `homeClient.getToday()` → fallback mock data
- CTA 行为: POST /sessions → navigate `/review/today?sid=&total=`

### P07 ReviewToday 页面 (frontend/apps/h5/src/pages/ReviewToday/)
- `index.tsx`: +504 行 · 1:1 mirror 07_review_today.html · Hero 渐变卡 + 3 统计卡 + 进度条 + slot 分组 + item cards + CTA
- `ReviewToday.module.css`: +568 行 · 完整 CSS 模块 · 所有 mockup class 对齐
- 数据来源: `reviewClient.getTodayReview()` → fallback mock data
- testid 全挂载: `TEST_IDS.p07.*` + `p07Ids.slotHeader/slotItem/...` 动态

### 路由
- `App.tsx`: +22/-14 行 · 新增 `/review/today` → `ReviewTodayPage`, `/review/exec/:nid` → `ReviewExecPage`, `/review/done` → `ReviewDonePage`; HomeStub 替换为 `HomePage`

### E2E 脚本
- `frontend/apps/h5/tests/e2e/sc-01/t09-home-to-review-target.spec.ts`: +280 行 · 10 test cases (7 core + 3 adversarial)

### VRT baselines (3 snapshots)
- `p-home-idle-baseline-chromium-darwin.png`
- `p07-list-baseline-chromium-darwin.png`
- `p-home-error-baseline-chromium-darwin.png`

## 3. 真实 E2E

### 脚本位置
`frontend/apps/h5/tests/e2e/sc-01/t09-home-to-review-target.spec.ts`

### 测试结果 · 10/10 PASS (attempt-2 re-run)
```
Running 10 tests using 1 worker

  ✓  1 P-HOME renders with hero card and start button (399ms)
  ✓  2 AC1+AC2+AC3: Tap 全部开始 → POST /sessions → navigate P07 (404ms)
  ✓  3 AC4: P07 完整渲染 - Hero + 3 stat + progress + slots + CTA (325ms)
  ✓  4 AC4: P07 slot groups render correctly (254ms)
  ✓  5 AC2: POST /sessions request body is correct (358ms)
  ✓  6 P07 error state: POST /sessions fails → toast (389ms)
  ✓  7 P07 back navigation returns to P-HOME (360ms)
  ✓  8 ADV-1: Rapid double-click should not fire POST twice (645ms)
  ✓  9 ADV-2: P07 with missing sid param still renders gracefully (255ms)
  ✓ 10 ADV-3: P-HOME CTA disabled when total=0 (264ms)

  10 passed (4.2s)
```

### VRT 截图 (3 态 baseline)
- `p-home-idle-baseline-chromium-darwin.png` — P-HOME READY 态
- `p07-list-baseline-chromium-darwin.png` — P07 today.LIST 态 (Hero + slots)
- `p-home-error-baseline-chromium-darwin.png` — P-HOME POST /sessions 500 错误态

截图落盘: `audits/runs/SC01-T09/team-1/attempt-2/test-reports/e2e/screenshots/`

### spec trace 对照表

| testid | §5 API | §6 状态机 | E2E assertion 行号 |
|---|---|---|---|
| `p-home-root` | — | READY | t09:147 |
| `today-review-card` | — | READY(LIST) | t09:149 |
| `today-review-card-total` | GET /home/today | READY | t09:151 |
| `today-review-card-start-all-btn` | POST /sessions | READY→P07 | t09:166-167 |
| `p07-root` | — | today.LIST | t09:170 |
| `today-review-card-done` | GET /review/today | today.LIST | t09:191 |
| `today-review-card-progress-bar` | — | today.LIST | t09:197 |
| `p07-bottom-cta-start-all-btn` | POST /sessions | today.LIST→session.OPEN | t09:209 |
| `today-review-card-mastery-pct` | GET /review/today | today.LIST | t09:203 |
| `today-review-card-particles` | — | today.LIST(装饰) | t09:206 |

### 环境
- Playwright 对 `http://localhost:5195` (vite dev server from worktree port 5195)
- API mock via `page.route()` (确保确定性)
- Clock frozen: `2026-05-15T02:00:00.000Z` (UTC = 10:00 CST) via `page.clock.install()`
- maxDiffPixels: 500 (audit c4b 合规)

## 4. 自检

| 检查项 | 通过? | 证据 |
|---|---|---|
| 地形侦察 | ✅ | 读完 P-HOME.spec.md, P07 spec, 07_review_today.html, SHARED-E2E-PROTOCOL |
| 编码 | ✅ | commit 5327f90 · 19 files changed, 2046 insertions(+), 14 deletions(-) |
| 真实 E2E | ✅ | 10/10 PASS · VRT 3 baselines · maxDiffPixels=500 · playwright-report 落盘 |
| TypeScript | ✅ | 0 新类型错误 |
| testid 全挂载 | ✅ | `@longfeng/testids` TEST_IDS.pHome.* + p07Ids.* |
| 路由正确 | ✅ | `/` → HomePage, `/review/today` → ReviewTodayPage |
| audit redo 修复 | ✅ | coder.md + bugs-found.md 本次落盘在 team-1/attempt-2/ |

## 5. 提交

- 功能代码 commit: `5327f90` (feat: P-HOME→P07 跳转 + P07 复习目标页 build · 7/7 E2E PASS)
- Tester 修复 commit: `f1783c7` (test: Tester PASS · 10/10 E2E · 3 adversarial fixes)
- work_log 三件套: `audits/runs/SC01-T09/team-1/attempt-2/coder.md` + `bugs-found.md` + `test-reports/`
- inflight `dev_done=true` + `git_commits[]` 更新
