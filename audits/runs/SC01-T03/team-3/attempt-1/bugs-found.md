# bugs-found.md · SC01-T03 · team-3 · attempt-1

## Bug 列表

### Bug 1: E2E happy path race — SSE 处理太快导致 nav 前 assertion 失败
- **文件**: `frontend/apps/h5/tests/e2e/sc-01/t03-ai-stream-pipeline.spec.ts`
- **描述**: Playwright route.fulfill 一次性返回全部 SSE 帧，hook 同步处理后 200ms 内 nav 到 P04，测试来不及断言中间状态
- **修复**: 使用 Promise gate 阻塞 SSE 响应，先截图 IDLE 态再释放 gate；中间态 (uploading) 截图移到 a11y 测试 (hangStream 模式)
- **Commit**: 见下方第二个 commit

### Bug 2: FAIL 测试中 p03-root visibility check 在 page 已 nav 后执行
- **文件**: `frontend/apps/h5/tests/e2e/sc-01/t03-ai-stream-pipeline.spec.ts`
- **描述**: setupP03 内等待 p03-root visible，但 2x FAIL 后 page 已 nav 到 /manual-entry，p03-root 不在 DOM
- **修复**: FAIL 测试不使用 setupP03，直接 inline setup + 只等待 /manual-entry URL
- **Commit**: 见下方第二个 commit

### Bug 3: pnpm workspace 基础设施缺失
- **文件**: `frontend/` (多个)
- **描述**: `@longfeng/*` workspace 包缺少 package.json，pnpm install 无法解析 workspace:* 依赖
- **修复**: 创建 pnpm-workspace.yaml + 各包 package.json + stub clients
- **Commit**: 见下方第二个 commit

共发现 3 个 bug，均已修复。
