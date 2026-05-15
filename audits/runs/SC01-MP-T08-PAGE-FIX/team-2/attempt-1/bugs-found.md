# Bugs Found · SC01-MP-T08-PAGE-FIX · attempt-1

## Bug 1: pages/home/index.wxml 动态 testid 绑定在 automator 环境不解析

- **文件**: `frontend/apps/mp/pages/home/index.wxml`
- **描述**: 14 处 `data-test-id="{{testIds.X}}"` 使用 Mustache 动态绑定，在 miniprogram-automator E2E 环境中 DOM 查询 `$('[data-test-id="p-home-root"]')` 无法匹配，导致 spec 中 4 个 testid assertion 全部失败
- **修复**: 替换为静态字符串值，与 `@longfeng/testids` pHome 常量一致
- **Commit**: `ce6dd29`
