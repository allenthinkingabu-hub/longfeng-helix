# Coder Work Log — SC01-MP-T08-E2E (attempt 1)

## 1. 地形侦察

- 完整读 `.harness/agents/coder-agent.md` 全文 (铁律 7 条 + 执行流程 7 步已内化)
- 完整读 `.harness/inflight/SC01-MP-T08-E2E.json`：Phase 1 page-vrt · home 页 · 写 spec 不跑 automator
- 标杆模板: `frontend/apps/mp/test/e2e/automator-smoke.spec.ts` — 已有 connect/disconnect 模式 + vitest + miniprogram-automator
- 读 home 页源码: `pages/home/index.ts` (130 行) + `index.wxml` (222 行) + `index.json` (7 行)
- 读设计 mockup: `design/mockups/wrongbook/01_home_ios_refined.html` (484 行)
- 确认 baseline PNG: `design/system/screenshots/mp-vrt-baseline/01_home_ios_refined.png` 存在
- 读 testids: `frontend/packages/testids/src/index.ts` — `pHome` 对象含 root / greetingHero / todayReviewCard / startAllBtn / weeklySparkline / weekStrip / messages / weakKp / quickEntries
- 确认 pixelmatch + pngjs 已在 mp devDependencies

## 2. 编码

写 `frontend/apps/mp/test/e2e/home.spec.ts`，4 个 test case:

| # | Test | 验证内容 | testid / API 映射 |
|---|------|----------|-------------------|
| 1 | currentPage path | `page.path === 'pages/home/index'` | app.json pages[0] |
| 2 | DOM testids 挂载 | `p-home-root` / `greeting-hero` / `today-review-card` / `today-review-card-start-all-btn` | pHome.root / greetingHero / todayReviewCard / startAllBtn |
| 3 | page data MVP values | greeting / studentName / streak / mastered / subjects(3) / weekDays(7) / messages(3) / quickEntries(4) | index.ts data 定义 |
| 4 | VRT pixelmatch | `mp.screenshot()` vs `01_home_ios_refined.png` baseline · diff < 5000 px | design/system/screenshots |

结构: beforeAll connect (8s timeout) · 4 tests · afterAll disconnect · 完全遵循 smoke spec 标杆模式

## 3. 真实 E2E

Phase 1 scope: 写 spec 不跑 automator (Phase 2 TL 串行验)。

**静态验证已过**:
- `pnpm -F mp test:unit` → 97 tests PASS (7 files)
- `tsc --noEmit` → 0 error
- `pnpm -F mp lint` → 22 errors 全部为预存的 van-* miniprogram_npm 组件路径缺失 (非本次改动引入 · main 分支同样存在)

**spec ↔ testid 对照表**:

| testid | wxml data-test-id | spec test# | assertion |
|--------|-------------------|------------|-----------|
| `p-home-root` | `{{testIds.root}}` | 2 | `page.$('[data-test-id="p-home-root"]')` truthy |
| `greeting-hero` | `{{testIds.greetingHero}}` | 2 | `page.$('[data-test-id="greeting-hero"]')` truthy |
| `today-review-card` | `{{testIds.todayReviewCard}}` | 2 | `page.$('[data-test-id="today-review-card"]')` truthy |
| `today-review-card-start-all-btn` | `{{testIds.startAllBtn}}` | 2 | `page.$('[data-test-id="..."]')` truthy |
| VRT baseline | `01_home_ios_refined.png` | 4 | pixelmatch diff < 5000 px |

## 4. 自检

- [x] 铁律 1 单一专注: 只做 SC01-MP-T08-E2E
- [x] 铁律 2 工作区隔离: 只在 claude/sc01-mp-t08-e2e 分支
- [x] 铁律 3 权限隔离: 只改 dev_done, 不碰 passes
- [x] 铁律 4 Git Commit: 描述性 commit (见下)
- [x] 铁律 5 工作日志: coder.md + bugs-found.md 落盘
- [x] 铁律 6 lint+tsc+test:unit: tsc 0 error · test:unit 97/97 PASS · lint 22 errors 全预存
- [x] spec 含 beforeAll connect (8s timeout) + 4 tests + afterAll disconnect
- [x] page-vrt: pixelmatch vs baseline_png · threshold 5000 px
- [x] Phase 1 不跑 automator (scope_in 明确)

## 5. 提交

- commit hash: (见下 git commit)
- 文件变更: `frontend/apps/mp/test/e2e/home.spec.ts` (+126 行 · 新文件)
