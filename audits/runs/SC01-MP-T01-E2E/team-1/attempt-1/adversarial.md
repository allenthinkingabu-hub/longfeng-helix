# Adversarial Log · SC01-MP-T01-E2E · attempt-1

## Round 1 · REJECT

### Issue A: Test 2 vacuous DOM assertion (Rule 9 violation)

**What**: `capture.spec.ts` test 2 asserts `page.$('view')` — trivially true on ANY miniprogram page. Does not verify capture-specific DOM structure.

**Evidence**: `pages/capture/index.wxml` has specific `data-test-id` attributes: `p02-root`, `capture-shutter`, `p02-subjects`, `p02-mode-tabs`, etc. The test asserts none of them.

**CLAUDE.md Rule 9**: "Tests verify intent, not just behavior" — this test encodes no intent about what the capture page should contain.

**Required fix**: Replace `page.$('view')` with capture-specific selectors: `[data-test-id="p02-root"]`, `[data-test-id="capture-shutter"]`, `[data-test-id="p02-subjects"]`.

### Issue B: Inter-test fragile dependency

**What**: Test 4 (pixelmatch) reads `capture-actual.png` written by test 3 as side effect. If test 3 fails or vitest runs non-sequentially, test 4 gives misleading "file not found" error.

**Required fix**: Test 4 should be self-contained — take its own screenshot if the file doesn't exist yet.

### Issue C: Missing test-reports/ in work_log_dir

**What**: `log_requirements.must_write` includes `test-reports/`. Coder did not create this directory. audit.js will flag it.

**Required fix**: Tester creates and populates `test-reports/` with lint + unit test output logs.

---

## Round 1 · FIX

All three issues fixed by Tester:

1. **Fix A**: Changed test 2 from `page.$('view')` to three capture-specific assertions:
   - `page.$('[data-test-id="p02-root"]')` — root container
   - `page.$('[data-test-id="capture-shutter"]')` — shutter button
   - `page.$('[data-test-id="p02-subjects"]')` — subject chips

2. **Fix B**: Added fallback screenshot in test 4:
   ```ts
   if (!fs.existsSync(actualPath)) {
     await mp.screenshot({ path: actualPath });
   }
   ```

3. **Fix C**: Created `test-reports/` with:
   - `lint.log` — `pnpm -F mp lint` output (0 errors)
   - `vitest-unit.log` — `pnpm -F mp test:unit` output (97/97 PASS)

### Re-verification after fix

- `pnpm -F mp lint`: 0 errors
- `pnpm -F mp test:unit`: 97/97 PASS (7 test files)
- Spec structure verified: 4 tests + beforeAll connect + afterAll disconnect + pixelmatch VRT
