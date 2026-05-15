# adversarial.md · SC01-MP-T03 · P03 Analyzing · attempt-3

## Round 1 · REJECT · statusText init 状态值错误

**发现**: `frontend/apps/mp/pages/analyzing/index.ts:67` — `data.statusText` 初始化为 `'AI 正在分析…'`，但 spec-trace.md 状态机表明 `init` 状态应显示 `'准备分析…'`。

| 项目 | 详情 |
|---|---|
| 文件 | `pages/analyzing/index.ts:67` |
| 期望 | `statusText: '准备分析…'` (init 态 per spec-trace.md) |
| 实际 | `statusText: 'AI 正在分析…'` (analyzing 态文案) |
| 严重性 | Medium |
| 复现 | `grep "statusText" pages/analyzing/index.ts` |

## Round 2 · FIX 确认

**修复**: commit `9be5534` — `statusText: '准备分析…'`
**验证**: `grep "准备分析" pages/analyzing/index.ts` → line 67 ✅ · tsc 0 errors ✅

## Round 3 · 探索性对抗测试 (Exploratory Adversarial)

### 3.1 DOM 注入 / 超长数据边界

- `streamOutput` 通过 `{{ streamOutput }}` 绑定 WXML `<text>`，小程序框架自动转义 → **无 DOM 注入风险** ✅
- `JSON.stringify(resp.result, null, 2)` 处理超长 JSON → WXSS `white-space: pre-wrap; word-break: break-word` 防破版 ✅
- 超长 taskId 拼入 URL path → 后端生成固定格式, 低风险 ✅

### 3.2 连点防抖 / race condition

- `onCancelTap` / `onBackTap` 多次连点 → `wx.navigateBack()` 框架内置节流 ✅
- `_startAnalysis` 无防抖但 `onLoad` 仅触发一次 → 无并发分析 race ✅
- `_pollTimer` clearInterval 确保无泄漏 ✅

### 3.3 阻断 API / 网络异常

- `_startAnalysis` catch → error 状态 + banner 正确 ✅
- `_pollOnce` catch → 静默继续 polling (设计合理, 网络抖动不中断) ✅
- `_pollCount > 60` 超时保护 → error 状态 ✅

**结论**: 探索性对抗未发现阻塞性问题。
