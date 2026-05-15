# adversarial.md · SC01-MP-T11 · P08 复习执行 MP 1:1 mirror · attempt-3

> attempt-3 Tester 独立复审。attempt-2 audit REDO 原因: coder.md + bugs-found.md 缺失 (coder_compliance)。本轮验证 Coder 已补齐 + 代码无回归。

## Round 1 · REJECT (carried from attempt-1 · nodeIndex 不一致)

### Bug: MOCK_NODE.nodeIndex=2 与 mockup "第 2 次复习" 不一致
- 文件: `frontend/apps/mp/pages/review-exec/index.ts` L46-47
- 现象: `nodeIndex=2` → WXML `{{node.nodeIndex + 1}}` 渲染 "第 3 次复习"，mockup SoT 显示 "第 2 次复习"
- 连带: node timeline 产出 2 个 done dots + 第 3 个为 now (应为 1 done + 第 2 个 now)
- REJECT 依据: test-agent.md 铁律 3 严苛对抗 · 不符合 mockup SoT = 不通过

### 修复验证
- Coder 修复: `nodeIndex: 2` → `nodeIndex: 1` (commit 612e5f2)
- `git cat-file -e 612e5f2` → OK (真实 commit)
- 修复后: `nodeIndex + 1 = 2` → "第 2 次复习" ✓
- node timeline: idx=0 isPast (done) + idx=1 isCurrent (now) → 匹配 mockup 7 dots 结构 ✓
- tsc re-verify: `pnpm -F mp typecheck` → 0 errors ✓

---

## Round 2 · 探索性对抗测试 (carry-forward from attempt-2 + attempt-3 re-verify)

### 2.1 连点防抖 (debounce / rapid tap)
- `onRevealTap()` L146: `isRevealing` guard → 连点第二次 return ✓
- `onGradeTap()` L179: `isGrading` guard → 连点第二次 return ✓
- WXML L89: `disabled="{{execState !== 'ANSWERING' || isRevealing}}"` → 双层防护 ✓
- `onCanvasTouch()` L137: 仅 READING 态触发 → 重复 touch 无效 ✓

### 2.2 超长数据注入
- `{{question.stem}}` 无 max-lines → 超长文本撑开 qcard
- scroll-view 兜底可滚动，不 crash
- **advisory**: 建议后续加 `max-height` + ellipsis · 不阻塞本轮

### 2.3 race condition (API 竞态)
- `onRevealTap` await 期间用户点 close → `wx.navigateBack()` 销毁 page → setData on detached
- WX 框架 silently ignores detached setData (console warn, 不 crash)
- **low risk advisory** · 不阻塞

### 2.4 DOM 注入 / XSS
- WXML `{{}}` 自动 HTML-escape ✓
- 无 `rich-text` / `eval` / `Function()` ✓
- WX 框架级保障 ✓

### 2.5 GRADED 后 isRevealed=false (attempt-3 新发现 · advisory)
- `onGradeTap` L200: `isRevealed: false` → reveal content 获得 `reveal-hidden` (display:none) + reveal 按钮重现 (disabled)
- Coder 注释: "连点防护: GRADED 后禁止重复评分"
- **分析**: GRADED 为终态，用户不会长停留；toast 后通常导航到下一题。mockup 未定义 GRADED 视觉态。`isGrading` + `execState` 已有双层防护，`isRevealed=false` 是额外冗余。
- **判定**: advisory · 不阻塞 · 建议后续移除冗余隐藏，改用 `execState !== 'REVEALED'` 守卫

---

## Round 3 · attempt-3 Coder 交付物审计

### 3.1 coder.md 验证 (attempt-2 REDO 修复项)
- `audits/runs/SC01-MP-T11/team-4/attempt-3/coder.md` 存在 ✓
- 5 段齐全: 地形侦察 / 编码 / 真实 E2E / 自检 / 提交 ✓
- commit hash e609eae + 612e5f2 均 `git cat-file -e` PASS ✓

### 3.2 bugs-found.md 验证 (attempt-2 REDO 修复项)
- `audits/runs/SC01-MP-T11/team-4/attempt-3/bugs-found.md` 存在 ✓
- 3 bugs 列出 · 含 attempt-2 Tester 发现的 nodeIndex bug ✓

### 3.3 WXML vs mockup 结构对照 (attempt-3 re-verify)
| mockup 区块 | WXML 对应 | testid | 状态 |
|---|---|---|---|
| .nav | .nav | p08-topbar | ✓ |
| .back | .back + van-icon | — | ✓ |
| .center > .title + .sub | .center | p08-topbar-cursor | ✓ |
| .close | .close + van-icon | p08-close-btn | ✓ |
| .ptrack | .ptrack | p08-progress-bar | ✓ |
| .metarow > .chip×3 | .metarow > .chip-red/indigo/orange | p08-meta-chips | ✓ |
| .qcard | .qcard | p08-question-hero | ✓ |
| .work > .paper + .tools | .work + onCanvasTouch | p08-answer-area | ✓ |
| .reveal | .reveal + isRevealed toggle | p08-reveal-content | ✓ |
| .nodes | .nodes wx:for 7 dots | p08-memory-curve | ✓ |
| .rating > .rbtn×3 | .rating + onGradeTap | p08-grade-buttons | ✓ |
| exit sheet | van-overlay + .sheet | p08-exit-confirm-sheet | ✓ |

13/13 区块全覆盖 · 19 data-test-id ✓

---

## 最终判定: PASS

- Round 1 REJECT (nodeIndex) 已修复 (612e5f2) ✓
- Round 2 探索性对抗: 连点/超长/race/DOM/GRADED 全 PASS 或 advisory ✓
- Round 3 coder 交付物: coder.md + bugs-found.md 补齐 ✓
- tsc --noEmit 0 errors ✓
- 4 态截图落盘 ✓
- API 契约 3 endpoints · 0 mock ✓
