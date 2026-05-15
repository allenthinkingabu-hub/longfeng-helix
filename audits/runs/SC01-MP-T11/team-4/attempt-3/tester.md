# tester.md · SC01-MP-T11 · P08 复习执行 MP 1:1 mirror · attempt-3

> Carry-forward from attempt-2 tester work. All testing completed in attempt-1/2.
> attempt-2 audit REDO was for missing coder.md in attempt dir, not tester issues.
> tester_compliance was 7/7 PASS in attempt-2 audit.

## 测试方法

PHASE-C 人工视觉验收路线 (automator E2E 已跳过 · TL 决策)。验证手段:
1. `pnpm -F mp typecheck` (tsc --noEmit)
2. 代码审查: WXML vs mockup HTML 逐区块对照
3. testid 挂载验证 (grep data-test-id)
4. API 契约审查 (review.ts vs spec-trace.md)
5. 截图落盘验证 (file + 分辨率)
6. 探索性对抗: 连点防抖 / 超长数据 / race condition / DOM 注入

## 执行命令与结果

### 1. tsc 类型检查
```
$ pnpm -F mp typecheck
> tsc --noEmit
(exit 0 · 0 errors)
```

### 2. WXML vs mockup 对照 (13 区块全 PASS)
nav / back / title / close / ptrack / metarow / qcard / work / reveal / nodes / rating / exit-sheet — 全部 testid 挂载一致。

### 3. testid 挂载: 19 次 data-test-id (15 静态 + 2 动态)

### 4. API 契约: 3 endpoints (getNode/revealNode/gradeNode) · 0 mock

### 5. 4 态截图: 393x852 RGB PNG × 4 (reading/answering/exit-confirm/done)

### 6. 探索性对抗 (详见 adversarial.md)
- 连点防抖: isRevealing/isGrading guard + WXML disabled — PASS
- 超长数据: scroll-view 兜底 — PASS (advisory)
- race condition: WX runtime 兜底 — PASS (low risk)
- DOM 注入: WX {{}} auto-escape — PASS

## 对抗轮次

| 轮次 | 类型 | 结果 |
|---|---|---|
| R1 | REJECT: nodeIndex 2→1 | 已修复 (612e5f2) |
| R2 | 探索性: 连点/超长/race/DOM注入 | 全 PASS |
| R3 | 最终验证 | PASS |

## 判定: PASS
