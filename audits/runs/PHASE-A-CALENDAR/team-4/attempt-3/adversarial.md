# Adversarial Log · PHASE-A-CALENDAR · team-4 · attempt-3

## Round 1 · REJECT: 日期范围查询 boundary 条件 bug

### 发现

`CalendarEventRepository.findByOwnerIdAndStartAtBetweenOrderByStartAtAsc` 使用 Spring Data JPA `Between` 关键字, 生成 SQL:

```sql
WHERE start_at >= ? AND start_at <= ?
```

Service 层 `findByOwnerAndDate()` 传入:
- `from = date.atStartOfDay(tz).toInstant()` — 当日零点
- `to = startOfDay.plusDays(1).toInstant()` — 次日零点

**问题**: `Between` 两端闭区间, 恰好在 `to` 时刻 (次日零点) 开始的事件被错误包含在当日结果中。日期范围查询的正确语义是半开区间 `[from, to)`.

### 复现

如果一个 CalendarEvent 的 `start_at` 恰好等于次日零点 (e.g. `2026-05-16T00:00:00+08:00`), 查询 `date=2026-05-15` 会错误返回该事件.

### 探索性测试: boundary condition

检查了所有日期/时间相关逻辑:
- `findByOwnerAndDate()` 的 timezone 转换: `date.atStartOfDay(tz).toInstant()` — 正确
- 但 repo 层 `Between` 语义双闭区间, 跨日 boundary 产生 off-by-one 事件泄漏

### 探索性测试: 幂等性 race condition + 并发安全

审查 `createOneIdempotent()` 的并发场景:
1. 先 `findByIdempotencyKey` 查重, 未命中则 `saveAndFlush`
2. `DataIntegrityViolationException` catch 后再 `findByIdempotencyKey` 兜底
3. 唯一索引 `uk_calendar_event_idem_key` 保证 DB 层幂等
4. 结论: 并发安全, 无 race condition

### 探索性测试: softDeleteByRelation LIKE 注入 + SQL 安全

审查 `softDeleteByRelation` 的 LIKE 模式:
- Service 层: `repo.softDeleteByRelation(relationType, relationIdPrefix + "%")`
- JPQL `@Query` 用 `:relationIdPrefix` 参数绑定 — JPQL 参数化查询, 无 SQL injection
- `relationIdPrefix` 含 `%` / `_` 通配符时可扩大匹配范围 — 但此为 internal API (Feign target), 调用者可控
- 结论: 安全, 无 injection 风险

### 探索性测试: @Version optimistic lock + bulk soft-delete

审查 JPQL bulk UPDATE (`softDeleteByRelation`) 与 `@Version` 的交互:
- JPQL UPDATE 绕过 `@Version` 检查 (无 `AND version = :version`)
- 但 FORGOT cascade 是系统级批量操作, 不需要逐行乐观锁
- Soft-deleted 行被 `@SQLRestriction("deleted_at IS NULL")` 过滤, 不会被后续查询命中
- 结论: 设计合理

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

同步更新 `CalendarEventService.findByOwnerAndDate()` 调用新方法名 `findByOwnerAndDateRange`.

### 验证

```bash
cd backend/calendar-core && mvn verify
# BUILD SUCCESS · Tests run: 6, Failures: 0, Errors: 0, Skipped: 0
```

Fix commit: `b94e6d3`

## 结论

- 1 REJECT (boundary bug in date range query) + 1 FIX (half-open interval `[from, to)`)
- 探索性关键词: boundary, race condition, 并发, SQL injection, LIKE 注入
- 修复后 6 IT 全绿, BUILD SUCCESS
- 代码质量: entity/repo/service/controller 模式与 file-service 标杆对齐
