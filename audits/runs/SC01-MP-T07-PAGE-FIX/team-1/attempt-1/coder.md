# Coder Log · SC01-MP-T07-PAGE-FIX · attempt-1

## 1. 地形侦察

- 读 `frontend/apps/mp/test/e2e/wrongbook-list.spec.ts`: spec 用 `.nav-h1`, `.search`, `.chips-row`, `.content` class selector 断言 DOM 节点
- 读 `frontend/apps/mp/pages/wrongbook-list/index.wxml`: wxml 有这些 class 但**无 data-test-id** 属性
- 读 `frontend/packages/testids/src/index.ts`: `TEST_IDS.wrongbookList` 已定义 12+ 个 testid 常量 (root, page-header-title, page-header-search, subject-chips 等)
- 读 `frontend/apps/mp/pages/wrongbook-list/index.ts`: 未 import TEST_IDS, data 中无 testIds 字段
- 对比标杆: `pages/home/index.ts` + `pages/home/index.wxml` 使用 `data-test-id="{{testIds.X}}"` 动态绑定模式
- 结论: wrongbook-list 是唯一没有 data-test-id 的页面, 需按标杆模式补齐

## 2. 编码

**index.ts 改动** (`pages/wrongbook-list/index.ts`):
1. 新增 `import { TEST_IDS } from '@longfeng/testids';`
2. `PageData` interface 新增 `testIds: typeof TEST_IDS.wrongbookList`
3. `Page.data` 新增 `testIds: TEST_IDS.wrongbookList`

**index.wxml 改动** (`pages/wrongbook-list/index.wxml`):
- 根 view: `data-test-id="{{testIds.root}}"` → `wrongbook.list.root`
- nav-h1 text: `data-test-id="{{testIds['page-header-title']}}"` → `p05-page-header-title`
- search view: `data-test-id="{{testIds['page-header-search']}}"` → `p05-page-header-search`
- ai-badge text: `data-test-id="{{testIds['page-header-semantic-badge']}}"` → `p05-page-header-semantic-badge`
- chips-row scroll-view: `data-test-id="{{testIds['subject-chips']}}"` → `p05-subject-chips`
- mastery-row view: `data-test-id="{{testIds['mastery-status']}}"` → `p05-mastery-status`
- sort view: `data-test-id="{{testIds['sort-bar']}}"` → `p05-sort-bar`
- empty view: `data-test-id="{{testIds['empty-state']}}"` → `p05-empty-state`
- empty capture btn: `data-test-id="{{testIds['empty-capture-btn']}}"` → `p05-empty-capture-btn`
- fab view: `data-test-id="{{testIds['fab-capture']}}"` → `p05-fab-capture`

**spec 改动** (`test/e2e/wrongbook-list.spec.ts`):
- Selector 从 class (`.nav-h1`, `.search`, `.chips-row`, `.content`) 改为 `[data-test-id="..."]` (root, title, search, chips)
- 与 `TEST_IDS.wrongbookList` 常量严格对齐

## 3. 真实 E2E

本任务 scope = Phase 5 page-fix, 不跑 automator (TL Phase 6 串行验)。

**lint + typecheck**:
- `pnpm -F mp lint` → `✓ lint-mp: 0 errors` (含 tsc --noEmit)

**test:unit**:
- `pnpm -F mp test:unit` → 7 files, 97 tests, 97 passed

## 4. 自检

| 检查项 | 状态 | 证据 |
|--------|------|------|
| wxml data-test-id 加了 | PASS | 10 个 data-test-id attr 对应 TEST_IDS.wrongbookList |
| spec selector 对齐 testids | PASS | 4 个 `[data-test-id="..."]` selector |
| testIds TS import + data 绑定 | PASS | index.ts L10 import + L15 interface + L29 data |
| lint 0 error | PASS | `✓ lint-mp: 0 errors` |
| typecheck 0 error | PASS | tsc --noEmit 通过 |
| test:unit 全绿 | PASS | 97/97 passed |
| 无 --no-verify | PASS | 未使用 |

## 5. 提交

Commit hash: 1bd5f69
