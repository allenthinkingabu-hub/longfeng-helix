# SC01-MP-T09-E2E · Adversarial Log · attempt-1

## Round 1 · REJECT — Silent-fork: hardcoded testid string

**Issue**: `test/e2e/review-today.spec.ts` line 79 hardcodes `"today-review-card"` as a string literal in `page.$('[data-test-id="today-review-card"]')` instead of importing `TEST_IDS.p07.todayReviewCard` from `@longfeng/testids`.

**Severity**: Medium — silent-fork risk. If `todayReviewCard` value changes in the testids package, the E2E assertion would still query the old string, silently passing or failing without tracing back to the source of truth.

**DoR clause**: "严禁 E2E assertion 与生产代码 Silent-fork (例如生产返 `upload_url` 但测试断言 `uploadUrl`) → REJECT"

**Reproduction**:
```bash
grep 'today-review-card' frontend/apps/mp/test/e2e/review-today.spec.ts
# Found hardcoded string on line 79
grep '@longfeng/testids' frontend/apps/mp/test/e2e/review-today.spec.ts
# No matches — testids package not imported
```

## Round 1 · FIX

**Changes**:
1. Added `import { TEST_IDS } from '@longfeng/testids';` (line 21)
2. Changed `page.$('[data-test-id="today-review-card"]')` → `page.$(\`[data-test-id="${TEST_IDS.p07.todayReviewCard}"]\`)`

**Verification**:
- `pnpm -F mp lint` → 0 errors (lint + tsc --noEmit PASS)
- `pnpm -F mp test:unit` → 97/97 PASS (no regression)

## Round 2 · Full review PASS

After fix, reviewed all 4 tests against scope_in:
1. ✅ `beforeAll connect` with 8s timeout + race pattern (matches automator-smoke.spec.ts)
2. ✅ `afterAll disconnect`
3. ✅ 4 tests: connect sanity, navigateTo path, hero DOM (now using testids import), pixelmatch VRT
4. ✅ `MAX_DIFF_PIXELS = 5000` matches inflight context threshold
5. ✅ No `page.route` mock / `vi.mock` / `jest.mock` (mock count = 0)
6. ✅ `maxDiffPixels` = 5000 ≤ 5000 threshold
7. ✅ Baseline path `design/system/screenshots/mp-vrt-baseline/07_review_today.png` exists (276KB)
8. ✅ Testid `today-review-card` verified in WXML source `pages/review-today/index.wxml:22`
9. ✅ scope_out respected: no page code changes, no automator run, no miniprogram-ci

No further issues found. PASS.
