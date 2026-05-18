# SC-12-T04 · Bugs Found · attempt-1

Total bugs found and fixed this attempt: **1**.

## Bug #1 · application.yml duplicate `anon:` top-level key → ApplicationContext failure cascade

- **Where**: `backend/anonymous-service/src/main/resources/application.yml`
- **What**: First draft appended the new `anon.storage.*` block as a *second*
  top-level `anon:` mapping at the bottom of the file (line 89), while line 63
  already had `anon:` for `anon.jwt.*` + `anon.guest-session-ttl-sec`.
  SnakeYAML's strict-mode loader (Spring Boot default since 2.x) rejected the
  document with:

  ```
  Caused by: while constructing a mapping
   in 'reader', line 1, column 1:
      server:
      ^
  found duplicate key anon
   in 'reader', line 89, column 1:
      anon:
      ^
  ```

  This blew up `ApplicationContext` load for SC12T04AnonPresignE2EIT — the
  first testcase produced `IllegalStateException: Failed to load
  ApplicationContext`, then the JUnit "context failure threshold (1)" gate
  cascade-skipped the other 7 testcases (8/8 Errors, 0 PASS).

- **Detection**: caught by running the IT — surfaced loud and clear at
  compile-then-run (Rule 12 fail-loud · NOT silenced by a try/catch).
  `failsafe-reports/com.longfeng.anonymousservice.SC12T04AnonPresignE2EIT.txt`
  ↓ "Caused by ... found duplicate key anon".
- **Fix**: merged the new `storage:` sub-block into the existing `anon:`
  mapping (as a sibling of `jwt:` and `guest-session-ttl-sec:`) — single
  top-level `anon:` block · all sub-keys live under it.
- **Fix commit**: `8ac2062` (included in the test commit alongside the IT
  file because the yaml fix unblocks the IT; the two changes are physically
  linked).
- **Validation**: after the fix, `mvn verify -Dit.test=SC12T04AnonPresignE2EIT`
  → 8/8 PASS · 23.69 s. Full suite `mvn verify` → 53/53 PASS · no regression.
- **Lesson**: when adding a new top-level config section, `grep -n "^anon:"`
  the target yaml first to confirm the namespace isn't already in use.
  Added this check to the work_log Bug #1 entry as institutional memory.

---

No other bugs found in this attempt. Coder DoD covered:
- 0 lint errors (n/a · backend-only · checkstyle disabled per project setup)
- 0 typecheck errors (`mvn clean compile` · 48 source files BUILD SUCCESS)
- 0 IT failures after Bug #1 fix
- 0 regression in pre-existing 45 IT (SC-12-T01/T02 · SC-13 · SC-13-SHARER ·
  SC-00 · SC-11 · skeleton)
