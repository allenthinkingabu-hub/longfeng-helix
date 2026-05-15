# Bugs Found · SC01-T03 · attempt-1

## Bug 1: P03 React 暗色主题与 mockup 浅色主题完全不匹配
- **文件**: `frontend/apps/h5/src/pages/Analyzing/Analyzing.module.css` + `index.tsx`
- **描述**: 原实现使用 Mood C 暗色主题 (dark gradient #1A1A2E→#0F0F23)，mockup HTML 使用浅色 iOS 主题 (#F2F2F7 bg + #FFFFFF cards)。DOM 结构也有显著差异：缺少 nav bar、preview card 细节、model badge green dot、stages 卡片描述、terminal header dots、tab bar。
- **修复**: 完全重写 CSS (293 行) + JSX 结构以 1:1 匹配 mockup。
- **Commit**: cc74088

## Bug 2: E2E 测试连接到错误的 dev server
- **文件**: E2E test configuration
- **描述**: 端口 5174 上的 Vite dev server 来自其他 worktree，该 worktree 没有 /analyzing/:taskId 路由，导致所有测试页面空白。
- **修复**: 在本 worktree 启动独立 dev server (port 5182)，使用 PLAYWRIGHT_BASE_URL=http://localhost:5182 运行测试。
- **Commit**: (runtime fix, no code change needed)
