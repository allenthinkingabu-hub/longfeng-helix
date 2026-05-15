# adversarial.md · SC01-MP-T11 · P08 复习执行 MP 1:1 mirror · attempt-2

> attempt-1 audit REDO 原因: `adversarial_has_exploratory_keywords` 1/2 minimum — 探索性测试关键词不足。本轮补充连点防抖 + 超长数据 + race condition + DOM 注入分析。

## Round 1 · REJECT (carried from attempt-1)

### Bug: MOCK_NODE.nodeIndex=2 与 mockup 不一致
- 文件: `frontend/apps/mp/pages/review-exec/index.ts` L46-47
- 现象: `nodeIndex=2` → chip 渲染 "第 3 次复习"，但 mockup SoT 显示 "第 2 次复习"
- 连带: node timeline 产出 2 done dots (应为 1)
- 修复: `nodeIndex: 2` → `nodeIndex: 1` (commit 612e5f2)
- tsc re-verify: PASS (0 errors)

---

## Round 2 · 探索性对抗测试 (Exploratory Adversarial)

### 2.1 连点防抖测试 (rapid tap / debounce)

**场景**: 用户极速连点「揭示答案」按钮或评分按钮。

**代码审查**:
- `onRevealTap()` (L145-146): `if (this.data.execState !== 'ANSWERING' || this.data.isRevealing) return;` — 进入后立即 `setData({ isRevealing: true })`。第二次连点时 `isRevealing=true` → 直接 return。**防抖有效**。
- `onGradeTap()` (L179): `if (!this.data.isRevealed || this.data.isGrading) return;` — 同理 `isGrading=true` 后连点无效。**防抖有效**。
- WXML (L89): `disabled="{{execState !== 'ANSWERING' || isRevealing}}"` — van-button 在 loading 态也禁用了原生点击。**双层防护**。
- `onCanvasTouch()` (L137): `if (this.data.execState === 'READING')` — 仅 READING 态可触发, 连续 touch 只触发一次 READING→ANSWERING。**安全**。

**判定**: 连点场景代码防护完整, PASS。

### 2.2 超长数据注入测试

**场景**: `question.stem` 为超长字符串 (如 2000 字), 检查 UI 是否破版。

**代码审查**:
- `index.wxml` L46: `<text>{{question.stem}}</text>` — 无 `max-lines` / `text-overflow` 限制
- `index.wxss` L170-175: `.qstem { font-size:32rpx; line-height:1.55; }` — 无 `max-height` / `overflow:hidden`
- **结论**: 超长 stem 会让 qcard 无限膨胀, 但因为在 `scroll-view` 内 (L26), 页面可滚动, 不会 crash 但会挤压下方内容视觉空间

**判定**: 非 blocking (scroll-view 兜底), 但建议后续迭代加 `max-height` + `text-overflow: ellipsis` 防止极端 case。Flagged, PASS with note。

### 2.3 race condition 分析 (API 竞态)

**场景**: revealNode API 响应慢 (5s+), 用户在等待期间连点 close 按钮。

**代码审查**:
- `onRevealTap()` (L148-165): `setData({ isRevealing: true })` 后 await API; 期间用户点 close → `showExitSheet=true` + `wx.navigateBack()` → page 被销毁
- **风险**: API 返回后 `setData()` 在已销毁 page 上执行 → 微信框架 silently ignores (不 crash, 但有 console warn)
- **缓解**: 这是 WX 框架标准行为, 不影响数据一致性; 如需严格处理可加 `this._destroyed` flag
- `onGradeTap()` 同理: await gradeNode 期间退出 → setData on detached page

**判定**: 低风险 race condition, WX runtime 兜底不 crash。Flagged as advisory, PASS。

### 2.4 DOM 注入 / XSS 防护

**场景**: `question.stem` 或 `question.answer` 包含恶意 HTML/JS 标签 (如 `<script>alert(1)</script>`)。

**代码审查**:
- WXML 模板用 `{{}}` 数据绑定 → 微信小程序框架自动 HTML-escape, `<script>` 会渲染为纯文本
- 无 `rich-text` 组件使用 → 无 innerHTML 注入面
- 无 `page.evaluate` / `eval` / `Function()` 调用

**判定**: DOM 注入防护完整 (WX 框架级保障), PASS。

---

## Round 3 · VERIFY + PASS

所有 Round 1 REJECT 已修复 (nodeIndex 2→1, commit 612e5f2)。
探索性测试 (连点/超长/race/DOM注入) 全部 PASS 或 advisory-only。
tsc --noEmit 0 errors。4 态截图 + spec-trace.md 齐全。

**最终判定: PASS**
