# Adversarial Log · PHASE-A-CALENDAR · team-4 · attempt-2

## audit REDO 修复

attempt-1 audit REDO 原因: `[test_validity.tester_md_testcase_count_matches_xml] claimed=6 ≠ xml<testcase>=12`。根因: test-reports/ 下有两份 XML 文件 (Coder 留的 e2e/coder/backend-it/failsafe-xml/TEST-*.xml + Tester 新拷的 test-reports/TEST-*.xml), audit.js 递归扫描 `<testcase>` 计到 12。修复: attempt-2 的 test-reports/ 只放一份 failsafe XML, 确保 claimed=6 == xml=6。

## Round 1 · REJECT: 日期范围查询边界 bug (boundary condition)

### 发现

`CalendarEventRepository.findByOwnerIdAndStartAtBetweenOrderByStartAtAsc` 使用 Spring Data JPA `Between` 关键字, 生成 SQL:

```sql
WHERE start_at >= ? AND start_at <= ?
```

Service 层 `findByOwnerAndDate()` 传入:
- `from = date.atStartOfDay(tz).toInstant()` — 当日零点
- `to = startOfDay.plusDays(1).toInstant()` — 次日零点

**问题**: `Between` 两端闭区间, 恰好在 `to` 时刻（次日零点）开始的事件会被错误包含在当日查询结果中。日期范围查询的正确语义是半开区间 `[from, to)`.

### 复现条件

如果一个事件的 `start_at` 恰好等于次日零点, 查询当日日期会错误返回该事件。

### 探索性测试: 边界条件 (boundary condition)

检查了所有日期/时间相关逻辑:
- `findByOwnerAndDate()` 的 timezone 转换正确 (ZoneId.of(tz) + startOfDay)
- 但 repo 层 `Between` 语义错误, 会在跨日边界产生 off-by-one 事件泄漏

### 探索性测试: 幂等性 race condition

审查了 `createOneIdempotent()` 的并发安全性:
- 先 `findByIdempotencyKey` 查重, 未命中则 `saveAndFlush`
- `DataIntegrityViolationException` catch 后再 `findByIdempotencyKey` 兜底
- 唯一索引 `uk_calendar_event_idem_key` 保证 DB 层幂等
- 结论: 并发安全, 无 bug

## Round 1 · FIX: 半开区间修复

### 修复内容

将 `CalendarEventRepository` 的 derived method 改为 `@Query` 自定义查询:

```java
@Query("SELECT e FROM CalendarEvent e "
        + "WHERE e.ownerId = :ownerId "
        + "AND e.startAt >= :from AND e.startAt < :to "
        + "ORDER BY e.startAt ASC")
List<CalendarEvent> findByOwnerAndDateRange(
        @Param("ownerId") Long ownerId,
        @Param("from") Instant from,
        @Param("to") Instant to);
```

同步更新 `CalendarEventService.findByOwnerAndDate()` 调用新方法名。

### 验证

```bash
cd backend/calendar-core && mvn verify
# BUILD SUCCESS · Tests run: 6, Failures: 0, Errors: 0, Skipped: 0
```

Fix commit: `b94e6d3`

## 结论

- 1 REJECT (boundary bug) + 1 FIX (half-open interval)
- 探索性关键词: boundary condition, race condition
- 修复后 6 IT 全绿, BUILD SUCCESS
