# bugs-found.md · SC01-MP-T11 · attempt-3

> Carry-forward from attempt-1 + Tester-found bug in attempt-2.

## Bug 列表

1. **`src/api/_http.ts` JSDoc 注释中 `*/` 提前关闭注释块** (attempt-1)
   - 文件: `frontend/apps/mp/src/api/_http.ts` line 6
   - 修复: 移除注释中的 glob 语法 · commit e609eae

2. **`src/api/_http.ts` 缺少 `process` / `fetch` / `AbortController` 类型声明** (attempt-1)
   - 文件: `frontend/apps/mp/src/api/_http.ts`
   - 修复: 添加 `declare` 声明 · commit e609eae

3. **MOCK_NODE.nodeIndex=2 与 mockup "第 2 次复习" 不一致** (Tester 发现 · attempt-2)
   - 文件: `frontend/apps/mp/pages/review-exec/index.ts` L46-47
   - 描述: nodeIndex=2 导致 chip 渲染 "第 3 次复习"，mockup SoT 显示 "第 2 次"
   - 修复: nodeIndex: 2 → 1 · commit 612e5f2
