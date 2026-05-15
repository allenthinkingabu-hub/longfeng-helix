# Bugs Found · SC01-T11 · P08 揭示答案 · attempt-3

> 本 attempt 的 REDO 原因是 coder.md + bugs-found.md 未落盘，非代码 bug。以下为本 task 全部已发现并修复的 bug（与 attempt-1 相同，代码未变更）。

## Bug 1: CSS/DOM 未对齐 mockup (视觉偏差)

- **文件**: `frontend/apps/h5/src/pages/ReviewExec/ReviewExec.module.css` + `index.tsx`
- **描述**: 已有实现使用 Tailwind 色板 (#dc2626, #fef2f2, #10b981 等) 和简化 DOM 结构, 与 mockup 08_review_exec.html 的 iOS 系统颜色 (#FF3B30, rgba(255,59,48,0.12), #34C759 等) 和丰富 DOM 层级严重不一致
- **修复**: commit `dcba9ca`

## Bug 2: Playwright viewport 被 Desktop Chrome 覆盖

- **文件**: `frontend/apps/h5/playwright.config.ts`
- **描述**: `devices['Desktop Chrome']` 的 spread 覆盖了顶层 `viewport: { width: 390, height: 844 }`, 导致 E2E 以 1280×720 桌面分辨率运行
- **修复**: commit `dcba9ca`

## Bug 3: CSS Module 类型声明缺失

- **文件**: 新增 `frontend/apps/h5/src/vite-env.d.ts`
- **描述**: TypeScript 编译报错 `Cannot find module './ReviewExec.module.css'`
- **修复**: commit `dcba9ca`
