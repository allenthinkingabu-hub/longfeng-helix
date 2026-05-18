package com.longfeng.reviewplan.util;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.IsoFields;

/**
 * SC-16-T01 · ISO 8601 week 边界计算工具.
 *
 * <p><b>不变量 INV-3 (key_invariants[2])</b>: ISO 8601 week (周一开始 · student_tz 边界) ·
 * 不允许混用美式 (周日开始) · 跨时区学生走 master §2B.9 SC-08 时区切换逻辑.
 *
 * <p><b>反 wall-clock 依赖</b>: 所有方法接受 {@code Clock} / {@code Instant} 参数 ·
 * 禁止内部调用 {@code LocalDate.now()} / {@code Instant.now()} · 防止 IT/UT flaky
 * (audit grep 0 命中 LocalDate.now / Instant.now 在 production code).
 *
 * <p><b>biz §10.14</b> 字面规约: 周一 00:00 student_tz → 下周一 00:00 student_tz (左闭右开).
 *
 * <p>纯函数 · 无状态 · 无 Spring 依赖 · AC8 类 #3 单测目标.
 */
public final class WeekBoundaryUtil {

  private WeekBoundaryUtil() {}

  /** 计算给定 {@code Instant} 在 {@code zone} 时区下的 ISO 8601 周一 00:00 (左边界). */
  public static Instant weekStart(Instant now, ZoneId zone) {
    ZonedDateTime zdt = now.atZone(zone);
    LocalDate date = zdt.toLocalDate();
    // ISO 8601: 周一 = 1, 周日 = 7
    long daysFromMonday = date.getDayOfWeek().getValue() - DayOfWeek.MONDAY.getValue();
    LocalDate monday = date.minusDays(daysFromMonday);
    return monday.atStartOfDay(zone).toInstant();
  }

  /** 计算给定 {@code Instant} 在 {@code zone} 时区下的下周一 00:00 (右开边界). */
  public static Instant weekEnd(Instant now, ZoneId zone) {
    Instant start = weekStart(now, zone);
    return start.atZone(zone).plusWeeks(1).toInstant();
  }

  /** 计算给定 {@code Instant} 在 {@code zone} 时区下的 ISO 周日 (右闭) · 用于 range.to 字段. */
  public static LocalDate weekSundayLocalDate(Instant now, ZoneId zone) {
    LocalDate monday = weekStart(now, zone).atZone(zone).toLocalDate();
    return monday.plusDays(6);
  }

  /** 计算 ISO 8601 week 字符串 e.g. "2026-W20". */
  public static String isoWeekLabel(Instant now, ZoneId zone) {
    LocalDate date = now.atZone(zone).toLocalDate();
    int weekYear = date.get(IsoFields.WEEK_BASED_YEAR);
    int weekNum = date.get(IsoFields.WEEK_OF_WEEK_BASED_YEAR);
    return String.format("%04d-W%02d", weekYear, weekNum);
  }

  /** 计算上一周的 {@code Instant} (本周 start 减 7 天 · 用于 masteryDelta 计算). */
  public static Instant previousWeekStart(Instant now, ZoneId zone) {
    return weekStart(now, zone).atZone(zone).minusWeeks(1).toInstant();
  }

  /** 学生当前 ZonedDateTime 对应的 LocalDate (本地日历日期 · 不含时分秒). */
  public static LocalDate todayLocalDate(Instant now, ZoneId zone) {
    return now.atZone(zone).toLocalDate();
  }

  /** 学生当前 ZonedDateTime 对应的昨天 LocalDate (streak yesterday-back 起点). */
  public static LocalDate yesterdayLocalDate(Instant now, ZoneId zone) {
    return todayLocalDate(now, zone).minusDays(1);
  }
}
