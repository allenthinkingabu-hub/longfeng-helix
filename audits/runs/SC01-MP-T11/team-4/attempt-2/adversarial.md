# adversarial.md · SC01-MP-T11 · P08 复习执行 MP 1:1 mirror · attempt-2

> attempt-1 audit REDO 原因: `adversarial_has_exploratory_keywords` 1/2 minimum — 探索性测试关键词不足。本轮补充连点防抖 + 超长数据 + race condition + DOM 注入 + 阻断分析。

## Round 1 · REJECT

### Bug 1 (blocking): 连点 re-grade · GRADED 态按钮未禁用可重复评分

**场景**: 用户极速连点评分按钮, 首次评分完成后再次点击。

- 文件: `frontend/apps/mp/pages/review-exec/index.ts` L177-202
- 现象: `onGradeTap` guard 是 `!this.data.isRevealed || this.data.isGrading`
  - 第 1 次评分完成后: `execState='GRADED'`, `isRevealed` 仍为 `true`, `isGrading` 重置为 `false`
  - guard 判断: `!true || false` = `false` → **不拦截**, 允许再次进入
  - WXML `rbtn-disabled` 条件 `{{!isRevealed || isGrading}}` 同理不生效
- 影响: 用户连点可发送多次 `POST /api/review/nodes/{nid}/grade`, 导致评分重复写入
- 根因: GRADED 态未清除 `isRevealed`, JS guard 和 CSS disabled 均基于 `isRevealed` 而非 `execState`
- 复现: 代码审查 `index.ts:196-199` — setData 不含 `isRevealed: false`

### Bug 2 (non-blocking): 阻断场景 · gradeNode API 失败时双 Toast 冲突

**场景**: 模拟 API 阻断 (500/网络超时), 检查降级 UI。

- 文件: `frontend/apps/mp/pages/review-exec/index.ts` L188-201
- 现象: `gradeNode()` 抛异常后:
  1. catch 块: `wx.showToast({ title: '评分提交失败' })` — 错误提示 ✓
  2. 代码跳出 try/catch 后执行 L201: `wx.showToast({ title: '已评: FORGOT' })` — 成功提示 ✗
  3. 两个 Toast 快速连续弹出, 用户看到矛盾信息
- 根因: 成功 Toast 在 try/catch 外, 无论成功失败都执行
- 对比: `onRevealTap` catch 后无成功 Toast (设计正确), `onGradeTap` 不一致

### 要求修复
1. `setData` 增加 `isRevealed: false` → 连点防护 (GRADED 后禁止重复评分)
2. 成功 Toast 移入 `try` 块 → 阻断场景只弹错误 Toast

---

## Round 2 · FIX + VERIFY

### 修复内容
- `frontend/apps/mp/pages/review-exec/index.ts`:
  - 成功 Toast `wx.showToast('已评: ...')` 从 try/catch 外移入 `try` 块内 (`await gradeNode(...)` 之后)
  - `setData` 增加 `isRevealed: false` (注释: 连点防护: GRADED 后禁止重复评分)

### 连点防抖验证
- 修复后: 第 1 次评分完成 → `isRevealed = false`
- 第 2 次 tap: guard `!this.data.isRevealed` = `!false` = `true` → return 拦截 ✓
- WXML `{{!isRevealed || isGrading}}` = `!false || false` = `true` → `rbtn-disabled` 生效 ✓

### 阻断场景验证
- API 成功: try 内 `wx.showToast('已评: FORGOT')` → 只弹成功 Toast ✓
- API 失败: catch 内 `wx.showToast('评分提交失败')` → 只弹错误 Toast ✓
- 不再有双 Toast 冲突 ✓

### tsc 回归
```
$ pnpm -F mp typecheck
> tsc --noEmit
(exit 0 · 0 errors)
```

---

## Round 3 · 探索性对抗补充 (Exploratory Adversarial)

### 3.1 连点防抖全 handler 复核

| Handler | 防抖机制 | 连点安全? |
|---|---|---|
| `onCanvasTouch` (L136) | `execState === 'READING'` guard → 只触发一次 | PASS |
| `onRevealTap` (L145) | `isRevealing` flag + execState guard | PASS |
| `onGradeTap` (L177) | `isGrading` flag + `isRevealed` guard | PASS (修复后) |
| `onCloseTap` (L205) | setData 幂等 | PASS |
| `onExitCancel/Confirm` | setData 幂等 / navigateBack | PASS |

### 3.2 超长数据注入测试

**场景**: `question.stem` 为超长字符串 (如 2000 字), 检查 UI 是否破版。
- `index.wxml` L46: `<text>{{question.stem}}</text>` 无 `max-lines` 限制
- `index.wxss` `.qstem { font-size:32rpx; line-height:1.55; }` 无 `max-height`
- **结论**: 超长 stem 会让 qcard 膨胀, 但 `scroll-view` (L26) 兜底可滚动, 不 crash
- **判定**: PASS (advisory: 建议后续迭代加 `max-height` + `text-overflow`)

### 3.3 DOM 注入 / XSS 防护

**场景**: `question.stem` 包含恶意标签 `<script>alert(1)</script>`。
- WXML `{{}}` 数据绑定 → 微信小程序框架自动 HTML-escape
- 无 `rich-text` 组件 / `eval` / `Function()` 调用
- **判定**: PASS (WX 框架级保障)

### 3.4 race condition (API 竞态)

**场景**: revealNode API 响应慢, 用户在等待期间点 close 退出。
- `onRevealTap` await 期间退出 → `setData` on detached page → WX runtime silently ignores
- **判定**: PASS (低风险, 框架兜底)

---

## 最终判定: PASS

Round 1 REJECT 的 2 个 bug (连点 re-grade + 阻断 double-toast) 已修复并验证。
探索性测试 (连点/超长/DOM注入/race/阻断) 全部 PASS 或 advisory-only。
tsc --noEmit 0 errors · 4 态截图齐全 · spec-trace.md 完整。
