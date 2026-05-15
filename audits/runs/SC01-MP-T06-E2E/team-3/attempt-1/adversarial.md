# Adversarial Log · SC01-MP-T06-E2E · attempt-1

## Round 1 · REJECT

### Finding 1: Missing `openNode` endpoint (coverage gap)

**Severity**: Medium — contract coverage incomplete
**Evidence**: `src/api/review.ts` exports 9 functions but spec only tests 8. `openNode` (POST `/api/review/nodes/:nid/open` → `ApiEnvelope<null>`) at line 138-143 has zero test coverage.

```bash
# Proof: grep exported functions vs spec test cases
grep -c "^export async function" frontend/apps/mp/src/api/review.ts  # → 9
grep -c "it('" frontend/apps/mp/test/e2e/review-api-contract.spec.ts  # → 8 (before fix)
```

**Why this matters**: The task scope says "调 src/api/review.ts 函数 · 验证响应契约". Missing 1 of 9 endpoints = 11% coverage gap. If backend wires `/open` differently, no test catches it.

### Finding 2: `nodeResult` field coverage incomplete

**Severity**: Low — nullable fields unchecked
**Evidence**: `NodeResultResp` interface (review.ts L64-77) defines 12 fields. Spec #8 only asserts 5 required fields, ignoring 7 nullable fields (`quality`, `easeFactorBefore`, `easeFactorAfter`, `intervalDaysBefore`, `intervalDaysAfter`, `nextDueAt`, `durationMs`). A backend regression that drops these fields from the response would go undetected.

---

## Round 2 · FIX + VERIFY

### Fix applied (by Tester):
1. Added test case #9 for `openNode` (POST `/api/review/nodes/:nid/open`) — asserts `ApiEnvelope` shape + `data === null`
2. Extended test case #8 `nodeResult` — added `'key' in data` checks for all 7 nullable fields
3. Updated describe title and header comments to reflect 9 endpoints

### Verification:
- `pnpm -F mp typecheck` → 0 errors ✓
- `pnpm -F mp test:unit` → 97/97 PASS (no regression) ✓
- Spec now covers all 9 exported functions in `src/api/review.ts` ✓
- 0 mock (`vi.mock` / `page.route` / `jest.mock` count = 0) ✓

### Why I believe these tests catch regressions:
- Each endpoint test validates the HTTP route exists (< 500) AND the response shape (envelope + required fields)
- Soft-skip design means tests are inert without backend but will activate and catch contract drift when backend is present in Phase 2
- The nullable field checks ensure backend serialization doesn't silently drop optional fields
