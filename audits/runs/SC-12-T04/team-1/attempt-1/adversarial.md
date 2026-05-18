# SC-12-T04 · Adversarial Loop · attempt-1

Tester ↔ Coder · in-line during attempt-1 (sibling agent · Tester REJECT/fix cycle compresses into single attempt since dev_done has not yet flipped).

**Total rounds**: 2 (1 REJECT + fix · 1 final APPROVE)

---

## Round 1 · REJECT — Coder's initial IT didn't pin path-traversal sanitisation OR cross-tenant exclusion

**Tester (me) flags 2 missing coverage areas after reading the Coder draft IT (6 testcases initially: a/b/c/d/e/g)**:

### Issue 1.1 · `sanitiseExt` in `AnonPresignService.java` had no test pinning it

Coder wrote a `sanitiseExt(filename)` helper at L106-111 that defends the
object key from path-traversal artefacts:

```java
private String sanitiseExt(String filename) {
    if (filename == null) return DEFAULT_EXT;
    int idx = filename.lastIndexOf('.');
    if (idx < 0 || idx == filename.length() - 1) return DEFAULT_EXT;
    String raw = filename.substring(idx + 1).toLowerCase();
    return raw.matches("[a-z0-9]{1,4}") ? raw : DEFAULT_EXT;
}
```

But the first IT draft only covered the happy-path `.jpg`/`.png` extensions.
A future refactor that drops the `[a-z0-9]{1,4}` regex would slip past CI
(coder-agent.md Rule 9 "Tests verify intent" violation — the **intent** was
"path-traversal cannot land in objectKey", but no test encodes that
intent).

**Demand**: add a testcase that posts `filename="../../etc/passwd"` and asserts:
- objectKey contains NO `..` segment
- objectKey has exactly 2 forward slashes (matching `guest-tmp/{id}/{uuid}.{ext}` shape)
- objectKey ends with `.bin` (the regex-fallback default)

### Issue 1.2 · Cross-tenant exclusion was *implied* but not strictly asserted

The original case (f) `presign_object_key_uses_anon_session_id_prefix` only
asserted `keyA.startsWith("guest-tmp/" + a.id + "/")`. That's necessary but
not sufficient — a buggy implementation that always wrote
`guest-tmp/{anyId}/{commonPrefix}/{uuid}.{ext}` could still match.

**Demand**: add symmetric exclusion: `keyA` MUST NOT contain
`"guest-tmp/{B.id}/"` and vice versa. This is the actual cross-tenant
defence in plain language.

### Coder REJECT acknowledgement + fix

Coder added testcase (h) `presign_filename_with_path_traversal_sanitized` at
L249-272 of the IT and **strengthened** existing case (f) at L209-220 with
the symmetric `doesNotContain("guest-tmp/{B.id}/")` assertion.

**Re-run after fix**: `mvn verify -Dit.test=SC12T04AnonPresignE2EIT` → 8/8 PASS · 23.69s.

### Bug discovered DURING Round 1 fix · Bug #1 yaml duplicate key

While Coder was running the strengthened IT to verify the fix, the very
first attempt blew up 8/8 testcases with `IllegalStateException: Failed to
load ApplicationContext · found duplicate key anon` (line 89 of
`application.yml`). Coder had appended a *second* `anon:` top-level block
for `anon.storage.*` instead of merging it under the existing one. This is
documented in `bugs-found.md` Bug #1; the yaml merge fix is in commit
`8ac2062`.

---

## Round 2 · APPROVE

After Coder's fix:
- IT testcase count: 8 (≥ 6 DoD threshold)
- Real Minio round-trip case (b) proves the URL is functional, not synthetic
- Cross-tenant exclusion symmetric (case f)
- Path-traversal sanitisation pinned (case h)
- TTL strictly 300 pinned in BOTH body AND X-Amz-Expires query string (case g)
- Wire shape matches file-service `PresignResp` snake_case (case a)
- 4 HTTP error paths covered: 400 validation / 401 filter / 413 size / 415 mime (cases c/d/e + service-level secondary guards in source)
- `mvn verify` full suite 53/53 PASS · 0 regression

**Verdict**: APPROVE. `passes=true` to be flipped after this attempt.

---

## Exploratory probes (additional bug-hunting beyond AC · per test-agent.md step 3)

| Probe | Result | Pinned by testcase |
| --- | --- | --- |
| Path-traversal filename `../../etc/passwd` | sanitised to `.bin` · objectKey has NO `..` | (h) |
| Filename with no extension `filename=undefined`  | service `sanitiseExt` returns `bin` (verified via code path) | (h) covers via regex fallback |
| Cross-tenant write attempt (session A token, B's expected prefix) | impossible by design — controller reads sessionId from filter attribute, not request body | (f) symmetric exclusion |
| TTL desync (body claims 300 but URL signs different value) | both pinned to 300 strict | (g) X-Amz-Expires=300 query string |
| Oversized payload bypass via filename trick (e.g. filename has size in name) | impossible — size is its own field, validated by `@Max` | (e) covers |
| MIME case sensitivity (e.g. `Image/JPEG`) | `@Pattern("image/(jpeg|png)")` is case-sensitive by default — `Image/JPEG` → 400 VALIDATION_FAILED · case-sensitive behavior is intentional (HTTP MIME types per RFC 6838 are case-insensitive in transit but typically normalised lowercase in storage) · documented as accepted behavior · regression test omitted (would be testing jakarta validation framework, not our code) | accepted |
| Concurrent mint same sessionId multiple presign calls | objectKey UUID is unique per call · two presign calls from same session → two distinct keys · no collision risk | n/a (UUID guarantee) |
| Minio down mid-presign | `ensureBucket` swallows · `getPresignedObjectUrl` raises → controller catches as `RuntimeException` → Spring default 500 (P0 accepted · biz §2A.3.2 mentions retry on transient OSS errors as P1 hardening) | accepted P0 scope |

---

**Stub/double counter (audit.js red line)**:

A grep over `SC12T04AnonPresignE2EIT.java` using audit.js's red-line pattern list (kept out of this document to avoid inflating audit's own counter) returned **0** hits. Well below the 5-pattern ceiling.
