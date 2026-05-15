# bugs-found.md · SC01-MP-T04 · attempt-1

## Bug 1: wave-1 合并遗漏 — API 模块缺少 export 导致 tsc 失败

- **文件**: `frontend/apps/mp/src/api/ai.ts` · `wrongbook.ts` · `review.ts`
- **描述**: wave-1 merge 后 3 个 API 模块缺少被 page 代码 import 的函数 export (`startAnalyze`, `pollAnalyzeStatus`, `createQuestion`, `getNode`, `revealNode`, `gradeNode`)，导致 `pnpm -F mp typecheck` 报 7 个 TS2305 错误
- **修复**: 补充所有缺失的 export 函数 + 类型定义，对齐 _http.ts 的 httpJSON 调用约定
- **commit**: `39bdc90`
