# bugs-found.md · SC01-MP-T03 · attempt-3

## Bug 列表 (inherited from attempt-1, no new bugs in attempt-3)

### Bug 1: _http.ts block comment 被 `*/` 提前截断

- **文件**: `frontend/apps/mp/src/api/_http.ts:6`
- **描述**: 注释中 `pages/*/index.ts` 包含 `*/` 字符序列，提前终止了 `/** ... */` block comment，导致后续注释文本被解析为代码，tsc 报 TS1005/TS1434/TS1127 语法错误
- **修复**: 将 `api/*.ts` 改为 `api/ 下`, `pages/*/index.ts` 改为 `pages/xxx/index.ts`，避免 `*/` 出现在 block comment 内
- **Commit**: 84c5db6

### Bug 2: typings/index.d.ts 缺少 Node 全局类型声明

- **文件**: `frontend/apps/mp/typings/index.d.ts`
- **描述**: tsconfig.json `"types": ["miniprogram-api-typings"]` 只有小程序类型，`_http.ts` vitest 路径使用的 `process`、`fetch`、`AbortController` 无类型定义，tsc 报 TS2591/TS2552/TS2304
- **修复**: 在 `typings/index.d.ts` 补充 `process`、`fetch`、`AbortController`、`setTimeout`/`setInterval` 等全局声明
- **Commit**: 84c5db6

## attempt-3 新增 bug

无新增 bug。attempt-3 仅修复 audit 合规问题 (补齐 work_log 文件到正确目录)。
