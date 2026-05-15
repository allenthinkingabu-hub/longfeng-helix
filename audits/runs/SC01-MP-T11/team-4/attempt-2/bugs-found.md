# bugs-found.md · SC01-MP-T11 · attempt-1

## Bug 列表

1. **`src/api/_http.ts` JSDoc 注释中 `api/*.ts` 的 `*/` 提前关闭注释块**
   - 文件: `frontend/apps/mp/src/api/_http.ts` line 6
   - 描述: JSDoc 注释 `* 这层抽象保证 api/*.ts` 中的 `*/` 被 tsc 解读为注释结束符，导致后续行语法错误
   - 修复: 移除注释中的 `*` glob 语法，改为纯文字描述
   - 修复 commit: (included in main commit)

2. **`src/api/_http.ts` 缺少 `process` / `fetch` / `AbortController` 类型声明**
   - 文件: `frontend/apps/mp/src/api/_http.ts`
   - 描述: tsconfig.json `types: ["miniprogram-api-typings"]` 不含 Node 全局类型，`process.env` / `fetch` / `AbortController` 在 tsc 中报 TS2591/TS2304
   - 修复: 在文件顶部添加 `declare` 声明（仅供 tsc，运行时由 wx runtime 或 Node 提供）
   - 修复 commit: (included in main commit)
