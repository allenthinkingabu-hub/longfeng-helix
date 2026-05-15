# Adversarial Log · SC01-MP-T13-E2E · attempt-1

## Round 1 · REJECT — CSS class selectors instead of data-test-id

**Issue**: Spec `test/e2e/review-done.spec.ts` Test 2 uses CSS class selectors (`.hero`, `.card`, `.stats`, `.cta`) instead of the page's `data-test-id` attribute selectors. The page WXML already defines stable testids via `@longfeng/testids` p09 block (e.g. `celebrate-hero`, `memory-curve`, `p09-stats-row`, `p09-cta-row`). CSS classes are fragile — they may change for styling reasons while testids are explicitly designed as stable testing anchors.

**Evidence**:
- Coder's coder.md §1 acknowledges reading testids: "读 testids: `frontend/packages/testids/src/index.ts` L444-465"
- But spec used `.hero`, `.card`, `.stats`, `.cta` (CSS classes) instead of `[data-test-id="..."]`
- Page WXML L5: `data-test-id="{{testIds.celebrateHero}}"` → value `celebrate-hero`
- Page WXML L64: `data-test-id="{{testIds.memoryCurve}}"` → value `memory-curve`
- Page WXML L125: `data-test-id="{{testIds.statsRow}}"` → value `p09-stats-row`
- Page WXML L159: `data-test-id="{{testIds.ctaRow}}"` → value `p09-cta-row`

**Fix applied**: Replaced 4 CSS class selectors with `[data-test-id="..."]` attribute selectors in Test 2.

**Verification after fix**:
- `pnpm -F mp lint` → 0 errors ✓
- `tsc --noEmit` → PASS ✓
- `pnpm -F mp test:unit` → 97/97 PASS ✓

## Round 2 · PASS

After fix, spec reviewed again:
- Test 1: navigation path assertion — correct ✓
- Test 2: uses `data-test-id` selectors (robust) — fixed ✓
- Test 3: screenshot file existence + size check — correct ✓
- Test 4: pixelmatch VRT with 5000px threshold (per inflight context.scenario) — correct ✓
- beforeAll: connect with 8s timeout — per scope_in ✓
- afterAll: disconnect — per scope_in ✓
- No `page.route` mock, no `vi.mock`, no forbidden patterns ✓
- `maxDiffPixels = 5000`: approved by TL in inflight context (not default 500) ✓
- No `page.evaluate` backdoor ✓

**Why I believe this test catches regressions**: The spec covers 4 dimensions — (1) route correctness, (2) DOM element existence via stable testids, (3) screenshot validity, (4) pixel-level visual regression. Any change to the page structure (removing/renaming testid elements), navigation path, or visual appearance would fail the corresponding test. The testid selectors are coupled to the `@longfeng/testids` contract, not volatile CSS classes.
