# Adversarial Log · SC01-MP-T14-E2E · attempt-1

## Round 1 · REJECT

**Issue**: `page.callMethod('onEnd')` (L51) directly invokes the page method, bypassing real UI interaction.

- **Violation**: Iron Rule 1 (模拟真人操作) + scope_in ("transition kind: 调 wx tap")
- **Evidence**: `frontend/apps/mp/test/e2e/done-to-home.spec.ts:51` used `page.callMethod('onEnd')` instead of tapping the `<van-button data-test-id="{{testIds.ctaEndBtn}}" bind:click="onEnd">结束本次</van-button>` element (WXML L160-164)
- **testid**: `p09-cta-row-end-btn` (from `@longfeng/testids` index.ts:464)
- **H5 reference**: `frontend/apps/h5/tests/e2e/sc-01/t14-done-to-home.spec.ts` correctly uses `page.locator('[data-testid="p09-cta-row-end-btn"]').click()` — MP spec should mirror this with `page.$('[data-test-id="p09-cta-row-end-btn"]').tap()`

**Impact**: When this spec runs in Phase 2, `callMethod` would bypass button visibility checks (`wx:if="{{pageState !== 'LOADING'}}"` on WXML L159), CTA dock rendering, and the `bind:click` event binding — defeating the purpose of E2E.

## Round 1 · FIX

**Change**: Replaced `page.callMethod('onEnd')` with:
```ts
const endBtn = await page.$('[data-test-id="p09-cta-row-end-btn"]');
expect(endBtn).toBeTruthy();
await endBtn.tap();
```

**Verification**:
- `pnpm -F mp typecheck` → 0 errors
- `pnpm -F mp test:unit` → 97/97 PASS (unchanged)
- Test name updated: `'trigger onEnd → reLaunch'` → `'tap "结束本次" CTA → reLaunch to /pages/home/index'`

**Why this fix catches regressions**: If the button testid changes, the selector breaks, or the CTA dock `wx:if` guard prevents rendering, this test will fail — whereas `callMethod` would silently pass.
