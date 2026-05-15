# Bugs Found · SC01-T11 · P08 揭示答案

## Bug 1: CSS/DOM 未对齐 mockup (视觉偏差)

- **文件**: `frontend/apps/h5/src/pages/ReviewExec/ReviewExec.module.css` + `index.tsx`
- **描述**: 已有实现使用 Tailwind 色板 (#dc2626, #fef2f2, #10b981 等) 和简化 DOM 结构, 与 mockup 08_review_exec.html 的 iOS 系统颜色 (#FF3B30, rgba(255,59,48,0.12), #34C759 等) 和丰富 DOM 层级严重不一致。Grade buttons 缺少图标圆 (.ri) + 副标题 (.rs), reveal card 缺少结构化 answer box (.ans > .ansK + .ansV), memory curve 用错了布局模式。
- **修复**: commit `dcba9ca` — 全量重写 CSS 颜色 + DOM 结构 1:1 mirror mockup

## Bug 2: Playwright viewport 被 Desktop Chrome 覆盖

- **文件**: `frontend/apps/h5/playwright.config.ts`
- **描述**: `devices['Desktop Chrome']` 的 spread 覆盖了顶层 `viewport: { width: 390, height: 844 }`, 导致 E2E 以 1280×720 桌面分辨率运行, 与移动端 mockup 不匹配。
- **修复**: commit `dcba9ca` — 在 project use 块显式设置 `viewport: { width: 393, height: 852 }` 覆盖 Desktop Chrome 默认值

## Bug 3: CSS Module 类型声明缺失

- **文件**: 新增 `frontend/apps/h5/src/vite-env.d.ts`
- **描述**: TypeScript 编译报错 `Cannot find module './ReviewExec.module.css'`, 缺少 CSS module 的 .d.ts 类型声明。
- **修复**: commit `dcba9ca` — 新增 vite-env.d.ts with `declare module '*.module.css'`
