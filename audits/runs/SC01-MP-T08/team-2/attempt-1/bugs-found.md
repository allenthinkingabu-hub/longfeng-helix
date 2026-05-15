# Bugs Found · SC01-MP-T08 · attempt-1

## Bug 1: Page() global not defined in vitest causes import crash

- **文件**: `pages/home/index.ts`
- **描述**: 直接在 index.ts 中 export 纯函数 + 调用 `Page()` 会导致 vitest import 时 `ReferenceError: Page is not defined`，因为 vitest 环境没有 wx 小程序全局 `Page` 函数。
- **修复**: 提取纯函数到 `pages/home/helpers.ts`，index.ts import from helpers。Unit test import helpers 而非 index。
- **Commit**: e9f01ac
