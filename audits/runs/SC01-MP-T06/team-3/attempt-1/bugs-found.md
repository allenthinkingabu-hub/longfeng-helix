# bugs-found.md · SC01-MP-T06 · attempt-1

## Bug 1: review.ts API 函数参数类型不兼容 MP 页面

- **文件**: `frontend/apps/mp/src/api/review.ts`
- **描述**: 新增的 `revealNode()` / `gradeNode()` 等函数参数类型为 `number`，但 `pages/review-exec/index.ts` 从路由参数取 nid 为 `string` 类型，导致 tsc 报 TS2345
- **修复**: 将 `getNode`/`openNode`/`revealNode`/`gradeNode`/`nodeResult` 的 nid 参数类型改为 `number | string`（后端 Spring MVC PathVariable Long 自动做 coercion）
- **Commit**: 见下方提交

## Bug 2: 原 review.ts 缺失 7/8 个 SC-01-C05 端点函数

- **文件**: `frontend/apps/mp/src/api/review.ts`
- **描述**: wave-1 T11/T13 只实现了 `completeSession` 一个函数（且该端点不在 Controller 的 8 个 SC-01-C05 中），其余 createSession/getToday/getNode/openNode/revealNode/gradeNode/nextInSession/nodeResult 全部缺失
- **修复**: 补齐全部 8 个函数 + 类型定义，1:1 对齐 ReviewPlanController.java
- **Commit**: 见下方提交
