# adversarial.md · SC01-MP-T03 · P03 Analyzing · attempt-1

## Round 1 · REJECT · statusText init 状态值错误

**发现**: `frontend/apps/mp/pages/analyzing/index.ts:67` — `data.statusText` 初始化为 `'AI 正在分析…'`，但 spec-trace.md 状态机表明 `init` 状态应显示 `'准备分析…'`。

| 项目 | 详情 |
|---|---|
| 文件 | `pages/analyzing/index.ts:67` |
| 期望 | `statusText: '准备分析…'` (init 态 per spec-trace.md) |
| 实际 | `statusText: 'AI 正在分析…'` (analyzing 态文案) |
| 严重性 | Medium — 状态机与 spec 不一致，init 态显示错误文案 |
| 复现 | 代码审查: `grep "statusText" pages/analyzing/index.ts` |

**影响**: 当页面无 `imageUrl` 参数加载时（demo 模式虽会立即切 analyzing，但 init 数据语义不正确），或未来真实 init 态停留时间较长时用户看到错误文案。

**要求**: 将 `statusText` 初始值改为 `'准备分析…'`，与 spec-trace.md 状态机对齐。

---

## Round 2 · FIX 确认 · statusText 已修复

**修复**: `index.ts:67` `statusText: '准备分析…'` — 已与 spec-trace.md init 状态对齐。

**验证**:
1. `grep "准备分析" pages/analyzing/index.ts` → 命中 line 67 ✅
2. `pnpm -F mp typecheck` → tsc --noEmit 0 errors ✅
3. spec-trace.md 状态机 init 行: "准备分析…" ↔ 代码 data.statusText 一致 ✅

**结论**: Bug 已修复，状态机初始值与 spec 对齐。

---

## 附注 · 非阻塞性视觉差异（PHASE-C 人工视觉验收可接受）

以下差异存在于 mockup HTML vs WXML 实现中，属于 MP 平台限制或 PHASE-C 简化范围内的合理 tradeoff，不构成 REJECT：

1. **JSON 终端无语法高亮**: mockup 用 `.k/.v/.n/.b` class 给 JSON 着色，MP 版 `{{ streamOutput }}` 为纯文本。MP 中实现 rich-text 着色需 `<rich-text>` 或多 `<text>` 拼接，复杂度高，PHASE-C 可接受。
2. **无光标闪烁动画**: mockup 有 `.cur` 元素 + `@keyframes b` 闪烁，MP 版缺失。可用 `<view>` + CSS animation 补充，非阻塞。
3. **返回箭头为 `<` 文本**: mockup 用 SVG path chevron，MP 用 `<text>&lt;</text>`。视觉近似，PHASE-C 可接受。
4. **`.thumb-pen` 缺 `font-family: cursive`**: mockup 用 cursive 字体，WXSS 未声明。微小差异，PHASE-C 可接受。
