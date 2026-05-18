package com.longfeng.reviewplan.weekly;

import static org.assertj.core.api.Assertions.assertThat;

import com.longfeng.reviewplan.util.WeekBoundaryUtil;
import java.time.Instant;
import java.time.ZoneId;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * SC-16-T01 · AC8 corner 类 #3 · ISO 8601 week 边界单测 (≥ 5 @Test).
 *
 * <p>测试目标: 周一 00:00 / 周日 23:59 / 跨年 W53→W01 / 闰年 2/29 / UTC vs Asia/Shanghai 8 小时差边界.
 */
class WeekBoundaryUtilTest {

  private static final ZoneId SH = ZoneId.of("Asia/Shanghai");
  private static final ZoneId UTC = ZoneId.of("UTC");

  @Test
  @DisplayName("周一 00:00:00.001 student_tz → 本周 monday")
  void weekStart_monday_first_millisecond() {
    // 2026-05-11 00:00:00.001 Asia/Shanghai → UTC 2026-05-10T16:00:00.001Z
    Instant t = Instant.parse("2026-05-10T16:00:00.001Z");
    Instant start = WeekBoundaryUtil.weekStart(t, SH);
    assertThat(start).isEqualTo(Instant.parse("2026-05-10T16:00:00Z"));
    assertThat(WeekBoundaryUtil.isoWeekLabel(t, SH)).isEqualTo("2026-W20");
  }

  @Test
  @DisplayName("周日 23:59:59.999 student_tz → 本周 · 下周一 00:00 是右开边界")
  void weekEnd_sunday_last_millisecond_still_in_this_week() {
    // 2026-05-17 23:59:59.999 Asia/Shanghai → UTC 2026-05-17T15:59:59.999Z
    Instant t = Instant.parse("2026-05-17T15:59:59.999Z");
    Instant start = WeekBoundaryUtil.weekStart(t, SH);
    Instant end = WeekBoundaryUtil.weekEnd(t, SH);
    // start = 2026-05-11 00:00 SH = 2026-05-10T16:00:00Z
    assertThat(start).isEqualTo(Instant.parse("2026-05-10T16:00:00Z"));
    // end = 2026-05-18 00:00 SH = 2026-05-17T16:00:00Z
    assertThat(end).isEqualTo(Instant.parse("2026-05-17T16:00:00Z"));
    assertThat(WeekBoundaryUtil.isoWeekLabel(t, SH)).isEqualTo("2026-W20");
  }

  @Test
  @DisplayName("跨年 ISO 2026-W53 → 2027-W01 边界")
  void weekLabel_iso_w53_to_w01_year_boundary() {
    // ISO 8601: 2026-12-31 (周四) → 2026-W53 (因 2026 是 53 周年)
    Instant lastDay2026 = Instant.parse("2026-12-31T05:00:00Z");
    String label = WeekBoundaryUtil.isoWeekLabel(lastDay2026, UTC);
    // 2026-12-31 是周四 · 在 2026-W53 (因 2026-01-01 周四 · 是 W01)
    assertThat(label).startsWith("2026-W"); // 验证 weekYear 属于 2026
    // 2027-01-04 周一 = 2027-W01
    Instant firstMonday2027 = Instant.parse("2027-01-04T05:00:00Z");
    assertThat(WeekBoundaryUtil.isoWeekLabel(firstMonday2027, UTC)).isEqualTo("2027-W01");
  }

  @Test
  @DisplayName("闰年 2/29 ISO week 计算正确")
  void weekLabel_leap_year_feb29() {
    // 2028 是闰年 · 2028-02-29 = 周二 · ISO week
    Instant feb29 = Instant.parse("2028-02-29T08:00:00Z");
    String label = WeekBoundaryUtil.isoWeekLabel(feb29, SH);
    assertThat(label).isEqualTo("2028-W09");
  }

  @Test
  @DisplayName("UTC vs Asia/Shanghai 8 小时差: UTC 周日 16:00 = 学生 SH 周一 00:00")
  void weekStart_utc_vs_sh_8h_difference_boundary() {
    // UTC 2026-05-10T16:00:00Z = Asia/Shanghai 2026-05-11T00:00:00+08:00 (周一 00:00)
    Instant t = Instant.parse("2026-05-10T16:00:00Z");
    // 在 SH 视角是本周 monday 起点
    assertThat(WeekBoundaryUtil.weekStart(t, SH)).isEqualTo(t);
    // 在 UTC 视角 · 周日 16:00 不是周一 00:00 · 还在上周 (W19 monday UTC start)
    Instant utcStart = WeekBoundaryUtil.weekStart(t, UTC);
    // UTC 周一 2026-05-04T00:00:00Z (上周 monday) 因 2026-05-10 是周日
    assertThat(utcStart).isEqualTo(Instant.parse("2026-05-04T00:00:00Z"));
  }

  @Test
  @DisplayName("previousWeekStart · 本周 monday - 7 天")
  void previousWeekStart_minus_7_days() {
    Instant t = Instant.parse("2026-05-15T02:00:00Z");
    Instant prev = WeekBoundaryUtil.previousWeekStart(t, SH);
    assertThat(prev).isEqualTo(Instant.parse("2026-05-03T16:00:00Z"));
  }

  @Test
  @DisplayName("yesterdayLocalDate · 当前 -1 day in tz")
  void yesterdayLocalDate_minus_1_day_in_tz() {
    Instant t = Instant.parse("2026-05-15T02:00:00Z"); // SH 周五 10am
    assertThat(WeekBoundaryUtil.yesterdayLocalDate(t, SH).toString()).isEqualTo("2026-05-14");
    assertThat(WeekBoundaryUtil.todayLocalDate(t, SH).toString()).isEqualTo("2026-05-15");
  }
}
