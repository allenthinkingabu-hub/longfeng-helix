# Bugs Found · SC-12-T01 · attempt-1

Live bugs caught during Coder phase + their fix commits. (P1+ potential issues
documented at the bottom so they don't get lost between slices.)

## Bug #1 · GuestSession analysis_result_json JSONB INSERT type mismatch

**Symptom**: First IT run produced HTTP 500 on every mint testcase. PG raised
`SQLState 42804`:

```
ERROR: column "analysis_result_json" is of type jsonb
but expression is of type character varying
Hint: You will need to rewrite or cast the expression.
```

**Root cause**: `GuestSession.analysisResultJson` was declared as plain `String`
with only `@Column(columnDefinition = "jsonb")`. Hibernate's default `VarcharType`
binds a `character varying` parameter at the JDBC layer, which PG refuses to
implicit-cast into `jsonb` (correct behaviour — silent coercion would mask
malformed JSON).

**Why it hit T01**: T01 never reads or writes the JSONB column, but JPA still
emits the column in every INSERT statement (with a `NULL` binding), which is
enough to trigger the type mismatch even for a null value.

**Fix**: Marked the field `insertable=false, updatable=false`. Hibernate now
omits the column from generated INSERT/UPDATE statements; the row gets the
DDL default (`NULL`). T04 will replace this with a proper
`@JdbcTypeCode(SqlTypes.JSON)` mapping when it actually needs to persist
analysis results.

**Fix commit**: `0c18bb8` (the fix is in the same feat commit as the entity
itself · the first IT run that surfaced the bug was BEFORE the commit landed).

**Regression guard**: The (a) happy-path testcase and all 4 subsequent
testcases (d/e/f/persist) exercise the INSERT path and would re-fail with the
same SQLState if the mapping regresses.

---

## P1 potential issues (NOT live bugs · documented for future slices)

These are not bugs in T01 deliverables — they are surfaced now so T02-T06
plan around them instead of re-discovering each one:

1. **Client-assigned BIGINT id space (no PG sequence)**.
   `AnonSessionService.generateRowId` mixes `nanoTime` (47 bits of monotonic time)
   with a 20-bit random jitter. Collision probability under bursty test load is
   negligible (< 1 in 2^40) but real. The 3-retry loop catches it; if collisions
   ever spike under prod load, swap to `UUID.randomUUID().getMostSignificantBits()`
   or a real PG sequence. SC-13 ShareToken uses the exact same pattern; the
   parity is intentional.

2. **`entry_source` whitelist vs biz wording**. biz §4.10 lists
   `'ad/qr/share/direct'` while P-GUEST-CAPTURE spec §5 also references
   `push/icon/deeplink`. The whitelist now permits all 7 plus `unknown`. If
   biz §4.10 narrows the list later, the whitelist constant needs to track —
   T01 added a comment in `AnonSessionService.ENTRY_SOURCE_WHITELIST` pointing
   to both sources.

3. **`anonToken` exp vs DB `expires_at` skew**. Both are computed at the
   same `now`, but if the JVM clock jitters between the two operations
   (DB INSERT first, JWT sign second), they can differ by milliseconds.
   T01 tolerates ±5s in IT assertions. T02+ should treat the JWT `exp` as
   the source of truth (it's signed; the DB row is mutable).

4. **No verifyAnonToken / no AnonFilter**. T02's first job is to add a
   `verifyAnonToken(token) -> Optional<Long>` method on AnonTokenService
   plus a Spring `WebFilter` that pulls `X-Anon-Token`, verifies it, and
   pins the resulting `guestSessionId` into a request attribute. T01
   intentionally left both off — adding them here would have required
   stubbing all the `/api/anon/*` endpoints they protect.

5. **`POST /api/anon/session` has no rate limit**. T06 will add Redis-bucket
   + `guest_rate_bucket` PG fallback. Until then, a flooder could mint
   arbitrarily many anon sessions. T01 inflight explicitly lists this in
   `scope_out`; the bug-#1 fix does not change that boundary.

---

Total live bugs in this attempt: **1** (caught and fixed before commit).
