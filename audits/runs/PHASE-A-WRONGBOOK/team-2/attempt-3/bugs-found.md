# Bugs Found · PHASE-A-WRONGBOOK · team-2 · attempt-3

## Bug 1 · Flyway V1.0.066 conflicts with clean wrongbook DB
- **File**: `backend/common/src/main/resources/db/migration/V1.0.066__review_plan_outbox_calendar_event_type.sql`
- **Description**: V1.0.066 from common.jar references `review_plan_outbox` table which doesn't exist in wrongbook database. On a fresh DB, Flyway fails with `relation "review_plan_outbox" does not exist`.
- **Fix**: Moved wrongbook migrations to `db/wrongbook/` classpath isolated from common's `db/migration/`. Configured `spring.flyway.locations=classpath:db/wrongbook`.
- **Commit**: `4666881` (application.yml Flyway locations) + `7ea3934` (migration in db/wrongbook/)

## Bug 2 · @CreatedDate with OffsetDateTime incompatible in Spring Data 3.2.5
- **File**: `WrongItem.java` @CreatedDate + @LastModifiedDate with OffsetDateTime fields
- **Description**: Spring Data auditing `DefaultAuditableBeanWrapperFactory` throws `Cannot convert unsupported date type java.time.LocalDateTime to java.time.OffsetDateTime` when `@CreatedDate` targets OffsetDateTime fields.
- **Fix**: Removed `@CreatedDate`/`@LastModifiedDate`/`@EntityListeners(AuditingEntityListener.class)` from WrongItem. Set createdAt/updatedAt manually in WrongItemService.
- **Commit**: `f73b941`

## Bug 3 · JSONB column type mismatch with String field
- **File**: `IdemKey.java` payload field mapped as String but column is JSONB
- **Description**: PostgreSQL rejects `INSERT INTO idem_key ... payload=?` with `column "payload" is of type jsonb but expression is of type character varying`.
- **Fix**: Added `?stringtype=unspecified` to JDBC URL so PG driver treats all String params as server-decided type.
- **Commit**: `4666881`

## Bug 4 · JPQL null parameter handling with Hibernate 6 + PostgreSQL
- **File**: `WrongItemRepository.java` findByFilters JPQL query
- **Description**: `(:subject IS NULL OR w.subject = :subject)` pattern fails with Hibernate 6 native query on PG — `could not determine data type of parameter $2`.
- **Fix**: Switched to native query with explicit `cast(:subject as varchar) IS NULL OR w.subject = cast(:subject as varchar)` pattern.
- **Commit**: `f73b941`

## Bug 5 · TestRestTemplate PATCH method not supported
- **File**: `WrongbookServiceIT.java` patchQuestion test
- **Description**: JDK `HttpURLConnection` (used by default `SimpleClientHttpRequestFactory`) does not support HTTP PATCH method, throwing `Invalid HTTP method: PATCH`.
- **Fix**: Used `java.net.http.HttpClient` for PATCH test instead of TestRestTemplate.
- **Commit**: `7aaa90e`
