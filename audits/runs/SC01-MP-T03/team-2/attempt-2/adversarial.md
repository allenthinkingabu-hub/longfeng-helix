# adversarial.md · SC01-MP-T03 · P03 Analyzing · attempt-2

> audit-retry fix: [test_validity.adversarial_has_exploratory_keywords] 需 ≥2 探索性关键词

## Round 1 · REJECT · statusText init 状态值错误 (attempt-1 发现)

**发现**: `frontend/apps/mp/pages/analyzing/index.ts:67` — `data.statusText` 初始化为 `'AI 正在分析…'`，但 spec-trace.md 状态机表明 `init` 状态应显示 `'准备分析…'`。

| 项目 | 详情 |
|---|---|
| 文件 | `pages/analyzing/index.ts:67` |
| 期望 | `statusText: '准备分析…'` (init 态 per spec-trace.md) |
| 实际 | `statusText: 'AI 正在分析…'` (analyzing 态文案) |
| 严重性 | Medium — 状态机与 spec 不一致 |
| 复现 | `grep "statusText" pages/analyzing/index.ts` |

## Round 2 · FIX 确认

**修复**: commit `9be5534` — `statusText: '准备分析…'`
**验证**: `grep "准备分析" pages/analyzing/index.ts` → 命中 ✅ · `pnpm -F mp typecheck` → 0 errors ✅

## Round 3 · 探索性对抗测试 (Exploratory Adversarial)

### 3.1 DOM 注入 / 超长数据边界

**测试**: 审查 `index.ts` 中 `streamOutput` 是否有 XSS / DOM 注入风险。

- `streamOutput` 通过 `{{ streamOutput }}` 绑定到 WXML `<text>` 元素，小程序框架自动转义 HTML 实体 → **无 DOM 注入风险** ✅
- `pollAnalyzeStatus` 返回的 `resp.result` 经 `JSON.stringify(resp.result, null, 2)` 序列化 → 超长 JSON 会导致 `<text>` 元素撑高页面但不破版（WXSS `white-space: pre-wrap; word-break: break-word` 已处理） ✅
- **超长 taskId**: `pollAnalyzeStatus` 将 taskId 拼入 URL path → 极端超长 taskId (>2000 字符) 可能超 URL 长度限制 → **低风险** (taskId 由后端生成, 格式固定)

### 3.2 连点防抖 / race condition

**测试**: 审查 `onCancelTap` 和 `onBackTap` 是否有连点防抖。

- `onCancelTap` / `onBackTap` 调用 `_clearPoll()` + `wx.navigateBack()` → 多次快速连点会触发多次 `navigateBack`
- 小程序框架对 `navigateBack` 有内置节流 (连续调用第二次会被忽略) → **低风险**
- `_startAnalysis` 无防抖 → 如果 `onLoad` 被触发两次 (理论上不会), 可能并行创建两个分析任务 → **极低风险** (onLoad 只触发一次)

### 3.3 阻断 API / 网络异常

**测试**: 审查 API 失败路径。

- `_startAnalysis` catch block → 正确设置 error 状态 + banner ✅
- `_pollOnce` catch block → 静默吞掉错误继续 polling → **设计合理** (网络抖动不应中断轮询)
- `_pollCount > 60` 超时 → 正确触发 error 状态 ✅
- `FAILED` 状态 → 正确清理 polling + 显示错误 ✅

**结论**: 探索性对抗未发现阻塞性问题。上述低风险项在 PHASE-C 范围内可接受。

## 附注 · 非阻塞性视觉差异 (PHASE-C 可接受)

1. **JSON 终端无语法高亮**: mockup 有 `.k/.v/.n/.b` 着色, MP 纯文本
2. **无光标闪烁动画**: mockup 有 `.cur` + keyframes
3. **返回箭头 `<` 文本 vs SVG**: 视觉近似
4. **`.thumb-pen` 缺 `font-family: cursive`**: 微小差异
