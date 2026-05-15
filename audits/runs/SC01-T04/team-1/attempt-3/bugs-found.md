# bugs-found.md · SC01-T04 · team-1 attempt-3

## Bug 1: App.tsx 缺少 P04 路由

- **文件**: `frontend/apps/h5/src/App.tsx`
- **描述**: App.tsx 只注册了 3 个路由 (`/`, `/capture`, `/analyzing/:taskId`)，缺少 `/question/:qid/result` 路由。P03 的 `onDone` handler 导航到 `/question/{qid}/result` 后，命中 catch-all `*` 规则被重定向回 `/`（首页），导致 DONE 事件后学生被踢回首页而非看到分析结果。
- **影响**: P03→P04 transition 完全不可达，SC-01 happy path 在步 7 断裂。
- **修复**: 添加 `<Route path="/question/:qid/result" element={<ResultPage />} />` + 导入 AnalyzingPage 替换 stub + 添加 `/wrongbook` 和 `/manual-entry` stub 路由。
- **修复 commit**: `cb9190c`

## Bug 2: App.tsx 使用 AnalyzingStub 而非真实 AnalyzingPage

- **文件**: `frontend/apps/h5/src/App.tsx`
- **描述**: `/analyzing/:taskId` 路由使用了一个简单 stub div 而非已实现的 `AnalyzingPage` 组件，导致 SSE 流水线、模型 fallback、取消等功能在路由层面不可用。
- **影响**: 所有 P03 相关 E2E 测试（T03、T04）无法在路由集成下工作。
- **修复 commit**: `cb9190c`
