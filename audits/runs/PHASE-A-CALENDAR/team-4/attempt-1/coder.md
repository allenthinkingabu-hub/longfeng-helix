# Coder Work Log · PHASE-A-CALENDAR · team-4 · attempt-1

## 1. 地形侦察

**读取文档**:
- `backend/BACKEND_GUIDANCE.md` 全文 — 13 章节 (Pattern-first / Common-first / Idempotency-first / Migration-as-code / Test-pyramid)
- `biz/业务与技术解决方案_AI错题本_基于日历系统.md §2A.4 S5` — 艾宾浩斯计划引擎 + 日历联动
- `design/system/pages/P09-review-done.spec.md §5` — API 触点 #3 `POST /api/calendar/events/{eid}/subscribe`
- `.harness/inflight/PHASE-A-CALENDAR.json` — sandbox config (PG:15435, Redis:16382, MinIO:9006)

**标杆模板 (Reference Template)**:
- `backend/file-service/` — Entity pattern (SnowflakeId, @Version, soft-delete, @CreatedDate/@LastModifiedDate)
- `backend/review-plan-service/` — Feign client contract (`CalendarFeignClient.java`), outbox pattern, CalendarBatchCreateService
- `backend/review-plan-service/src/main/java/com/longfeng/reviewplan/feign/dto/` — CalendarEventCreateReq / CalendarSubscribeResp shape

**Feign 契约确认**:
| Method | Path | Contract Source |
|---|---|---|
| POST | `/internal/events/batch` | CalendarFeignClient.batchCreateEvents |
| POST | `/internal/calendar/events/{eid}/subscribe` | CalendarFeignClient.subscribe |
| GET | `/calendar/nodes?date=` | CalendarFeignClient.getNodes |
| DELETE | `/internal/events?relationType=&relationIdPrefix=` | biz FORGOT cascade (§2B.5) |
| POST | `/api/calendar/events/{eid}/subscribe` | P09 spec §5 #3 |

## 2. 编码

**Flyway Migration**:
- `V1.0.067__calendar_event.sql` — CREATE TABLE calendar_event (id BIGINT PK, relation_type, relation_id, owner_id, title, start_at, end_at, state, color_tag, source, idempotency_key, subscribed, version, created_at, updated_at, deleted_at) + 3 indexes (uk_idem_key, idx_owner_start, idx_relation)

**Entity**: `CalendarEvent.java` — @Entity + @SQLDelete + @SQLRestriction("deleted_at IS NULL") + @Version + @CreatedDate/@LastModifiedDate + SnowflakeId
**Repository**: `CalendarEventRepository.java` — findByIdempotencyKey, findByOwnerIdAndStartAtBetween, softDeleteByRelation (JPQL UPDATE)
**DTOs**: CalendarEventCreateReq (request), CalendarEventResp (response record), CalendarSubscribeResp (response record)
**Service**: `CalendarEventService.java`:
  - `batchCreate()` — iterates reqs, idempotent per idempotency_key (check + saveAndFlush + DataIntegrityViolation fallback)
  - `subscribe()` — findById, set subscribed=true+subscribedAt, idempotent
  - `findByOwnerAndDate()` — date→Instant range by timezone
  - `softDeleteByRelation()` — JPQL UPDATE for FORGOT cascade
**Controllers**:
  - `CalendarInternalController` — POST /internal/events/batch, POST /internal/calendar/events/{eid}/subscribe, DELETE /internal/events
  - `CalendarApiController` — POST /api/calendar/events/{eid}/subscribe (ApiResult wrapped), GET /api/calendar/events
  - `CalendarNodesController` — GET /calendar/nodes (Feign target, no /api prefix)
**Config**: `JpaConfig.java` — @EnableJpaRepositories + @EntityScan + @EnableJpaAuditing
**Support**: `SnowflakeIdGenerator.java` — worker-id=3 (file-service=1, review-plan=5)
**Application**: scanBasePackages = {"com.longfeng.calendar", "com.longfeng.common"}
**application.yml**: port 18080, PG localhost:5432, validate, Flyway classpath:db/migration
**pom.xml**: +Testcontainers (postgresql, junit-jupiter), override parent testExcludes, +failsafe plugin

Commits:
- `cdf3335` — feat(calendar-core): V1.0.067 Flyway migration
- `758d495` — feat(calendar-core): entity + repo + service + controllers + config
- `a1e3f8c` — test(calendar-core): CalendarCoreIT 6 IT tests

## 3. 真实 E2E

**后端 IT (Testcontainers 接 sandbox PG:15435)**:

`CalendarCoreIT.java` — 6 tests, real PG sandbox (port 15435), `mvn verify BUILD SUCCESS`:

| # | Test | Endpoint | Assertion |
|---|---|---|---|
| ① | batchCreate_7Events | POST /internal/events/batch | 7 STUDY events created, DB count=7 |
| ② | batchCreate_idempotent | POST /internal/events/batch ×2 | Replay returns 7, DB still 7 |
| ③ | subscribeInternal | POST /internal/calendar/events/{eid}/subscribe | subscribed=true, idempotent replay |
| ④ | subscribePublic | POST /api/calendar/events/{eid}/subscribe | ApiResult.code=0, data.subscribed=true |
| ⑤ | forgotCascade_softDelete | DELETE /internal/events | Active count → 0, total still 7 (soft-deleted) |
| ⑥ | getNodes_byDate | GET /calendar/nodes?date=2026-05-15 | Returns 1 event for T0 (2h offset) |

**verify.log**: `audits/runs/PHASE-A-CALENDAR/team-4/attempt-1/test-reports/e2e/coder/backend-it/verify.log`
- `grep -q "BUILD SUCCESS" verify.log` → ✓
- Tests run: 6, Failures: 0, Errors: 0, Skipped: 0

**failsafe XML**: `audits/runs/PHASE-A-CALENDAR/team-4/attempt-1/test-reports/e2e/coder/backend-it/failsafe-xml/TEST-com.longfeng.calendar.CalendarCoreIT.xml`

**Note**: physical_verification.dor_c1_to_c6_required=false (PHASE-A backend service, no frontend E2E). C-2/C-4/C-5/C-6 N/A. C-3 (verify.log BUILD SUCCESS) satisfied.

## 4. 自检

| 铁律 | 做了吗 | 证据 |
|---|---|---|
| 铁律1 单一专注 | ✓ | 只做 PHASE-A-CALENDAR 任务 |
| 铁律2 工作区隔离 | ✓ | 只在 claude/phase-a-calendar 分支修改 |
| 铁律3 权限隔离 | ✓ | 只改 dev_done + git_commits，不碰 passes |
| 铁律4 Git Commits 描述性 | ✓ | 3 commits: cdf3335, 758d495, a1e3f8c |
| 铁律5 落盘工作日志 | ✓ | coder.md + bugs-found.md 在 work_log_dir |
| 铁律6 E2E/IT 真跑 | ✓ | mvn verify BUILD SUCCESS, 6/6 IT GREEN |
| Rule 3 Surgical | ✓ | 只改 calendar-core + 1 Flyway migration |
| Rule 6 tool budget | ✓ | ~45 tool uses, under 50 soft line |
| Rule 11 标杆对齐 | ✓ | Entity/Repo/Service/Controller 模式与 file-service/review-plan-service 对齐 |
| Rule 12 Fail loud | ✓ | 所有 IT 真跑真过, 无跳过 |

## 5. 提交

| Hash | 描述 |
|---|---|
| `cdf3335` | feat(calendar-core): V1.0.067 Flyway migration · calendar_event table + indexes |
| `758d495` | feat(calendar-core): entity + repo + service + controllers + config · Feign target for review-plan-service |
| `a1e3f8c` | test(calendar-core): CalendarCoreIT · 6 IT tests · real PG sandbox 15435 · mvn verify BUILD SUCCESS |

`dev_done=true` · `mvn verify BUILD SUCCESS` 唯一硬条件已满足。
