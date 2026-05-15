# Adversarial Log · SC01-MP-T03-E2E · attempt-1 (Tester)

## Round 1 · REJECT

**发现时间**: Tester 进场审查 `analyzing.spec.ts`

### Issue 1 (Critical): VRT pixelmatch 维度不匹配时静默裁剪 → false PASS 风险

- **位置**: `frontend/apps/mp/test/e2e/analyzing.spec.ts` L82-83 (原始版本)
- **问题**: Coder 使用 `Math.min(baselinePng.width, actualPng.width)` 和 `Math.min(baselinePng.height, actualPng.height)` 处理维度不匹配。当实际截图与 baseline PNG 尺寸不同时，pixelmatch 只比较左上角子区域，剩余区域的差异被丢弃。
- **风险**: Phase 2 真跑 automator 时，simulator 渲染分辨率与 Chromium mockup baseline 可能不同，此时 VRT 测试会给出 **false PASS** — 违反 CLAUDE.md Rule 9 "Tests verify intent, not just behavior" + Rule 12 "Fail loud"。
- **复现**: 假设 baseline 750×1334，actual 375×667 → 只比较 375×667 区域 → 右半屏/下半屏差异全丢。
- **严重性**: Critical — 直接影响 VRT 断言有效性。

### Issue 2 (Minor): 重复 `node:fs` import

- **位置**: `analyzing.spec.ts` L16-17 (原始版本)
- **问题**: 两行分别 import `readFileSync` 和 `writeFileSync, mkdirSync`，应合并为单条 import。
- **严重性**: Minor — lint 未报错但违反代码整洁原则。

### REJECT 判定

Coder 原始 spec 存在 false-PASS 风险漏洞，不可放行。要求修复后重新验证。

---

## Round 2 · FIX + RE-VERIFY → PASS

**修复人**: Tester (spec 层面修复，非生产代码)

### Fix 1: 维度不匹配显式 fail

```typescript
// Before (silent crop):
const width = Math.min(baselinePng.width, actualPng.width);
const height = Math.min(baselinePng.height, actualPng.height);

// After (explicit fail):
expect(
  actualPng.width === baselinePng.width && actualPng.height === baselinePng.height,
  `dimension mismatch: actual ${actualPng.width}×${actualPng.height} vs baseline ${baselinePng.width}×${baselinePng.height}`,
).toBe(true);
const { width, height } = baselinePng;
```

### Fix 2: 合并 `node:fs` import

```typescript
// Before: 2 lines
import { readFileSync } from 'node:fs';
import { writeFileSync, mkdirSync } from 'node:fs';

// After: 1 line
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
```

### 重新验证结果

| 验证项 | 结果 |
|--------|------|
| `pnpm -F mp lint` | 0 errors ✓ |
| `tsc --noEmit` | clean ✓ |
| `pnpm -F mp test:unit` | 97/97 PASS ✓ |
| spec 无 `page.route` mock | ✓ grep 确认 |
| spec 无 `vi.mock` | ✓ |
| `maxDiffPixels` / threshold | 5000 pixel + 0.15 threshold ✓ (在 audit 阈值内) |
| 维度 mismatch 现在 fail loud | ✓ (explicit expect + error message) |

### PASS 判定

修复后 spec 质量合格，VRT 断言严格，lint/tsc/test:unit 全绿。Phase 1 交付物达标。
