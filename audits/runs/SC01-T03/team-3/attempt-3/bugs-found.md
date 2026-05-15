# Bugs Found · SC01-T03 · attempt-3

## 0 bug

本 attempt-3 未发现新 bug。代码在 attempt-1/2 已完成并稳定，7/7 E2E 全绿。

### 历史修复 (attempt-1/2, 已合入)
1. **E2E dev server 端口冲突**: dev server 运行在其他 worktree (sc01-t11 port 5174)，本 worktree 需启独立 vite 实例 (port 5178)。通过 `PLAYWRIGHT_BASE_URL` 环境变量解决。非代码 bug，是环境配置问题。
