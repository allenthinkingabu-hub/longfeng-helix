# SC01-T09 Bugs Found · team-1 · attempt-2

## 本轮发现并修复的 Bug

### Bug 1: E2E 测试指向错误的 dev server
- **文件**: `frontend/apps/h5/playwright.config.ts`
- **描述**: Playwright config 默认 baseURL `http://localhost:5174` 指向 main 分支的 vite dev server，而非本 worktree 的 dev server。导致 E2E 测试在 attempt-2 re-run 时 10/10 FAIL（页面只渲染 stub `<h2>首页</h2>`）。
- **修复方式**: 使用 `PLAYWRIGHT_BASE_URL=http://localhost:5195` 环境变量指向本 worktree 的 vite dev server (port 5195)。
- **影响**: 不需要代码变更，仅运行时环境配置。

### Bug 2 (attempt-1 audit compliance): work_log 三件套未落盘 team-1 目录
- **文件**: `audits/runs/SC01-T09/team-1/attempt-1/coder.md` (缺失)
- **描述**: attempt-1 的 coder.md + bugs-found.md 只写入了 `team-3/attempt-1/` 目录，`team-1/attempt-1/` 缺失，导致 audit.js `coder_compliance` 维度 FAIL。
- **修复**: attempt-2 在正确的 `team-1/attempt-2/` 目录写入完整 coder.md + bugs-found.md。
- **Commit**: 本 attempt-2 commit (待提交)

**总计: 2 bugs (1 环境 + 1 compliance)**
