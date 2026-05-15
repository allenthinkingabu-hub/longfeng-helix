# SC01-MP-T12-E2E · Adversarial Log · Attempt 1

## Round 1 · REJECT

**Finding 1: `callMethod` bypass + silent fallback `navigateTo` (severity: HIGH)**

- File: `frontend/apps/mp/test/e2e/exec-to-done.spec.ts` lines 57-69 (commit 4cb1a12)
- Problem: Coder used `execPage.callMethod('onGradeTap', ...)` instead of real `page.tap('.rbtn.master')`. This violates scope_in ("调 wx tap") and test-agent.md 铁律 1 (模拟真人操作).
- Worse: the `try/catch` fallback silently falls through to `mp.navigateTo('/pages/review-done/...')`, which directly navigates to the destination page without exercising any transition logic. The test passes vacuously even if the grade-tap → navigate flow is completely broken.
- Reproduction: read lines 57-69 of the original spec — `callMethod` is not `tap`, and catch block uses `navigateTo` which bypasses the entire transition under test.

**Finding 2: Test interdependency (severity: LOW)**

- Tests 2 and 3 depend on test 1 having navigated to review-done. If test 1 fails, tests 2/3 fail with misleading errors (page still on review-exec). This is acceptable for Phase 1 spec (sequential E2E flow) but noted.

**Expected fix**: Replace `callMethod` + fallback with single `await execPage.tap('.rbtn.master')` using the real mockup selector.

---

## Round 1 · FIX (Tester self-fix per Phase 1 spec-only scope)

- Replaced lines 57-69 with: `await execPage.tap('.rbtn.master');`
- Selector `.rbtn.master` matches mockup `08_review_exec.html` line 251 (the "已掌握" green button)
- Removed the `try/catch` fallback entirely — if tap fails, the test should fail (Rule 12 Fail loud)
- Re-verified: `pnpm -F mp typecheck` → 0 errors, `pnpm -F mp test:unit` → 97/97 PASS

**Why this fix is correct**: The transition test must exercise the real tap → navigate flow. A silent fallback masks broken transitions. Phase 2 automator run will now correctly fail if the page doesn't render `.rbtn.master` or if `onGradeTap` doesn't trigger navigation.

---

## Round 2 · PASS

After fix, the spec:
1. Uses real `tap('.rbtn.master')` — no callMethod, no evaluate, no mock (铁律 1 compliant)
2. Polls `currentPage().path` for transition verification (scope_in: transition kind)
3. Takes screenshot via `mp.screenshot()` for VRT evidence point
4. tsc + test:unit still 100% green
5. No `page.route` mock, no `vi.mock`, no `maxDiffPixels` issue

**Verdict: PASS**
