# Coder Log · SC01-MP-T08-PAGE-FIX · attempt-1

## 1. 地形侦察

- 读 inflight `SC01-MP-T08-PAGE-FIX.json`: previous_audit_verdict 指出 wxml 用 `{{testIds.X}}` 动态绑定但 spec 用静态 selector `[data-test-id="..."]` 不匹配
- 读 `frontend/apps/mp/test/e2e/home.spec.ts`: spec 期望 `p-home-root`, `greeting-hero`, `today-review-card`, `today-review-card-start-all-btn` 4 个静态 testid
- 读 `frontend/apps/mp/pages/home/index.wxml`: 14 处 `data-test-id="{{testIds.X}}"` 动态绑定
- 读 `frontend/apps/mp/pages/home/index.ts`: `testIds: TEST_IDS.pHome` 从 `@longfeng/testids` 导入
- 读 `frontend/packages/testids/src/index.ts`: `pHome` 对象值与 spec 期望一致（`root: 'p-home-root'` 等）
- 根因: miniprogram-automator 环境下 `$('[data-test-id="p-home-root"]')` 查 DOM，但 wxml 动态绑定 `{{testIds.root}}` 未在 automator 环境正确渲染

## 2. 编码

将 `pages/home/index.wxml` 中全部 14 处 `{{testIds.X}}` 动态绑定替换为对应的静态字符串值:

| 原 wxml 绑定 | 替换为静态值 |
|---|---|
| `{{testIds.root}}` | `p-home-root` |
| `{{testIds.greetingHero}}` | `greeting-hero` |
| `{{testIds.streakFireIcon}}` | `streak-bar-fire-icon` |
| `{{testIds.streakDaysNumber}}` | `streak-bar-days-number` |
| `{{testIds.todayReviewCard}}` | `today-review-card` |
| `{{testIds.totalLabel}}` | `today-review-card-total` |
| `{{testIds.circleProgress}}` | `today-review-card-circle-progress` |
| `{{testIds.startAllBtn}}` | `today-review-card-start-all-btn` |
| `{{testIds.weeklySparkline}}` | `p-home-weekly-sparkline` |
| `{{testIds.weekStrip}}` | `week-strip` |
| `{{testIds.messagesMoreLink}}` | `p-home-messages-more-link` |
| `{{testIds.messages}}` | `p-home-messages` |
| `{{testIds.weakKp}}` | `p-home-weak-kp` |
| `{{testIds.quickEntries}}` | `p-home-quick-entries` |

仅改动 1 文件 `frontend/apps/mp/pages/home/index.wxml` (+14 -14)。JS 中 `testIds` data 属性保留不删（Rule 3 Surgical: 无害死数据，不必动）。

## 3. 真实 E2E

本任务 scope 明确 "不跑 automator (TL Phase 6 串行验)"（inflight context.scope_in 最后一条）。验证范围:

- `tsc --noEmit`: 0 errors
- `pnpm -F mp test:unit` (vitest): 97/97 PASS，含 `home.spec.ts` 16 tests 全绿
- pre-commit hook: lint 0 errors + test:unit 97/97 PASS

## 4. 自检

| 检查项 | 结果 | 证据 |
|---|---|---|
| wxml 14 处 testid 已改静态 | PASS | `git diff ce6dd29~1..ce6dd29` |
| spec 期望的 4 个 testid 在 wxml 中存在 | PASS | `p-home-root` (line 5), `greeting-hero` (line 11), `today-review-card` (line 54), `today-review-card-start-all-btn` (line 84) |
| tsc --noEmit 0 errors | PASS | 命令输出无错误 |
| test:unit 97/97 | PASS | vitest 输出 "Tests 97 passed (97)" |
| lint 0 errors | PASS | pre-commit hook 输出 "✓ lint-mp: 0 errors" |
| commit 真实存在 | PASS | `git cat-file -e ce6dd29` |

## 5. 提交

- Commit: `ce6dd29` — `fix(SC01-MP-T08): replace dynamic {{testIds.X}} with static data-test-id in pages/home/index.wxml`
- Branch: `claude/sc01-mp-t08-page-fix`
- Files changed: `frontend/apps/mp/pages/home/index.wxml` (+14 -14)
