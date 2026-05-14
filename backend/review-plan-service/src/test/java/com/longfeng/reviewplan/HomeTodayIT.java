package com.longfeng.reviewplan;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.longfeng.reviewplan.dto.HomeTodayResp;
import com.longfeng.reviewplan.support.SnowflakeIdGenerator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Map;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * SC-01-D01 · GET /api/home/today IT · 验证两条主路径：
 *
 * <ol>
 *   <li>① 空状态：用户无 review_plan 数据 → total=0 / done=0 / circleProgress=0.0
 *   <li>② 有 review_plan 数据：3 条 due today，1 条 completed_at=today → total=3 / done=1
 * </ol>
 *
 * <p>测试基础设施沿用 {@link IntegrationTestBase}（sandbox PG @ 15436 · Flyway on · MQ off）。
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
class HomeTodayIT extends IntegrationTestBase {

  @Autowired private MockMvc mvc;
  @Autowired private DataSource dataSource;
  @Autowired private ObjectMapper jsonMapper;
  @Autowired private SnowflakeIdGenerator idGen;

  private JdbcTemplate jdbc;

  private static final long HOME_USER = 9001001L;
  private static final String TZ = "Asia/Shanghai";

  @BeforeEach
  void seed() {
    jdbc = new JdbcTemplate(dataSource);
    // 清理可能的脏态（按 user_id 边界）
    jdbc.update("DELETE FROM review_plan WHERE student_id = ?", HOME_USER);
    jdbc.update("DELETE FROM wrong_item WHERE student_id = ?", HOME_USER);
    jdbc.update("DELETE FROM user_account WHERE id = ?", HOME_USER);

    jdbc.update(
        "INSERT INTO user_account (id, username, role, status, timezone) "
            + "VALUES (?, ?, 'STUDENT', 1, 'Asia/Shanghai')",
        HOME_USER,
        "home-today-user");
  }

  // ======================================================================
  // ① 空状态：无 review_plan → total=0 / done=0
  // ======================================================================

  @Test
  @DisplayName("SC-01-D01 ① 空状态：无 review_plan 数据 · total=0 / done=0 / circleProgress=0.0")
  void empty_state_returns_zero_total_and_zero_done() throws Exception {
    MvcResult res =
        mvc.perform(
                get("/api/home/today")
                    .param("tz", TZ)
                    .header("X-User-Id", HOME_USER))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(0))
            .andExpect(jsonPath("$.data.tz").value(TZ))
            .andExpect(jsonPath("$.data.today.total").value(0))
            .andExpect(jsonPath("$.data.today.done").value(0))
            .andExpect(jsonPath("$.data.today.circleProgress").value(0.0))
            .andReturn();

    HomeTodayResp resp = parse(res);
    assertThat(resp.tz()).isEqualTo(TZ);
    assertThat(resp.today().total()).isZero();
    assertThat(resp.today().done()).isZero();
    assertThat(resp.today().circleProgress()).isZero();
    // B02 决策：session in-memory → resume 当前阶段恒 null
    assertThat(resp.resume()).isNull();
  }

  // ======================================================================
  // ② 有数据：3 条 due today，1 条 completed → total=3 / done=1
  // ======================================================================

  @Test
  @DisplayName("SC-01-D01 ② 有数据：3 due today + 1 completed today · total=3 / done=1")
  void with_data_returns_correct_total_and_done() throws Exception {
    ZoneId zone = ZoneId.of(TZ);
    LocalDate today = LocalDate.now(zone);
    Instant noonToday = today.atStartOfDay(zone).plusHours(12).toInstant();

    // 3 条 wrong_item + review_plan：next_due_at 都落今日 12:00 (tz)
    long item1 = insertWrongItem("math");
    long item2 = insertWrongItem("math");
    long item3 = insertWrongItem("physics");
    long plan1 = insertPlan(item1, noonToday, null); // active, 未完成
    long plan2 = insertPlan(item2, noonToday, null); // active, 未完成
    long plan3 = insertPlan(item3, noonToday, noonToday); // completed_at=今日 → done

    MvcResult res =
        mvc.perform(
                get("/api/home/today")
                    .param("tz", TZ)
                    .header("X-User-Id", HOME_USER))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value(0))
            .andExpect(jsonPath("$.data.today.total").value(3))
            .andExpect(jsonPath("$.data.today.done").value(1))
            .andReturn();

    HomeTodayResp resp = parse(res);
    assertThat(resp.today().total()).isEqualTo(3);
    assertThat(resp.today().done()).isEqualTo(1);
    // circleProgress = 1/3 ≈ 0.333
    assertThat(resp.today().circleProgress()).isEqualTo(1.0 / 3.0);

    // 文档化 3 个 planId 互异（防呆）
    assertThat(plan1).isNotEqualTo(plan2);
    assertThat(plan2).isNotEqualTo(plan3);
  }

  // ======================================================================
  // helpers
  // ======================================================================

  private long insertWrongItem(String subject) {
    long id = idGen.nextId();
    jdbc.update(
        "INSERT INTO wrong_item (id, student_id, subject, source_type, status, mastery, version) "
            + "VALUES (?, ?, ?, 1, 0, 0, 0)",
        id,
        HOME_USER,
        subject);
    return id;
  }

  private long insertPlan(long wrongItemId, Instant nextDueAt, Instant completedAt) {
    long id = idGen.nextId();
    jdbc.update(
        "INSERT INTO review_plan (id, wrong_item_id, student_id, node_index, "
            + "strategy_code, start_at, current_level, interval_index, ease_factor, "
            + "total_review, total_forget, mastery_score, status, dispatch_version, "
            + "consecutive_good_count, next_due_at, completed_at, created_at, updated_at) "
            + "VALUES (?, ?, ?, 0, 'EBBINGHAUS_SM2', now(), 0, 0, 2.500, 0, 0, 0, 0, 0, 0, ?, ?, now(), now())",
        id,
        wrongItemId,
        HOME_USER,
        java.sql.Timestamp.from(nextDueAt),
        completedAt == null ? null : java.sql.Timestamp.from(completedAt));
    return id;
  }

  private HomeTodayResp parse(MvcResult res) throws Exception {
    Map<String, Object> env =
        jsonMapper.readValue(
            res.getResponse().getContentAsString(),
            new TypeReference<Map<String, Object>>() {});
    return jsonMapper.convertValue(env.get("data"), HomeTodayResp.class);
  }
}
