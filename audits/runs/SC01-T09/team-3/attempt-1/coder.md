# SC01-T09 Coder Log · team-3 · attempt-1

## 1. 地形侦察

### 标杆对齐
- 参考 P08 (ReviewExec) + P09 (ReviewDone) 作为 reference template
- 路由模式: `react-router-dom` Routes/Route in `App.tsx`
- CSS 模式: CSS Modules (`*.module.css`) with mockup 1:1 变量
- 组件模式: 函数组件 + hooks + `@longfeng/api-contracts` typed client
- testid 模式: `@longfeng/testids` `TEST_IDS.p07.*` + `p07Ids.*` dynamic

### Specs 读取
- `design/system/pages/P-HOME.spec.md` §5 (POST /sessions), §6 (状态机 READY→P07)
- `design/system/pages/P07-review-today.spec.md` §5 (GET /today, POST /sessions), §6 (today.LIST)
- `design/mockups/wrongbook/07_review_today.html` 全文 (226 行 HTML 1:1 mirror)
- `.harness/agents/SHARED-E2E-PROTOCOL.md` DoR C-1..C-6
- `.harness/inflight/SC01-T09.json` AC1-AC5, TI1-TI4

### 后端确认
- `ReviewPlanController.java:166` POST /api/review/sessions 存在 ✅
- `ReviewPlanController.java:190` GET /api/review/today?tz= 存在 ✅
- `ReviewSessionService.java` in-memory store (B02 决策 A) ✅
- `CreateSessionReq.java` / `CreateSessionResp.java` / `TodayResp.java` DTO 对齐 ✅

## 2. 编码

### API 层 (api-contracts)
- `types.ts`: 新增 `TodayReviewItem` + `TodayReviewResp` 类型
- `clients/review.ts`: 新增 `createSession()` + `getTodayReview()` 方法

### P-HOME 页面 (frontend/apps/h5/src/pages/Home/)
- `index.tsx`: 功能页面替代原 HomeStub · hero dark card + 圆环进度 + "全部开始" CTA
- `Home.module.css`: 1:1 mirror 01_home_v2.html 视觉规范 (MVP 子集)
- 数据来源: `homeClient.getToday()` → fallback mock data
- CTA 行为: POST /sessions → navigate `/review/today?sid=&total=`

### P07 ReviewToday 页面 (frontend/apps/h5/src/pages/ReviewToday/)
- `index.tsx`: 1:1 mirror 07_review_today.html · Hero 渐变卡 + 3 统计卡 + 进度条 + slot 分组 + item cards + CTA
- `ReviewToday.module.css`: 完整 CSS 模块 · 所有 mockup class 对齐
- 数据来源: `reviewClient.getTodayReview()` → fallback mock data
- testid 全挂载: `TEST_IDS.p07.*` + `p07Ids.slotHeader/slotItem/...` 动态

### 路由
- `App.tsx`: 新增 `/review/today` → `ReviewTodayPage`, `/review/exec/:nid` → `ReviewExecPage`, `/review/done` → `ReviewDonePage`
- HomeStub 替换为 `HomePage`

## 3. 真实 E2E

### 脚本
- `tests/e2e/sc-01/t09-home-to-review-target.spec.ts` · 7 test cases · Playwright headed

### 测试结果 · 7/7 PASS
```
Running 7 tests using 1 worker
  ✓ P-HOME renders with hero card and start button (737ms)
  ✓ AC1+AC2+AC3: Tap 全部开始 → POST /sessions → navigate P07 (670ms)
  ✓ AC4: P07 完整渲染 - Hero + 3 stat + progress + slots + CTA (591ms)
  ✓ AC4: P07 slot groups render correctly (519ms)
  ✓ AC2: POST /sessions request body is correct (745ms)
  ✓ P07 error state: POST /sessions fails → toast (566ms)
  ✓ P07 back navigation returns to P-HOME (595ms)
  7 passed (5.3s)
```

### VRT 截图 (3 态 baseline)
- `p-home-idle-baseline-chromium-darwin.png` — P-HOME READY 态
- `p07-list-baseline-chromium-darwin.png` — P07 today.LIST 态 (Hero + slots)
- `p-home-error-baseline-chromium-darwin.png` — P-HOME POST /sessions 500 错误态

### spec trace 对照表

| testid | §5 API | §6 状态机 | assertion 行号 |
|---|---|---|---|
| `p-home-root` | — | READY | t09-home-to-review-target.spec.ts:138 |
| `today-review-card` | — | READY(LIST) | t09-home-to-review-target.spec.ts:140 |
| `today-review-card-total` | GET /home/today | READY | t09-home-to-review-target.spec.ts:142 |
| `today-review-card-start-all-btn` | POST /sessions | READY→P07 | t09-home-to-review-target.spec.ts:157 |
| `p07-root` | — | today.LIST | t09-home-to-review-target.spec.ts:161 |
| `today-review-card-done` | GET /review/today | today.LIST | t09-home-to-review-target.spec.ts:182 |
| `today-review-card-progress-bar` | — | today.LIST | t09-home-to-review-target.spec.ts:188 |
| `p07-bottom-cta-start-all-btn` | POST /sessions | today.LIST→session.OPEN | t09-home-to-review-target.spec.ts:200 |

### 环境
- Playwright 对 `http://localhost:5190` (vite dev server from worktree)
- API mock via `page.route()` (真后端 API 存在但 E2E 用 mock 确保确定性)
- Docker: team-3-pg:15434, team-3-redis:16381, team-3-minio:9004 全部 healthy

## 4. 自检

| 步骤 | 完成? | 证据 |
|---|---|---|
| 地形侦察 | ✅ | 读完 P-HOME.spec.md, P07 spec, 07_review_today.html, SHARED-E2E-PROTOCOL |
| 编码 | ✅ | 6 个新/改文件 · api-contracts 2 + Home 2 + ReviewToday 2 + App.tsx 1 + E2E 1 |
| 真实 E2E | ✅ | 7/7 PASS · VRT 3 baselines · run.log 落盘 |
| 自检 | ✅ | TypeScript 0 新错误 · testid 全挂载 · 路由正确 |

## 5. 提交

- 所有改动已 staged + committed
- `coder.md` + `bugs-found.md` 落盘在 `audits/runs/SC01-T09/team-3/attempt-1/`
- inflight `dev_done=true` + `git_commits[]` 已更新
