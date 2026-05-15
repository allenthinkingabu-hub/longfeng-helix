# Coder Log · SC01-MP-T11-PAGE-FIX · attempt-1

## 1. 地形侦察

- 读 `frontend/apps/mp/test/e2e/review-exec.spec.ts`: spec 用静态 `[data-test-id="p08-root"]` 等 selector
- 读 `frontend/apps/mp/pages/review-exec/index.wxml`: wxml 用 `{{testIds.root}}` 动态绑定
- 读 `frontend/packages/testids/src/index.ts`: TEST_IDS.p08 值与 spec selector 完全一致
- 根因: miniprogram-automator `page.$()` 无法解析 Mustache `{{}}` 动态属性, spec selector 匹配失败

## 2. 编码

- 将 `index.wxml` 中 17 处 `data-test-id="{{testIds.X}}"` 替换为静态字符串值
- 映射表:
  | wxml 原值 | 替换为 |
  |---|---|
  | `{{testIds.root}}` | `p08-root` |
  | `{{testIds.topbar}}` | `p08-topbar` |
  | `{{testIds.topbarCursor}}` | `p08-topbar-cursor` |
  | `{{testIds.closeBtn}}` | `p08-close-btn` |
  | `{{testIds.progressBar}}` | `p08-progress-bar` |
  | `{{testIds.metaChips}}` | `p08-meta-chips` |
  | `{{testIds.questionHero}}` | `p08-question-hero` |
  | `{{testIds.answerArea}}` | `p08-answer-area` |
  | `{{testIds.revealBtn}}` | `p08-reveal-btn` |
  | `{{testIds.revealContent}}` | `p08-reveal-content` |
  | `{{testIds.revealCheckmark}}` | `p08-reveal-checkmark` |
  | `{{testIds.memoryCurve}}` | `memory-curve` |
  | `{{testIds.gradeButtons}}` | `p08-grade-buttons` |
  | `{{testIds.gradeBtnForgot}}` | `p08-grade-buttons-forgot` |
  | `{{testIds.gradeBtnPartial}}` | `p08-grade-buttons-partial` |
  | `{{testIds.gradeBtnMastered}}` | `p08-grade-buttons-mastered` |
  | `{{testIds.exitConfirmSheet}}` | `p08-exit-confirm-sheet` |
- 保留 `{{item.testId}}` (line 119 步骤列表动态 testId, spec 不依赖)

## 3. 真实 E2E

本任务 scope 为 page-fix, inflight `physical_verification.dor_c1_to_c6_required = false`, 不跑 automator (TL Phase 6 串行验).

## 4. 自检

- `pnpm -F mp lint` → 0 errors
- `pnpm -F mp test:unit` → 97/97 PASS
- wxml 中所有 spec 引用的 testid 均已静态化, selector 匹配确认

## 5. 提交

- commit hash: 9327bb2
