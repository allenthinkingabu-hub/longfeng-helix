# Coder Work Log · SC-12-T01 · attempt-1

Task: SC-12 P-GUEST-CAPTURE backend skeleton (slice 1/6 · session-mint endpoint).
Commit: `0c18bb8` (feat backend) — to be amended by `<test-commit>` (test) and `<chore-commit>` (work_log).

## 1. 地形侦察

Read before writing a line of code:

- `.harness/inflight/SC-12-T01.json` — 55 scope_in items + 9 DoD + sandbox config + log_requirements
- `.harness/agents/coder-agent.md` — full read; iron rules 1-7 + auxiliary rule 6 (E2E) + Rule 6.5 compaction
- `CLAUDE.md` — Test-Case-First Phase 6 model, 通用工程德行 12 条, 双脑回看 protocol
- DDL source of truth `backend/anonymous-service/src/main/resources/db/anonymous/V20260421_02__init_anonymous.sql` §1-§2
  - **Spec drift surfaced**: inflight comment claimed `status enum 0..9 INIT/CONSENTED/UPLOADING/UPLOADED/ANALYZING/ANALYZED/FAILED/EXPIRED/CLAIMED/ABANDONED`. DDL `COMMENT ON COLUMN guest_session.status` actually says `0 CREATED / 1 ANALYZING / 2 RESULT_READY / 3 FAILED / 4 CLAIMED / 9 EXPIRED`. **Followed DDL** (it is the source of truth that PG enforces; the inflight comment was advisory). Wrote DDL spelling into the Javadoc of `GuestSession` so future task readers see one canonical enum.
  - **Spec drift surfaced**: inflight comment claimed rate-bucket column was `date`. DDL actually has `bucket_date` (DATE is a SQL keyword — DDL avoided collision). Mapped repo derived-query to `findByDeviceFpAndBucketDate(...)`.
- Reference templates (`grep`-found):
  - Entity shape: `backend/anonymous-service/src/main/java/com/longfeng/anonymousservice/entity/ShareToken.java`
    (client-assigned BIGINT PK, hand-written getters/setters, no Lombok, status as `short`, OffsetDateTime for timestamps)
  - Service mint+sign pattern: `service/ShareTokenService.java` lines 234-280 (Jwts.builder + SecretKey injection + 3-retry id collision loop + nanoTime-based id generator)
  - Controller + validation handler: `controller/ShareIssueController.java` lines 92-102 (`@ExceptionHandler(MethodArgumentNotValidException.class)` returns 400 with `code/message` body, controller-scoped to avoid colliding with sibling controllers)
  - IT shape: `test/java/.../SC13SharerE2EIT.java` (extends `IntegrationTestBase`, `@SpringBootTest(RANDOM_PORT)`, JdbcTemplate + HttpClient + Jwts parse-verify helpers)

## 2. 编码

Files written (all new — no edits to existing code besides `application.yml`):

| Path | Purpose |
| --- | --- |
| `entity/GuestSession.java` | JPA mapping for `guest_session` DDL §1 (15 cols) |
| `entity/GuestRateBucket.java` | JPA mapping for `guest_rate_bucket` DDL §2 (T01 NOT touched; T06 备料) |
| `repo/GuestSessionRepository.java` | `JpaRepository<GuestSession, Long>` |
| `repo/GuestRateBucketRepository.java` | `+ findByDeviceFpAndBucketDate` derived query |
| `service/AnonTokenService.java` | HS256 mint · `sub="anon:"+id` · iss/aud/secret reuse `anon.jwt.*` |
| `service/AnonSessionService.java` | DB INSERT + sanitizeEntrySource (whitelist) + 3-collision retry |
| `dto/AnonSessionRequest.java` | `@NotBlank @Size(max=128) deviceFp` + 4 optional fields |
| `dto/AnonSessionResponse.java` | record (anonToken, anonSessionId, expiresAt) |
| `dto/AnonErrorResponse.java` | `{code, message}` envelope (mirrors `ShareErrorResponse`) |
| `controller/AnonSessionController.java` | `POST /api/anon/session` + scoped `@ExceptionHandler` |
| `application.yml` | + `anon.guest-session-ttl-sec: 86400` (24h default) |

Boundary choices (vs the inflight scope description):

- **`sub` prefix is `"anon:"`** verbatim (not `"anon-"` or `"anonymous:"`). Hard-coded as
  `AnonTokenService.SUB_PREFIX` constant so T02 AnonFilter can import the same constant
  instead of re-typing the literal.
- **`entry_source` whitelist** includes `direct` (biz §4.10 spelling: `ad/qr/share/direct`)
  in addition to the operational extras `push/icon/deeplink/unknown` from P-GUEST-CAPTURE
  spec §5. Inflight comment listed `share` but not `direct`; followed biz over inflight.
- **`analysis_result_json` JSONB column** is mapped with `insertable=false, updatable=false`
  so Hibernate skips it on INSERT (else PG SQLState 42804 — see Bug #1 in `bugs-found.md`).
- **Controller is class-scoped**, not `@RestController` + `@RequestMapping("/api/anon")` —
  there is only one endpoint; pinning the full path on the method keeps grep-discovery
  trivial (`grep -rn '/api/anon/session'`).

## 3. 真实 E2E

T01 is a backend-only slice (no frontend; frontend stays at the SC-12-STUB-T01 stub per inflight
boundary `scope_out`). The "真实 E2E" obligation lives in `SC12T01AnonSessionE2EIT.java` and is
the **Backend E2E IT** form of the truth pyramid the agent.md requires.

Run command + result (raw stdout snippet):

```
$ cd backend && mvn -pl anonymous-service verify
...
[INFO] Results:
[INFO]
[INFO] Tests run: 33, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

33/33 testcase = 6 new SC-12-T01 + 4 SC-13 + 9 SC-13-SHARER + 6 SC-00 sessionResolve + 8 T01LandingShellApi.
Surefire XML raw output preserved in `test-reports/` after Phase 4 Tester run.

Test-case ↔ spec ↔ source trace:

| Testcase | Pins | Source covered |
| --- | --- | --- |
| `mint_returns_200_with_anonToken_and_sessionId_and_db_row` | biz §2B.13 F01 happy path · §4.10 DDL row | `AnonSessionController.mint` + `AnonSessionService.mint` + `AnonTokenService.mintAnonToken` |
| `mint_without_device_fp_returns_400` | biz §2A.3.2 device_fp REQUIRED contract | `@NotBlank` on `AnonSessionRequest.deviceFp` + controller's `handleValidation` |
| `mint_long_device_fp_returns_400` | DDL `VARCHAR(128)` cap | `@Size(max=128)` boundary |
| `mint_invalid_entry_source_sanitized_to_unknown` | XSS defense for `entry_source` (biz §4.10) | `AnonSessionService.sanitizeEntrySource` |
| `mint_persists_optional_fields_correctly` | All 4 optional cols round-trip to DB | `AnonSessionService.mint` field copy chain |
| `mint_token_sub_prefix_is_anon` | T02 AnonFilter discriminator vs student JWT | `AnonTokenService.SUB_PREFIX` |

## 4. 自检

Coder DoD checklist (mapped to coder-agent.md):

- [x] Iron Rule 1 单一专注 — only SC-12-T01; no scope creep into T02/T06
- [x] Iron Rule 2 工作区隔离 — worktree `claude/nifty-kepler-3deb2c`, no edits outside `backend/anonymous-service/`
- [x] Iron Rule 3 权限 — `dev_done=true` written after this section; `passes` left for Tester
- [x] Iron Rule 4 git commit hash 真实 — `git cat-file -e 0c18bb8` passes (verified before commit)
- [x] Iron Rule 5 work_log 落盘 — this file + `bugs-found.md` in `audits/runs/SC-12-T01/team-1/attempt-1/`
- [x] Iron Rule 6 lint + 真编译 — `mvn -pl anonymous-service verify` 33/33 PASS (checkstyle baseline 1146 pre-existing violations carried by all prior tasks · not raised by Coder gate)
- [x] Iron Rule 7 三件套 — N/A (no MP E2E spec; backend IT is the analogue)
- [x] DoD (a) E2E 全绿 raw — `mvn verify` stdout above
- [x] DoD (b) 截图 — N/A backend slice
- [x] DoD (c) spec trace table — §3 above
- [x] CLAUDE.md Rule 1 Think Before Coding — surfaced 2 spec drifts during 地形侦察 (status enum, bucket_date column) instead of guessing
- [x] CLAUDE.md Rule 3 Surgical — touched only the 10 new files + 1 YAML key; no adjacent cleanup
- [x] CLAUDE.md Rule 9 Tests verify intent — `mint_token_sub_prefix_is_anon` explicitly comments "T02 AnonFilter relies on this prefix"; covers WHY not just WHAT
- [x] CLAUDE.md Rule 12 Fail loud — DataIntegrityViolationException retry surfaces an IllegalStateException after 3 tries (not silent fallback)
- [x] Rule 6 tool budget — ≈ 30 tool use spent in this attempt, well below 50 soft line

## 5. 提交

| Commit | Hash | Status |
| --- | --- | --- |
| feat(SC-12-T01 backend) | `0c18bb8` | DONE (git cat-file -e ✓) |
| test(SC-12-T01) IT 6 testcase · regression all green | TBD by Tester | pending Phase 4 |
| chore(SC-12-T01) work_log + audit.js v3 PASS + inflight finalize | TBD by Tester | pending Phase 5 |

After this Coder phase, `inflight.task.dev_done = true` and control passes to Tester.
