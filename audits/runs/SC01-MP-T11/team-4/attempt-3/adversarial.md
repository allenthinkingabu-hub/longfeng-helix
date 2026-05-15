# adversarial.md · SC01-MP-T11 · P08 复习执行 MP 1:1 mirror · attempt-3

> Carry-forward from attempt-2 adversarial. All adversarial work completed in attempt-1/2.

## Round 1 · REJECT (from attempt-1)

### Bug: MOCK_NODE.nodeIndex=2 与 mockup 不一致
- 文件: `frontend/apps/mp/pages/review-exec/index.ts` L46-47
- 现象: `nodeIndex=2` → chip 渲染 "第 3 次复习"，mockup SoT 显示 "第 2 次复习"
- 连带: node timeline 2 done dots vs mockup 1 done dot
- 修复: `nodeIndex: 2` → `nodeIndex: 1` (commit 612e5f2)
- tsc re-verify: PASS (0 errors)

---

## Round 2 · 探索性对抗测试 (Exploratory Adversarial)

### 2.1 连点防抖测试 (rapid tap / debounce)
- `onRevealTap()` L146: `if (isRevealing) return` + `setData({ isRevealing: true })` — 连点第二次直接 return
- `onGradeTap()` L179: `if (isGrading) return` + `setData({ isGrading: true })` — 同理
- WXML L89: `disabled="{{execState !== 'ANSWERING' || isRevealing}}"` — 双层防护
- **判定**: 连点防护完整, PASS

### 2.2 超长数据注入测试
- `{{question.stem}}` 无 max-lines 限制, 超长会膨胀 qcard
- 但在 scroll-view 内可滚动, 不 crash
- **判定**: PASS (advisory: 建议加 max-height)

### 2.3 race condition 分析
- revealNode API 慢 + 用户退出 → setData on detached page → WX 静默忽略
- gradeNode 同理
- **判定**: PASS (low risk, WX runtime 兜底)

### 2.4 DOM 注入 / XSS 防护
- WXML {{}} 数据绑定自动 HTML-escape
- 无 rich-text / eval / Function() 注入面
- **判定**: PASS

---

## Round 3 · VERIFY + PASS

Round 1 REJECT 已修复 (nodeIndex 2→1, commit 612e5f2)。
探索性测试 (连点/超长/race/DOM注入) 全部 PASS。
tsc --noEmit 0 errors。4 态截图 + spec-trace.md 齐全。

**最终判定: PASS**
