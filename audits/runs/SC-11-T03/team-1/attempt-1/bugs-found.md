# SC-11-T03 · bugs found · attempt-1

本轮在编码 + adversarial spec 开发过程中发现并修复的 bug 记录。

## Bug #1 · adversarial (d) chip_double_tap 测试假设错误

**现象**: 初版 adversarial spec (d) 用 `Promise.all([chip.click(), chip.click()])` 模拟极速双击 · 期望产生 1 个浮层 · 实际测试 fail 因为 `overlayRoot` 找不到 (count 0)。

**根因**: Playwright 的 `chip.click()` 是 actionability-aware · 第一次 click 后浮层立刻覆盖了 chip (mask 全屏覆盖)。第二次 click 在 Playwright 看来还是要点 chip · 但 chip 已被 mask 遮挡 → Playwright 等待 → 这期间 mask 被 hit → close · 最终 overlay 不可见。**这是测试期望与真实交互模型的 alignment failure**。

**正确假设**: 同一 JS microtask 内连发 2 次 `chip.click()` (浏览器层) · React 18 自动 batch · `setOpenSample` 合并 · 浮层 DOM 数恰 1。

**修复**: 改用 `page.evaluate(() => { chip.click(); chip.click(); })` · 在浏览器同一 task 内连发两次 DOM click 事件 (不是 React 状态注入 · 是真 DOM click event · 符合 test-agent.md 铁律 1 "100% 模拟真实人类")。

**修复 commit**: 包含在 `f940c82` test commit · file: `frontend/apps/h5/tests/e2e/sc-11/t03-landing-sample-chips-adversarial.spec.ts` L116-138。

**回归验证**: 修复后 9/9 PASS · double_tap test 681ms 内验证 `count === 1`。

---

## Bug #2 · evidence-capture spec 路径相对级数偏差 1

**现象**: 初版 t03-evidence-capture.spec.ts 用 `'../../../../../audits/...'` (5 levels up) · 期望落到仓库根 `audits/runs/SC-11-T03/...` · 实际落到 `frontend/audits/runs/SC-11-T03/...` (多了一层 `frontend`)。SC-11-T02 evidence-capture 同样 bug · T02 通过手动 cp 绕过。

**根因**: HERE = `frontend/apps/h5/tests/e2e/sc-11/` · 6 levels up 才到仓库根 (sc-11 → e2e → tests → h5 → apps → frontend → repo)。

**修复**: spec 改 `'../../../../../../audits/...'` (6 levels) · 落盘路径正确指向 `audits/runs/SC-11-T03/team-1/attempt-1/test-reports/`。

**修复 commit**: 即将随 work_log 落盘提交 (commit 3) · 同时清理误产生的 `frontend/audits/runs/SC-11-T03/` 目录。

**回归验证**: 1/1 PASS · `cat audits/runs/SC-11-T03/team-1/attempt-1/test-reports/ide-console.txt` 验证 5 行 (0 [error])。

---

总计 **2 bug found · 2 fixed** · 0 outstanding · 全部在 attempt-1 内消化。
