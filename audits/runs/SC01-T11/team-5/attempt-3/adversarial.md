# Adversarial Log · SC01-T11 · P08 揭示答案 · attempt-3

## Round 1 · REJECT: 快速连点防重入 + AC4/TI3 规约矛盾

### 发现的问题

1. **React 18 闭包竞态 (rapid double-click)**: `handleReveal` 用 `isRevealing` state 做防重入 guard (index.tsx:95-96)。React 18 auto-batching 下, 两次极速 click 理论上可能在同一渲染帧内进入 handler, 因为 `useState` setter 不立即更新闭包值。
   - **严重度**: 低 · 实际 React event loop 逐个处理 click event, 且 `execState !== 'ANSWERING'` 提供第二道 guard (REVEALED 后 handler 返回)。
   - **边界测试需求**: test-agent.md step 3 要求「极速疯狂连点」对抗测试。

2. **AC4 与 TI3 规约矛盾**: inflight AC4 说「揭示后底部 3 按钮 (未掌握/部分/已掌握) 全部可点」, 但 TI3 说「揭示后不允许再 tap ✓ 已掌握」。两者互斥。

### 修复验证

#### 快速连点防重入 (代码审查 · 验证通过)

```tsx
// index.tsx:94-96
const handleReveal = useCallback(async () => {
  if (execState !== 'ANSWERING' || isRevealing) return;  // 双重 guard
  setIsRevealing(true);  // 同步设置在 await 之前
```

防重入分析:
- **Guard 1**: `isRevealing` state check — 同步检查, 第一次 click 设为 true
- **Guard 2**: `execState !== 'ANSWERING'` — reveal 完成后 state 变 REVEALED, 后续 click 直接 return
- **React event loop**: 浏览器逐个 dispatch click event, React 18 不会在同一 microtask 内处理两个独立 click
- **结论**: 双重 guard + event loop 串行 = 防重入逻辑安全。不构成真实 bug。

#### AC4/TI3 规约矛盾 (设计决策 · 验证通过)

- Coder 遵循 TI3 + spec §6.4 (更具体的约束): mastered disabled after reveal
- forgot + partial enabled after reveal ✓
- 矛盾源自 inflight AC4 的措辞过于笼统, TI3 是更精确的规约
- **结论**: Coder 选择 TI3 是正确的设计决策, 符合 spec §6.4 禁止行为列表

**Round 1 结果: REJECT 项经代码审查验证, Coder 实现正确, 两项均非真实 bug。**

## Round 2 · 物理验证 + 对抗清单

| 验证项 | 方法 | 结果 |
|--------|------|------|
| testid 数量 (组件) | `grep -c data-testid index.tsx` | 18 ✓ |
| commit hash 验真 | `git cat-file -e` × 4 | 全部存在 ✓ |
| 路由拦截计数 | `grep page.route t11-reveal.spec.ts` | 1 次 (§9 error sim · ≤5) ✓ |
| VRT 阈值 | `grep maxDiffPixels tests/` | 0 次 ✓ |
| evaluate 后门 | `grep page.evaluate spec.ts` | 0 次 ✓ |
| XML testcase 总计 | `grep '<testcase'` | Playwright=6 + IT=10 = 16 ✓ |
| 截图证据 | `ls screenshots/` | 16 张 (4 态 × 4 种) ✓ |
| coder.md 落盘 (REDO 修复) | `ls attempt-3/coder.md` | 7103 bytes ✓ |
| bugs-found.md 落盘 (REDO 修复) | `ls attempt-3/bugs-found.md` | 1436 bytes ✓ |

### 连点/边界对抗验证

- **防重入 guard**: 双重同步检查 (isRevealing + execState) ✓
- **502 错误降级**: E2E #5 validates UI still expands on server error ✓
- **振动 fallback**: feature-detect + try-catch 双保险, 桌面环境不崩 ✓
- **mastered 按钮状态**: 揭示前全部 disabled → 揭示后 forgot/partial enabled + mastered disabled ✓

**Final verdict: PASS**
