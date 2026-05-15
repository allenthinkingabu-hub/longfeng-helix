# bugs-found.md · SC01-MP-T03 · attempt-3

## Bug 列表

### Bug 1: _http.ts block comment 被 `*/` 提前截断
- **文件**: `frontend/apps/mp/src/api/_http.ts:6`
- **描述**: 注释中 `pages/*/index.ts` 包含 `*/` 字符序列，提前终止了 block comment
- **修复**: 将 `api/*.ts` 改为 `api/ 下`, `pages/*/index.ts` 改为 `pages/xxx/index.ts`
- **Commit**: 84c5db6

### Bug 2: typings/index.d.ts 缺少 Node 全局类型声明
- **文件**: `frontend/apps/mp/typings/index.d.ts`
- **描述**: `_http.ts` vitest 路径使用的 `process`、`fetch`、`AbortController` 无类型定义
- **修复**: 补充 `process`、`fetch`、`AbortController`、`setTimeout`/`setInterval` 等全局声明
- **Commit**: 84c5db6

### Bug 3: statusText 初始值与 spec-trace 状态机不一致
- **文件**: `frontend/apps/mp/pages/analyzing/index.ts:67`
- **描述**: `data.statusText` 初始化为 `'AI 正在分析…'`，但 spec-trace.md 状态机 init 态应为 `'准备分析…'`
- **修复**: 将 statusText 初始值改为 `'准备分析…'`
- **Commit**: 9be5534
