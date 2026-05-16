package com.longfeng.reviewplan.service;

import com.longfeng.reviewplan.util.WeekBoundaryUtil;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import javax.sql.DataSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/**
 * SC-16-T01 · weekly_aggregate service · 单一聚合源 · 同时供应 /api/home/weekly + /today.weekSummary.
 *
 * <p><b>不变量 INV-1 (key_invariants[0])</b>: 全仓只此一处 SQL 聚合 · 两个 controller 各调一次
 * (字面 grep `wb_review_record` SELECT 在 review-plan-service 仓 main 路径下只出现 1 处).
 *
 * <p><b>不变量 INV-3 (key_invariants[2])</b>: ISO 8601 week (周一开始 · student_tz 边界) ·
 * 反 wall-clock 依赖 · production code 0 命中 {@code LocalDate.now()} / {@code Instant.now()} ·
 * 统一通过注入的 {@link Clock} 取当前时间.
 *
 * <p><b>聚合契约</b> (biz §10.14 字面照实现):
 * <ul>
 *   <li>{@code masteryRate} = count(grade=MASTERED) / count(grade IS NOT NULL) · 空周 null
 *   <li>{@code sparkline[7]} = 同 masteryRate · groupBy day(reviewed_at AT student_tz) ·
 *       空日 null (不 forward-fill · 不 0)
 *   <li>{@code streak} = yesterday-back · 今天有 GRADED 则 +1
 *   <li>{@code newCount} = count(wb_question) where created_at ∈ [thisWeek] · 空周 0
 * </ul>
 *
 * <p><b>反 anti_pattern</b>:
 * <ul>
 *   <li>{@code @Cacheable} 0 命中 (test-cases.md Case 4 · spec §5.3 "两端均不缓存")
 *   <li>两段 SQL fork 0 命中 (audit grep `wb_review_record` SELECT 字面只 1 处)
 *   <li>空周 masteryRate=0.0 / sparkline 0 / forward-fill 全部 0 命中
 * </ul>
 */
@Service
public class WeeklyAggregateService {

  private final JdbcTemplate jdbc;
  private final Clock clock;

  // -------- biz §10.14 字段 1 · masteryRate · 单一字面 SELECT (INV-1) --------
  // 聚合: grade IS NOT NULL 做分母 · grade='MASTERED' 做分子 · 空周分母为 0 服务层判 null.
  // groupBy day(reviewed_at AT student_tz) → 7 行 daily 数据.
  private static final String AGGREGATE_DAILY_GRADED_SQL =
      "SELECT date_trunc('day', reviewed_at AT TIME ZONE ?) AS day_tz, "
          + "       COUNT(*) FILTER (WHERE grade IS NOT NULL) AS graded, "
          + "       COUNT(*) FILTER (WHERE grade = 'MASTERED') AS mastered, "
          + "       COALESCE(SUM(duration_sec) FILTER (WHERE grade IS NOT NULL), 0) AS duration_sec_sum "
          + "FROM wb_review_record "
          + "WHERE student_id = ? AND reviewed_at >= ? AND reviewed_at < ? "
          + "GROUP BY 1";

  // 上周 masteryRate (用于 masteryDelta · 不返回 sparkline)
  private static final String AGGREGATE_PREV_WEEK_MASTERY_SQL =
      "SELECT COUNT(*) FILTER (WHERE grade IS NOT NULL) AS graded, "
          + "       COUNT(*) FILTER (WHERE grade = 'MASTERED') AS mastered "
          + "FROM wb_review_record "
          + "WHERE student_id = ? AND reviewed_at >= ? AND reviewed_at < ?";

  // 学科雷达: groupBy subject_code
  private static final String AGGREGATE_SUBJECT_SQL =
      "SELECT q.subject_code AS subject, "
          + "       COUNT(*) FILTER (WHERE r.grade IS NOT NULL) AS graded, "
          + "       COUNT(*) FILTER (WHERE r.grade = 'MASTERED') AS mastered "
          + "FROM wb_review_record r "
          + "JOIN wb_question q ON r.question_id = q.id AND q.deleted_at IS NULL "
          + "WHERE r.student_id = ? AND r.reviewed_at >= ? AND r.reviewed_at < ? "
          + "GROUP BY q.subject_code";

  // 薄弱 KP: 本周 grade='FORGOT' 按 kp_id 计数 + 历史总错次数 (排序键: 本周 FORGOT count DESC)
  // INV-4: 按 recentMissCount DESC limit 3 · 不允许按 totalMissCount 排
  private static final String AGGREGATE_WEAK_KP_SQL =
      "SELECT q.kp_id, q.kp_name, q.subject_code, "
          + "       COUNT(*) FILTER (WHERE r.reviewed_at >= ? AND r.reviewed_at < ? "
          + "                         AND r.grade = 'FORGOT') AS recent_miss, "
          + "       COUNT(*) FILTER (WHERE r.grade = 'FORGOT') AS total_miss "
          + "FROM wb_question q "
          + "LEFT JOIN wb_review_record r ON r.question_id = q.id AND r.student_id = q.owner_id "
          + "WHERE q.owner_id = ? AND q.deleted_at IS NULL AND q.kp_id IS NOT NULL "
          + "GROUP BY q.kp_id, q.kp_name, q.subject_code "
          + "HAVING COUNT(*) FILTER (WHERE r.reviewed_at >= ? AND r.reviewed_at < ? "
          + "                         AND r.grade = 'FORGOT') > 0";

  // 失败题 top 5: 本周 FORGOT 按 question_id 计数
  private static final String AGGREGATE_FAILED_TOP_SQL =
      "SELECT r.question_id, q.subject_code, COUNT(*) AS miss_count "
          + "FROM wb_review_record r "
          + "JOIN wb_question q ON r.question_id = q.id AND q.deleted_at IS NULL "
          + "WHERE r.student_id = ? AND r.reviewed_at >= ? AND r.reviewed_at < ? "
          + "  AND r.grade = 'FORGOT' "
          + "GROUP BY r.question_id, q.subject_code "
          + "ORDER BY miss_count DESC LIMIT 5";

  // newCount: 本周新建 wb_question
  private static final String AGGREGATE_NEW_COUNT_SQL =
      "SELECT COUNT(*) FROM wb_question "
          + "WHERE owner_id = ? AND created_at >= ? AND created_at < ? AND deleted_at IS NULL";

  // streak yesterday-back: 找 last GRADED 日序列 · 直接查所有 GRADED 日 (limit 60 防失控)
  private static final String AGGREGATE_GRADED_DAYS_SQL =
      "SELECT DISTINCT date_trunc('day', reviewed_at AT TIME ZONE ?) AS day_tz "
          + "FROM wb_review_record "
          + "WHERE student_id = ? AND grade IS NOT NULL "
          + "  AND reviewed_at >= ? AND reviewed_at < ? "
          + "ORDER BY day_tz DESC";

  @Autowired
  public WeeklyAggregateService(DataSource dataSource, Clock clock) {
    this.jdbc = new JdbcTemplate(dataSource);
    this.clock = clock;
  }

  /**
   * SC-16-T01 单一聚合入口 · 同时供应 /weekly 完整 + /today.weekSummary 投影.
   *
   * @param studentId 学生 ID (X-User-Id Header 透传值)
   * @param tz 学生时区 (e.g. Asia/Shanghai)
   * @return raw POJO 含所有可能字段 · controller 各自投影
   */
  public WeeklyAggregateRaw aggregate(long studentId, ZoneId tz) {
    Instant now = clock.instant();
    Instant weekStart = WeekBoundaryUtil.weekStart(now, tz);
    Instant weekEnd = WeekBoundaryUtil.weekEnd(now, tz);
    Instant prevWeekStart = WeekBoundaryUtil.previousWeekStart(now, tz);

    String weekLabel = WeekBoundaryUtil.isoWeekLabel(now, tz);
    LocalDate mondayDate = weekStart.atZone(tz).toLocalDate();
    LocalDate sundayDate = mondayDate.plusDays(6);

    // ---- 字段 1+2 · 本周 daily 聚合 (含 sparkline + masteryRate + duration_sec sum) ----
    String tzId = tz.getId();
    List<DailyAggRow> dailyRows = jdbc.query(
        AGGREGATE_DAILY_GRADED_SQL,
        (rs, n) -> new DailyAggRow(
            rs.getTimestamp("day_tz"),
            rs.getLong("graded"),
            rs.getLong("mastered"),
            rs.getLong("duration_sec_sum")),
        tzId, studentId, Timestamp.from(weekStart), Timestamp.from(weekEnd));

    // 7 天 sparkline · index 0 = 周一 · 6 = 周日 · 空日 null (不 forward-fill · biz §10.14 字段 2)
    Double[] sparkline = new Double[7];
    long totalGraded = 0L;
    long totalMastered = 0L;
    long totalDurationSec = 0L;
    Map<LocalDate, DailyAggRow> dailyMap = new HashMap<>();
    for (DailyAggRow row : dailyRows) {
      LocalDate dayLocal = row.dayTzTs.toInstant().atZone(tz).toLocalDate();
      dailyMap.put(dayLocal, row);
      totalGraded += row.graded;
      totalMastered += row.mastered;
      totalDurationSec += row.durationSecSum;
    }
    for (int i = 0; i < 7; i++) {
      LocalDate day = mondayDate.plusDays(i);
      DailyAggRow row = dailyMap.get(day);
      if (row == null || row.graded == 0L) {
        sparkline[i] = null; // 空日 null · biz §10.14 字段 2
      } else {
        sparkline[i] = (double) row.mastered / (double) row.graded;
      }
    }

    Double masteryRate;
    if (totalGraded == 0L) {
      masteryRate = null; // 空周 null · biz §10.14 字段 1
    } else {
      masteryRate = (double) totalMastered / (double) totalGraded;
    }

    // ---- masteryDelta · 上周聚合 ----
    Double prevMasteryRate;
    List<long[]> prevRows = jdbc.query(
        AGGREGATE_PREV_WEEK_MASTERY_SQL,
        (rs, n) -> new long[] {rs.getLong("graded"), rs.getLong("mastered")},
        studentId, Timestamp.from(prevWeekStart), Timestamp.from(weekStart));
    if (prevRows.isEmpty() || prevRows.get(0)[0] == 0L) {
      prevMasteryRate = null;
    } else {
      prevMasteryRate = (double) prevRows.get(0)[1] / (double) prevRows.get(0)[0];
    }
    Double masteryDelta;
    if (masteryRate == null || prevMasteryRate == null) {
      masteryDelta = null; // biz §10.14 "delta 派生" 一边 null → null
    } else {
      masteryDelta = masteryRate - prevMasteryRate;
    }

    // ---- 学科雷达 ----
    List<SubjectRadarRaw> subjectRadar = jdbc.query(
        AGGREGATE_SUBJECT_SQL,
        (rs, n) -> {
          long graded = rs.getLong("graded");
          long mastered = rs.getLong("mastered");
          Double rate = graded == 0L ? null : (double) mastered / (double) graded;
          return new SubjectRadarRaw(rs.getString("subject"), rate, (int) graded);
        },
        studentId, Timestamp.from(weekStart), Timestamp.from(weekEnd));

    // ---- 薄弱 KP top 3 (INV-4 按 recentMissCount DESC) ----
    List<WeakKpRaw> weakKpsAll = jdbc.query(
        AGGREGATE_WEAK_KP_SQL,
        (rs, n) -> new WeakKpRaw(
            rs.getString("kp_id"),
            rs.getString("kp_name"),
            rs.getString("subject_code"),
            rs.getInt("recent_miss"),
            rs.getInt("total_miss")),
        Timestamp.from(weekStart), Timestamp.from(weekEnd), studentId,
        Timestamp.from(weekStart), Timestamp.from(weekEnd));
    weakKpsAll.sort(Comparator.comparingInt((WeakKpRaw w) -> w.recentMissCount).reversed());
    List<WeakKpRaw> weakKps = weakKpsAll.size() > 3 ? weakKpsAll.subList(0, 3) : weakKpsAll;

    // ---- 失败题 top 5 ----
    List<FailedQRaw> failedTop = jdbc.query(
        AGGREGATE_FAILED_TOP_SQL,
        (rs, n) -> new FailedQRaw(
            rs.getString("question_id"), rs.getString("subject_code"), rs.getInt("miss_count")),
        studentId, Timestamp.from(weekStart), Timestamp.from(weekEnd));

    // ---- newCount ----
    Integer newCount = jdbc.queryForObject(
        AGGREGATE_NEW_COUNT_SQL, Integer.class,
        studentId, Timestamp.from(weekStart), Timestamp.from(weekEnd));
    int newCountInt = newCount == null ? 0 : newCount;

    // ---- streak · yesterday-back (biz §10.14 字段 3) ----
    int streak = computeStreak(studentId, tz, now);

    return new WeeklyAggregateRaw(
        weekLabel,
        mondayDate.toString(),
        sundayDate.toString(),
        masteryRate,
        masteryDelta,
        java.util.Arrays.asList(sparkline),
        subjectRadar,
        weakKps,
        (int) totalGraded,
        (int) (totalDurationSec / 60L),
        newCountInt,
        failedTop,
        streak);
  }

  /**
   * biz §10.14 字段 3 字面: streak 从昨天起往回数连续 N 天每日 ≥ 1 GRADED · 今天有 GRADED 则 +1.
   *
   * <p>public 暴露给单测 (AC8 类 #1 corner: 跨月 / 跨年 / 首日 / DST / 负数防御). 仅 service 内部 +
   * 测试调用 · 不挂任何 controller 暴露给 HTTP 层 (privacy by convention).
   */
  public int computeStreak(long studentId, ZoneId tz, Instant now) {
    LocalDate today = WeekBoundaryUtil.todayLocalDate(now, tz);
    // 取近 60 天 GRADED 日 (防失控扫全表 · streak > 60 罕见)
    Instant scanStart = today.minusDays(60).atStartOfDay(tz).toInstant();
    Instant scanEnd = today.plusDays(1).atStartOfDay(tz).toInstant();

    List<LocalDate> gradedDaysDesc = new ArrayList<>(jdbc.query(
        AGGREGATE_GRADED_DAYS_SQL,
        (rs, n) -> rs.getTimestamp("day_tz").toInstant().atZone(tz).toLocalDate(),
        tz.getId(), studentId, Timestamp.from(scanStart), Timestamp.from(scanEnd)));

    java.util.Set<LocalDate> gradedSet = new java.util.HashSet<>(gradedDaysDesc);

    int streak = 0;
    // yesterday-back loop
    LocalDate cursor = today.minusDays(1);
    while (gradedSet.contains(cursor)) {
      streak++;
      cursor = cursor.minusDays(1);
    }
    // 今天 +1 if today has GRADED
    if (gradedSet.contains(today)) {
      streak++;
    }
    return Math.max(0, streak); // 负数防御 (biz §10.14 字段 3 boundary)
  }

  // ============================================================================
  // 内部 raw POJO · controller 各自投影
  // ============================================================================

  /** weekly_aggregate raw 输出 · /weekly + /today 共享投影源. */
  public static final class WeeklyAggregateRaw {
    public final String weekLabel;
    public final String rangeFromIso;
    public final String rangeToIso;
    public final Double masteryRate;
    public final Double masteryDelta;
    public final List<Double> sparkline;
    public final List<SubjectRadarRaw> subjectRadar;
    public final List<WeakKpRaw> weakKps;
    public final int reviewedCount;
    public final int reviewedDurationMin;
    public final int newCount;
    public final List<FailedQRaw> failedTop;
    public final int streak;

    public WeeklyAggregateRaw(
        String weekLabel,
        String rangeFromIso,
        String rangeToIso,
        Double masteryRate,
        Double masteryDelta,
        List<Double> sparkline,
        List<SubjectRadarRaw> subjectRadar,
        List<WeakKpRaw> weakKps,
        int reviewedCount,
        int reviewedDurationMin,
        int newCount,
        List<FailedQRaw> failedTop,
        int streak) {
      this.weekLabel = weekLabel;
      this.rangeFromIso = rangeFromIso;
      this.rangeToIso = rangeToIso;
      this.masteryRate = masteryRate;
      this.masteryDelta = masteryDelta;
      this.sparkline = sparkline;
      this.subjectRadar = subjectRadar;
      this.weakKps = weakKps;
      this.reviewedCount = reviewedCount;
      this.reviewedDurationMin = reviewedDurationMin;
      this.newCount = newCount;
      this.failedTop = failedTop;
      this.streak = streak;
    }
  }

  public record SubjectRadarRaw(String subject, Double masteryRate, int sampleSize) {}

  public record WeakKpRaw(
      String kpId, String kpName, String subject, int recentMissCount, int totalMissCount) {}

  public record FailedQRaw(String questionId, String subject, int missCount) {}

  private static final class DailyAggRow {
    final Timestamp dayTzTs;
    final long graded;
    final long mastered;
    final long durationSecSum;

    DailyAggRow(Timestamp dayTzTs, long graded, long mastered, long durationSecSum) {
      this.dayTzTs = dayTzTs;
      this.graded = graded;
      this.mastered = mastered;
      this.durationSecSum = durationSecSum;
    }
  }
}
