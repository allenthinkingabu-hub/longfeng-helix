# Adversarial Log · SC01-MP-T01-PAGE-FIX · attempt-1

## Round 1 · REJECT (investigative)

**Finding**: `pages/capture/index.wxml` lines 73 and 87 still use dynamic `data-test-id="{{ item.testid }}"` bindings. The previous audit verdict specifically flagged `{{testIds.X}}` dynamic bindings as the root cause of 29/55 spec failures. Are these remaining dynamic patterns the same anti-pattern that was supposed to be fixed?

**Evidence**:
```
grep -n 'data-test-id="{{' frontend/apps/mp/pages/capture/index.wxml
73:      data-test-id="{{ item.testid }}"
87:      data-test-id="{{ item.testid }}"
```

**Expected**: All testids in wxml should be static per the previous audit's redo_reason: "改 pages/capture/index.wxml 加静态 data-test-id 或对应 class 让 spec selector 找得到".

**Verdict**: REJECT pending investigation — need to determine if these dynamic bindings affect any spec selector.

---

## Round 1 · Resolution (PASS after investigation)

**Investigation**:

1. The `{{ item.testid }}` pattern on lines 73/87 is inside `wx:for` loops — each list item (subject chips, mode tabs) gets its testid from the data model. This is fundamentally different from the fixed `{{testIds.X}}` pattern which was a page-level testid map lookup.

2. Cross-reference with spec selectors:
   - `[data-test-id="p02-root"]` → wxml line 3: **static** `data-test-id="p02-root"` ✓
   - `[data-test-id="capture-shutter"]` → wxml line 110: **static** `data-test-id="capture-shutter"` ✓
   - `[data-test-id="p02-subjects"]` → wxml line 68: **static** `data-test-id="p02-subjects"` ✓

3. None of the 3 spec selectors target the `wx:for` list items. The dynamic `{{ item.testid }}` on lines 73/87 does NOT affect spec pass/fail.

4. The `{{ item.testid }}` pattern is appropriate for list items where each item's testid is data-driven (e.g., `p02-subj-math`, `p02-subj-english` etc. derived from subject data).

**Conclusion**: The remaining dynamic testids are a different pattern (list-item data binding) from the fixed issue (page-level testid map). All 3 spec-tested selectors are correctly static. No code change needed.

**Verdict**: PASS — Coder's assessment is correct.

---

## Round 2 · Additional verification

**Physical verification results**:
- `pnpm -F mp run lint` → 0 errors + tsc --noEmit pass (exit 0)
- `pnpm -F mp run test:unit` → 97/97 tests passed (exit 0)
- grep cross-reference: all 3 spec selectors have exact static matches in wxml
- All 3 tested elements are unconditional (no `wx:if`) — they always render

**No further issues found.**
