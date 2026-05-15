# Adversarial Log · SC01-MP-T13-E2E · attempt-2

## Carried from attempt-1

### Round 1 · REJECT — CSS class selectors → data-test-id

Spec `test/e2e/review-done.spec.ts` Test 2 used CSS class selectors (`.hero`, `.card`, `.stats`, `.cta`) instead of `data-test-id` attribute selectors. Fixed in attempt-1 commit 32bb14d.

Evidence: page WXML defines `data-test-id="celebrate-hero"`, `data-test-id="memory-curve"`, `data-test-id="p09-stats-row"`, `data-test-id="p09-cta-row"`.

### Round 1 · FIX — replaced with attribute selectors

Replaced 4 selectors in review-done.spec.ts:
- `.hero` → `[data-test-id="celebrate-hero"]`
- `.card` → `[data-test-id="memory-curve"]`
- `.stats` → `[data-test-id="p09-stats-row"]`
- `.cta` → `[data-test-id="p09-cta-row"]`

Verified: lint 0 errors + tsc PASS + test:unit 97/97 PASS.

## Attempt-2 · Audit REDO fix

### REJECT (audit.js) — 2 issues

1. `maxDiffPixels_le_500`: tester.md mentioned 5000 threshold without `--vrtMax=N` justification format. audit.js default check is ≤500.
2. `tester_md_testcase_count_matches_xml`: vitest log was plain-text (no `<testcase>` XML tags), audit.js could not verify claimed 97 count.

### FIX — both issues resolved

1. Added explicit `--vrtMax=5000` justification in tester.md: TL-approved threshold from inflight `context.scenario` for MP Skyline/WebView page-vrt kind. The threshold is set by the task spawn configuration, not an arbitrary override.
2. Re-ran vitest with `--reporter=junit` to produce `vitest-unit.xml` with 97 `<testcase>` elements, matching the claimed count exactly.

## Round 2 · PASS

Spec quality re-verified after attempt-1 fix:
- 4 test cases: navigation, DOM (testid selectors), screenshot, VRT pixelmatch
- No `page.route` mock, no `vi.mock`, no `page.evaluate` backdoor
- `MAX_DIFF_PIXELS = 5000` per TL inflight context (`--vrtMax=5000`)
- beforeAll connect 8s timeout + afterAll disconnect
- lint + tsc + test:unit 97/97 PASS

**Why these tests catch regressions**: testid selectors are coupled to the `@longfeng/testids` contract; pixelmatch catches visual drift; navigation test catches routing changes. All 4 dimensions must pass simultaneously.
