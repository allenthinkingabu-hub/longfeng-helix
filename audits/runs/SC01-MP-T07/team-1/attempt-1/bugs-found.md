# Bugs Found · SC01-MP-T07 · attempt-1

## Bug 1: URLSearchParams not available in MP runtime

- **文件**: `frontend/apps/mp/src/api/wrongbook.ts`
- **描述**: `listWrongQuestions()` 初始实现使用 `new URLSearchParams()` 构建 query string，但 MP 运行时没有 `URLSearchParams` 全局对象，导致 `tsc --noEmit` 报 TS2304。
- **修复**: 改用手工 `parts.push()` + `parts.join('&')` 拼接 query string。
- **Commit**: f4cd981

## Bug 2: Page() global not available in vitest unit test

- **文件**: `frontend/apps/mp/pages/wrongbook-list/index.ts`
- **描述**: 直接从 `index.ts` import 纯函数会触发顶层 `Page()` 调用，vitest 环境无 `Page` 全局 → `ReferenceError: Page is not defined`。
- **修复**: 提取纯函数到 `helpers.ts`，unit test import helpers 而非 index。
- **Commit**: f4cd981
