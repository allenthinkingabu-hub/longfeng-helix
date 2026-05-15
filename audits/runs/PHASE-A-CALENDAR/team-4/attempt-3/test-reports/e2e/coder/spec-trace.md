# Spec Trace · PHASE-A-CALENDAR · calendar-core

## API Endpoint → Test Case Mapping

| # | API Path | Method | Feign Contract | IT Test (CalendarCoreIT) | Playwright Test | Screenshot |
|---|---|---|---|---|---|---|
| 1 | `/internal/events/batch` | POST | CalendarFeignClient.batchCreateEvents | batchCreate_7Events | 1-batch-create | 01-02 |
| 2 | `/internal/events/batch` (replay) | POST | idempotency_key unique | batchCreate_idempotent | 2-batch-create-idempotent | 03-04 |
| 3 | `/internal/calendar/events/{eid}/subscribe` | POST | CalendarFeignClient.subscribe | subscribeInternal | 3-subscribe-internal | 05-06 |
| 4 | `/api/calendar/events/{eid}/subscribe` | POST | P09 spec §5 #3 | subscribePublic | 4-subscribe-public | 07-08 |
| 5 | `/internal/events` | DELETE | FORGOT cascade (§2B.5) | forgotCascade_softDelete | 5-forgot-cascade | 09-10 |
| 6 | `/calendar/nodes?date=` | GET | CalendarFeignClient.getNodes | getNodes_byDate | 6-get-nodes | 11-12 |

## State Machine Coverage

| State | Transition | IT Assertion | Playwright Assertion |
|---|---|---|---|
| SCHEDULED (default) | batchCreate → event.state=SCHEDULED | ✓ relationType=STUDY | ✓ body[0].relationType=STUDY |
| subscribed=false → true | subscribe → subscribed=true | ✓ subscribed=true | ✓ resp.subscribed=true |
| active → soft-deleted | softDelete → deleted_at IS NOT NULL | ✓ active count → 0 | ✓ deletedCount=3 |
| query by date | findByOwnerAndDateRange [from, to) | ✓ returns 1 event for date | ✓ GET /calendar/nodes returns events |

## Bug Found During E2E

| Bug | File | Fix Commit |
|---|---|---|
| JavaScript BigInt precision loss on Snowflake IDs | Playwright test `extractId()` workaround | N/A (test-side fix, not production code) |
| Date range query used inclusive `to` bound | `CalendarEventRepository.java` | `b94e6d3` |
