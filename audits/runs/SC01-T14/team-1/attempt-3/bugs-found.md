# SC01-T14 · Bugs Found · attempt-3

## Bug 1 · P09 handleEnd hard navigation

- **文件**: `frontend/apps/h5/src/pages/ReviewDone/index.tsx`
- **描述**: P09 `handleEnd` 使用 `window.location.href = '/'` 触发完整页面刷新，导致 React 状态全部丢失、transition 时间超过 500ms 预算、无法触发 P-HOME 的 N→N-1 数字动画。
- **修复**: 改为 `useNavigate()` + `navigate('/')` 实现 SPA 内软导航
- **commit**: `5accb29`

## Bug 2 · Router 缺失 review 路由

- **文件**: `frontend/apps/h5/src/App.tsx`
- **描述**: ReviewExecPage 和 ReviewDonePage 组件已存在但未注册路由。E2E 测试导航到 `/review/done` 或 `/review/exec/1` 会 fallback 到首页 (catch-all `*`)。
- **修复**: 添加 `Route path="/review/exec/:nid"` 和 `Route path="/review/done"` 路由
- **commit**: `5accb29`

**共发现 2 个 bug，均已修复。**
