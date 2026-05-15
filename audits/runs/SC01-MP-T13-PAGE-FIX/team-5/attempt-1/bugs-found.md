# Bugs Found · SC01-MP-T13-PAGE-FIX · attempt-1

## Bug 1: review-done wxml 使用动态 testid 绑定导致 e2e spec selector 不匹配

- **文件**: `frontend/apps/mp/pages/review-done/index.wxml`
- **描述**: 4 处 `data-test-id="{{testIds.X}}"` 动态 Mustache 绑定，miniprogram-automator 在 `page.$('[data-test-id="..."]')` 查询时无法匹配（automator 不展开 Mustache 表达式）
- **修复**: 替换为静态字符串值（与 `TEST_IDS.p09` 常量一致）
- **Commit**: `2855df5`
