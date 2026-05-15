# Adversarial Log · SC01-T13 · P09 ReviewDone
## Tester · team-5 · attempt-1

---

## Round 1 · REJECT

**Issue**: AC3 E2E test "renders memory curve with 6 nodes (done/now/future states)" does NOT verify node states.

**Evidence**:
- `t13-review-done.spec.ts:172-189` — test title claims to verify done/now/future states
- Actual assertions: only `toBeVisible()` on each `memory-curve-node-{T1..T6}`
- No CSS/color/state differentiation checked
- With `nodeIndex=2`: T1 should render green (done), T2 blue+pulse (now), T3-T6 gray (future)
- Component applies distinct CSS classes: `.nodeDotDone` (green #34C759), `.nodeDotNow` (blue gradient), default (gray)
- **CLAUDE.md Rule 9**: "Tests verify intent, not just behavior" — checking visibility alone doesn't encode the business WHY (node progression states)

**Reproduce**:
```bash
grep -n "toBeVisible\|toHaveCSS\|color\|done\|now\|future" frontend/apps/h5/tests/e2e/sc-01/t13-review-done.spec.ts | head -20
# → Only toBeVisible() found in AC3 test, no CSS state assertions
```

**Expected fix**: Add `toHaveCSS('color', ...)` assertions on node labels to verify done/now/future state differentiation:
- T1 label: `rgb(52, 199, 89)` (green = done)
- T2 label: `rgb(0, 122, 255)` (blue = now)
- T3-T6 labels: `rgb(99, 99, 102)` (gray = future)

---

## Round 2 · FIX + PASS

**Fix applied**: Enhanced AC3 test at `t13-review-done.spec.ts:185-199` (new lines) with CSS color assertions:
- T1 label → `toHaveCSS('color', 'rgb(52, 199, 89)')` (done/green)
- T2 label → `toHaveCSS('color', 'rgb(0, 122, 255)')` (now/blue)
- T3-T6 labels → `toHaveCSS('color', 'rgb(99, 99, 102)')` (future/gray)

**Verification**: Code review confirms:
- Component `getNodeState()` (index.tsx:71-76) correctly maps `idx < currentNodeIndex → done`, `idx === → now`, `idx > → future`
- CSS module `.nodeLabelDone { color: var(--green) }`, `.nodeLabelNow { color: var(--blue) }`, default `.nodeLabel { color: var(--sec) }` (ReviewDone.module.css:348-354)
- E2E mock `node_index: 2` → T1(done) T2(now) T3-T6(future) — matches assertions

**Other reviewed items (no issues found)**:
1. API client `camelize()` (review.ts:13-26) correctly transforms snake_case mock responses → camelCase DTOs
2. Error degradation (§9): `placeholderData` is temporary in react-query; on 500 error `data` becomes undefined → `isError && !nodeResult` triggers Toast "结果同步中" correctly
3. TI1 confetti `pointer-events: none` assertion (AC1 test:134) — reads CSS only, does not inject/change state
4. TI2 ALL_DONE hides continue CTA — `toHaveCount(0)` correctly asserts absence
5. TI3 subscribe idempotency — button disabled after first click, `callCount === 1`
6. AC4 subscribe flow → Toast "已同步到日历" + button text changes to "已添加" + disabled
7. AC5 stats row + KP chart — testids match `@longfeng/testids` p09 exports
8. All 22 testids from spec §13 present in component with correct `data-testid` attributes
9. `physical_verification.dor_c1_to_c6_required: false` — `page.route` mock usage accepted per TL override

**Verdict**: PASS after Round 2 fix.
