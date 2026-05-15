# Bugs Found · SC01-MP-T07-PAGE-FIX · attempt-1

## Bug 1: wrongbook-list wxml 缺少 data-test-id 属性

- **文件**: `frontend/apps/mp/pages/wrongbook-list/index.wxml`
- **描述**: P05 wrongbook-list 是唯一没有 `data-test-id` 属性的页面。`TEST_IDS.wrongbookList` 常量已在 `@longfeng/testids` 中定义但未被 wxml 使用。E2E spec 用 class selector 断言, 与项目其它页面 `[data-test-id]` 模式不一致。
- **修复**: 在 index.ts 导入 TEST_IDS 并绑定到 data, wxml 10 个关键元素加 `data-test-id="{{testIds[...]}}"`, spec 改用 `[data-test-id]` selector。
- **Commit**: 1bd5f69

## Bug 2: index.ts PageData interface 缺 testIds 字段

- **文件**: `frontend/apps/mp/pages/wrongbook-list/index.ts`
- **描述**: 添加 `testIds` 到 data 后, PageData interface 未声明该字段, 导致 TS2353 编译错误。
- **修复**: 在 PageData interface 中补充 `testIds: typeof TEST_IDS.wrongbookList`。
- **Commit**: 1bd5f69
