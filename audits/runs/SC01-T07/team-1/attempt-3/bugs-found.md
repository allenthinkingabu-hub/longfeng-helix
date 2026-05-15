# bugs-found.md · SC01-T07 · attempt-3

## 发现并修复的 Bug

### Bug 1: App.tsx P04 路由指向 stub div 而非 ResultPage 组件
- **文件**: `frontend/apps/h5/src/App.tsx` L29
- **描述**: `/question/:qid/result` 路由原本指向 `<div data-testid="p04-root">Result</div>` 占位 div，不渲染真实 P04 ResultPage 组件。导致 P04→P05 跳转链路断裂。
- **修复**: 导入 `ResultPage` 组件，将路由 element 改为 `<ResultPage />`
- **修复 commit**: e306dc8

### Bug 2: App.tsx 缺少 /wrongbook 路由
- **文件**: `frontend/apps/h5/src/App.tsx`
- **描述**: WrongbookStub 组件虽已定义但未注册到路由表。P04 save 后 navigate 到 `/wrongbook` 会命中 catch-all `*` 路由，重定向至首页。
- **修复**: 添加 `<Route path="/wrongbook" element={<WrongbookListPage />} />`
- **修复 commit**: e306dc8
