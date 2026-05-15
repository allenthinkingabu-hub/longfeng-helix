# Adversarial Log · SC01-MP-T05-E2E · attempt-1 (Tester)

## Round 1 · REJECT

**发现**: `result.spec.ts:70-82` pixelmatch dimension mismatch bug

当 `mp.screenshot()` 返回的实际截图与 baseline PNG 尺寸不一致时（常见：不同 DPR 设备、baseline 手动裁切），代码用 `Math.min` 取较小的 width/height 传给 pixelmatch，但两个 `PNG.data` buffer 的行步长（row stride = `png.width * 4`）仍为各自原图宽度。pixelmatch 按传入的 `width * 4` stride 逐行读取，会跨行错位读取像素，导致：
- diff 结果完全不可信（误报/漏报）
- 若 `width * height * 4 > buffer.length` 直接越界 crash

**复现条件**: actual.width !== baseline.width（Phase 2 真机跑时极可能触发）

**期望修复**: 断言尺寸必须一致 + 不一致时 fail 并输出诊断信息（actual vs baseline dimensions），不要静默 Math.min 掩盖。

**依据**: test-agent.md 铁律 1 (模拟真人)、CLAUDE.md Rule 12 (Fail loud)

---

## Round 2 · FIX + RE-VERIFY

**修复**: 移除 `Math.min` fallback，改为严格断言 `actualPng.width === baselinePng.width && actualPng.height === baselinePng.height`，不一致时抛出描述性错误（含两边 dimensions）。

**验证**:
- `pnpm -F mp typecheck`: 0 error
- `pnpm -F mp test:unit`: 97/97 PASS
- grep 确认无 `Math.min` 残留 in spec

**结论**: 修复正确，spec 质量达标。PASS。
