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

  // 2026-05-18 用户决策: masteryRate 改 SM-2 ease 折算 (avg-1.3)/1.7 clamp [0,1] ·
  // 测试 fixture 改 seed review_outcome.ease_factor_after (新数据源) ·
  // wb_review_record 仍 seed (供 reviewedCount + duration + streak + weakKPs · 旧字段).

  @Test
  @DisplayName("masteryRate corner #2.2 · 28 outcomes ease=3.0 (SM-2 cap) → 1.0")
  void masteryRate_all_mastered_returns_1_0() {
    long sid = uniqueSid();
    long qid = seedQuestion(sid);
    for (int i = 0; i < 28; i++) {
      Instant ts = Instant.parse("2026-05-12T04:00:00Z").plusSeconds(60L * i);
      insertRecord(sid, qid, ts, "MASTERED", 60);
      insertOutcome(sid, qid, ts, 5, 3.0); // ease cap = 1.0 fraction
    }
    WeeklyAggregateService.WeeklyAggregateRaw raw = service.aggregate(sid, SH);
    assertThat(raw.masteryRate).isEqualTo(1.0);
    assertThat(raw.reviewedCount).isEqualTo(28);
  }

  @Test
  @DisplayName("masteryRate corner #2.3 · 28 outcomes ease=1.3 (SM-2 floor) → 0.0")
  void masteryRate_all_forgot_returns_0_0() {
    long sid = uniqueSid();
    long qid = seedQuestion(sid);
    for (int i = 0; i < 28; i++) {
      Instant ts = Instant.parse("2026-05-12T04:00:00Z").plusSeconds(60L * i);
      insertRecord(sid, qid, ts, "FORGOT", 60);
      insertOutcome(sid, qid, ts, 0, 1.3); // ease floor = 0.0 fraction
    }
    WeeklyAggregateService.WeeklyAggregateRaw raw = service.aggregate(sid, SH);
    assertThat(raw.masteryRate).isEqualTo(0.0);
    assertThat(raw.reviewedCount).isEqualTo(28);
  }

  @Test
  @DisplayName("masteryRate corner #2.4 · 1 outcome ease=3.0 → 1.0")
  void masteryRate_single_mastered_returns_1_0() {
    long sid = uniqueSid();
    long qid = seedQuestion(sid);
    Instant ts = Instant.parse("2026-05-12T04:00:00Z");
    insertRecord(sid, qid, ts, "MASTERED", 60);
    insertOutcome(sid, qid, ts, 5, 3.0);
    WeeklyAggregateService.WeeklyAggregateRaw raw = service.aggregate(sid, SH);
    assertThat(raw.masteryRate).isEqualTo(1.0);
  }

  @Test
  @DisplayName("masteryRate corner #2.5 · 27 ease=3.0 + 1 ease=1.3 → (avg-1.3)/1.7 浮点精度")
  void masteryRate_27_over_28_double_precision() {
    long sid = uniqueSid();
    long qid = seedQuestion(sid);
    for (int i = 0; i < 27; i++) {
      Instant ts = Instant.parse("2026-05-12T04:00:00Z").plusSeconds(60L * i);
      insertRecord(sid, qid, ts, "MASTERED", 60);
      insertOutcome(sid, qid, ts, 5, 3.0);
    }
    Instant lastTs = Instant.parse("2026-05-12T06:00:00Z");
    insertRecord(sid, qid, lastTs, "FORGOT", 60);
    insertOutcome(sid, qid, lastTs, 0, 1.3);
    WeeklyAggregateService.WeeklyAggregateRaw raw = service.aggregate(sid, SH);
    // avg ease = (27*3.0 + 1.3) / 28 · clamp 后 fraction = (avg - 1.3) / 1.7
    double expected = (((27 * 3.0 + 1.3) / 28.0) - 1.3) / 1.7;
    assertThat(raw.masteryRate).isCloseTo(expected, org.assertj.core.data.Offset.offset(1e-9));
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
    // 2026-05-18 service streak + reviewedCount + sparkline + subjectRadar + failedTop
    // 全切到 review_outcome · helper 必须双 seed 让旧测试继续 work (wb_review_record 仍 seed
    // 给老 invariant 兜底 · review_outcome 是 service 新真实数据源).
    insertOutcome(sid, qid, ts, 5, 3.0);
  }

  private void insertRecord(long sid, long qid, Instant ts, String grade, int durationSec) {
    long id = idGen.nextId();
    jdbc.update(
        "INSERT INTO wb_review_record (id, student_id, question_id, reviewed_at, grade, duration_sec) "
            + "VALUES (?, ?, ?, ?, ?, ?)",
        id, sid, qid, java.sql.Timestamp.from(ts), grade, durationSec);
  }

  // 2026-05-18 用户决策: masteryRate + sparkline 切 review_outcome.ease_factor_after ·
  // 测试 fixture 同步写 outcome 行驱动 SM-2 折算.
  private void insertOutcome(long sid, long qid, Instant ts, int quality, double easeAfter) {
    long id = idGen.nextId();
    // plan_id 设为 qid (测试简化 · plan 与 question 1:1 映射) · wrong_item_id = qid
    jdbc.update(
        "INSERT INTO review_outcome (id, plan_id, wrong_item_id, user_id, quality, "
            + "ease_factor_before, ease_factor_after, interval_days_before, interval_days_after, completed_at, created_at, updated_at) "
            + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        id, qid, qid, sid, quality, easeAfter, easeAfter, 1, 1,
        java.sql.Timestamp.from(ts), java.sql.Timestamp.from(ts), java.sql.Timestamp.from(ts));
  }
}
