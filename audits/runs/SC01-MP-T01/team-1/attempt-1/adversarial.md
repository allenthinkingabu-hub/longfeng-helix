# adversarial.md · SC01-MP-T01 · attempt-1

## Round 1 · REJECT

### Bug A · Flash icon ternary no-op (index.wxml:12)

- **现象**: `name="{{ flashOn ? 'bulb-o' : 'bulb-o' }}"` — 三元表达式两个分支都是 `'bulb-o'`，icon name 永远不变
- **严重性**: Low (颜色仍会切换 #FFCC00/#fff，但 icon 名不变属于 dead code / copy-paste 残留)
- **修复要求**: 去掉无效三元，直接用 `name="bulb-o"`（Vant 无 filled bulb 变体，color 已区分 on/off 状态）

### Bug B · Tab 4 "复习" icon 偏离 mockup SoT (index.wxml:139)

- **现象**: Mockup `02_capture.html` 第 191 行 tab 4 "复习" 使用 bell/notification 形状 SVG。Coder 用了 `van-icon name="clock-o"`（时钟），与 mockup 视觉不一致
- **严重性**: Medium — 1:1 mirror 任务要求视觉对齐 mockup SoT
- **修复要求**: 将 `clock-o` 改为 Vant 的 `bell` (bell icon 更贴合 mockup bell SVG 形态)

### 复现

```bash
grep "flashOn ? 'bulb-o' : 'bulb-o'" frontend/apps/mp/pages/capture/index.wxml
grep "clock-o" frontend/apps/mp/pages/capture/index.wxml
```

---

## Round 2 · FIX + RE-VERIFY

### Fix A · Flash icon ternary → 移除死代码三元
- `index.wxml:12`: `name="{{ flashOn ? 'bulb-o' : 'bulb-o' }}"` → `name="bulb-o"`

### Fix B · Tab 4 icon → bell
- `index.wxml:139`: `name="clock-o"` → `name="bell"`

### Re-verify
- `pnpm -F mp typecheck` → PASS (0 errors)
- grep 确认修复：
  - `grep 'bulb-o' index.wxml` → 单次出现，无三元
  - `grep 'bell' index.wxml` → tab 4 行命中
- 4 baseline 截图不受影响（截的是 mockup HTML，不是 WXML runtime）

### 判定: PASS
两处 bug 均已修复，tsc 仍通过，mockup 对齐度提升。
