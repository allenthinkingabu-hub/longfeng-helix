# Coder Log · SC01-MP-T09-PAGE-FIX · attempt-1

## 1. 地形侦察

- 读 inflight `SC01-MP-T09-PAGE-FIX.json`: `previous_audit_verdict.redo_reason` = "改 pages/review-today/index.wxml 加静态 data-test-id 或对应 class 让 spec selector 找得到"
- 读 `frontend/apps/mp/test/e2e/review-today.spec.ts`: spec 用 `page.$('[data-test-id="${TEST_IDS.p07.todayReviewCard}"]')` 查 DOM，期望静态 `data-test-id="today-review-card"`
- 读 `frontend/apps/mp/pages/review-today/index.wxml`: 全部 11 处 `data-test-id` 使用 Mustache 动态绑定 `{{testIds.X}}`，automator E2E 下 selector 匹配不到
- 读 `frontend/packages/testids/src/index.ts` p07 section: 确认 11 个 testid 字面值
- 读 `frontend/apps/mp/pages/review-today/index.ts`: 确认 `data.testIds = TEST_IDS.p07` 初始化存在但 wxml 动态绑定在 automator 下不可靠

## 2. 编码

将 `pages/review-today/index.wxml` 中 11 处动态 `{{testIds.X}}` 替换为对应的静态字符串：

| # | 旧值 | 新值 | 行 |
|---|------|------|----|
| 1 | `{{testIds.root}}` | `p07-root` | 4 |
| 2 | `{{testIds.todayReviewCard}}` | `today-review-card` | 22 |
| 3 | `{{testIds.heroParticles}}` | `today-review-card-particles` | 23 |
| 4 | `{{testIds.heroTotal}}` | `today-review-card-total` | 32 |
| 5 | `{{testIds.heroEstMin}}` | `today-review-card-est-min` | 33 |
| 6 | `{{testIds.heroDone}}` | `today-review-card-done` | 38 |
| 7 | `{{testIds.heroProgressBar}}` | `today-review-card-progress-bar` | 51 |
| 8 | `{{testIds.heroProgressPct}}` | `p07-hero-progress-pct` | 55 |
| 9 | `{{testIds.heroMasteryPct}}` | `today-review-card-mastery-pct` | 56 |
| 10 | `{{testIds.emptyState}}` | `p07-empty-state` | 61 |
| 11 | `{{testIds.bottomCtaStartAllBtn}}` | `p07-bottom-cta-start-all-btn` | 109 |

值来源: `@longfeng/testids` `TEST_IDS.p07` 对象，1:1 对应。

## 3. 真实 E2E

本任务 scope 为 page-fix（wxml testid 静态化），inflight `physical_verification.dor_c1_to_c6_required = false`，不跑 automator（TL Phase 6 串行验）。

spec 中的 selector `[data-test-id="today-review-card"]` 现在能匹配 wxml line 22 的静态 `data-test-id="today-review-card"`。

## 4. 自检

- [x] lint.mjs: 22 errors 全为 pre-existing van-* component resolution（main 分支同样存在），无新增 error
- [x] tsc --noEmit: 0 error
- [x] test:unit: 97/97 PASS (7 files)
- [x] 只改了 `pages/review-today/index.wxml` 一个文件，11 处 testid 替换
- [x] 未改 spec / 未改 JS / 未改 JSON — surgical

## 5. 提交

- commit hash: (pending — will fill after git commit)
