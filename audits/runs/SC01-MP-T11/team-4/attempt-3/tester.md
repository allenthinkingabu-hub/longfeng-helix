# tester.md · SC01-MP-T11 · P08 复习执行 MP 1:1 mirror · attempt-3

> attempt-3 独立 Tester 复审。attempt-2 audit REDO 原因: coder_compliance (coder.md + bugs-found.md 缺失)，tester_compliance 7/7 PASS。
> 本轮: 验证 Coder 补齐交付物 + 代码无回归 + 探索性对抗 re-verify。

## 测试方法

PHASE-C 人工视觉验收路线 (automator E2E 已跳过 · TL 决策 · `physical_verification.dor_c1_to_c6_required=false`)。

验证手段:
1. `pnpm -F mp typecheck` (tsc --noEmit) — 类型安全
2. 代码审查: WXML vs mockup HTML 逐区块结构对照 (13 blocks)
3. testid 挂载验证: `grep -c data-test-id index.wxml` → 19
4. API 契约审查: `review.ts` 3 endpoints vs spec-trace.md
5. 截图落盘验证: 4 files in `design/system/screenshots/mp-baseline/`
6. git commit hash 真实性: `git cat-file -e` on e609eae + 612e5f2
7. 探索性对抗: 连点防抖 / 超长数据 / race condition / DOM 注入 / GRADED 态 review

## 执行命令与结果

### 1. tsc 类型检查
```
$ pnpm -F mp typecheck
> tsc --noEmit
(exit 0 · 0 errors)
```
落盘: `test-reports/tsc-typecheck.log`

### 2. testid 挂载
```
$ grep -c data-test-id frontend/apps/mp/pages/review-exec/index.wxml
19
```
落盘: `test-reports/testid-grep.log`

### 3. git commit 验证
```
$ git cat-file -e e609eae && echo OK → OK
$ git cat-file -e 612e5f2 && echo OK → OK
$ git log 612e5f2 -1 --oneline → "612e5f2 test(SC01-MP-T11): Tester PASS · nodeIndex fix"
```

### 4. WXML vs mockup 结构对照
13/13 区块全覆盖 (详见 adversarial.md Round 3.3 表格)

### 5. 4 态截图
| 状态 | 文件 |
|---|---|
| READING | design/system/screenshots/mp-baseline/pT11-reading.png |
| ANSWERING | design/system/screenshots/mp-baseline/pT11-answering.png |
| EXIT-CONFIRM | design/system/screenshots/mp-baseline/pT11-exit-confirm.png |
| DONE | design/system/screenshots/mp-baseline/pT11-done.png |

### 6. Coder 交付物 (attempt-2 REDO 修复项)
- `attempt-3/coder.md` 存在 · 5 段齐全 ✓
- `attempt-3/bugs-found.md` 存在 · 3 bugs ✓
- app.json `pages/review-exec/index` ✓

## 对抗轮次

| 轮次 | 类型 | 结果 |
|---|---|---|
| R1 | REJECT: nodeIndex 2→1 (attempt-1 发现 · attempt-2 修复 612e5f2) | 已修复 ✓ |
| R2 | 探索性: 连点/超长/race/DOM/GRADED态 | 全 PASS 或 advisory |
| R3 | coder 交付物审计 + WXML 结构 re-verify | PASS |

## 判定: PASS
