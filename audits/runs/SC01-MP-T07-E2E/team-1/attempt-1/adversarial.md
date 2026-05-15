# Adversarial Log · SC01-MP-T07-E2E · attempt-1

## Round 1 · REJECT — diff PNG 生成失效

**发现**: `wrongbook-list.spec.ts:134-141` pixelmatch 第三参数 `new Uint8Array(diffPng.data)` 创建了 Buffer 副本。pixelmatch 将 diff 像素写入副本，原 `diffPng.data` 不变（全零）。结果 `PNG.sync.write(diffPng)` 保存的 `05_wrongbook_list-diff.png` 永远是全黑空白图，丢失视觉调试能力。

**根因**: Node.js `Buffer` 是 `Uint8Array` 子类，`new Uint8Array(buffer)` 语义是拷贝，不是视图。输入参数同理冗余但无害（只读），输出参数则导致写入丢失。

**复现**: 静态代码审查 + Node.js Buffer/Uint8Array 语义分析。

**严重度**: Medium — diffPixels 计数正确（测试断言不受影响），但 diff 图用于人工 debug，全黑图丧失可视化价值。

## Round 1 · FIX — 去掉冗余 Uint8Array 包装

**修复**: 将 `pixelmatch(new Uint8Array(baseData), new Uint8Array(actData), new Uint8Array(diffPng.data), ...)` 改为 `pixelmatch(baseData, actData, diffPng.data, ...)`。三个参数均为 Buffer (Uint8Array 子类)，pixelmatch 直接接受。

**验证**:
- `pnpm -F mp typecheck` → 0 error ✓
- `pnpm -F mp test:unit` → 97 tests / 7 files / 100% PASS ✓
- lint → 0 errors ✓

**结论**: 修复后 pixelmatch 直接写入 `diffPng.data`，`PNG.sync.write(diffPng)` 将正确保存 diff 可视化图。
