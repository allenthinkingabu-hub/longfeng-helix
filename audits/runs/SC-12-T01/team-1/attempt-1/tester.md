# Tester Work Log · SC-12-T01 · attempt-1

Task: SC-12 P-GUEST-CAPTURE backend skeleton (slice 1/6 · session-mint).
Coder hand-off commit: `0c18bb8`.
Adversarial round fix commit: `<test-commit>` (to be added with this work_log).

## Step 0 · DoR 准入

`inflight.physical_verification.dor_c1_to_c6_required = false` — DoR C-1..C-6 skipped
per inflight (P0 backend-only slice, no MP / H5 frontend deliverable). spec_alignment
audit dim auto-passes by the same flag.

Test-Case-First Phase 2 / 2.5 user approval gate: `test_case_first_required = false`
(inflight) — Phase 1 TestDesigner not in scope, no test-cases.md gate. audit dim
`test_cases_alignment` auto-passes by the same opt-out.

DoR requirements actually applicable to this BE-only slice:

- [x] Coder commit `0c18bb8` exists (`git cat-file -e 0c18bb8` → OK)
- [x] `coder.md` 5 段落 (地形侦察 · 编码 · 真实 E2E · 自检 · 提交) — present
- [x] `bugs-found.md` ≥ 1 entry or explicit "0 bug" — present (1 live bug · 1 fix)
- [x] Backend IT file exists (`SC12T01AnonSessionE2EIT.java`)
- [x] IT runs against real PG (`localhost:15432`) — `IntegrationTestBase` injects DB URL
- [x] No `@MockBean` / `MockMvc` / `wx.request.mock` / `vi.mock` in new code — `grep` clean

## Step 1-2 · 进场拦截 + 全维度提取

Surface area in this BE-only slice:

| Source | What the testcase must pin |
| --- | --- |
| biz §2B.13 SC-12 F01 | POST /api/anon/session → 200 + anonToken/anonSessionId/expiresAt |
| biz §4.10 DDL | guest_session row · status=0 CREATED · 24h TTL · entry_source whitelist |
| design/system/pages/P-GUEST-CAPTURE-guest-capture.spec.md §5 | X-Anon-Token shape used by T02+ · sub="anon:"+id discriminator |
| Coder src `AnonSessionService.sanitizeEntrySource` | XSS defense whitelist |
| Coder src `AnonTokenService.mintAnonToken` | HS256 with `anon.jwt.*` parity |
| Coder src `AnonSessionController.handleValidation` | 400 VALIDATION_FAILED envelope |

## Step 3 · 编脚本

`backend/anonymous-service/src/test/java/com/longfeng/anonymousservice/SC12T01AnonSessionE2EIT.java`
holds 6 testcases (table below). The shape mirrors `SC13SharerE2EIT` 1:1 — same
`IntegrationTestBase`, same `HttpClient`, same `Jwts.parser().verifyWith(key)` helper
flow. **Zero mocks** (grep `Mock|@MockBean|page.route|wx.request.mock` → 0 hits).

| # | Testcase | Pins |
| --- | --- | --- |
| a | mint_returns_200_with_anonToken_and_sessionId_and_db_row | happy path + JWT verify + DB row + status=0 + **JWT exp ↔ response.expiresAt ↔ DB expires_at three-way parity (Round 1 fix)** |
| b | mint_without_device_fp_returns_400 | @NotBlank → 400 VALIDATION_FAILED |
| c | mint_long_device_fp_returns_400 | @Size(max=128) → 400 |
| d | mint_invalid_entry_source_sanitized_to_unknown | XSS whitelist defense |
| e | mint_persists_optional_fields_correctly | all 4 optional cols persist |
| f | mint_token_sub_prefix_is_anon | sub="anon:"+id discriminator vs student JWT |

## Step 4 · 自检（mock & adversarial gates）

- mock count: `grep -ic 'mock\|@MockBean\|page.route\|wx.request.mock' SC12T01AnonSessionE2EIT.java` → 0 — within audit cap (≤ 5)
- maxDiffPixels: N/A (backend slice, no VRT)
- IDE Console: N/A (`team_id = team-1`, `ide_smoke` dim auto-skips for non-mp/h5)
- adversarial loop: 1 REJECT + 1 fix landed (see `adversarial.md`)
- exploratory keywords in `adversarial.md`: 边界 / 超长 / 并发 / 500 / 注入 / SQL — ≥ 2 (audit `test_validity.adversarial_has_exploratory_keywords`)

## Step 5 · 物理验证（真后端 + 真 PG + 真 Redis）

Commands ran (raw stdout archived to `test-reports/`):

```
$ cd backend && mvn -pl anonymous-service verify
...
[INFO] --- maven-failsafe-plugin:3.1.2:integration-test (default) @ anonymous-service ---
[INFO]
[INFO] -------------------------------------------------------
[INFO]  T E S T S
[INFO] -------------------------------------------------------
[INFO] Running com.longfeng.anonymousservice.AnonymousServiceSkeletonE2EIT
[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running com.longfeng.anonymousservice.SC12T01AnonSessionE2EIT
[INFO] Tests run: 6, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running com.longfeng.anonymousservice.SC13ShareE2EIT
[INFO] Tests run: 4, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running com.longfeng.anonymousservice.SC13SharerE2EIT
[INFO] Tests run: 9, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running com.longfeng.anonymousservice.T01LandingShellApiE2EIT
[INFO] Tests run: 8, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running com.longfeng.anonymousservice.T01T02SessionResolveE2EIT
[INFO] Tests run: 5, Failures: 0, Errors: 0, Skipped: 0
[INFO]
[INFO] Results:
[INFO]
[INFO] Tests run: 33, Failures: 0, Errors: 0, Skipped: 0
[INFO] BUILD SUCCESS
```

**Tests run: 33** (= 6 new SC-12-T01 + 4 SC-13 + 9 SC-13-SHARER + 5 SessionResolve + 8 LandingShell + 1 Skeleton).
**All previously green IT (SC-13, SC-13-SHARER, SC-00, SC-11) remain green** — regression
clean. Full JUnit XML + raw text saved under `test-reports/`.

Real-infrastructure proof points:

- `IntegrationTestBase` injects `jdbc:postgresql://127.0.0.1:15432/wrongbook` — real PG (no H2, no Testcontainers spawn)
- `JdbcTemplate.queryForMap("SELECT ... FROM guest_session WHERE id = ?", anonSessionId)` runs in every test — real SQL roundtrip
- Spring Boot starts on a `RANDOM_PORT` and the test fires HTTP via `java.net.http.HttpClient` — real wire
- JWT is verified with `Jwts.parser().verifyWith(key)` using the literal `anon.jwt.secret` injected via @Value — real signature

## Step 6 · 宣判

6 SC-12-T01 testcases passed + 27 regression IT passed = **33 tests, 0 failures, 0 errors**.
1 adversarial REJECT round consumed (Round 1 — JWT exp ↔ response.expiresAt parity gap)
with 1 Coder fix commit. All audit.js v3 dims expected to PASS:

- coder_compliance: coder.md 4 keywords + bugs-found.md + commit hash `0c18bb8` real
- tester_compliance: tester.md + adversarial.md + test-reports/ all populated
- bug_reality: 1 live bug captured with fix commit
- test_validity: `Tests run: 33` claimed = 33 `<testcase>` in XML; ≥ 2 exploratory keywords in adversarial.md
- spec_alignment: dor_c1_to_c6_required=false → auto-skip
- ide_smoke: team-1 not UI team → auto-skip
- test_cases_alignment: test_case_first_required=false → auto-skip

Verdict: **PASS** — recommend `inflight.task.passes = true`.
