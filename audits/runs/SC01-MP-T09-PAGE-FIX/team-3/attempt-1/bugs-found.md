# Bugs Found · SC01-MP-T09-PAGE-FIX · attempt-1

## Bug 1: wxml 动态 testid 绑定导致 E2E selector 匹配失败

- **文件**: `frontend/apps/mp/pages/review-today/index.wxml`
- **描述**: 11 处 `data-test-id` 使用 Mustache `{{testIds.X}}` 动态绑定，miniprogram-automator E2E 下 `page.$('[data-test-id="today-review-card"]')` 找不到元素。改为静态字符串后 selector 可匹配。
- **修复 commit**: 5bf6e9d
