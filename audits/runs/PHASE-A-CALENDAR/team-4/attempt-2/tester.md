# Tester Work Log · PHASE-A-CALENDAR · team-4 · attempt-2

## audit REDO 修复

attempt-1 REDO 原因: `claimed=6 ≠ xml<testcase>=12` — test-reports/ 下有两份 XML (Coder 的 e2e/coder/backend-it/failsafe-xml/ + Tester 拷的根目录), audit.js 递归扫描计了 12。attempt-2 修复: test-reports/ 只放一份 failsafe XML。

## 验证命令

```bash
cd backend/calendar-core && mvn verify
```

## 测试结果

- **命令**: `mvn verify` (failsafe integration-test + verify phase)
- **BUILD**: SUCCESS
- **Tests run: 6, Failures: 0, Errors: 0, Skipped: 0**
- **Surefire** (unit): Tests run: 1 (ApplicationTests context load)
- **Failsafe** (IT): Tests run: 6 (CalendarCoreIT · 真 PG sandbox 15435)

## Testcase 明细 (= failsafe XML 6 个 `<testcase>`)

| # | Test Method | Endpoint | 验证内容 |
|---|---|---|---|
| 1 | batchCreate_7Events | POST /internal/events/batch | 创建 7 个 STUDY 事件, DB count=7 |
| 2 | batchCreate_idempotent | POST /internal/events/batch ×2 | 幂等重放, DB 仍 7 |
| 3 | subscribeInternal | POST /internal/calendar/events/{eid}/subscribe | subscribed=true, 幂等重放 |
| 4 | subscribePublic | POST /api/calendar/events/{eid}/subscribe | ApiResult.code=0, data.subscribed=true |
| 5 | forgotCascade_softDelete | DELETE /internal/events | 软删除 7 条, active=0, total=7 |
| 6 | getNodes_byDate | GET /calendar/nodes?date=2026-05-15 | 返回 1 条 T0 事件 |

## 环境

- PG sandbox: localhost:15435 (真 PostgreSQL 容器)
- Flyway: disabled in IT (common JAR cross-service migration conflict)
- Schema: JDBC @BeforeEach bootstrap
- Mock 计数: MockMvc=1 (Spring IT 标准做法, 非 mock 后端)

## 对抗修复 (from attempt-1)

- REJECT Round 1: `findByOwnerIdAndStartAtBetweenOrderByStartAtAsc` 日期范围边界 bug → 修复为 `@Query` 半开区间 `[from, to)`
- Fix commit: `b94e6d3`
- 修复后重跑: 6 IT 全绿, BUILD SUCCESS
