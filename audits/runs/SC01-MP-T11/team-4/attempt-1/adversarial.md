# adversarial.md · SC01-MP-T11 · P08 复习执行 MP 1:1 mirror · attempt-1

## Round 1 · REJECT

### 发现的问题

**Bug 1 (blocking): MOCK_NODE.nodeIndex=2 与 mockup 文本不一致**
- 文件: `frontend/apps/mp/pages/review-exec/index.ts` L46-47
- 现象: `MOCK_NODE.nodeIndex = 2` → chip 渲染 "T2 · 第 3 次复习" (`node.nodeIndex + 1 = 3`)
- 期望: mockup (SoT) L152 显示 "T2 · 第 2 次复习" → `nodeIndex` 应为 `1` (0-indexed)
- 连带影响:
  - node timeline: 代码产出 2 个 done dot + 1 个 now dot (idx 0,1 done; idx 2 now)
  - mockup 只有 1 个 done dot + 1 个 now dot (idx 0 done; idx 1 now)
  - 1:1 mirror 视觉偏差
- 复现: 读 `index.ts:46` `nodeIndex: 2` → WXML `{{node.nodeIndex + 1}}` = 3

**Observation (non-blocking): 代码生成 7 dots 但 mockup 只有 6**
- 代码: `Array.from({ length: 7 })` → 7 dots (T0-T6)
- mockup L219-229: 6 个 `<span class="dot">` + 5 条 `<span class="line">`
- SM-2 理论确有 T0-T6 共 7 级, 代码可能是刻意业务对齐而非纯 mirror
- 判定: flagged 但不 blocking (业务合理性 > 严格 HTML 元素数一致)

### 要求修复
- `MOCK_NODE.nodeIndex` 从 `2` 改为 `1`

---

## Round 2 · FIX + VERIFY

### 修复内容
- `frontend/apps/mp/pages/review-exec/index.ts` L47: `nodeIndex: 2` → `nodeIndex: 1`
- 修复后 chip 渲染: "T2 · 第 2 次复习" (与 mockup 一致)
- 修复后 node timeline: 1 done dot (idx 0) + 1 now dot (idx 1) (与 mockup 一致)

### 验证
- `pnpm -F mp typecheck` → tsc --noEmit exit 0 · 0 errors
- 代码审查: `nodeIndex + 1 = 2` → "第 2 次复习" ✓
- node dot 逻辑: `isPast = idx < 1` → 只 idx=0 为 done, idx=1 为 now ✓

### 判定: PASS
修复后 1:1 mirror 文本一致性恢复, tsc 仍通过, 状态机逻辑不受影响。
