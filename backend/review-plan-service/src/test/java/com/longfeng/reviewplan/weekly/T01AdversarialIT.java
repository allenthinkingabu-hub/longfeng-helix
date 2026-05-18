package com.longfeng.reviewplan.weekly;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.longfeng.reviewplan.IntegrationTestBase;
import com.longfeng.reviewplan.service.WeeklyAggregateService;
import com.longfeng.reviewplan.support.SnowflakeIdGenerator;
import com.longfeng.reviewplan.util.WeekBoundaryUtil;
import java.sql.SQLException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * SC-16-T01 · Tester adversarial · 1 轮对抗 · 3 角度 · Phase 4 step 3.
 *
 * <ul>
 *   <li><b>Adversarial 角度 1 (AC5 P95 ≤ 400ms)</b>: @RepeatedTest(20) · /api/home/weekly happy path
 *       连跑 · 计算 P95 延迟 · 断言 ≤ 400ms (feature_list AC5 · Coder bugs-found surface · 透明 delegate)
 *   <li><b>Adversarial 角度 2 (Case 6b 真实补强 · code 50001 字面断言)</b>: T01WeeklyApiE2EIT.Case6bServiceErrorIT
 *       只断言 status().isInternalServerError() · 没断言 jsonPath $.code === 50001 · 此处补 GAP
 *   <li><b>Adversarial 角度 3 (ISO W53 字面强断言)</b>: 现有 WeekBoundaryUtilTest 跨年 case 用
 *       startsWith("2026-W") 弱断言 (可漂到 W52/W01 仍 PASS) · 此处补字面 W53 + W01 强断言
 * </ul>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@TestPropertySource(properties = "spring.cache.type=NONE")
class T01AdversarialIT extends IntegrationTestBase {

  @Autowired private MockMvc mvc;
  @Autowired private DataSource dataSource;
  @Autowired private SnowflakeIdGenerator idGen;

  @MockBean private Clock clock;

  private JdbcTemplate jdbc;

  private static final long STU_PERF = 9230001L;
  private static final String TZ = "Asia/Shanghai";
  private static final Instant FIXED_NOW = Instant.parse("2026-05-15T02:00:00Z");
  private static final Instant WEEK_MONDAY_UTC = Instant.parse("2026-05-10T16:00:00Z");
  private static final Instant PREV_WEEK_MONDAY_UTC = Instant.parse("2026-05-03T16:00:00Z");

  // P95 latency record (跨 @RepeatedTest 调用累计 · static 是为了 @RepeatedTest 共享数组)
  private static final List<Long> latenciesMs = Collections.synchronizedList(new ArrayList<>());

  @BeforeEach
  void setup() {
    org.mockito.Mockito.when(clock.instant()).thenReturn(FIXED_NOW);
    org.mockito.Mockito.when(clock.getZone()).thenReturn(ZoneId.of("UTC"));
    jdbc = new JdbcTemplate(dataSource);
    // 一次清理
    jdbc.update("DELETE FROM wb_review_record WHERE student_id = ?", STU_PERF);
    jdbc.update("DELETE FROM wb_question WHERE owner_id = ?", STU_PERF);

    // Seed Case 1 等价 fixture · 本周 28 条 GRADED + 上周 25 条 + 8 wb_question
    long q = insertQuestion(STU_PERF, "math", "KP-PERF", "Perf KP");
    seedRecords(STU_PERF, q, 0, 5, 5, 500);
    seedRecords(STU_PERF, q, 1, 5, 5, 500);
    seedRecords(STU_PERF, q, 2, 4, 6, 600);
    seedRecords(STU_PERF, q, 3, 3, 6, 600);
    seedRecordsAt(STU_PERF, q, 4, 9, 2, 6, 600);
    seedRecordsPrevWeek(STU_PERF, q, 16, 25);
    for (int i = 0; i < 7; i++) {
      insertQuestionAt(STU_PERF, "math", "KP-PX" + i, "KP " + i, WEEK_MONDAY_UTC.plusSeconds(3600L * (12 + i)));
    }
  }

  // =========================================================================
  // Adversarial 角度 1 · AC5 P95 ≤ 400ms (feature_list AC5 · 透明 delegate by Coder)
  // =========================================================================

  /** @RepeatedTest(20) · 累计 20 次延迟 · 第 20 次执行后断言 P95 ≤ 400ms. */
  @RepeatedTest(20)
  @DisplayName("Adversarial #1 · AC5 P95 · /api/home/weekly happy path 20 次连跑 P95 ≤ 400ms")
  void adversarial1_perf_p95_under_400ms() throws Exception {
    long t0 = System.nanoTime();
    mvc.perform(get("/api/home/weekly").header("X-User-Id", STU_PERF))
        .andExpect(status().isOk());
    long elapsedMs = (System.nanoTime() - t0) / 1_000_000;
    latenciesMs.add(elapsedMs);

    // 当累计达 20 次时计算 P95
    if (latenciesMs.size() >= 20) {
      List<Long> sorted = new ArrayList<>(latenciesMs);
      Collections.sort(sorted);
      // P95 = index ceil(0.95 * N) - 1 = 19 for N=20 (last element)
      long p95 = sorted.get((int) Math.ceil(0.95 * sorted.size()) - 1);
      System.out.println("[Adversarial #1 P95] N=" + sorted.size() + " p95=" + p95 + "ms · sorted=" + sorted);
      // feature_list AC5 字面 ≤ 400ms (spec §11 性能预算)
      // sandbox PG warm + Spring Boot warm 应轻松达成
      assertThat(p95).as("AC5 P95 ≤ 400ms").isLessThanOrEqualTo(400L);
    }
  }

  // =========================================================================
  // Adversarial 角度 2 · Case 6b 补强: code 50001 字面断言 (GAP fix)
  // =========================================================================

  @Nested
  @SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
  @AutoConfigureMockMvc
  @TestPropertySource(properties = "spring.cache.type=NONE")
  class Case6bCodeAssertionGap extends IntegrationTestBase {
    @Autowired private MockMvc mvcGap;
    @MockBean private WeeklyAggregateService aggregateMock;

    @Test
    @DisplayName("Adversarial #2 · Case 6b 真实 code 字面断言: status 500 + $.code === 50001 (test-cases.md Then 字面)")
    void adversarial2_case6b_code_50001_literal_assertion() throws Exception {
      org.mockito.Mockito.when(aggregateMock.aggregate(
              org.mockito.ArgumentMatchers.anyLong(),
              org.mockito.ArgumentMatchers.any(ZoneId.class)))
          .thenThrow(new RuntimeException("simulated SQLException",
              new SQLException("boom · adversarial")));

      mvcGap.perform(get("/api/home/weekly").header("X-User-Id", STU_PERF))
          .andExpect(status().isInternalServerError())
          // GAP: T01WeeklyApiE2EIT.Case6bServiceErrorIT 只断言 status · 没断言 code
          // test-cases.md Case 6 Then 字面: "code === INTERNAL" (即 ErrCode.INTERNAL_ERROR.code() = 50001)
          .andExpect(jsonPath("$.code").value(50001));
    }
  }

  // =========================================================================
  // Adversarial 角度 3 · ISO W53 字面强断言 (现有 UT 弱断言 startsWith 漂)
  // =========================================================================

  @Test
  @DisplayName("Adversarial #3a · 2026-12-31 跨年 ISO week 字面 = '2026-W53' (现 UT startsWith 弱断言可漂 W52/W01)")
  void adversarial3a_iso_w53_literal_label() {
    // 2026-12-31 周四 · ISO weekYear=2026 · weekNum=53 (Coder UT 只验 startsWith("2026-W") · 漂)
    Instant lastDay2026 = Instant.parse("2026-12-31T05:00:00Z");
    String label = WeekBoundaryUtil.isoWeekLabel(lastDay2026, ZoneId.of("UTC"));
    // 字面断言 W53 · 比现 UT 强
    assertThat(label).isEqualTo("2026-W53");
  }

  @Test
  @DisplayName("Adversarial #3b · 2027-01-01 (周五) ISO week 字面 = '2026-W53' (跨年但仍在 W53 内)")
  void adversarial3b_2027_jan_01_still_in_2026_w53() {
    // ISO 8601: 2027-01-01 (周五) · 仍属 2026-W53 (因 2026-W53 包含周一 12/28 到周日 2027-01-03)
    Instant t = Instant.parse("2027-01-01T05:00:00Z");
    String label = WeekBoundaryUtil.isoWeekLabel(t, ZoneId.of("UTC"));
    assertThat(label).isEqualTo("2026-W53");
  }

  @Test
  @DisplayName("Adversarial #3c · 2027-01-04 (周一) ISO week 字面 = '2027-W01'")
  void adversarial3c_2027_jan_04_w01() {
    Instant t = Instant.parse("2027-01-04T05:00:00Z");
    String label = WeekBoundaryUtil.isoWeekLabel(t, ZoneId.of("UTC"));
    assertThat(label).isEqualTo("2027-W01");
  }

  // =========================================================================
  // Helpers (复用 T01WeeklyApiE2EIT 模式)
  // =========================================================================

  private long insertQuestion(long ownerId, String subject, String kpId, String kpName) {
    return insertQuestionAt(ownerId, subject, kpId, kpName, WEEK_MONDAY_UTC.plusSeconds(3600L * 12));
  }

  private long insertQuestionAt(long ownerId, String subject, String kpId, String kpName, Instant createdAt) {
    long id = idGen.nextId();
    jdbc.update(
        "INSERT INTO wb_question (id, owner_id, subject_code, kp_id, kp_name, created_at, updated_at) "
            + "VALUES (?, ?, ?, ?, ?, ?, ?)",
        id, ownerId, subject, kpId, kpName,
        java.sql.Timestamp.from(createdAt), java.sql.Timestamp.from(createdAt));
    return id;
  }

  private void seedRecords(long sid, long qid, int dayOffset, int masteredCount, int totalCount, int totalDurationSec) {
    seedRecordsAt(sid, qid, dayOffset, 12, masteredCount, totalCount, totalDurationSec);
  }

  private void seedRecordsAt(long sid, long qid, int dayOffset, int hourUtc, int masteredCount, int totalCount, int totalDurationSec) {
    int per = totalCount == 0 ? 0 : totalDurationSec / totalCount;
    for (int i = 0; i < totalCount; i++) {
      Instant ts = WEEK_MONDAY_UTC.plusSeconds(86400L * dayOffset + 3600L * hourUtc + 60L * i);
      String grade = i < masteredCount ? "MASTERED" : "PARTIAL";
      insertRecord(sid, qid, ts, grade, per);
    }
  }

  private void seedRecordsPrevWeek(long sid, long qid, int masteredCount, int totalCount) {
    for (int i = 0; i < totalCount; i++) {
      Instant ts = PREV_WEEK_MONDAY_UTC.plusSeconds(86400L * 2 + 3600L * 12 + 60L * i);
      String grade = i < masteredCount ? "MASTERED" : "PARTIAL";
      insertRecord(sid, qid, ts, grade, 60);
    }
  }

  private void insertRecord(long sid, long qid, Instant reviewedAt, String grade, int durationSec) {
    long id = idGen.nextId();
    jdbc.update(
        "INSERT INTO wb_review_record (id, student_id, question_id, reviewed_at, grade, duration_sec) "
            + "VALUES (?, ?, ?, ?, ?, ?)",
        id, sid, qid, java.sql.Timestamp.from(reviewedAt), grade, durationSec);
  }
}
