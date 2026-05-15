# Bugs Found · SC01-MP-T12 · attempt-1

## Bug 1: Missing API exports cause typecheck failure

- **文件**: `frontend/apps/mp/src/api/review.ts`
- **描述**: `review-exec/index.ts` 导入 `getNode`, `revealNode`, `gradeNode` 但 `review.ts` 仅导出 `completeSession`，导致 TS2305 编译错误
- **修复**: 按 H5 sibling `reviewClient` 接口签名补齐三个 API 函数
- **Commit**: (见 coder.md §5)

## Bug 2: Missing P08→P09 transition

- **文件**: `frontend/apps/mp/pages/review-exec/index.ts`
- **描述**: `onGradeTap` 在 GRADED 状态后没有 `wx.navigateTo` 导航到 P09 (review-done)。H5 sibling 在 L163 有 `nav('/review/done?...')` 但 MP 版缺失
- **修复**: 在 `onGradeTap` 末尾添加 `wx.navigateTo({ url: '/pages/review-done/index?sid=&grade=&nodeId=' })`
- **Commit**: (见 coder.md §5)
