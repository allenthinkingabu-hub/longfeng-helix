# Adversarial Log · PHASE-A-REVIEW-PLAN · team-5 · attempt-2

## Previous Audit REDO (attempt-1)

**redo_reason**: `[test_validity.tester_md_testcase_count_matches_xml] claimed=5 ≠ xml<testcase>=10`
**Root cause**: Coder's archived XML (5 testcases) + Tester's archived XML (5 testcases) = 10 total, but tester.md claimed 5.
**Fix applied in attempt-2**: Only one set of failsafe XML in `test-reports/failsafe-reports/` (5 testcases total). No duplicate Coder archive.

---

## Round 1 · REJECT · Stale Javadoc/Comments in IT Infrastructure

### Issue Found

IntegrationTestBase.java and HomeTodayIT.java contain stale PHASE-0 comments that contradict the actual PHASE-A configuration:

| File | Line | Stale Content | Actual Reality |
|------|------|---------------|----------------|
| IntegrationTestBase.java | L11 Javadoc | "pgvector/pg16 @ 127.0.0.1:**15432**" | Port is **15436** (fixed in d6e39e3) |
| IntegrationTestBase.java | L14-16 Javadoc | "直接关闭 Flyway 自启" | Flyway is **enabled** (d6e39e3) |
| IntegrationTestBase.java | L24 static block | "因 flyway 已禁用" | Flyway IS enabled (`spring.flyway.enabled=true`) |
| HomeTodayIT.java | L36 Javadoc | "共享 pgvector @ 15432 · Flyway off" | PG @ 15436 · Flyway ON |

**Severity**: Medium. Misleading documentation that could cause future developers to make wrong assumptions about the test infrastructure.

**Rule violated**: CLAUDE.md Rule 12 (Fail loud) - silent inconsistency between comments and actual configuration.

### Reproduction

```bash
# Before fix (attempt-1 initial state):
grep -n "15432\|Flyway off\|flyway 已禁用" \
  backend/review-plan-service/src/test/java/com/longfeng/reviewplan/IntegrationTestBase.java \
  backend/review-plan-service/src/test/java/com/longfeng/reviewplan/HomeTodayIT.java
```

Confirmed stale references at IntegrationTestBase L11, L15, L24 and HomeTodayIT L36.

---

## Round 1 · FIX · Updated stale comments to reflect PHASE-A reality

### Changes Made (committed in 8b3953a)

1. **IntegrationTestBase.java Javadoc**: Updated to "sandbox PG @ 127.0.0.1:15436/wrongbook" and "Flyway 已启用 (out-of-order + baseline-on-migrate)"
2. **IntegrationTestBase.java static block comment**: Updated to "Flyway 前置安全网" instead of "因 flyway 已禁用"
3. **HomeTodayIT.java Javadoc**: Updated to "sandbox PG @ 15436 · Flyway on · MQ off"

### Re-verification

```bash
cd backend/review-plan-service && mvn verify -DskipTests=false
```

**Result**: BUILD SUCCESS · Tests run: 5, Failures: 0, Errors: 0, Skipped: 0

No regression. All 5 IT tests continue to pass against real PG @ 15436.

---

## Adversarial Assessment Summary

| Dimension | Verdict |
|-----------|---------|
| IT connects to real sandbox PG (not H2/embedded) | PASS - jdbc:postgresql://127.0.0.1:15436/wrongbook confirmed in logs |
| Flyway enabled and running migrations | PASS - "Current version of schema public: 1.0.066" in logs |
| No prohibited mocking (page.route/vi.mock/etc.) | PASS - only TogglableCalendarStub for external Feign boundary |
| Test data cleanup via JdbcTemplate DELETE | PASS - @BeforeEach cleanup by user_id boundary |
| Database assertions (not just API response checks) | PASS - JdbcTemplate queryForObject verifying outbox rows |
| Failsafe plugin executing IT (not surefire) | PASS - "maven-failsafe-plugin:3.1.2:integration-test" in logs |
| 5 testcases match XML count | PASS - 2 (HomeTodayIT) + 3 (CalendarBatchCreateIT) = 5, single XML set |
| Previous REDO reason addressed | PASS - eliminated duplicate XML, claimed count now matches |
