# Tester Work Log · PHASE-A-REVIEW-PLAN · team-5 · attempt-1

## Test Environment

- **Database**: PostgreSQL 15.17 @ 127.0.0.1:15436/wrongbook (sandbox, NOT H2/embedded)
- **Credentials**: longfeng / longfeng_dev
- **Flyway**: enabled (out-of-order + baseline-on-migrate + ignore-migration-patterns)
- **MQ/Feign/Sentinel/Nacos**: disabled in IT
- **Build tool**: Maven 3.x + failsafe-plugin 3.1.2

## Commands Executed

```bash
# Independent Tester verification (not reusing Coder's output)
cd backend/review-plan-service
mvn verify -DskipTests=false
```

## Test Results

**5 testcase passed** (failsafe integration-test phase):

| Test Class | Test Method | Status |
|------------|-------------|--------|
| HomeTodayIT | empty_state_returns_zero_total_and_zero_done | PASS |
| HomeTodayIT | with_data_returns_correct_total_and_done | PASS |
| CalendarBatchCreateIT | happyPath_noOutboxRow | PASS |
| CalendarBatchCreateIT | feign503_retriesThreeTimesThenOutbox | PASS |
| CalendarBatchCreateIT | relayJob_picksUpOutboxAndDispatches | PASS |

**BUILD SUCCESS** · Total time: 03:01 min

## Verification Checklist

| Check | Result |
|-------|--------|
| mvn verify (not mvn test) | PASS - failsafe plugin ran IT tests |
| Real PG @ 15436 (not H2/embedded) | PASS - HikariPool connected to jdbc:postgresql://127.0.0.1:15436/wrongbook |
| Flyway enabled | PASS - "Current version of schema public: 1.0.066" |
| No H2 driver in classpath | PASS - only PostgreSQL runtime dependency |
| Failsafe XML generated | PASS - 2 XML files (HomeTodayIT + CalendarBatchCreateIT) |
| Testcase count matches XML | PASS - 5 testcases (2+3) in XML `<testcase>` elements |
| Mock count <= 5 | PASS - 1 TogglableCalendarStub (Feign stub for external service), no vi.mock/page.route/jest.mock |
| git_commits all real | PASS - 6 commits (5ab782f, 370bcbe, 8261dd3, 957f97a, d6e39e3, cbb5c76) verified via git log |

## Adversarial Findings

1 round of REJECT + fix documented in `adversarial.md`:
- **REJECT**: Stale Javadoc/comments in IntegrationTestBase.java and HomeTodayIT.java referencing wrong port (15432) and disabled Flyway state
- **FIX**: Updated comments to reflect PHASE-A reality (port 15436, Flyway enabled)
- **Re-verify**: BUILD SUCCESS, 5 testcases passed, no regression

## Test Reports Archived

- `test-reports/failsafe-reports/TEST-com.longfeng.reviewplan.HomeTodayIT.xml`
- `test-reports/failsafe-reports/TEST-com.longfeng.reviewplan.service.CalendarBatchCreateIT.xml`
- `test-reports/failsafe-reports/failsafe-summary.xml`
- `test-reports/tester-verify.log` (Tester's independent mvn verify output)
