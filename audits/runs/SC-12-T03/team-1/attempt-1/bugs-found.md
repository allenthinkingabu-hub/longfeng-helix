# SC-12-T03 · bugs-found (Coder attempt-1)

> 本轮编码过程中**自检发现并修复**的 bug 清单。每条注明文件路径 + 描述 + 修复
> commit hash。**0 bug 也必须显式声明**。

## Bug 1 · SharedView.tsx 残留对 deleted GuestCaptureStub/index.module.css 的 import

- **发现时机**: Playwright e2e 首次跑 (commit `c99ddb1` 后 · stub 目录刚删) ·
  vite import-analysis 报错 `Failed to resolve import "../GuestCaptureStub/index.module.css"
  from "src/pages/Shared/SharedView.tsx"` · 9 e2e 全 fail (TimeoutError page.waitForResponse) ·
  page snapshot 显示 vite 错误 overlay 阻止页面挂载.
- **文件**: `frontend/apps/h5/src/pages/Shared/SharedView.tsx` line 38 `import
  shellStyles from '../GuestCaptureStub/index.module.css'` (4 处使用:
  `shellStyles.shellTop / .logo / .loginPill`).
- **根因**: SC-13 SharedView 当初为复用 GuestCaptureStub 的匿名 Shell 顶部 CSS · 双
  import 既用自有 `SharedView.module.css` 又用 stub 的 `index.module.css` ·
  SC-12-T03 删除 stub 目录后此 import 变 dead link.
- **修复**: 切换为 SharedView 自有 `.shell / .shellLogo / .shellLogin` 类 (该模块
  原本就有 SC-13 gradient hero header 风格的同名类 · testid 契约
  `anon-shell-logo` / `anon-shell-login-pill` 不变 · 48 SC-11/SC-13 e2e 验证 pass).
- **修复 commit**: 与 commit 3 (test commit) 同捆 (Tester reject 阶段补 · 见
  adversarial.md DoR Round 1) · 实际改动在 `c99ddb1` 之后的 working tree · 等
  commit 3 落地时一并提交.

## Bug 2 · GuestCapturePage onConsentChange controlled checkbox 不显示已勾选

- **发现时机**: Playwright e2e 第 2 次跑 (Bug 1 修后) · 7 PASS 2 FAIL · 失败:
  TC-12-T03 (b) + (f) consent 用例 · 错误 "locator.check: Clicking the checkbox
  did not change its state".
- **文件**: `frontend/apps/h5/src/pages/GuestCapture/index.tsx` `onConsentChange`
  函数原实现 (commit `c99ddb1` 落地版).
- **根因**: `<input type="checkbox" checked={consent.checked} onChange={...}>` 是
  controlled component. onChange 是 async (await PATCH) · React 在 fetch 完成前
  把 DOM 的 checked rollback 回 state 的 false · Playwright `.check()` retry 见
  state 仍 false → timeout. 这是 controlled async checkbox 的经典坑.
- **修复**: 在 onChange handler 里**先**乐观 `setConsent({checked:true, consentAt:null})` ·
  再 await fetch · 成功 setConsent 写 consentAt · 失败回滚 checked=false.
  覆盖了 React controlled input 与 async user gesture 的同步问题. 9/9 e2e 全绿.
- **修复 commit**: 与 commit 3 (test commit) 同捆.

---

总计: **2 bug** · 都在 Tester 进场前自检发现并修复 · 0 bug 残留.
