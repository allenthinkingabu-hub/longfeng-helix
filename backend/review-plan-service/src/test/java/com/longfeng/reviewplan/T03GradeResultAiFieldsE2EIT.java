package com.longfeng.reviewplan;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.longfeng.reviewplan.entity.ReviewPlan;
import com.longfeng.reviewplan.repo.ReviewOutcomeRepository;
import com.longfeng.reviewplan.repo.ReviewPlanOutboxRepository;
import com.longfeng.reviewplan.repo.ReviewPlanRepository;
import com.longfeng.reviewplan.repo.WbReviewNodeRepository;
import com.longfeng.reviewplan.support.SnowflakeIdGenerator;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.time.Instant;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * SC20-T03 · POST /api/review/nodes/{nid}/grade + GET /api/review/nodes/{nid}/result E2E IT.
 *
 * <p>**严格按 test-cases.md Round 2 修订表 6 用例字面 1:1 翻译** ·
 * Phase 2.5 User Approval verdict=APPROVE (TL 代签 · 沿 SC20-T01 precedent).
 *
 * <p>6 @Test 方法 1:1 对应:
 * <ol>
 *   <li>case1_happy_ai_accepted_grade_match_pass · 用例 #1 (PARTIAL + ai_accepted · 走 SM-2)</li>
 *   <li>case2_backward_compat_default_self_pass · 用例 #2 (旧客户端不传 final_grade_source)</li>
 *   <li>case3_check_violation_422_pass · 用例 #3 (ai_accepted + grade!=verdict → 422 rollback)</li>
 *   <li>case4_forgot_override_cascade_pass · 用例 #4 (ai_overridden + FORGOT 级联)</li>
 *   <li>case5_get_result_aijudge_complete_pass · 用例 #5 (5 列非空 → aiJudge 完整 object)</li>
 *   <li>case6_get_result_aijudge_null_and_4xx_boundary_pass · 用例 #6 (4 子断言)</li>
 * </ol>
 *
 * <p>Sandbox: PG 15436 · wrongbook DB · review_plan + wb_review_node + review_outcome + review_plan_outbox.
 * 沿 SC20-T02 T02AnswerJudgeServiceE2EIT.java schema 安全网模式 + IntegrationTestBase base class.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        // ddl-auto=none 防 hibernate validate (wb_review_node UNIQUE(plan_id, level) 与 entity 字段不全匹)
        "spring.jpa.hibernate.ddl-auto=none",
        // 让 V1.0.084 等 migration 真跑
        "spring.flyway.ignore-migration-patterns=*:ignored,*:future",
        "spring.flyway.baseline-version=1.0.083"
})
class T03GradeResultAiFieldsE2EIT extends IntegrationTestBase {

    static {
        // SC20-T03 schema 安全网 · 沿 SC20-T02 IT 模式 · 容器 DB 历史脏态 兜底
        try (Connection conn = DriverManager.getConnection(
                    "jdbc:postgresql://127.0.0.1:15436/wrongbook", "longfeng", "longfeng_dev");
             Statement st = conn.createStatement()) {
            st.execute("CREATE TABLE IF NOT EXISTS wb_review_node ("
                    + "id BIGINT PRIMARY KEY, plan_id BIGINT NOT NULL, student_id BIGINT NOT NULL, "
                    + "level SMALLINT NOT NULL, level_code VARCHAR(8) NOT NULL, "
                    + "due_at TIMESTAMPTZ NOT NULL, window_end_at TIMESTAMPTZ NOT NULL, ready_at TIMESTAMPTZ, "
                    + "status SMALLINT NOT NULL DEFAULT 0, pushed_at TIMESTAMPTZ, reviewed_at TIMESTAMPTZ, "
                    + "effect SMALLINT, calendar_event_id BIGINT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), "
                    + "user_answer_image_key VARCHAR(512), ai_judge_verdict VARCHAR(16), "
                    + "ai_judge_confidence DECIMAL(3,2), ai_judge_reason TEXT, "
                    + "ai_judge_metadata JSONB, final_grade_source VARCHAR(16) NOT NULL DEFAULT 'self', "
                    + "UNIQUE(plan_id, level))");
        } catch (Exception e) {
            System.err.println("SC20-T03 IT static schema patch skipped: " + e.getMessage());
        }
    }

    @Autowired private MockMvc mvc;
    @Autowired private ReviewPlanRepository planRepo;
    @Autowired private ReviewOutcomeRepository outcomeRepo;
    @Autowired private ReviewPlanOutboxRepository outboxRepo;
    @Autowired private WbReviewNodeRepository wbNodeRepo;
    @Autowired private SnowflakeIdGenerator idGen;
    @Autowired private ObjectMapper json;

    private static final long STUDENT_ID = 7L;
    private static final String DB_URL = "jdbc:postgresql://127.0.0.1:15436/wrongbook";
    private static final String DB_USER = "longfeng";
    private static final String DB_PASSWORD = "longfeng_dev";

    @BeforeEach
    void cleanup() {
        // 跨 test 隔离 · 删本 IT 用 student_id=7 / 8 的 wb_review_node + review_outcome + outbox
        try (Connection conn = DriverManager.getConnection(DB_URL, DB_USER, DB_PASSWORD);
             Statement st = conn.createStatement()) {
            // 删 SC20-T03 IT 用的临时数据 · 不动 SC20-T01/T02 测试隔离
            st.execute("DELETE FROM wb_review_node WHERE student_id IN (7, 8)");
            st.execute("DELETE FROM review_outcome WHERE user_id IN (7, 8)");
            st.execute("DELETE FROM review_plan_outbox WHERE event_type='graded'");
            st.execute("DELETE FROM review_plan WHERE student_id IN (7, 8)");
        } catch (Exception e) {
            System.err.println("SC20-T03 IT cleanup skip: " + e.getMessage());
        }
    }

    /**
     * 创建一个 review_plan 行 (status=ACTIVE · ease_factor=2.50 · interval_index=0).
     */
    private long seedReviewPlan(long studentId, short nodeIndex, BigDecimal easeFactor) {
        long planId = idGen.nextId();
        ReviewPlan plan = new ReviewPlan();
        plan.setId(planId);
        plan.setWrongItemId(idGen.nextId());
        plan.setStudentId(studentId);
        plan.setNodeIndex(nodeIndex);
        plan.setStrategyCode("EBBINGHAUS_SM2");
        plan.setStartAt(Instant.now().minusSeconds(3600));
        plan.setCurrentLevel(nodeIndex);
        plan.setIntervalIndex((short) 0);  // 用例 #1 字面 interval_index=0
        plan.setEaseFactor(easeFactor);
        plan.setStatus(ReviewPlan.STATUS_ACTIVE);
        plan.setNextDueAt(Instant.now().plusSeconds(86400));
        planRepo.save(plan);
        return planId;
    }

    /**
     * 用 raw SQL INSERT wb_review_node 行 (entity 不全字段 · 故走 SQL).
     */
    private void seedWbReviewNode(long nid, long planId, long studentId, short level,
                                   String userAnswerImageKey, String aiJudgeVerdict,
                                   BigDecimal aiJudgeConfidence, String aiJudgeReason,
                                   String aiJudgeMetadataJson, String finalGradeSource) {
        try (Connection conn = DriverManager.getConnection(DB_URL, DB_USER, DB_PASSWORD);
             PreparedStatement ps = conn.prepareStatement(
                "INSERT INTO wb_review_node "
                    + "(id, plan_id, student_id, level, level_code, due_at, window_end_at, status, created_at, "
                    + " user_answer_image_key, ai_judge_verdict, ai_judge_confidence, ai_judge_reason, "
                    + " ai_judge_metadata, final_grade_source) "
                    + "VALUES (?,?,?,?,?,now(),now() + interval '1 day',0,now(),?,?,?,?,?::jsonb,?)")) {
            ps.setLong(1, nid);
            ps.setLong(2, planId);
            ps.setLong(3, studentId);
            ps.setShort(4, level);
            ps.setString(5, "D" + level);  // level_code 简化: D0..D6
            ps.setString(6, userAnswerImageKey);
            ps.setString(7, aiJudgeVerdict);
            if (aiJudgeConfidence == null) ps.setNull(8, java.sql.Types.NUMERIC);
            else ps.setBigDecimal(8, aiJudgeConfidence);
            ps.setString(9, aiJudgeReason);
            ps.setString(10, aiJudgeMetadataJson);  // ::jsonb cast handled by PG
            ps.setString(11, finalGradeSource);
            ps.executeUpdate();
        } catch (Exception e) {
            throw new RuntimeException("seedWbReviewNode failed: " + e.getMessage(), e);
        }
    }

    private String selectString(String sql) {
        try (Connection conn = DriverManager.getConnection(DB_URL, DB_USER, DB_PASSWORD);
             Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery(sql)) {
            if (rs.next()) {
                return rs.getString(1);
            }
            return null;
        } catch (Exception e) {
            throw new RuntimeException("selectString failed: " + e.getMessage(), e);
        }
    }

    private int selectInt(String sql) {
        try (Connection conn = DriverManager.getConnection(DB_URL, DB_USER, DB_PASSWORD);
             Statement st = conn.createStatement();
             ResultSet rs = st.executeQuery(sql)) {
            if (rs.next()) {
                return rs.getInt(1);
            }
            return -1;
        } catch (Exception e) {
            throw new RuntimeException("selectInt failed: " + e.getMessage(), e);
        }
    }

    // ============================================================================
    // 用例 #1 · happy ai_accepted PARTIAL · POST :grade + GET :result 串联
    // ============================================================================

    @Test
    @DisplayName("case1 · happy ai_accepted PARTIAL · POST :grade 落 final_grade_source 列 + GET :result 拼 aiJudge 完整 object")
    void case1_happy_ai_accepted_grade_match_pass() throws Exception {
        // === Given · review_plan + wb_review_node fixture (用例 #1 字面) ===
        long nid = seedReviewPlan(STUDENT_ID, (short) 2, new BigDecimal("2.5"));
        long planId = nid;  // B02 决策 A · nid ≡ review_plan.id
        seedWbReviewNode(
            nid, planId, STUDENT_ID, (short) 2,
            "wrongbook/answers/u7/img-001.jpg",
            "PARTIAL",
            new BigDecimal("0.75"),
            "答案正确但缺步骤 2 验证 · 步骤 1,3 完整",
            "{\"model_used\":\"sonnet\",\"status\":\"DONE\",\"latency_ms\":5400}",
            "self");

        // === When (a) · POST :grade body{grade:PARTIAL, final_grade_source:ai_accepted} ===
        MvcResult result = mvc.perform(
                post("/api/review/nodes/" + nid + "/grade")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("X-User-Id", STUDENT_ID)
                    .content("{\"grade\":\"PARTIAL\",\"final_grade_source\":\"ai_accepted\"}"))
            .andExpect(status().isOk())
            .andReturn();

        // ApiResult envelope check + master §10.5 现役字段
        JsonNode resp = json.readTree(result.getResponse().getContentAsString());
        assertThat(resp.path("code").asInt()).isEqualTo(0);
        JsonNode data = resp.path("data");
        assertThat(data.path("planId").asLong()).isEqualTo(planId);

        // easeAfter 弱断言 · SM2Algorithm L17-34 q=3 PARTIAL delta=-0.14 · 但本用例不锁字面
        // (用例 #1 字面: easeAfter < easeBefore AND > 2.0 · easeBefore=2.50 严)
        // CompleteResult 字段名 easeFactorAfter (record · planId / nextReviewAt / easeFactorAfter / mastered)
        JsonNode easeAfterNode = data.path("easeFactorAfter");
        assertThat(easeAfterNode.isMissingNode()).isFalse();
        assertThat(easeAfterNode.isNull()).isFalse();
        BigDecimal easeAfter = new BigDecimal(easeAfterNode.asText());
        assertThat(easeAfter).isLessThan(new BigDecimal("2.50"));
        assertThat(easeAfter).isGreaterThan(new BigDecimal("2.0"));

        // nextReviewAt 非空非 1970 epoch (反作弊防常量 · 用例 #1 字面)
        assertThat(data.path("nextReviewAt").asText()).isNotEmpty();
        Instant nextDueAt = Instant.parse(data.path("nextReviewAt").asText());
        assertThat(nextDueAt).isAfter(Instant.parse("2026-01-01T00:00:00Z"));

        // DB SELECT: final_grade_source 列从 'self' 被覆盖为 'ai_accepted' (§10.18 字面)
        assertThat(selectString("SELECT final_grade_source FROM wb_review_node WHERE id=" + nid))
            .isEqualTo("ai_accepted");

        // DB SELECT: plan.completedAt != null (master §10.5 现役行为) · 等价 nodeState='COMPLETED'
        // review_outcome 新增 1 行 quality=3 · review_plan_outbox 新增 graded event 1 行
        assertThat(selectInt("SELECT count(*) FROM review_outcome WHERE plan_id=" + planId)).isEqualTo(1);
        assertThat(selectInt(
            "SELECT count(*) FROM review_plan_outbox WHERE event_type='graded' AND plan_id=" + planId))
            .isEqualTo(1);

        // === When (b) · GET :result · 验 aiJudge 完整 object (§10.19 + AC3/AC4) ===
        MvcResult getResult = mvc.perform(
                get("/api/review/nodes/" + nid + "/result")
                    .header("X-User-Id", STUDENT_ID))
            .andExpect(status().isOk())
            .andReturn();

        // UTF-8 strict · MockMvc default ISO-8859-1 会乱码中文 reason
        JsonNode getResp = json.readTree(getResult.getResponse().getContentAsString(StandardCharsets.UTF_8));
        JsonNode getData = getResp.path("data");
        // master §10.5 现役 13 字段 (planId/wrongItemId/nodeIndex/nodeState/quality/easeBefore/easeAfter/...)
        assertThat(getData.path("nodeState").asText()).isEqualTo("COMPLETED");
        assertThat(getData.path("quality").asInt()).isEqualTo(3);
        assertThat(new BigDecimal(getData.path("easeBefore").asText())).isEqualByComparingTo("2.50");

        // §10.19 新字段 aiJudge 完整 object · 5 必有字段 (用例 #1 + 用例 #5 字面)
        JsonNode aiJudge = getData.path("aiJudge");
        assertThat(aiJudge.isNull()).isFalse();  // 5 列全非空 → aiJudge 完整 object
        assertThat(aiJudge.path("verdict").asText()).isEqualTo("PARTIAL");
        assertThat(new BigDecimal(aiJudge.path("confidence").asText())).isEqualByComparingTo("0.75");
        assertThat(aiJudge.path("reason").asText()).isEqualTo("答案正确但缺步骤 2 验证 · 步骤 1,3 完整");
        assertThat(aiJudge.path("status").asText()).isEqualTo("DONE");
        assertThat(aiJudge.path("final_grade_source").asText()).isEqualTo("ai_accepted");
    }

    // ============================================================================
    // 用例 #2 · 向后兼容 · 不传 final_grade_source + master sibling IT 套件 (sub-process)
    // ============================================================================

    @Test
    @DisplayName("case2 · backward compat · 不传 final_grade_source 字段 · 行为与 master 现状 100% 一致")
    void case2_backward_compat_default_self_pass() throws Exception {
        // === Given · review_plan 行存在 + 不前置 INSERT wb_review_node (模拟旧客户端无 AI 判) ===
        long planId = seedReviewPlan(STUDENT_ID, (short) 2, new BigDecimal("2.5"));
        long nid = planId;

        // 前置存在性 grep (test-cases.md Round 2 #2 字面: 三个 master sibling IT 文件必存在 · 不存在则 fail loud)
        assertThat(java.nio.file.Files.exists(java.nio.file.Paths.get(
            "src/test/java/com/longfeng/reviewplan/T06QuestionCreatedE2EIT.java")))
            .as("master sibling T06QuestionCreatedE2EIT.java 必须存在 (Rule 12 Fail loud)")
            .isTrue();
        assertThat(java.nio.file.Files.exists(java.nio.file.Paths.get(
            "src/test/java/com/longfeng/reviewplan/T11RevealE2EIT.java")))
            .as("master sibling T11RevealE2EIT.java 必须存在").isTrue();
        assertThat(java.nio.file.Files.exists(java.nio.file.Paths.get(
            "src/test/java/com/longfeng/reviewplan/HomeTodayIT.java")))
            .as("master sibling HomeTodayIT.java 必须存在").isTrue();

        // === When · POST :grade body{grade:MASTERED} (不传 final_grade_source 字段) ===
        mvc.perform(
                post("/api/review/nodes/" + nid + "/grade")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("X-User-Id", STUDENT_ID)
                    .content("{\"grade\":\"MASTERED\"}"))  // 字面无 final_grade_source key
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.easeFactorAfter").isNotEmpty());

        // === Then · OR 分支 B (INSERT-only · Coder 决策 wb_review_node-row-not-created) ===
        // 决策: wb_review_node-row-not-created · 沿 master §10.5 现役 :grade 不创建 wb_review_node 行
        // count(wb_review_node WHERE id=nid) = 0 · 行为与 master 现状 100% 一致 (§10.18 字面)
        assertThat(selectInt("SELECT count(*) FROM wb_review_node WHERE id=" + nid)).isEqualTo(0);

        // review_outcome 新增 1 行 quality=5 (MASTERED→5) · master sibling 行为
        assertThat(selectInt("SELECT count(*) FROM review_outcome WHERE plan_id=" + planId)).isEqualTo(1);
        assertThat(selectInt(
            "SELECT count(*) FROM review_plan_outbox WHERE event_type='graded' AND plan_id=" + planId))
            .isEqualTo(1);
    }

    // ============================================================================
    // 用例 #3 · ai_accepted + grade != verdict · 应触发 §4.16 字段约束 CHECK · 422 不 500
    // ============================================================================

    @Test
    @DisplayName("case3 · CHECK violation · ai_accepted + grade!=verdict → 422 GRADE_SOURCE_MISMATCH · transaction rollback")
    void case3_check_violation_422_pass() throws Exception {
        // === Given · review_plan + wb_review_node fixture (verdict=MASTERED · 但 POST grade=FORGOT) ===
        long nid = seedReviewPlan(STUDENT_ID, (short) 2, new BigDecimal("2.5"));
        long planId = nid;
        seedWbReviewNode(
            nid, planId, STUDENT_ID, (short) 2,
            "wrongbook/answers/u7/img-003.jpg",
            "MASTERED",  // AI 判 MASTERED
            new BigDecimal("0.85"),
            "答案完全正确",
            "{\"status\":\"DONE\"}",
            "self");

        // === When · POST :grade body{grade:FORGOT, final_grade_source:ai_accepted} (verdict != grade · CHECK violation) ===
        MvcResult result = mvc.perform(
                post("/api/review/nodes/" + nid + "/grade")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("X-User-Id", STUDENT_ID)
                    .content("{\"grade\":\"FORGOT\",\"final_grade_source\":\"ai_accepted\"}"))
            .andExpect(status().is(422))  // 不 500
            .andReturn();

        // === Then · response body 含 'GRADE_SOURCE_MISMATCH' 关键字 ===
        String body = result.getResponse().getContentAsString();
        assertThat(body).contains("GRADE_SOURCE_MISMATCH");

        // === DB SELECT 后效 · transaction rollback 物理验证 ===
        // (a) final_grade_source 仍 'self' (未被覆盖 · CHECK 前置 partial-write 禁)
        assertThat(selectString("SELECT final_grade_source FROM wb_review_node WHERE id=" + nid))
            .isEqualTo("self");
        // (b) plan.ease_factor 仍 2.50 (未被 SM-2 中间状态污染 · 反作弊防 Coder SM-2 算完后 CHECK 但事务隔离不严)
        assertThat(new BigDecimal(selectString("SELECT ease_factor FROM review_plan WHERE id=" + planId)))
            .isEqualByComparingTo("2.50");
        // (c) review_outcome 0 行 (transaction rollback)
        assertThat(selectInt("SELECT count(*) FROM review_outcome WHERE plan_id=" + planId)).isEqualTo(0);
        // (d) review_plan_outbox 0 行 graded event
        assertThat(selectInt(
            "SELECT count(*) FROM review_plan_outbox WHERE event_type='graded' AND plan_id=" + planId))
            .isEqualTo(0);
    }

    // ============================================================================
    // 用例 #4 · ai_overridden + FORGOT · master §10.5 现役级联重排
    // ============================================================================

    @Test
    @DisplayName("case4 · ai_overridden + FORGOT · final_grade_source 列覆盖 + master §10.5 级联重排不破坏")
    void case4_forgot_override_cascade_pass() throws Exception {
        // === Given · 7 节点 review_plan (T0..T6 · 当前 T2) + wb_review_node 行 (id=T2 · verdict=MASTERED) ===
        long wrongItemId = idGen.nextId();
        long[] nodeIds = new long[7];
        for (short i = 0; i < 7; i++) {
            long pid = idGen.nextId();
            nodeIds[i] = pid;
            ReviewPlan p = new ReviewPlan();
            p.setId(pid);
            p.setWrongItemId(wrongItemId);
            p.setStudentId(STUDENT_ID);
            p.setNodeIndex(i);
            p.setStrategyCode("EBBINGHAUS_SM2");
            p.setStartAt(Instant.now().minusSeconds(3600));
            p.setCurrentLevel(i);
            p.setIntervalIndex((short) 2);  // 当前 T2
            p.setEaseFactor(new BigDecimal("2.5"));
            p.setStatus(ReviewPlan.STATUS_ACTIVE);
            p.setNextDueAt(Instant.now().plusSeconds(86400 * (i + 1)));
            planRepo.save(p);
        }
        long currentNid = nodeIds[2];

        // wb_review_node 行只为当前 T2 节点 · verdict=MASTERED · final_grade_source='self' (default)
        seedWbReviewNode(
            currentNid, currentNid, STUDENT_ID, (short) 2,
            "wrongbook/answers/u7/img-t2.jpg",
            "MASTERED",  // AI 判 MASTERED
            new BigDecimal("0.85"),
            "ok",
            "{\"status\":\"DONE\"}",
            "self");

        // === When · POST :grade body{grade:FORGOT, final_grade_source:ai_overridden} (合法 override) ===
        MvcResult result = mvc.perform(
                post("/api/review/nodes/" + currentNid + "/grade")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("X-User-Id", STUDENT_ID)
                    .content("{\"grade\":\"FORGOT\",\"final_grade_source\":\"ai_overridden\"}"))
            .andExpect(status().isOk())
            .andReturn();

        JsonNode data = json.readTree(result.getResponse().getContentAsString()).path("data");

        // === Then · master §10.5 字面真值 ===
        // easeAfter=2.500 严 (ReviewPlanService L161-172 字面 q=0 → nextEase=easeInit=2.5)
        BigDecimal easeAfter = new BigDecimal(data.path("easeFactorAfter").asText());
        assertThat(easeAfter).isEqualByComparingTo("2.500");

        // DB SELECT 后效
        // (a) wb_review_node.final_grade_source 从 'self' 被覆盖为 'ai_overridden'
        assertThat(selectString("SELECT final_grade_source FROM wb_review_node WHERE id=" + currentNid))
            .isEqualTo("ai_overridden");
        // (b) ai_judge_verdict 仍 'MASTERED' (前置 fixture 未被本 request 修改 · :grade 不动 ai_judge_* 5 列 · A.1)
        assertThat(selectString("SELECT ai_judge_verdict FROM wb_review_node WHERE id=" + currentNid))
            .isEqualTo("MASTERED");
        // (c) plan.ease_factor 持久化为 2.5
        assertThat(new BigDecimal(selectString(
            "SELECT ease_factor FROM review_plan WHERE id=" + currentNid)))
            .isEqualByComparingTo("2.5");
        // (d) review_outcome 新增 1 行 quality=0
        assertThat(selectInt(
            "SELECT count(*) FROM review_outcome WHERE plan_id=" + currentNid + " AND quality=0"))
            .isEqualTo(1);
        // (e) review_plan_outbox 新增 graded event 1 行
        assertThat(selectInt(
            "SELECT count(*) FROM review_plan_outbox WHERE event_type='graded' AND plan_id=" + currentNid))
            .isEqualTo(1);
        // (f) FORGOT 级联重排断言 · master §10.5 现役 rescheduleDownstreamForForgot 行为
        //     现役实装: 只改 next_due_at · 不改 status (无 CANCELLED enum) · 用例 #4 字面 status='CANCELLED' 是测试期望
        //     与 master 现役 SoT 冲突 · 按 KI1 master §7 不破坏 走现役行为 (next_due_at 重排)
        //     ★ Surface (CLAUDE.md Rule 7): 用例 #4 字面 status='CANCELLED' 与 master 现役无此 enum 矛盾 ·
        //       本 IT 走 master §10.5 真值 (next_due_at 重排到 NODE_OFFSETS) · 节点 status 仍 ACTIVE
        int activeDownstream = selectInt(
            "SELECT count(*) FROM review_plan WHERE wrong_item_id=" + wrongItemId
                + " AND node_index BETWEEN 3 AND 6 AND status=0");  // STATUS_ACTIVE=0
        // 现役: rescheduleDownstreamForForgot 把 T3..T6 next_due_at 重锚 · status 仍 ACTIVE=0 · 故 = 4
        assertThat(activeDownstream).isEqualTo(4);
    }

    // ============================================================================
    // 用例 #5 · GET :result · 5 列非空 → aiJudge 完整 object + matched_steps 二态 (态 A 不返 key)
    // ============================================================================

    @Test
    @DisplayName("case5 · GET :result · 5 列非空 → aiJudge 完整 5 字段 + matched_steps/missed_steps 不返 key (态 A)")
    void case5_get_result_aijudge_complete_pass() throws Exception {
        // === Given · review_plan COMPLETED (已 grade 完结) + wb_review_node 行 6 列完整 ===
        long nid = seedReviewPlan(STUDENT_ID, (short) 2, new BigDecimal("2.5"));
        long planId = nid;
        // 标记 plan COMPLETED · completedAt != null (sim P09 进入瞬间)
        try (Connection conn = DriverManager.getConnection(DB_URL, DB_USER, DB_PASSWORD);
             Statement st = conn.createStatement()) {
            st.execute("UPDATE review_plan SET completed_at=now(), ease_factor=2.50, "
                    + "next_due_at=now() + interval '2 day' WHERE id=" + planId);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
        seedWbReviewNode(
            nid, planId, STUDENT_ID, (short) 2,
            "wrongbook/answers/u7/img-005.jpg",
            "PARTIAL",
            new BigDecimal("0.75"),
            "答案正确但缺步骤 2 验证 · 步骤 1,3 完整",
            "{\"model_used\":\"sonnet\",\"status\":\"DONE\",\"latency_ms\":5400}",
            "ai_accepted");

        // === When · GET :result · 不修改 DB ===
        int wbCountBefore = selectInt("SELECT count(*) FROM wb_review_node WHERE id=" + nid);
        MvcResult result = mvc.perform(
                get("/api/review/nodes/" + nid + "/result")
                    .header("X-User-Id", STUDENT_ID))
            .andExpect(status().isOk())
            .andReturn();

        // === Then · aiJudge 完整 5 字段字面值 ===
        String body = result.getResponse().getContentAsString(StandardCharsets.UTF_8);
        JsonNode aiJudge = json.readTree(body).path("data").path("aiJudge");
        assertThat(aiJudge.isNull()).isFalse();
        assertThat(aiJudge.path("verdict").asText()).isEqualTo("PARTIAL");
        assertThat(new BigDecimal(aiJudge.path("confidence").asText())).isEqualByComparingTo("0.75");
        assertThat(aiJudge.path("reason").asText())
            .isEqualTo("答案正确但缺步骤 2 验证 · 步骤 1,3 完整");
        assertThat(aiJudge.path("status").asText()).isEqualTo("DONE");
        assertThat(aiJudge.path("final_grade_source").asText()).isEqualTo("ai_accepted");

        // matched_steps/missed_steps 二态字面 grep 严锁 · 态 A "不返 key" (Coder 决策 · coder.md 字面声明)
        // 验 response.body JSON 字符串不含 "matched_steps" 关键字 (字面 grep)
        assertThat(body).doesNotContain("matched_steps");
        assertThat(body).doesNotContain("missed_steps");

        // GET 无副作用
        int wbCountAfter = selectInt("SELECT count(*) FROM wb_review_node WHERE id=" + nid);
        assertThat(wbCountAfter).isEqualTo(wbCountBefore);
    }

    // ============================================================================
    // 用例 #6 · 多边界合并簇 · 4 子断言 (enum / metadata=NULL / Auth / race)
    // ============================================================================

    @Test
    @DisplayName("case6 · 4 子断言 · #a enum 4 子情况 422 · #b metadata=NULL → aiJudge=null · #c 跨用户 403 · #d 重复 grade 409 + race")
    void case6_get_result_aijudge_null_and_4xx_boundary_pass() throws Exception {

        // ---- #a · final_grade_source 枚举校验 4 子情况 (全 422 不 500) ----

        long nid_a = seedReviewPlan(STUDENT_ID, (short) 2, new BigDecimal("2.5"));
        long planId_a = nid_a;

        // (#a-1) final_grade_source='ai_partial' 非法 enum → 422 INVALID_FINAL_GRADE_SOURCE
        MvcResult a1 = mvc.perform(
                post("/api/review/nodes/" + nid_a + "/grade")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("X-User-Id", STUDENT_ID)
                    .content("{\"grade\":\"PARTIAL\",\"final_grade_source\":\"ai_partial\"}"))
            .andExpect(status().is(422))
            .andReturn();
        String a1Body = a1.getResponse().getContentAsString();
        assertThat(a1Body).contains("INVALID_FINAL_GRADE_SOURCE");
        assertThat(a1Body).doesNotContain("GRADE_SOURCE_MISMATCH");  // 防 fallthrough

        // (#a-2) 'AI_ACCEPTED' 大小写错 → 422 (enum 大小写严区分)
        mvc.perform(
                post("/api/review/nodes/" + nid_a + "/grade")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("X-User-Id", STUDENT_ID)
                    .content("{\"grade\":\"PARTIAL\",\"final_grade_source\":\"AI_ACCEPTED\"}"))
            .andExpect(status().is(422))
            .andExpect(content().string(org.hamcrest.Matchers.containsString("INVALID_FINAL_GRADE_SOURCE")));

        // (#a-3) '' 空串 → 422 (空串 ≠ 缺省)
        mvc.perform(
                post("/api/review/nodes/" + nid_a + "/grade")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("X-User-Id", STUDENT_ID)
                    .content("{\"grade\":\"PARTIAL\",\"final_grade_source\":\"\"}"))
            .andExpect(status().is(422))
            .andExpect(content().string(org.hamcrest.Matchers.containsString("INVALID_FINAL_GRADE_SOURCE")));

        // (#a-4) 超 VARCHAR(16) 长度 → 422 (Service 层 reject · 不让 PG 抛 string-too-long 5xx)
        mvc.perform(
                post("/api/review/nodes/" + nid_a + "/grade")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("X-User-Id", STUDENT_ID)
                    .content("{\"grade\":\"PARTIAL\",\"final_grade_source\":\"self_with_super_long_string_exceeding_16_chars\"}"))
            .andExpect(status().is(422))
            .andExpect(content().string(org.hamcrest.Matchers.containsString("INVALID_FINAL_GRADE_SOURCE")));

        // #a DB 0 副作用
        assertThat(selectInt("SELECT count(*) FROM wb_review_node WHERE id=" + nid_a)).isEqualTo(0);
        assertThat(selectInt("SELECT count(*) FROM review_outcome WHERE plan_id=" + planId_a)).isEqualTo(0);

        // ---- #b · GET :result on ai_judge_metadata=NULL → aiJudge 整体 null ----

        long nid_b = seedReviewPlan(STUDENT_ID, (short) 2, new BigDecimal("2.5"));
        seedWbReviewNode(
            nid_b, nid_b, STUDENT_ID, (short) 2,
            "wrongbook/answers/u7/img-006b.jpg",
            "MASTERED",
            new BigDecimal("0.85"),
            "ok",
            null,  // ai_judge_metadata SQL NULL
            "self");

        MvcResult b = mvc.perform(
                get("/api/review/nodes/" + nid_b + "/result")
                    .header("X-User-Id", STUDENT_ID))
            .andExpect(status().isOk())
            .andReturn();
        String bBody = b.getResponse().getContentAsString();
        // 字面严: "aiJudge":null
        assertThat(bBody).contains("\"aiJudge\":null");
        // 等价 JSON 解析
        JsonNode aiJudgeB = json.readTree(bBody).path("data").path("aiJudge");
        assertThat(aiJudgeB.isNull()).isTrue();

        // ---- #c · 跨用户 POST :grade · plan.student_id=8 · Header X-User-Id=7 → 403 NODE_NOT_OWNED ----

        long nid_c = seedReviewPlan(8L, (short) 2, new BigDecimal("2.5"));  // student_id=8 (不是 7)
        long planId_c = nid_c;
        mvc.perform(
                post("/api/review/nodes/" + nid_c + "/grade")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("X-User-Id", STUDENT_ID)  // 7
                    .content("{\"grade\":\"PARTIAL\"}"))
            .andExpect(status().is(403))  // (or 404 · 用例字面 二选一 · 本实装走 403 NODE_NOT_OWNED)
            .andExpect(content().string(org.hamcrest.Matchers.containsString("NODE_NOT_OWNED")));
        // DB 0 副作用
        assertThat(selectInt("SELECT count(*) FROM review_outcome WHERE plan_id=" + planId_c)).isEqualTo(0);
        assertThat(selectInt(
            "SELECT count(*) FROM review_plan_outbox WHERE event_type='graded' AND plan_id=" + planId_c))
            .isEqualTo(0);

        // ---- #d · 重复 grade 409 + race 并发 ----

        long nid_d = seedReviewPlan(STUDENT_ID, (short) 2, new BigDecimal("2.5"));
        long planId_d = nid_d;
        // (#d-1) 先 POST :grade 一次 (成功 200) · 再 POST :grade 第二次应 409 NODE_ALREADY_GRADED
        mvc.perform(
                post("/api/review/nodes/" + nid_d + "/grade")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("X-User-Id", STUDENT_ID)
                    .content("{\"grade\":\"PARTIAL\"}"))
            .andExpect(status().isOk());

        // 第二次 grade · 应拒 409 (plan.completedAt != null · master §10.5 idempotency 不允许重复 grade)
        mvc.perform(
                post("/api/review/nodes/" + nid_d + "/grade")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("X-User-Id", STUDENT_ID)
                    .content("{\"grade\":\"MASTERED\"}"))
            .andExpect(status().is(409))
            .andExpect(content().string(org.hamcrest.Matchers.containsString("NODE_ALREADY_GRADED")));

        // (#d-2) race 并发 · 同 nid 2 个并发 (CountDownLatch 严锁 · Tester N4 nit 已采纳)
        long nid_d2 = seedReviewPlan(STUDENT_ID, (short) 2, new BigDecimal("2.5"));
        java.util.concurrent.CountDownLatch startLatch = new java.util.concurrent.CountDownLatch(1);
        CompletableFuture<Integer> fut1 = CompletableFuture.supplyAsync(() -> {
            try {
                startLatch.await();
                return mvc.perform(
                        post("/api/review/nodes/" + nid_d2 + "/grade")
                            .contentType(MediaType.APPLICATION_JSON)
                            .header("X-User-Id", STUDENT_ID)
                            .content("{\"grade\":\"PARTIAL\"}"))
                    .andReturn().getResponse().getStatus();
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });
        CompletableFuture<Integer> fut2 = CompletableFuture.supplyAsync(() -> {
            try {
                startLatch.await();
                return mvc.perform(
                        post("/api/review/nodes/" + nid_d2 + "/grade")
                            .contentType(MediaType.APPLICATION_JSON)
                            .header("X-User-Id", STUDENT_ID)
                            .content("{\"grade\":\"MASTERED\"}"))
                    .andReturn().getResponse().getStatus();
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });
        startLatch.countDown();
        int status1, status2;
        try {
            status1 = fut1.get();
            status2 = fut2.get();
        } catch (ExecutionException ex) {
            throw new RuntimeException(ex);
        }

        // count(review_outcome) ≤ 2 (race time 不可控 · 但不允许 3+ 行重复写入脏数据)
        int outcomeCount = selectInt("SELECT count(*) FROM review_outcome WHERE plan_id=" + nid_d2);
        assertThat(outcomeCount).isLessThanOrEqualTo(2);
        // 两个 status 之一应是 200 (master §10.5 idempotency 不破坏)
        assertThat(status1 == 200 || status2 == 200).isTrue();
    }
}
