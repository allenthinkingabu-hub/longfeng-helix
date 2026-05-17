# SC-11-T02 · Bugs Found · attempt-1

## Bug #1 · Vite SPA fallback 导致 `<picture><source webp>` 误判可用 → onError 卡死无 PNG fallback

- **文件**: `frontend/apps/h5/src/pages/Landing/HeroDemo/index.tsx`
- **发现路径**: attempt-1 spec (a) `hero_renders_default` 一开始失败 → 调查发现 Playwright 把 `<picture>` 渲染成 poster fallback 状态，不是预期的 happy path
- **根因**: Vite dev server (HMR + SPA shell) 对未匹配的资源路径 (`/landing/hero.webp` · 我们故意不生成 webp · 因为 sandbox 无 cwebp) 返回 `200 text/html` (index.html)，**不是 404**。 `<picture>` 元素看到 200 → 把 HTML 字节当成 webp 加载 → 解码失败 → 触发 `<img onError>` (Chrome 行为: 同 `<picture>` 内挑一个 source 失败不重试 `<img src>`)。
- **修复**: 默认不渲染 `<source webp>`，prop `webpSrc` 改默认 `''` (empty)，仅当显式传入有效 URL 时才挂 source。同时改 `loading='lazy'` → `loading='eager'` (hero 是 LCP-critical · 首屏不能 lazy)。
- **修复 commit**: `23ccef3` (第一次提交即修 · 在 spec 跑通前的 inner-loop 内修复了)
- **回归证据**: spec (a) 5/5 PASS · poster 仅在 (b) deliberately-404 注入时显示

## Bug #2 · 30s 上报埋点未 cleanup → unmount 后仍触发 (潜在内存泄漏)

- **文件**: `frontend/apps/h5/src/pages/Landing/HeroDemo/index.tsx` useEffect
- **发现路径**: 实现 setTimeout 时主动想到这个隐患 (Rule 9 Tests verify intent · 写测试前自检) · 否则用户快速从 Landing 跳走再返回 · 30s 后旧 timer 仍上报埋点
- **根因**: setTimeout 不 cleanup
- **修复**: useEffect return 函数 `clearTimeout(timer)` · 同时 useRef `reportedRef` 标记 · 防 React.StrictMode 双 invoke + 防 re-mount 重复上报
- **回归证据**: spec (e) `demo_play_telemetry` 验证 fastForward 30s 上报 1 次 · 再 fastForward 60s 仍 1 次 · 不重复 (reportedRef guard)
- **修复 commit**: `23ccef3`

## Bug #3 · prefers-reduced-motion 用户被强制看动画 (WCAG 2.3.3 违规)

- **文件**: `frontend/apps/h5/src/pages/Landing/ThreeStepComic/index.module.css`
- **发现路径**: 探索性测试维度 · 用户启动 brief 明确点出 "prefers-reduced-motion · 三步漫画 fadeIn 应该尊重该 preference"
- **根因**: 纯 CSS @keyframes 默认对所有用户启用 · 没有 reduced-motion fallback
- **修复**: `@media (prefers-reduced-motion: reduce) { .step { opacity: 1; animation: none; } }`
- **回归证据**: `t02-evidence-capture.spec.ts` 截图 `04_reduced_motion_instant_visible.png` + console.log `reduced-motion step1 opacity: 1` (emulateMedia 后 · animation off · opacity 立即 1)
- **修复 commit**: `23ccef3`

## 显式声明

本轮共发现 **3 个真 bug**，全部修复并落入 attempt-1 commit `23ccef3` (单 commit 因为均在 inner-loop 修 · 在 spec 跑过前就修完了)。`git cat-file -e 23ccef3` 可验真。
