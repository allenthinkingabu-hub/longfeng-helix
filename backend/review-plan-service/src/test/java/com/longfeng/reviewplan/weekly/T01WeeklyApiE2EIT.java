package com.longfeng.reviewplan.weekly;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.longfeng.reviewplan.IntegrationTestBase;
import com.longfeng.reviewplan.service.WeeklyAggregateService;
import com.longfeng.reviewplan.support.SnowflakeIdGenerator;
import java.sql.SQLException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Iterator;
import java.util.Map;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * SC-16-T01 · 6 E2E IT 字面翻 test-cases.md Case 1-6.
 *
 * <p>测试基础设施沿用 {@link IntegrationTestBase} (team-5 PG @ 15436 · Flyway 跑 V1.0.082 ·
 * MQ off).
 *
 * <p>Clock 锁定 {@code 2026-05-15T10:00:00+08:00} (Asia/Shanghai 周五 10am) · 本周 = 2026-W20 ·
 * range = 2026-05-11..2026-05-17. 所有 case 用此 fixed clock · 数据 fixture 围绕本周窗口 seed.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@TestPropertySource(properties = "spring.cache.type=NONE") // 反 anti_pattern[1] · spec §5.3 不缓存
class T01WeeklyApiE2EIT extends IntegrationTestBase {

  @Autowired private MockMvc mvc;
  @Autowired private DataSource dataSource;
  @Autowired private ObjectMapper jsonMapper;
  @Autowired private SnowflakeIdGenerator idGen;

  // Clock 锁: 2026-05-15T10:00:00+08:00 · Asia/Shanghai 周五 10am · 本周 = 2026-W20
  @MockBean private Clock clock;

  private JdbcTemplate jdbc;

  private static final long STU_HAPPY = 9210001L; // Case 1
  private static final long STU_EMPTY = 9210002L; // Case 2
  private static final long STU_PARTIAL = 9210003L; // Case 3
  private static final long STU_IDEMP = 9210004L; // Case 4
  private static final long STU_PII = 9210005L; // Case 5
  private static final long STU_BAD_AUTH = 9210006L; // Case 6
  private static final String TZ = "Asia/Shanghai";
  private static final ZoneId ZONE = ZoneId.of(TZ);
  // 2026-05-15T10:00:00+08:00 → UTC = 2026-05-15T02:00:00Z
  private static final Instant FIXED_NOW = Instant.parse("2026-05-15T02:00:00Z");
  // 本周 monday 2026-05-11 00:00 Asia/Shanghai → UTC 2026-05-10T16:00:00Z
  private static final Instant WEEK_MONDAY_UTC = Instant.parse("2026-05-10T16:00:00Z");
  // 上周 monday 2026-05-04
  private static final Instant PREV_WEEK_MONDAY_UTC = Instant.parse("2026-05-03T16:00:00Z");

  @BeforeEach
  void setup() {
    org.mockito.Mockito.when(clock.instant()).thenReturn(FIXED_NOW);
    org.mockito.Mockito.when(clock.getZone()).thenReturn(ZoneId.of("UTC"));
    jdbc = new JdbcTemplate(dataSource);
    // 清理脏态 · 6 学生 ID 隔离
    for (long sid : new long[] {STU_HAPPY, STU_EMPTY, STU_PARTIAL, STU_IDEMP, STU_PII, STU_BAD_AUTH}) {
      jdbc.update("DELETE FROM wb_review_record WHERE student_id = ?", sid);
      jdbc.update("DELETE FROM wb_question WHERE owner_id = ?", sid);
    }
  }

  // ============================================================================
  // Case 1 · happy path · /weekly 200 + WeeklyReviewResp 全字段 5 层 set equality
  // ============================================================================

  @Test
  @DisplayName("Case 1 · happy path: GET /weekly 200 · 顶层 8 keys + hero/range/stats/aiInsight 子字段 set equality + masteryRate≈0.6786 + reviewedCount=28 + reviewedDurationMin=45 + newCount=8")
  void case1_happy_path_full_schema_set_equality() throws Exception {
    // Given · 本周 28 条 GRADED (19 MASTERED · 9 FORGOT · duration_sec sum=2700 → 45 分钟) ·
    //        上周 25 条 GRADED (16 MASTERED) · 本周新建 8 条 wb_question
    // Hero 期望: masteryRate = 19/28 ≈ 0.6786 · masteryDelta = 0.6786 - 16/25 = 0.0386
    long qHappy = insertQuestion(STU_HAPPY, "math", "KP-100", "测试 KP");
    // 本周周一 (offset 0 = 2026-05-11) 5 GRADED (5 MASTERED · 500 秒)
    seedRecords(STU_HAPPY, qHappy, 0, 5, 5, 500);
    // 周二 (offset 1) 5 GRADED (5 MASTERED · 500 秒)
    seedRecords(STU_HAPPY, qHappy, 1, 5, 5, 500);
    // 周三 (offset 2) 6 GRADED (4 MASTERED 2 FORGOT · 600 秒)
    seedRecords(STU_HAPPY, qHappy, 2, 4, 6, 600);
    // 周四 (offset 3) 6 GRADED (3 MASTERED 3 FORGOT · 600 秒)
    seedRecords(STU_HAPPY, qHappy, 3, 3, 6, 600);
    // 周五 (offset 4 = 2026-05-15 fixed now 当天) 6 GRADED (2 MASTERED 4 FORGOT · 600 秒 = 6×100) ·
    // 注意周五用 09:00 · 比 clock fixed_now 10am 早 1 小时 · 在本周窗口内
    // total duration = 500+500+600+600+600 = 2800 秒 = 46 分钟 (Java int truncation 安全 · 每个 record 100s 整除)
    seedRecordsAt(STU_HAPPY, qHappy, 4, 9, 2, 6, 600);
    // 上周累计 25 条 (16 MASTERED · seedRecordsForPrevWeek 用)
    seedRecordsPrevWeek(STU_HAPPY, qHappy, 16, 25);
    // 本周新建 8 条 wb_question (newCount=8)
    for (int i = 0; i < 7; i++) {
      insertQuestionAt(STU_HAPPY, "math", "KP-X" + i, "KP " + i, WEEK_MONDAY_UTC.plusSeconds(3600 * (12 + i)));
    }
    // 加上 qHappy 自己 (本周 monday + 1h 创建) 共 8 条
    jdbc.update("UPDATE wb_question SET created_at = ? WHERE id = ?",
        java.sql.Timestamp.from(WEEK_MONDAY_UTC.plusSeconds(3600)), qHappy);

    // When · GET /api/home/weekly · Header X-User-Id: 9210001
    MvcResult res = mvc.perform(
            get("/api/home/weekly").header("X-User-Id", STU_HAPPY))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.code").value(0))
        .andExpect(jsonPath("$.data.week").value("2026-W20"))
        .andExpect(jsonPath("$.data.range.from").value("2026-05-11"))
        .andExpect(jsonPath("$.data.range.to").value("2026-05-17"))
        .andExpect(jsonPath("$.data.stats.reviewedCount").value(28))
        .andExpect(jsonPath("$.data.stats.reviewedDurationMin").value(46))
        .andExpect(jsonPath("$.data.stats.newCount").value(8))
        .andReturn();

    JsonNode root = jsonMapper.readTree(res.getResponse().getContentAsString());
    JsonNode data = root.get("data");

    // 顶层 8 keys set equality (Case 1 字面)
    assertJsonObjectKeysExactly(
        data, "week", "range", "hero", "subjectRadar", "weakKPs", "stats", "failedTop", "aiInsight");
    // range 2 keys
    assertJsonObjectKeysExactly(data.get("range"), "from", "to");
    // hero 3 keys
    assertJsonObjectKeysExactly(data.get("hero"), "masteryRate", "masteryDelta", "sparkline");
    // stats 3 keys
    assertJsonObjectKeysExactly(data.get("stats"), "reviewedCount", "reviewedDurationMin", "newCount");
    // aiInsight 3 keys
    assertJsonObjectKeysExactly(data.get("aiInsight"), "insightId", "text", "generatedAt");
    // subjectRadar[0] 3 keys
    JsonNode radar = data.get("subjectRadar");
    assertThat(radar.isArray()).isTrue();
    assertThat(radar.size()).isGreaterThan(0);
    assertJsonObjectKeysExactly(radar.get(0), "subject", "masteryRate", "sampleSize");

    // masteryRate ≈ 19/28 ≈ 0.6786 · sparkline 长度严格 7
    double masteryRate = data.get("hero").get("masteryRate").asDouble();
    assertThat(masteryRate).isCloseTo(19.0 / 28.0, org.assertj.core.data.Offset.offset(1e-9));
    assertThat(data.get("hero").get("sparkline").size()).isEqualTo(7);

    // weakKPs ≤ 3
    assertThat(data.get("weakKPs").size()).isLessThanOrEqualTo(3);

    // 反 PII 字段泄漏 · response JSON 完整文本 grep 0 命中
    String json = res.getResponse().getContentAsString();
    assertThat(json).doesNotContain("student_id_hash");
    assertThat(json).doesNotContain("parent_id");
    assertThat(json).doesNotContain("device_fp");
  }

  // ============================================================================
  // Case 2 · 空周全 null 语义 · masteryRate=null · sparkline 7 null · stats.newCount=0
  // ============================================================================

  @Test
  @DisplayName("Case 2 · 空周: /weekly hero.masteryRate=null · sparkline 7 个 null · stats.newCount=0 · /today.weekSummary mirror")
  void case2_empty_week_null_semantics() throws Exception {
    // Given · STU_EMPTY 本周 0 wb_review_record · 0 wb_question

    // When · /weekly
    MvcResult weeklyRes = mvc.perform(
            get("/api/home/weekly").header("X-User-Id", STU_EMPTY))
        .andExpect(status().isOk()).andReturn();
    JsonNode weeklyData = jsonMapper.readTree(weeklyRes.getResponse().getContentAsString()).get("data");

    // Then · masteryRate 严格 null (不是 0 不是 0.0 不是 -1)
    assertThat(weeklyData.get("hero").get("masteryRate").isNull()).isTrue();
    // sparkline 长度 7 · 每个都 null
    JsonNode spark = weeklyData.get("hero").get("sparkline");
    assertThat(spark.size()).isEqualTo(7);
    for (int i = 0; i < 7; i++) {
      assertThat(spark.get(i).isNull()).as("sparkline[" + i + "] must be null").isTrue();
    }
    // newCount === 0 (不为 null · 计数字段)
    assertThat(weeklyData.get("stats").get("newCount").asInt()).isEqualTo(0);
    assertThat(weeklyData.get("stats").get("reviewedCount").asInt()).isEqualTo(0);

    // /today.weekSummary mirror
    MvcResult todayRes = mvc.perform(
            get("/api/home/today")
                .param("tz", TZ)
                .header("X-User-Id", STU_EMPTY))
        .andExpect(status().isOk()).andReturn();
    JsonNode todayData = jsonMapper.readTree(todayRes.getResponse().getContentAsString()).get("data");
    JsonNode ws = todayData.get("weekSummary");
    assertThat(ws.get("masteryRate").isNull()).isTrue();
    assertThat(ws.get("sparkline").size()).isEqualTo(7);
    for (int i = 0; i < 7; i++) {
      assertThat(ws.get("sparkline").get(i).isNull()).isTrue();
    }
    assertThat(ws.get("streak").asInt()).isEqualTo(0);
    assertThat(ws.get("newCount").asInt()).isEqualTo(0);
  }

  // ============================================================================
  // Case 3 · 单日 null + sparkline 不 forward-fill + streak yesterday-back
  // ============================================================================

  @Test
  @DisplayName("Case 3 · 单日空: sparkline[0] number · sparkline[1] null · sparkline[2] null (不 forward-fill) · sparkline[3] number · sparkline[4..6] null · streak ≥ 1 (昨天 ≥ 1 GRADED)")
  void case3_single_day_null_no_forward_fill_streak_yesterday_back() throws Exception {
    // Given · STU_PARTIAL · 本周周一 (offset 0) 3 GRADED · 周二 (offset 1) 0 · 周三 (offset 2) 0 ·
    //        周四 (offset 3) 2 GRADED · 周五-周日 0 · 今天 = 周五 fixed now · 昨天 = 周四 (≥ 1 GRADED)
    long q = insertQuestion(STU_PARTIAL, "math", "KP-200", "Case3 KP");
    seedRecords(STU_PARTIAL, q, 0, 2, 3, 300); // 周一 3 GRADED · 2 MASTERED · sparkline[0] = 2/3
    seedRecords(STU_PARTIAL, q, 3, 1, 2, 200); // 周四 2 GRADED · 1 MASTERED · sparkline[3] = 1/2

    // When
    MvcResult res = mvc.perform(get("/api/home/weekly").header("X-User-Id", STU_PARTIAL))
        .andExpect(status().isOk()).andReturn();
    JsonNode data = jsonMapper.readTree(res.getResponse().getContentAsString()).get("data");
    JsonNode spark = data.get("hero").get("sparkline");

    // Then
    assertThat(spark.size()).isEqualTo(7);
    assertThat(spark.get(0).isNull()).as("周一 sparkline[0]").isFalse();
    assertThat(spark.get(0).asDouble()).isCloseTo(2.0 / 3.0, org.assertj.core.data.Offset.offset(1e-9));
    assertThat(spark.get(1).isNull()).as("周二 sparkline[1] 空日 null").isTrue();
    assertThat(spark.get(2).isNull()).as("周三 sparkline[2] 空日 null · 不 forward-fill 周一值").isTrue();
    assertThat(spark.get(3).isNull()).as("周四 sparkline[3]").isFalse();
    assertThat(spark.get(3).asDouble()).isCloseTo(1.0 / 2.0, org.assertj.core.data.Offset.offset(1e-9));
    assertThat(spark.get(4).isNull()).as("周五 sparkline[4] 今天 0 GRADED null").isTrue();
    assertThat(spark.get(5).isNull()).isTrue();
    assertThat(spark.get(6).isNull()).isTrue();

    // /today.weekSummary streak ≥ 1 (昨天周四 ≥ 1 GRADED 起 yesterday-back)
    MvcResult todayRes = mvc.perform(
            get("/api/home/today").param("tz", TZ).header("X-User-Id", STU_PARTIAL))
        .andExpect(status().isOk()).andReturn();
    JsonNode ws = jsonMapper.readTree(todayRes.getResponse().getContentAsString())
        .get("data").get("weekSummary");
    assertThat(ws.get("sparkline").get(2).isNull()).isTrue();
    assertThat(ws.get("streak").asInt()).isGreaterThanOrEqualTo(1);
  }

  // ============================================================================
  // Case 4 · 双 endpoint 同源 (INV-6) + 同 endpoint 幂等 (TI1) + 禁缓存
  // ============================================================================

  @Test
  @DisplayName("Case 4 · 跨 endpoint 同源 + 同 endpoint 幂等: /weekly.hero.masteryRate === /today.weekSummary.masteryRate (浮点容差 0) · sparkline 数组逐元素一致 · 两次 /weekly 完全相等")
  void case4_cross_endpoint_homogeneity_and_idempotency() throws Exception {
    // Given · STU_IDEMP 本周 5 GRADED (3 MASTERED · 200 秒)
    long q = insertQuestion(STU_IDEMP, "physics", "KP-300", "Case4 KP");
    seedRecords(STU_IDEMP, q, 2, 3, 5, 200);

    // When · /weekly → /today → /weekly
    MvcResult w1Res = mvc.perform(get("/api/home/weekly").header("X-User-Id", STU_IDEMP))
        .andExpect(status().isOk()).andReturn();
    MvcResult tRes = mvc.perform(
            get("/api/home/today").param("tz", TZ).header("X-User-Id", STU_IDEMP))
        .andExpect(status().isOk()).andReturn();
    MvcResult w2Res = mvc.perform(get("/api/home/weekly").header("X-User-Id", STU_IDEMP))
        .andExpect(status().isOk()).andReturn();

    JsonNode w1 = jsonMapper.readTree(w1Res.getResponse().getContentAsString()).get("data");
    JsonNode t = jsonMapper.readTree(tRes.getResponse().getContentAsString()).get("data");
    JsonNode w2 = jsonMapper.readTree(w2Res.getResponse().getContentAsString()).get("data");

    // (1) 跨 endpoint 同源 INV-6
    assertThat(w1.get("hero").get("masteryRate").asDouble())
        .isEqualTo(t.get("weekSummary").get("masteryRate").asDouble());
    JsonNode w1Spark = w1.get("hero").get("sparkline");
    JsonNode tSpark = t.get("weekSummary").get("sparkline");
    assertThat(w1Spark.size()).isEqualTo(tSpark.size());
    for (int i = 0; i < 7; i++) {
      // null 位置一致
      assertThat(w1Spark.get(i).isNull()).isEqualTo(tSpark.get(i).isNull());
      if (!w1Spark.get(i).isNull()) {
        assertThat(w1Spark.get(i).asDouble()).isEqualTo(tSpark.get(i).asDouble());
      }
    }
    assertThat(w1.get("stats").get("newCount").asInt())
        .isEqualTo(t.get("weekSummary").get("newCount").asInt());

    // (2) 同 endpoint 幂等 TI1
    assertThat(w2.get("hero").get("masteryRate").asDouble())
        .isEqualTo(w1.get("hero").get("masteryRate").asDouble());
    assertThat(w2.get("hero").get("sparkline").toString())
        .isEqualTo(w1.get("hero").get("sparkline").toString());
    assertThat(w2.get("subjectRadar").toString()).isEqualTo(w1.get("subjectRadar").toString());
    assertThat(w2.get("weakKPs").toString()).isEqualTo(w1.get("weakKPs").toString());
  }

  // ============================================================================
  // Case 5 · PII 脱敏 0 命中 + weakKPs 按 recentMissCount DESC limit 3 反诱饵
  // ============================================================================

  @Test
  @DisplayName("Case 5 · PII 脱敏 0 命中 + weakKPs 按 recentMissCount DESC · KP-D recent=1 不入榜 · 排序 B(4) > C(3) > A(2)")
  void case5_pii_redact_and_weak_kp_ordering_by_recent_miss() throws Exception {
    // Given · 4 个 KP: A(recent=2) · B(recent=4) · C(recent=3) · D(recent=1 但 total=20 反诱饵)
    long qA = insertQuestion(STU_PII, "math", "KP-A", "Algebra");
    long qB = insertQuestion(STU_PII, "math", "KP-B", "Geometry");
    long qC = insertQuestion(STU_PII, "math", "KP-C", "Function");
    long qD = insertQuestion(STU_PII, "math", "KP-D", "Old History");

    // KP-A · 本周 2 FORGOT · 历史额外 8 FORGOT (total=10) · 本周还有 8 GRADED
    seedRecords(STU_PII, qA, 1, 0, 8, 400); // 周二 0 MASTERED 8 GRADED (其中 2 FORGOT 6 中性)
    seedForgotInWeek(STU_PII, qA, 1, 2);
    seedForgotPrevWeek(STU_PII, qA, 8);

    // KP-B · 本周 4 FORGOT
    seedForgotInWeek(STU_PII, qB, 2, 4);
    seedForgotPrevWeek(STU_PII, qB, 1);

    // KP-C · 本周 3 FORGOT
    seedForgotInWeek(STU_PII, qC, 3, 3);
    seedForgotPrevWeek(STU_PII, qC, 5);

    // KP-D · 本周 1 FORGOT (排除榜外) · 历史 19 FORGOT (total=20 · 反诱饵)
    seedForgotInWeek(STU_PII, qD, 0, 1);
    seedForgotPrevWeek(STU_PII, qD, 19);

    // When
    MvcResult res = mvc.perform(get("/api/home/weekly").header("X-User-Id", STU_PII))
        .andExpect(status().isOk()).andReturn();
    String json = res.getResponse().getContentAsString();
    JsonNode data = jsonMapper.readTree(json).get("data");

    // Then · PII 0 命中
    assertThat(json).doesNotContain("student_id_hash");
    assertThat(json).doesNotContain("parent_id");
    assertThat(json).doesNotContain("device_fp");

    // weakKPs length === 3 · 顺序 B(4) > C(3) > A(2) · D(1) 不入榜
    JsonNode wk = data.get("weakKPs");
    assertThat(wk.size()).isEqualTo(3);
    assertThat(wk.get(0).get("kpId").asText()).isEqualTo("KP-B");
    assertThat(wk.get(0).get("recentMissCount").asInt()).isEqualTo(4);
    assertThat(wk.get(1).get("kpId").asText()).isEqualTo("KP-C");
    assertThat(wk.get(1).get("recentMissCount").asInt()).isEqualTo(3);
    assertThat(wk.get(2).get("kpId").asText()).isEqualTo("KP-A");
    assertThat(wk.get(2).get("recentMissCount").asInt()).isEqualTo(2);
  }

  // ============================================================================
  // Case 6 · 错误码组 · 6a 401×2 (X-User-Id 缺失 / 非法) + 6b 500 SQLException 注入
  // ============================================================================

  @Test
  @DisplayName("Case 6a · X-User-Id Header 完全缺失 → HTTP 401 + code 40101 (UNAUTHORIZED · 不退化 500)")
  void case6a_unauthorized_missing_header() throws Exception {
    mvc.perform(get("/api/home/weekly"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value(40101));
  }

  @Test
  @DisplayName("Case 6a · X-User-Id Header 格式非法 → HTTP 401 + code 40101")
  void case6a_unauthorized_invalid_header_format() throws Exception {
    mvc.perform(get("/api/home/weekly").header("X-User-Id", "abc!"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value(40101));
    mvc.perform(get("/api/home/weekly").header("X-User-Id", ""))
        .andExpect(status().isUnauthorized());
    mvc.perform(get("/api/home/weekly").header("X-User-Id", "-1"))
        .andExpect(status().isUnauthorized());
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  /** 创建 wb_question · created_at = 本周周一 12:00 UTC. */
  private long insertQuestion(long ownerId, String subject, String kpId, String kpName) {
    return insertQuestionAt(ownerId, subject, kpId, kpName, WEEK_MONDAY_UTC.plusSeconds(3600 * 12));
  }

  private long insertQuestionAt(
      long ownerId, String subject, String kpId, String kpName, Instant createdAt) {
    long id = idGen.nextId();
    jdbc.update(
        "INSERT INTO wb_question (id, owner_id, subject_code, kp_id, kp_name, created_at, updated_at) "
            + "VALUES (?, ?, ?, ?, ?, ?, ?)",
        id, ownerId, subject, kpId, kpName,
        java.sql.Timestamp.from(createdAt), java.sql.Timestamp.from(createdAt));
    return id;
  }

  /**
   * 本周 dayOffset (0=周一, 4=周五, 6=周日) 时间 12:00 UTC 之后插入 totalCount 条 GRADED 记录 ·
   * 其中前 masteredCount 条 grade='MASTERED' · 其他为 'PARTIAL' (GRADED 但非 MASTERED) · 总 duration_sec.
   */
  private void seedRecords(
      long sid, long qid, int dayOffset, int masteredCount, int totalCount, int totalDurationSec) {
    seedRecordsAt(sid, qid, dayOffset, 12, masteredCount, totalCount, totalDurationSec);
  }

  private void seedRecordsAt(
      long sid, long qid, int dayOffset, int hourUtc, int masteredCount, int totalCount, int totalDurationSec) {
    int per = totalCount == 0 ? 0 : totalDurationSec / totalCount;
    for (int i = 0; i < totalCount; i++) {
      Instant ts = WEEK_MONDAY_UTC.plusSeconds(86400L * dayOffset + 3600L * hourUtc + 60L * i);
      String grade = i < masteredCount ? "MASTERED" : "PARTIAL";
      insertRecord(sid, qid, ts, grade, per);
    }
  }

  /** 上周 25 条 (16 MASTERED · 其他 PARTIAL) · 在上周周三 12:00 UTC. */
  private void seedRecordsPrevWeek(long sid, long qid, int masteredCount, int totalCount) {
    for (int i = 0; i < totalCount; i++) {
      Instant ts = PREV_WEEK_MONDAY_UTC.plusSeconds(86400L * 2 + 3600L * 12 + 60L * i);
      String grade = i < masteredCount ? "MASTERED" : "PARTIAL";
      insertRecord(sid, qid, ts, grade, 60);
    }
  }

  /** 本周 dayOffset 12:00 UTC 插入 count 条 FORGOT 记录. */
  private void seedForgotInWeek(long sid, long qid, int dayOffset, int count) {
    for (int i = 0; i < count; i++) {
      Instant ts =
          WEEK_MONDAY_UTC.plusSeconds(86400L * dayOffset + 3600L * 12 + 60L * i + 10);
      insertRecord(sid, qid, ts, "FORGOT", 30);
    }
  }

  /** 上周 (本周开始前 N 天) 插入 count 条 FORGOT 记录 · 用于 KP totalMiss 反诱饵. */
  private void seedForgotPrevWeek(long sid, long qid, int count) {
    for (int i = 0; i < count; i++) {
      // 上周周三 + i 分钟
      Instant ts = PREV_WEEK_MONDAY_UTC.plusSeconds(86400L * 2 + 3600L * 12 + 60L * i);
      insertRecord(sid, qid, ts, "FORGOT", 30);
    }
  }

  private void insertRecord(long sid, long qid, Instant reviewedAt, String grade, int durationSec) {
    long id = idGen.nextId();
    jdbc.update(
        "INSERT INTO wb_review_record (id, student_id, question_id, reviewed_at, grade, duration_sec) "
            + "VALUES (?, ?, ?, ?, ?, ?)",
        id, sid, qid, java.sql.Timestamp.from(reviewedAt), grade, durationSec);
  }

  /** 断言 JSON Object node 的 keys 字面 set equality. */
  private static void assertJsonObjectKeysExactly(JsonNode node, String... expectedKeys) {
    java.util.Set<String> actual = new java.util.HashSet<>();
    Iterator<Map.Entry<String, JsonNode>> it = node.fields();
    while (it.hasNext()) {
      actual.add(it.next().getKey());
    }
    java.util.Set<String> expected = new java.util.HashSet<>(java.util.Arrays.asList(expectedKeys));
    assertThat(actual).isEqualTo(expected);
  }

  /**
   * Case 6b · 服务端降级错误码 · 通过 @MockBean WeeklyAggregateService 抛 RuntimeException 实现.
   *
   * <p>独立 @Nested 测试类 · 避免 @MockBean 污染其他 case (Mockito Spring lifecycle 不允许同一类内动态切换 @MockBean).
   */
  @org.junit.jupiter.api.Nested
  @SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
  @AutoConfigureMockMvc
  @TestPropertySource(properties = "spring.cache.type=NONE")
  class Case6bServiceErrorIT extends IntegrationTestBase {
    @Autowired private MockMvc mvc6b;
    @MockBean private WeeklyAggregateService aggregateServiceMock;

    @Test
    @DisplayName("Case 6b · service 内部 SQLException → HTTP 500 + code 50001 (INTERNAL)")
    void case6b_internal_500_on_service_exception() throws Exception {
      org.mockito.Mockito.when(aggregateServiceMock.aggregate(org.mockito.ArgumentMatchers.anyLong(),
              org.mockito.ArgumentMatchers.any(ZoneId.class)))
          .thenThrow(new RuntimeException("simulated SQLException", new SQLException("boom")));

      mvc6b.perform(get("/api/home/weekly").header("X-User-Id", STU_HAPPY))
          .andExpect(status().isInternalServerError());
    }
  }
}
