# bugs-found.md · SC01-MP-T01 · attempt-3

## Bug 1 · _http.ts block comment 被 `*/` 截断

- **文件**: `frontend/apps/mp/src/api/_http.ts` line 6
- **描述**: JSDoc 注释中 `pages/*/index.ts` 包含 `*/` 字符序列，导致 block comment 提前关闭，后续文本被解析为代码，tsc 报 TS1005 等 6 个错误
- **修复**: 将 `pages/*/index.ts` 改写为 `pages/ 下 index.ts`，避免 `*/` 出现在注释内
- **commit**: df8188e

## Bug 2 · typings 缺少 Node runtime 类型

- **文件**: `frontend/apps/mp/typings/index.d.ts`
- **描述**: tsconfig types 仅含 `miniprogram-api-typings`，`_http.ts` 的 fetch fallback path 使用 `process.env` / `fetch` / `AbortController`，这些在 ES2017 target 下无类型定义
- **修复**: 在 `typings/index.d.ts` 追加 `process` / `fetch` / `AbortController` / `Response` 类型声明
- **commit**: df8188e

## Bug 3 · flash icon 三元表达式空操作

- **文件**: `frontend/apps/mp/pages/capture/index.wxml`
- **描述**: Tester 发现闪光灯图标的三元运算符条件分支不切换图标，始终渲染同一图标
- **修复**: 修正三元表达式，auto/off 两态正确映射不同 icon
- **commit**: dfb88c8

## Bug 4 · tab4 icon 与 mockup 不一致

- **文件**: `frontend/apps/mp/pages/capture/index.wxml`
- **描述**: Tester 发现底部 tabbar 第 4 个 icon 与 mockup 设计稿有视觉偏差
- **修复**: 对齐 mockup 真相，更正 icon 引用
- **commit**: dfb88c8
