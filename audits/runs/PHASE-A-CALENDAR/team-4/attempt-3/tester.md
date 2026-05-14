# Tester Work Log · PHASE-A-CALENDAR · team-4 · attempt-3

## Previous audit REDO context

- attempt-2 audit REDO: `coder_compliance.coder_md_exists` + `coder_compliance.bugs_found_md_exists` missing in attempt-2 dir. Coder fixed in attempt-3 (commit `6935dc7`).
- attempt-1 audit REDO: `test_validity.tester_md_testcase_count_matches_xml` claimed=6 != xml=12 due to duplicate XML in test-reports/. Fixed: attempt-3 test-reports/ contains only 1 failsafe XML.

## 验证命令

```bash
cd backend/calendar-core && mvn verify
```

## 测试结果

- **命令**: `mvn verify` (surefire unit + failsafe integration-test + verify phase)
- **BUILD**: SUCCESS
- **Failsafe** (IT): Tests run: 6, Failures: 0, Errors: 0, Skipped: 0 (CalendarCoreIT · real PG sandbox 15435)
- **Surefire** (unit): 1 ApplicationTests context load passed

## Testcase 明细 (= failsafe XML 6 个 `<testcase>`)

| # | Test Method | Endpoint | 验证内容 |
|---|---|---|---|
| 1 | batchCreate_7Events | POST /internal/events/batch | 创建 7 个 STUDY 事件, DB count=7 |
| 2 | batchCreate_idempotent | POST /internal/events/batch x2 | 幂等重放, DB 仍 7 |
| 3 | subscribeInternal | POST /internal/calendar/events/{eid}/subscribe | subscribed=true, 幂等重放, DB 验证 |
| 4 | subscribePublic | POST /api/calendar/events/{eid}/subscribe | ApiResult.code=0, data.subscribed=true |
| 5 | forgotCascade_softDelete | DELETE /internal/events | 软删除 7 条, active=0, total=7 (soft-deleted) |
| 6 | getNodes_byDate | GET /calendar/nodes?date=2026-05-15 | 返回 1 条 T0 事件 (半开区间验证) |

## 环境

- PG sandbox: localhost:15435 (real PostgreSQL container, not H2/embedded)
- Flyway: disabled in IT (common JAR cross-service migration conflict, pattern aligned with file-service)
- Schema: JDBC @BeforeEach bootstrap (CREATE TABLE IF NOT EXISTS)
- MockMvc: 1 (Spring Boot IT standard, not mock backend)

## 代码审查摘要

- Entity: soft-delete via @SQLDelete + @SQLRestriction, @Version optimistic lock, SnowflakeId
- Repository: @Query 半开区间 [from, to), JPQL soft-delete by relation LIKE
- Service: 幂等 batch create (unique index + DataIntegrityViolation fallback), idempotent subscribe
- Controllers: internal (Feign target) + public (ApiResult wrapped) + Feign nodes endpoint
- IT: 6 tests covering all 5 endpoints + DB assertions (JdbcTemplate) + real PG sandbox
