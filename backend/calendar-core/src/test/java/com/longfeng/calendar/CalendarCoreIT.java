package com.longfeng.calendar;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.longfeng.calendar.dto.CalendarEventCreateReq;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * S5 calendar-core integration test · real PG sandbox (port 15435).
 *
 * <p>Validates:
 * <ul>
 *   <li>POST /internal/events/batch · batch create 7 events (idempotent)
 *   <li>POST /internal/calendar/events/{eid}/subscribe · subscribe (idempotent)
 *   <li>DELETE /internal/events · FORGOT cascade soft-delete
 *   <li>POST /api/calendar/events/{eid}/subscribe · public subscribe
 *   <li>GET /calendar/nodes · Feign target query
 * </ul>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class CalendarCoreIT extends IntegrationTestBase {

    private static final long OWNER_ID = 8000100L;
    private static final long WRONG_ITEM_ID = 8000200L;

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper json;
    @Autowired private DataSource dataSource;

    private JdbcTemplate jdbc;

    @BeforeEach
    void ensureSchemaAndCleanUp() {
        jdbc = new JdbcTemplate(dataSource);
        // Ensure table exists (Flyway disabled — sandbox schema managed externally)
        jdbc.execute(CREATE_TABLE_DDL);
        jdbc.execute(CREATE_INDEXES_DDL);
        // Hard-delete test data to avoid interference between tests
        jdbc.update("DELETE FROM calendar_event WHERE owner_id = ?", OWNER_ID);
    }

    // ======================================================================
    // ① Batch create 7 events
    // ======================================================================
    @Test
    @DisplayName("POST /internal/events/batch · create 7 STUDY events")
    void batchCreate_7Events() throws Exception {
        List<CalendarEventCreateReq> reqs = buildSevenReqs();

        mvc.perform(post("/internal/events/batch")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(reqs)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(7))
                .andExpect(jsonPath("$[0].relationType").value("STUDY"))
                .andExpect(jsonPath("$[0].state").value("SCHEDULED"));

        int count = jdbc.queryForObject(
                "SELECT count(*) FROM calendar_event WHERE owner_id = ? AND deleted_at IS NULL",
                Integer.class, OWNER_ID);
        assertThat(count).isEqualTo(7);
    }

    // ======================================================================
    // ② Batch create idempotent
    // ======================================================================
    @Test
    @DisplayName("POST /internal/events/batch · idempotent replay returns same events")
    void batchCreate_idempotent() throws Exception {
        List<CalendarEventCreateReq> reqs = buildSevenReqs();

        // First call
        mvc.perform(post("/internal/events/batch")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(reqs)))
                .andExpect(status().isOk());

        // Replay same requests
        mvc.perform(post("/internal/events/batch")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(reqs)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(7));

        // Still only 7 rows
        int count = jdbc.queryForObject(
                "SELECT count(*) FROM calendar_event WHERE owner_id = ? AND deleted_at IS NULL",
                Integer.class, OWNER_ID);
        assertThat(count).isEqualTo(7);
    }

    // ======================================================================
    // ③ Subscribe internal
    // ======================================================================
    @Test
    @DisplayName("POST /internal/calendar/events/{eid}/subscribe · subscribe + idempotent replay")
    void subscribeInternal() throws Exception {
        // Create one event first
        List<CalendarEventCreateReq> reqs = buildSevenReqs().subList(0, 1);
        MvcResult createResult = mvc.perform(post("/internal/events/batch")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(reqs)))
                .andExpect(status().isOk())
                .andReturn();

        Long eventId = json.readTree(createResult.getResponse().getContentAsString())
                .get(0).get("id").asLong();

        // Subscribe
        mvc.perform(post("/internal/calendar/events/" + eventId + "/subscribe"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.subscribed").value(true))
                .andExpect(jsonPath("$.eventId").value(eventId));

        // Idempotent replay
        mvc.perform(post("/internal/calendar/events/" + eventId + "/subscribe"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.subscribed").value(true));

        // DB check
        Boolean subscribed = jdbc.queryForObject(
                "SELECT subscribed FROM calendar_event WHERE id = ?",
                Boolean.class, eventId);
        assertThat(subscribed).isTrue();
    }

    // ======================================================================
    // ④ Public subscribe (P09 §5 #3)
    // ======================================================================
    @Test
    @DisplayName("POST /api/calendar/events/{eid}/subscribe · public subscribe with ApiResult")
    void subscribePublic() throws Exception {
        List<CalendarEventCreateReq> reqs = buildSevenReqs().subList(0, 1);
        MvcResult createResult = mvc.perform(post("/internal/events/batch")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(reqs)))
                .andExpect(status().isOk())
                .andReturn();

        Long eventId = json.readTree(createResult.getResponse().getContentAsString())
                .get(0).get("id").asLong();

        mvc.perform(post("/api/calendar/events/" + eventId + "/subscribe")
                        .header("X-User-Id", "student1")
                        .header("X-Idempotency-Key", "idem-sub-" + eventId)
                        .header("X-Request-Id", "req-001"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.subscribed").value(true));
    }

    // ======================================================================
    // ⑤ FORGOT cascade · soft delete by relation
    // ======================================================================
    @Test
    @DisplayName("DELETE /internal/events · FORGOT cascade soft-delete by relation prefix")
    void forgotCascade_softDelete() throws Exception {
        // Create 7 events
        List<CalendarEventCreateReq> reqs = buildSevenReqs();
        mvc.perform(post("/internal/events/batch")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(reqs)))
                .andExpect(status().isOk());

        assertThat(countActiveEvents()).isEqualTo(7);

        // Soft-delete by relation prefix
        mvc.perform(delete("/internal/events")
                        .param("relationType", "STUDY")
                        .param("relationIdPrefix", "question:" + WRONG_ITEM_ID + ":"))
                .andExpect(status().isOk());

        assertThat(countActiveEvents()).isZero();

        // Verify soft-deleted (still in DB with deleted_at set)
        int totalInDb = jdbc.queryForObject(
                "SELECT count(*) FROM calendar_event WHERE owner_id = ?",
                Integer.class, OWNER_ID);
        assertThat(totalInDb).isEqualTo(7);
    }

    // ======================================================================
    // ⑥ GET /calendar/nodes · Feign target query
    // ======================================================================
    @Test
    @DisplayName("GET /calendar/nodes · query events by date")
    void getNodes_byDate() throws Exception {
        List<CalendarEventCreateReq> reqs = buildSevenReqs();
        mvc.perform(post("/internal/events/batch")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(reqs)))
                .andExpect(status().isOk());

        // T0 is 2h from base → 2026-05-15 in Asia/Shanghai
        mvc.perform(get("/calendar/nodes")
                        .param("date", "2026-05-15")
                        .param("ownerId", String.valueOf(OWNER_ID))
                        .header("X-User-Timezone", "Asia/Shanghai"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].relationType").value("STUDY"));
    }

    // ======================================================================
    // ⑦ P10 spec §5 #1 · GET /api/calendar/events?month=YYYY-MM
    // ======================================================================
    @Test
    @DisplayName("GET /api/calendar/events?month=YYYY-MM · 月范围查询 + 日 bucket")
    void listByMonth_bucketsByDate() throws Exception {
        // Seed: 7 Ebbinghaus events (T0..T6) · 6 in May 2026 SHA, 1 in June 2026 SHA
        // (base 2026-05-15T08:00:00Z + {2h,1d,2d,4d,7d,14d,30d} ·
        //  Asia/Shanghai 是 UTC+8 · 故 T6 = 2026-06-14)
        mvc.perform(post("/internal/events/batch")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(buildSevenReqs())))
                .andExpect(status().isOk());

        // 查 2026-05 · 期待 6 条 (T0..T5) · 跨日 ASC bucket
        mvc.perform(get("/api/calendar/events")
                        .param("month", "2026-05")
                        .header("X-User-Id", String.valueOf(OWNER_ID))
                        .header("X-User-Timezone", "Asia/Shanghai"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.month").value("2026-05"))
                .andExpect(jsonPath("$.data.days.length()").value(6))
                .andExpect(jsonPath("$.data.days[0].date").value("2026-05-15"))
                .andExpect(jsonPath("$.data.days[0].events.length()").value(1))
                .andExpect(jsonPath("$.data.days[0].events[0].relationType").value("STUDY"))
                .andExpect(jsonPath("$.data.days[5].date").value("2026-05-29"));

        // 查 2026-06 · 期待 1 条 (T6)
        mvc.perform(get("/api/calendar/events")
                        .param("month", "2026-06")
                        .header("X-User-Id", String.valueOf(OWNER_ID))
                        .header("X-User-Timezone", "Asia/Shanghai"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.month").value("2026-06"))
                .andExpect(jsonPath("$.data.days.length()").value(1))
                .andExpect(jsonPath("$.data.days[0].date").value("2026-06-14"));

        // 查空月 · 期待 days=[]
        mvc.perform(get("/api/calendar/events")
                        .param("month", "2026-09")
                        .header("X-User-Id", String.valueOf(OWNER_ID)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.month").value("2026-09"))
                .andExpect(jsonPath("$.data.days.length()").value(0));

        // 格式错 · 不 throw 400 · 返空 (controller 状态机兜底)
        mvc.perform(get("/api/calendar/events")
                        .param("month", "bad-format")
                        .header("X-User-Id", String.valueOf(OWNER_ID)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.days.length()").value(0));

        // 无 X-User-Id · 返空月 · 不 401
        mvc.perform(get("/api/calendar/events")
                        .param("month", "2026-05"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.days.length()").value(0));
    }

    // ======================================================================
    // Helpers
    // ======================================================================
    private int countActiveEvents() {
        return jdbc.queryForObject(
                "SELECT count(*) FROM calendar_event WHERE owner_id = ? AND deleted_at IS NULL",
                Integer.class, OWNER_ID);
    }

    private List<CalendarEventCreateReq> buildSevenReqs() {
        // Ebbinghaus spacing: 2h, 1d, 2d, 4d, 7d, 14d, 30d from base
        Instant base = Instant.parse("2026-05-15T08:00:00Z");
        long[] offsetHours = {2, 24, 48, 96, 168, 336, 720};

        return java.util.stream.IntStream.range(0, 7).mapToObj(i -> {
            CalendarEventCreateReq r = new CalendarEventCreateReq();
            r.setRelationType("STUDY");
            r.setRelationId("question:" + WRONG_ITEM_ID + ":node:" + (100 + i));
            r.setOwnerId(OWNER_ID);
            r.setTitle("复习节点 T" + i);
            Instant start = base.plus(offsetHours[i], ChronoUnit.HOURS);
            r.setStartAt(start);
            r.setEndAt(start.plus(30, ChronoUnit.MINUTES));
            r.setState("SCHEDULED");
            r.setColorTag("#FFC857");
            r.setSource("review-plan-service");
            r.setIdempotencyKey(r.getRelationId());
            return r;
        }).toList();
    }
}
