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

  // -------- 2026-05-18 用户决策: 全 service 切到 review_outcome + wrong_item --------
  // 数据源统一: review_outcome (复习页同源) + wrong_item (生产真表) ·
  // wb_review_record + wb_question (我 SC-16-T01 并行表) 不再用 · 生产实际数据全在前者.
  //
  // 字段映射:
  //   review_outcome.user_id        ← wb_review_record.student_id
  //   review_outcome.completed_at   ← wb_review_record.reviewed_at
  //   review_outcome.quality=5      ← grade='MASTERED'
  //   review_outcome.quality=0      ← grade='FORGOT'
  //   review_outcome.wrong_item_id  ← wb_review_record.question_id
  //   wrong_item.subject            ← wb_question.subject_code
  //   wrong_item.student_id         ← wb_question.owner_id
  //   wrong_item.kp_id / kp_name    ← 不存在 (spec gap · weakKPs 返空列表)

  // 本周 daily 聚合 (mastered/forgotten 计数 + duration)
  // duration_sec 在 review_outcome 没有列 · 用 60s 默认估算 (待 schema 补)
  private static final String AGGREGATE_DAILY_GRADED_SQL =
      "SELECT date_trunc('day', completed_at AT TIME ZONE ?) AS day_tz, "
          + "       COUNT(*) AS graded, "
          + "       COUNT(*) FILTER (WHERE quality = 5) AS mastered, "
          + "       COUNT(*) * 60 AS duration_sec_sum "
          + "FROM review_outcome "
          + "WHERE user_id = ? AND completed_at >= ? AND completed_at < ? "
          + "GROUP BY 1";

  // 学科雷达: groupBy wrong_item.subject · 用 avg ease 折算 (与 masteryRate 算法统一)
  private static final String AGGREGATE_SUBJECT_SQL =
      "SELECT w.subject AS subject, "
          + "       AVG(r.ease_factor_after) AS avg_ease, "
          + "       COUNT(*) AS sample_size "
          + "FROM review_outcome r "
          + "JOIN wrong_item w ON w.id = r.wrong_item_id AND w.deleted_at IS NULL "
          + "WHERE r.user_id = ? AND r.completed_at >= ? AND r.completed_at < ? "
          + "  AND r.ease_factor_after IS NOT NULL AND w.subject IS NOT NULL "
          + "GROUP BY w.subject";

  // 失败题 top 5: 本周 quality=0 按 wrong_item_id 计数 · 2026-05-18 加 origin_image_key
  // 用 MIN(image_key) 因 GROUP BY 不暴露 (同 wrong_item_id 必同 image_key · MIN 仅满足 SQL)
  private static final String AGGREGATE_FAILED_TOP_SQL =
      "SELECT r.wrong_item_id AS question_id, w.subject AS subject_code, "
          + "       COUNT(*) AS miss_count, MIN(w.origin_image_key) AS image_key "
          + "FROM review_outcome r "
          + "JOIN wrong_item w ON w.id = r.wrong_item_id AND w.deleted_at IS NULL "
          + "WHERE r.user_id = ? AND r.completed_at >= ? AND r.completed_at < ? "
          + "  AND r.quality = 0 "
          + "GROUP BY r.wrong_item_id, w.subject "
          + "ORDER BY miss_count DESC LIMIT 5";

  // newCount: 本周新增 wrong_item · 学生归属用 student_id
  private static final String AGGREGATE_NEW_COUNT_SQL =
      "SELECT COUNT(*) FROM wrong_item "
          + "WHERE student_id = ? AND created_at >= ? AND created_at < ? AND deleted_at IS NULL";

  // streak yesterday-back: review_outcome.completed_at distinct day (limit 60 防失控)
  private static final String AGGREGATE_GRADED_DAYS_SQL =
      "SELECT DISTINCT date_trunc('day', completed_at AT TIME ZONE ?) AS day_tz "
          + "FROM review_outcome "
          + "WHERE user_id = ? "
          + "  AND completed_at >= ? AND completed_at < ? "
          + "ORDER BY day_tz DESC";

  // 薄弱 KP top 3 (2026-05-18 用户决策 A · 真 AI 数据): JOIN analysis_result 拿 AI 已生成 KP
  // - task_id == wrong_item.id (SC01-MP-BUG-AI-FAKE root cause #3 已修 · 闭环)
  // - knowledge_points 是 JSONB array: [{"name":"韦达定理"}, ...]
  // - DISTINCT ON wrong_item_id + ORDER BY ar.created_at DESC 取每题最新分析
  // - 取首个 KP (knowledge_points->0->>'name')
  // - 本周 quality=0 (FORGOT) 按 KP 分组 · 错次数 DESC limit 3
  // - INV-4 排序键: recentMissCount DESC (不允许 totalMissCount)
  private static final String AGGREGATE_WEAK_KP_SQL =
      "WITH latest_kp AS ( "
          + "  SELECT DISTINCT ON (CAST(task_id AS BIGINT)) "
          + "         CAST(task_id AS BIGINT) AS wrong_item_id, "
          + "         knowledge_points->0->>'name' AS kp_name "
          + "  FROM analysis_result "
          + "  WHERE knowledge_points IS NOT NULL "
          + "    AND jsonb_array_length(knowledge_points) > 0 "
          + "    AND task_id ~ '^[0-9]+$' "
          + "  ORDER BY CAST(task_id AS BIGINT), created_at DESC "
          + ") "
          + "SELECT lk.kp_name, w.subject, COUNT(*) AS recent_miss "
          + "FROM review_outcome r "
          + "JOIN wrong_item w ON w.id = r.wrong_item_id AND w.deleted_at IS NULL "
          + "JOIN latest_kp lk ON lk.wrong_item_id = w.id "
          + "WHERE r.user_id = ? "
          + "  AND r.completed_at >= ? AND r.completed_at < ? "
          + "  AND r.quality = 0 "
          + "GROUP BY lk.kp_name, w.subject "
          + "ORDER BY recent_miss DESC LIMIT 3";

  // -------- 2026-05-18 用户决策: sparkline + masteryRate 改 SM-2 ease 折算 --------
  // 数据源 review_outcome.ease_factor_after · 与 P07 复习页 + P-HOME weekly-stats 三处统一.
  // 公式 (avg_ease - 1.3) / 1.7 · clamp [0,1] · 返 0..1 fraction.
  // 每日 avg 用 groupBy day(completed_at AT student_tz).
  private static final String AGGREGATE_DAILY_AVG_EASE_SQL =
      "SELECT date_trunc('day', completed_at AT TIME ZONE ?) AS day_tz, "
          + "       AVG(ease_factor_after) AS avg_ease, "
          + "       COUNT(*) AS cnt "
          + "FROM review_outcome "
          + "WHERE user_id = ? AND completed_at >= ? AND completed_at < ? "
          + "  AND ease_factor_after IS NOT NULL "
          + "GROUP BY 1";

  // 上周整周 avg ease (用于 masteryDelta · 同上算法)
  private static final String AGGREGATE_PREV_WEEK_AVG_EASE_SQL =
      "SELECT AVG(ease_factor_after) AS avg_ease, COUNT(*) AS cnt "
          + "FROM review_outcome "
          + "WHERE user_id = ? AND completed_at >= ? AND completed_at < ? "
          + "  AND ease_factor_after IS NOT NULL";

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

    // ---- 字段 1+2 · 本周 daily 聚合 ----
    // grade-based SQL: 提供 mastered/forgotten 计数 + duration_sec_sum + streak 用.
    // sparkline/masteryRate (2026-05-18 用户决策) 切到 ease-based SQL · 与 P07 一致.
    String tzId = tz.getId();
    List<DailyAggRow> dailyRows = jdbc.query(
        AGGREGATE_DAILY_GRADED_SQL,
        (rs, n) -> new DailyAggRow(
            rs.getTimestamp("day_tz"),
            rs.getLong("graded"),
            rs.getLong("mastered"),
            rs.getLong("duration_sec_sum")),
        tzId, studentId, Timestamp.from(weekStart), Timestamp.from(weekEnd));

    long totalDurationSec = 0L;
    long totalGraded = 0L; // reviewedCount 用 · 不参与 masteryRate 计算 (已切 ease)
    for (DailyAggRow row : dailyRows) {
      totalDurationSec += row.durationSecSum;
      totalGraded += row.graded;
    }

    // ---- sparkline + masteryRate · SM-2 ease 折算 (2026-05-18 用户决策) ----
    // 每日 avg(ease_factor_after) → 映射 [1.3,3.0]→[0,1] · 空日 null (不 forward-fill).
    List<DailyEaseRow> easeRows = jdbc.query(
        AGGREGATE_DAILY_AVG_EASE_SQL,
        (rs, n) -> new DailyEaseRow(
            rs.getTimestamp("day_tz"),
            rs.getBigDecimal("avg_ease"),
            rs.getLong("cnt")),
        tzId, studentId, Timestamp.from(weekStart), Timestamp.from(weekEnd));

    Double[] sparkline = new Double[7];
    Map<LocalDate, DailyEaseRow> easeMap = new HashMap<>();
    double totalEaseSum = 0.0;
    long totalEaseCnt = 0L;
    for (DailyEaseRow row : easeRows) {
      LocalDate dayLocal = row.dayTzTs.toInstant().atZone(tz).toLocalDate();
      easeMap.put(dayLocal, row);
      if (row.avgEase != null && row.cnt > 0) {
        totalEaseSum += row.avgEase.doubleValue() * row.cnt;
        totalEaseCnt += row.cnt;
      }
    }
    for (int i = 0; i < 7; i++) {
      LocalDate day = mondayDate.plusDays(i);
      DailyEaseRow row = easeMap.get(day);
      if (row == null || row.avgEase == null || row.cnt == 0L) {
        sparkline[i] = null; // 空日 null
      } else {
        sparkline[i] = clampEaseToFraction(row.avgEase.doubleValue());
      }
    }

    Double masteryRate;
    if (totalEaseCnt == 0L) {
      masteryRate = null; // 空周 null · 诚实显 — % 不假装
    } else {
      masteryRate = clampEaseToFraction(totalEaseSum / (double) totalEaseCnt);
    }

    // ---- masteryDelta · 上周整周 avg ease ----
    Double prevMasteryRate;
    List<Object[]> prevEaseRows = jdbc.query(
        AGGREGATE_PREV_WEEK_AVG_EASE_SQL,
        (rs, n) -> new Object[] {rs.getBigDecimal("avg_ease"), rs.getLong("cnt")},
        studentId, Timestamp.from(prevWeekStart), Timestamp.from(weekStart));
    if (prevEaseRows.isEmpty() || prevEaseRows.get(0)[0] == null
        || ((Long) prevEaseRows.get(0)[1]) == 0L) {
      prevMasteryRate = null;
    } else {
      java.math.BigDecimal prevAvg = (java.math.BigDecimal) prevEaseRows.get(0)[0];
      prevMasteryRate = clampEaseToFraction(prevAvg.doubleValue());
    }
    Double masteryDelta;
    if (masteryRate == null || prevMasteryRate == null) {
      masteryDelta = null; // biz §10.14 "delta 派生" 一边 null → null
    } else {
      masteryDelta = masteryRate - prevMasteryRate;
    }

    // ---- 学科雷达 (2026-05-18 切 review_outcome JOIN wrong_item · ease 折算) ----
    List<SubjectRadarRaw> subjectRadar = jdbc.query(
        AGGREGATE_SUBJECT_SQL,
        (rs, n) -> {
          java.math.BigDecimal avgEase = rs.getBigDecimal("avg_ease");
          long sampleSize = rs.getLong("sample_size");
          Double rate = avgEase == null ? null : clampEaseToFraction(avgEase.doubleValue());
          return new SubjectRadarRaw(rs.getString("subject"), rate, (int) sampleSize);
        },
        studentId, Timestamp.from(weekStart), Timestamp.from(weekEnd));

    // ---- 薄弱 KP top 3 (2026-05-18 用户决策 A · 复用 AI 已生成 KP) ----
    // analysis_result.knowledge_points JSONB (qwen-vl-max prompt 输出 · 真 AI 提取) ·
    // task_id == wrong_item.id 闭环 · 不用加 wrong_item.kp_name 列 · 不用 ai-service 回写.
    // kpId 复用 kp_name (无 dictionary 表 · MVP) · 前端 weakKpTap 用 kp_name 当 query.
    List<WeakKpRaw> weakKps = jdbc.query(
        AGGREGATE_WEAK_KP_SQL,
        (rs, n) -> {
          String kpName = rs.getString("kp_name");
          return new WeakKpRaw(
              kpName,             // kpId 复用 kp_name (MVP · 无独立 dict)
              kpName,             // kpName 字面
              rs.getString("subject"),
              rs.getInt("recent_miss"),
              rs.getInt("recent_miss"));  // totalMissCount 同 recent (MVP · 仅本周维度)
        },
        studentId, Timestamp.from(weekStart), Timestamp.from(weekEnd));

    // ---- 失败题 top 5 (2026-05-18 切 review_outcome WHERE quality=0 JOIN wrong_item) ----
    List<FailedQRaw> failedTop = jdbc.query(
        AGGREGATE_FAILED_TOP_SQL,
        (rs, n) -> new FailedQRaw(
            String.valueOf(rs.getLong("question_id")),
            rs.getString("subject_code"),
            rs.getInt("miss_count"),
            rs.getString("image_key")),
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

  public record FailedQRaw(String questionId, String subject, int missCount, String imageKey) {}

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

  // 2026-05-18 用户决策: sparkline + masteryRate SM-2 ease 折算 raw row
  private static final class DailyEaseRow {
    final Timestamp dayTzTs;
    final java.math.BigDecimal avgEase;
    final long cnt;

    DailyEaseRow(Timestamp dayTzTs, java.math.BigDecimal avgEase, long cnt) {
      this.dayTzTs = dayTzTs;
      this.avgEase = avgEase;
      this.cnt = cnt;
    }
  }

  /**
   * 2026-05-18 用户决策: SM-2 ease 折算 0..1 fraction · 与 P07 复习页 computeMasteryPct 一致.
   * 公式: (avg_ease - 1.3) / 1.7 · clamp [0,1].
   * 1.3 = SM-2 floor → 0% · 2.5 = init → 70.6% · 3.0 = cap → 100%
   */
  private static double clampEaseToFraction(double avgEase) {
    return Math.max(0.0, Math.min(1.0, (avgEase - 1.3) / 1.7));
  }
}
