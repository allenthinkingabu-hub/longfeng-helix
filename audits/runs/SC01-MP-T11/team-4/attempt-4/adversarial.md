# adversarial.md · SC01-MP-T11 · P08 复习执行 MP 1:1 mirror · attempt-4

## Round 1 · REJECT

### Bug: MOCK_NODE.nodeIndex 与 mockup 文本不一致
- 文件: `frontend/apps/mp/pages/review-exec/index.ts` L46-47
- 现象: nodeIndex 值导致 chip 渲染的复习次数与 mockup SoT 不匹配
- 修复: nodeIndex 校正 (commit 612e5f2)
- tsc re-verify: PASS

---

## Round 2 · 探索性对抗测试

### 连点防抖 (rapid tap / debounce)
- onRevealTap: `if (isRevealing) return` + setData isRevealing=true → 连点被挡
- onGradeTap: `if (isGrading) return` + setData isGrading=true → 连点被挡
- WXML: van-button disabled 绑定 → 双层防护
- **判定**: PASS

### 超长数据注入
- question.stem 无 max-lines 限制, 超长会膨胀 qcard
- 但 scroll-view 兜底可滚动, 不会导致页面 crash 或不可用
- **判定**: PASS (advisory: 建议后续加 text-overflow)

### race condition (API 竞态)
- revealNode API 响应慢时用户退出 → setData on detached page → WX runtime 静默忽略
- gradeNode 同理, 不影响数据一致性
- **判定**: PASS (low risk)

### DOM 注入 / XSS 防护
- WXML 数据绑定自动 HTML-escape, 恶意标签渲染为纯文本
- 无 rich-text 组件, 无 eval/Function, 无注入面
- **判定**: PASS

---

## Round 3 · 最终验证

Round 1 REJECT 已修复 (commit 612e5f2)。
探索性对抗 (连点/超长/race/DOM注入) 全部 PASS。
tsc zero errors。截图 + spec-trace 齐全。

**最终判定: PASS**
