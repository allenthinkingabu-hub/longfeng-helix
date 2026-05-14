# Bugs Found · PHASE-A-CALENDAR · team-4 · attempt-3

## Bug List

- **Bug 1 · Flyway migration failure in IT due to common JAR cross-service dependencies**
  - File: `backend/calendar-core/src/test/java/com/longfeng/calendar/IntegrationTestBase.java`
  - Description: Flyway in IT tried to run all migrations from common JAR including references to `review_plan_outbox` table that doesn't exist in calendar-only DB.
  - Fix: Disabled Flyway in IT, bootstrapped schema via JDBC `@BeforeEach`. Pattern aligned with file-service.
  - Commit: `a1e3f8c`

- **Bug 2 · Date range query inclusive upper bound**
  - File: `backend/calendar-core/src/main/java/com/longfeng/calendar/repo/CalendarEventRepository.java`
  - Description: `findByOwnerAndDateRange` JPQL used `<= :to` (inclusive end) instead of `< :to` (half-open interval). Events at midnight boundary appeared in both adjacent days.
  - Fix: Changed to half-open interval `[from, to)` with `startAt >= :from AND startAt < :to`
  - Commit: `b94e6d3`

- **Bug 3 · JavaScript BigInt precision loss on Snowflake IDs (client-side, Playwright test)**
  - File: Playwright test (not production code)
  - Description: Snowflake IDs exceed JavaScript's `Number.MAX_SAFE_INTEGER`. `JSON.parse()` rounds the ID causing subscribe 404.
  - Workaround: Extract `id` via regex from raw JSON text in test code.
  - Note: Client-side concern for JS consumers. Production Feign callers unaffected.

Total bugs: 3 (2 production, 1 test-side)
