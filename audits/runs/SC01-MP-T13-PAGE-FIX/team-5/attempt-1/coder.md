# Coder Work Log · SC01-MP-T13-PAGE-FIX · attempt-1

## 1. 地形侦察

- 读 inflight `SC01-MP-T13-PAGE-FIX.json`: redo_reason 明确指出 `pages/review-done/index.wxml` 使用 `{{testIds.X}}` 动态绑定，而 e2e spec 用静态 `[data-test-id="..."]` selector 不匹配
- 读 `frontend/apps/mp/test/e2e/review-done.spec.ts`: 确认 4 个查询 selector
  - `[data-test-id="celebrate-hero"]`
  - `[data-test-id="memory-curve"]`
  - `[data-test-id="p09-stats-row"]`
  - `[data-test-id="p09-cta-row"]`
- 读 `frontend/apps/mp/pages/review-done/index.wxml`: 确认 4 处使用 `{{testIds.celebrateHero}}` / `{{testIds.memoryCurve}}` / `{{testIds.statsRow}}` / `{{testIds.ctaRow}}`
- 读 `frontend/packages/testids/src/index.ts` · `TEST_IDS.p09`: 确认 value 与 spec selector 完全匹配（celebrateHero→'celebrate-hero', memoryCurve→'memory-curve', statsRow→'p09-stats-row', ctaRow→'p09-cta-row'）
- 决策：改 wxml 加静态 data-test-id（更可持续 · inflight scope_in 推荐）

## 2. 编码

4 处 surgical 替换（只动 spec 查询的 4 个元素）：

| wxml 行 | 原值 | 新值 |
|---------|------|------|
| hero view | `data-test-id="{{testIds.celebrateHero}}"` | `data-test-id="celebrate-hero"` |
| memory curve card | `data-test-id="{{testIds.memoryCurve}}"` | `data-test-id="memory-curve"` |
| stats row | `data-test-id="{{testIds.statsRow}}"` | `data-test-id="p09-stats-row"` |
| CTA dock | `data-test-id="{{testIds.ctaRow}}"` | `data-test-id="p09-cta-row"` |

文件: `frontend/apps/mp/pages/review-done/index.wxml` · +4 -4

## 3. 真实 E2E

本任务 scope 为 page-fix（Phase 5）· `physical_verification.dor_c1_to_c6_required = false` · 不跑 automator（TL Phase 6 串行验证）。

验证项：
- `tsc --noEmit`: 0 error
- `pnpm -F mp test:unit`: 97/97 PASS
- pre-commit hook: lint 0 errors + test:unit 97/97 PASS

## 4. 自检

| 检查项 | 通过 | 证据 |
|--------|------|------|
| 只动 1 个文件 | ✓ | `git diff --stat` = 1 file, 4 insertions, 4 deletions |
| testid 值与 TEST_IDS.p09 常量匹配 | ✓ | `frontend/packages/testids/src/index.ts:447-462` |
| tsc --noEmit 0 error | ✓ | 命令输出无错误 |
| test:unit 97/97 | ✓ | vitest run output |
| pre-commit hook pass | ✓ | commit 2855df5 成功 |
| commit hash 真实 | ✓ | `git cat-file -e 2855df5` |

## 5. 提交

- Commit: `2855df5` — `fix(SC01-MP-T13-PAGE-FIX): replace 4 dynamic {{testIds.X}} with static data-test-id in review-done wxml`
- Branch: `claude/sc01-mp-t13-page-fix`
- Pre-commit: lint 0 error · test:unit 97/97 PASS
