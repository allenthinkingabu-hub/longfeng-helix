# Bugs Found · SC01-MP-T11-PAGE-FIX · attempt-1

## Bug 1: wxml data-test-id 动态绑定导致 E2E spec selector 匹配失败

- **文件**: `frontend/apps/mp/pages/review-exec/index.wxml`
- **描述**: 17 处 `data-test-id` 使用 `{{testIds.X}}` Mustache 动态绑定, miniprogram-automator `page.$('[data-test-id="p08-root"]')` 无法匹配
- **修复**: 替换为静态字符串值 (与 `@longfeng/testids` TEST_IDS.p08 值一致)
- **commit**: (见 git log)
