# Bugs Found · PHASE-A-CALENDAR · team-4 · attempt-1

## Bug List

### Bug 1: Flyway migration failure in IT due to common JAR cross-service dependencies

**File**: `backend/calendar-core/src/test/java/com/longfeng/calendar/IntegrationTestBase.java`
**Description**: When Flyway was enabled in IT, it tried to run all migrations from the common JAR including `V1.0.066__review_plan_outbox_calendar_event_type.sql` which references `review_plan_outbox` table that doesn't exist in a calendar-only DB. This caused all 6 IT tests to fail with `ApplicationContext failure`.
**Fix**: Disabled Flyway in IT (`spring.flyway.enabled=false`), set `ddl-auto=none`, and bootstrapped the calendar_event table schema via JDBC in `@BeforeEach`. Pattern aligned with file-service IntegrationTestBase.
**Commit**: `a1e3f8c`

Total bugs: 1
