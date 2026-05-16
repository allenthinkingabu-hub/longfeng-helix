package com.longfeng.reviewplan.weekly;

import static org.assertj.core.api.Assertions.assertThat;

import com.longfeng.reviewplan.IntegrationTestBase;
import com.longfeng.reviewplan.service.WeeklyAggregateService;
import com.longfeng.reviewplan.support.SnowflakeIdGenerator;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * SC-16-T01 · AC8 corner 类 #1 (compute_streak) + #2 (masteryRate 浮点) 单测.
 *
 * <p>注: 本测试用 @SpringBootTest + 真 PG 容器 (复用 IntegrationTestBase) · 因 service 用 JdbcTemplate
 * 直连 DB · 纯 Mockito UT 难精确验聚合 SQL · 用 IT 模式更稳. 但严格按 surefire 命名 (*Test.java) 跑
 * 单元 test (mvn test phase) 而非 IT (verify phase) - 这里 surefire 配置 include *Test.java.
 *
 * <p>覆盖 @Test ≥ 10 (合并 corner #1 + #2 · WeekBoundaryUtilTest 单独 ≥ 6 = 总 ≥ 15+).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
class WeeklyAggregateServiceTest extends IntegrationTestBase {

  @Autowired private WeeklyAggregateService service;
  @Autowired private DataSource ds;
  @Autowired private SnowflakeIdGenerator idGen;

  @MockBean private Clock clock;

  private static final ZoneId SH = ZoneId.of("Asia/Shanghai");
  private static final Instant NOW_FRI_10AM = Instant.parse("2026-05-15T02:00:00Z");

  private JdbcTemplate jdbc;

  @BeforeEach
  void setup() {
    org.mockito.Mockito.when(clock.instant()).thenReturn(NOW_FRI_10AM);
    org.mockito.Mockito.when(clock.getZone()).thenReturn(ZoneId.of("UTC"));
    jdbc = new JdbcTemplate(ds);
  }

  // ---------- AC8 类 #1 · compute_streak corner ----------

  @Test
  @DisplayName("streak corner #1.1 · 0 GRADED → streak = 0 (注册首日今日无复习)")
  void streak_zero_when_no_records() {
    long sid = uniqueSid();
    int s = service.computeStreak(sid, SH, NOW_FRI_10AM);
    assertThat(s).isEqualTo(0);
  }

  @Test
  @DisplayName("streak corner #1.2 · 昨天 1 GRADED + 今天 0 → streak = 1 (yesterday-back · 今天不破)")
  void streak_yesterday_only_returns_1() {
    long sid = uniqueSid();
    long qid = seedQuestion(sid);
    // 昨天 2026-05-14 12:00 SH = 2026-05-14T04:00:00Z
    insertGraded(sid, qid, Instant.parse("2026-05-14T04:00:00Z"));
    int s = service.computeStreak(sid, SH, NOW_FRI_10AM);
    assertThat(s).isEqualTo(1);
  }

  @Test
  @DisplayName("streak corner #1.3 · 昨天 + 今天都 ≥ 1 GRADED → streak = 2 (今天 +1)")
  void streak_includes_today_when_today_has_graded() {
    long sid = uniqueSid();
    long qid = seedQuestion(sid);
    insertGraded(sid, qid, Instant.parse("2026-05-14T04:00:00Z")); // 昨天
    insertGraded(sid, qid, Instant.parse("2026-05-15T01:00:00Z")); // 今天 9am SH
    int s = service.computeStreak(sid, SH, NOW_FRI_10AM);
    assertThat(s).isEqualTo(2);
  }

  @Test
  @DisplayName("streak corner #1.4 · 连续 5 天 (周一-周五) GRADED · 周五 = 今天 → streak = 5")
  void streak_five_consecutive_days() {
    long sid = uniqueSid();
    long qid = seedQuestion(sid);
    // 2026-05-11 周一 ... 2026-05-15 周五 (今天) 各 1 GRADED
    insertGraded(sid, qid, Instant.parse("2026-05-10T16:30:00Z")); // 周一 00:30 SH
    insertGraded(sid, qid, Instant.parse("2026-05-11T16:30:00Z")); // 周二
    insertGraded(sid, qid, Instant.parse("2026-05-12T16:30:00Z")); // 周三
    insertGraded(sid, qid, Instant.parse("2026-05-13T16:30:00Z")); // 周四
    insertGraded(sid, qid, Instant.parse("2026-05-15T01:00:00Z")); // 周五今天
    int s = service.computeStreak(sid, SH, NOW_FRI_10AM);
    assertThat(s).isEqualTo(5);
  }

  @Test
  @DisplayName("streak corner #1.5 · 跨月: 4/30-5/1 连续 → 包含跨月日 (LocalDate.minusDays 自动跨月)")
  void streak_across_month_boundary() {
    long sid = uniqueSid();
    long qid = seedQuestion(sid);
    // 2026-04-30 周四 + 2026-05-01 周五 + 5-02 周六 + 5-03 周日 + 5-04 周一 + ... 5-14 周四 = 15 天连续
    for (int day = 0; day < 15; day++) {
      Instant ts =
          Instant.parse("2026-04-30T04:00:00Z").plusSeconds(86400L * day); // 顺序往后
      insertGraded(sid, qid, ts);
    }
    int s = service.computeStreak(sid, SH, NOW_FRI_10AM);
    // 昨天 5-14 起 yesterday-back → 5-14, 5-13, ... , 4-30 = 15 天 · 今天 5-15 无 GRADED 不 +1
    assertThat(s).isEqualTo(15);
  }

  @Test
  @DisplayName("streak corner #1.6 · 负数防御: streak 输出 ≥ 0")
  void streak_never_negative() {
    long sid = uniqueSid();
    int s = service.computeStreak(sid, SH, NOW_FRI_10AM);
    assertThat(s).isGreaterThanOrEqualTo(0);
  }

  // ---------- AC8 类 #2 · masteryRate 浮点边界 ----------

  @Test
  @DisplayName("masteryRate corner #2.1 · 0 GRADED → null (严格 === null · 不是 0)")
  void masteryRate_empty_returns_null() {
    long sid = uniqueSid();
    WeeklyAggregateService.WeeklyAggregateRaw raw = service.aggregate(sid, SH);
    assertThat(raw.masteryRate).isNull();
  }

  @Test
  @DisplayName("masteryRate corner #2.2 · 28 全对 → 1.0 严格 ==")
  void masteryRate_all_mastered_returns_1_0() {
    long sid = uniqueSid();
    long qid = seedQuestion(sid);
    for (int i = 0; i < 28; i++) {
      insertRecord(sid, qid, Instant.parse("2026-05-12T04:00:00Z").plusSeconds(60L * i), "MASTERED", 60);
    }
    WeeklyAggregateService.WeeklyAggregateRaw raw = service.aggregate(sid, SH);
    assertThat(raw.masteryRate).isEqualTo(1.0);
    assertThat(raw.reviewedCount).isEqualTo(28);
  }

  @Test
  @DisplayName("masteryRate corner #2.3 · 28 全错 → 0.0 严格 ==")
  void masteryRate_all_forgot_returns_0_0() {
    long sid = uniqueSid();
    long qid = seedQuestion(sid);
    for (int i = 0; i < 28; i++) {
      insertRecord(sid, qid, Instant.parse("2026-05-12T04:00:00Z").plusSeconds(60L * i), "FORGOT", 60);
    }
    WeeklyAggregateService.WeeklyAggregateRaw raw = service.aggregate(sid, SH);
    assertThat(raw.masteryRate).isEqualTo(0.0);
    assertThat(raw.reviewedCount).isEqualTo(28);
  }

  @Test
  @DisplayName("masteryRate corner #2.4 · 1 GRADED 1 MASTERED → 1.0")
  void masteryRate_single_mastered_returns_1_0() {
    long sid = uniqueSid();
    long qid = seedQuestion(sid);
    insertRecord(sid, qid, Instant.parse("2026-05-12T04:00:00Z"), "MASTERED", 60);
    WeeklyAggregateService.WeeklyAggregateRaw raw = service.aggregate(sid, SH);
    assertThat(raw.masteryRate).isEqualTo(1.0);
  }

  @Test
  @DisplayName("masteryRate corner #2.5 · 27/28 浮点 = 0.9642857142857143 (Java double 精度)")
  void masteryRate_27_over_28_double_precision() {
    long sid = uniqueSid();
    long qid = seedQuestion(sid);
    for (int i = 0; i < 27; i++) {
      insertRecord(sid, qid, Instant.parse("2026-05-12T04:00:00Z").plusSeconds(60L * i), "MASTERED", 60);
    }
    insertRecord(sid, qid, Instant.parse("2026-05-12T06:00:00Z"), "FORGOT", 60);
    WeeklyAggregateService.WeeklyAggregateRaw raw = service.aggregate(sid, SH);
    assertThat(raw.masteryRate).isEqualTo(27.0 / 28.0);
  }

  // ---------- helpers ----------

  private long uniqueSid() {
    return 9700000L + idGen.nextId() % 100000L;
  }

  private long seedQuestion(long sid) {
    long qid = idGen.nextId();
    jdbc.update(
        "INSERT INTO wb_question (id, owner_id, subject_code, kp_id, kp_name, created_at, updated_at) "
            + "VALUES (?, ?, 'math', ?, ?, ?, ?)",
        qid, sid, "KP-T" + qid, "test",
        java.sql.Timestamp.from(Instant.parse("2026-05-12T04:00:00Z")),
        java.sql.Timestamp.from(Instant.parse("2026-05-12T04:00:00Z")));
    return qid;
  }

  private void insertGraded(long sid, long qid, Instant ts) {
    insertRecord(sid, qid, ts, "MASTERED", 60);
  }

  private void insertRecord(long sid, long qid, Instant ts, String grade, int durationSec) {
    long id = idGen.nextId();
    jdbc.update(
        "INSERT INTO wb_review_record (id, student_id, question_id, reviewed_at, grade, duration_sec) "
            + "VALUES (?, ?, ?, ?, ?, ?)",
        id, sid, qid, java.sql.Timestamp.from(ts), grade, durationSec);
  }
}
