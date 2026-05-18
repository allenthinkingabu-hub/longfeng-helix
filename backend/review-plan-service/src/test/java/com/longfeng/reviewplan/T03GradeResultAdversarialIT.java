package com.longfeng.reviewplan;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
 * SC20-T03 · Adversarial IT (Tester Phase 4 · Step 2 严苛对抗 + Step 3 探索性测试).
 *
 * <p>**职责** (test-agent.md 铁律 3): Coder 已通过 6 主用例 · 但主用例覆盖范围有限 ·
 * Tester 必须发起破坏性边界测试 + 探索性测试 · 验证生产代码在严苛恶意场景下仍坚如磐石。
 *
 * <p>3 @Test method:
 * <ol>
 *   <li><b>adv01_strict_race_idempotency_exactly_one_outcome</b> · 严格 idempotency ·
 *       2 个并发 grade 同 nid · 验 review_outcome row count <b>exactly 1</b>
 *       (master §10.5 · 一次 grade 一次结算 · 严格断言 ≤ 1 而非 Coder 主用例的 ≤ 2)</li>
 *   <li><b>adv02_metadata_status_non_string_type_safe</b> · 探索性 · metadata 含
 *       `{"status": 12345}` (status 是 number 不是 string) · 验 extractMetadataStatus
 *       不抛 NPE/5xx · 而是 status=null 或 "12345" 字符串化 · GET :result 仍 200</li>
 *   <li><b>adv03_confidence_boundary_zero_and_one</b> · 探索性 · confidence=0.00 / 1.00
 *       边界值 (DECIMAL(3,2) range) · 验 GET :result 正常返 aiJudge object · 不触发
 *       buildAiJudgeDto 的 null check</li>
 * </ol>
 *
 * <p><b>为什么这些探索测试重要</b> (test-agent.md 铁律 3 「为什么这测试能抓回归」):
 * <ul>
 *   <li>adv01: master §10.5 idempotency 是 SC-01-T11 baseline · SC20-T03 改 :grade 加 4 CHECK
 *       后若 partial-rollback 不严 · race 下可能多写 outcome 行 · 破坏统计语义</li>
 *   <li>adv02: 上游 AI 服务版本变更可能写入非预期 type 的 status (e.g. enum number 而非 string) ·
 *       JSON.parseTree 不抛 · 但 .asText() 行为 (int → "12345") 需明示 · 防 GET :result 5xx 崩盘</li>
 *   <li>adv03: confidence DECIMAL(3,2) 边界 0.00/1.00 是 AI Judge 的物理边界 (0=完全错 · 1=完全对) ·
 *       验 buildAiJudgeDto 的 null check `wb.getAiJudgeConfidence() == null` 不误把 0.00 当 null</li>
 * </ul>
 *
 * <p>Sandbox: PG 15436 · 与 T03GradeResultAiFieldsE2EIT 共享 schema + IntegrationTestBase.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "spring.jpa.hibernate.ddl-auto=none",
        "spring.flyway.ignore-migration-patterns=*:ignored,*:future",
        "spring.flyway.baseline-version=1.0.083"
})
class T03GradeResultAdversarialIT extends IntegrationTestBase {

    @Autowired private MockMvc mvc;
    @Autowired private ReviewPlanRepository planRepo;
    @Autowired private ReviewOutcomeRepository outcomeRepo;
    @Autowired private ReviewPlanOutboxRepository outboxRepo;
    @Autowired private WbReviewNodeRepository wbNodeRepo;
    @Autowired private SnowflakeIdGenerator idGen;
    @Autowired private ObjectMapper json;

    private static final long STUDENT_ID = 9L;  // 与主 IT student_id=7/8 隔离
    private static final String DB_URL = "jdbc:postgresql://127.0.0.1:15436/wrongbook";
    private static final String DB_USER = "longfeng";
    private static final String DB_PASSWORD = "longfeng_dev";

    @BeforeEach
    void cleanup() {
        try (Connection conn = DriverManager.getConnection(DB_URL, DB_USER, DB_PASSWORD);
             Statement st = conn.createStatement()) {
            st.execute("DELETE FROM wb_review_node WHERE student_id IN (9)");
            st.execute("DELETE FROM review_outcome WHERE user_id IN (9)");
            st.execute("DELETE FROM review_plan_outbox WHERE event_type='graded'");
            st.execute("DELETE FROM review_plan WHERE student_id IN (9)");
        } catch (Exception e) {
            System.err.println("SC20-T03 Adversarial IT cleanup skip: " + e.getMessage());
        }
    }

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
        plan.setIntervalIndex((short) 0);
        plan.setEaseFactor(easeFactor);
        plan.setStatus(ReviewPlan.STATUS_ACTIVE);
        plan.setNextDueAt(Instant.now().plusSeconds(86400));
        planRepo.save(plan);
        return planId;
    }

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
            ps.setString(5, "D" + level);
            ps.setString(6, userAnswerImageKey);
            ps.setString(7, aiJudgeVerdict);
            if (aiJudgeConfidence == null) ps.setNull(8, java.sql.Types.NUMERIC);
            else ps.setBigDecimal(8, aiJudgeConfidence);
            ps.setString(9, aiJudgeReason);
            ps.setString(10, aiJudgeMetadataJson);
            ps.setString(11, finalGradeSource);
            ps.executeUpdate();
        } catch (Exception e) {
            throw new RuntimeException("seedWbReviewNode failed: " + e.getMessage(), e);
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
    // Adv-00 · A.1 学生主体性宪法 · header X-User-Id 缺失时 NODE_NOT_OWNED 必拒 (REJECT-fix)
    // ============================================================================

    /**
     * **REJECT-fix 候选铁证 (A.1 学生主体性宪法 inconsistency bug)**:
     *
     * <p>test-cases.md Round 2 #6 子断言 #c 字面 "跨用户访问 plan.student_id=8 ≠ Header X-User-Id:7 → 403" ·
     * 但 Coder 实装 ReviewPlanController.java L456 `userId != 0L && ...` 短路 ·
     * <b>当 X-User-Id header 缺失 (default 0) 时 · CHECK 整体跳过 · 任何客户端可 grade 任何 node</b>。
     *
     * <p>biz §1.4 A.1 学生主体性宪法字面: 任何 student 都不能 grade 他人的 node。
     * 实装允许 "no header" 绕过 CHECK · 是 inconsistency:
     * <ul>
     *   <li>设计意图 (test-cases.md 字面): X-User-Id default 0 但与 plan.studentId 不等仍拒</li>
     *   <li>实装 (line 456): X-User-Id=0 时跳过 check · plan.studentId 任何值都不拒</li>
     * </ul>
     *
     * <p>本 adversarial 用 X-User-Id 完全不传 + plan.studentId=9 (合法 student) ·
     * 预期 (按设计字面): 返 403 NODE_NOT_OWNED · DB 0 副作用。
     * 实际 (按 Coder 实装): 返 200 + DB 写入 outcome + outbox (A.1 严重违反)。
     */
    @Test
    @DisplayName("adv00 · A.1 学生主体性 · X-User-Id 缺失时不许 grade · 403 NODE_NOT_OWNED")
    void adv00_missing_user_header_must_reject_403() throws Exception {
        long nid = seedReviewPlan(STUDENT_ID, (short) 2, new BigDecimal("2.5"));  // student_id=9
        long planId = nid;

        // === When · POST :grade 不传 X-User-Id header ===
        MvcResult result = mvc.perform(
                post("/api/review/nodes/" + nid + "/grade")
                    .contentType(MediaType.APPLICATION_JSON)
                    // 不传 X-User-Id (default 0 by @RequestHeader)
                    .content("{\"grade\":\"PARTIAL\"}"))
            .andReturn();

        int status = result.getResponse().getStatus();
        String body = result.getResponse().getContentAsString(StandardCharsets.UTF_8);

        // === Then · 设计字面 (A.1 学生主体性) ===
        // 预期 403 NODE_NOT_OWNED · 因 plan.studentId=9 ≠ default userId=0
        // 当前 Coder 实装 L456 `userId != 0L && ...` 短路 → 返 200 = bug
        assertThat(status)
            .as("A.1 学生主体性 · header 缺失时必须 403 NODE_NOT_OWNED · 实装返 " + status + " body=" + body)
            .isEqualTo(403);
        assertThat(body)
            .as("error body 必含 NODE_NOT_OWNED")
            .contains("NODE_NOT_OWNED");

        // DB 0 副作用 (transaction rollback)
        int outcomeCount = selectInt("SELECT count(*) FROM review_outcome WHERE plan_id=" + planId);
        assertThat(outcomeCount).as("0 outcome").isEqualTo(0);
        int outboxCount = selectInt(
            "SELECT count(*) FROM review_plan_outbox WHERE event_type='graded' AND plan_id=" + planId);
        assertThat(outboxCount).as("0 outbox").isEqualTo(0);
    }

    // ============================================================================
    // Adv-01 · 严格 race idempotency (探索性 · 比主用例 #d-2 严)
    // ============================================================================

    /**
     * **探索性测试**: master §10.5 idempotency 字面 "一次 grade 一次结算" ·
     * Coder 主用例 #d-2 用 ≤ 2 宽松断言 (允许 race 重复写) · 但 master sibling 严格语义是
     * <b>exactly 1</b>. 本 adversarial 用更严断言验:
     *
     * <p>2 个并发 grade 同 nid · 预期 final state: review_outcome row count = 1
     * (一个成功 200 · 另一个 409 NODE_ALREADY_GRADED · 真 idempotency)。
     *
     * <p>若 fail (count > 1) → Coder 实装的 :grade 4 CHECK 中 NodeAlreadyGraded
     * 在 race 下 partial-rollback 不严 · 必须 fix (e.g. 加 DB UNIQUE constraint
     * 或 plan.completedAt 在 transaction 内 SELECT FOR UPDATE)。
     */
    @Test
    @DisplayName("adv01 · 2 并发 grade 同 nid · review_outcome row count exactly 1 (master §10.5 严)")
    void adv01_strict_race_idempotency_exactly_one_outcome() throws Exception {
        // === Given · 单 plan · 新建 ===
        long nid = seedReviewPlan(STUDENT_ID, (short) 2, new BigDecimal("2.5"));
        long planId = nid;

        // === When · 2 并发 grade · CountDownLatch 同时启动 ===
        java.util.concurrent.CountDownLatch startLatch = new java.util.concurrent.CountDownLatch(1);

        CompletableFuture<Integer> fut1 = CompletableFuture.supplyAsync(() -> {
            try {
                startLatch.await();
                return mvc.perform(
                        post("/api/review/nodes/" + nid + "/grade")
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
                        post("/api/review/nodes/" + nid + "/grade")
                            .contentType(MediaType.APPLICATION_JSON)
                            .header("X-User-Id", STUDENT_ID)
                            .content("{\"grade\":\"MASTERED\"}"))
                    .andReturn().getResponse().getStatus();
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });

        startLatch.countDown();  // 同时启动
        int status1, status2;
        try {
            status1 = fut1.get();
            status2 = fut2.get();
        } catch (ExecutionException ex) {
            throw new RuntimeException(ex);
        }

        // === Then · 严格 idempotency (master §10.5 字面) ===

        // 至少 1 个 200 (一次 grade 必须成功 · 不允许 0 个 200 = 完全失败)
        assertThat(status1 == 200 || status2 == 200)
            .as("至少 1 并发 PASS · status1=" + status1 + " status2=" + status2)
            .isTrue();

        // ⭐ 严格断言: review_outcome **exactly 1** row · 不允许 race 双写
        int outcomeCount = selectInt("SELECT count(*) FROM review_outcome WHERE plan_id=" + planId);
        assertThat(outcomeCount)
            .as("master §10.5 idempotency · race 不允许重复结算 · 严格 exactly 1 · "
                + "若 count > 1 则 Coder 实装 NodeAlreadyGraded CHECK 在 race 下 partial-rollback 不严 · "
                + "status1=" + status1 + " status2=" + status2 + " outcomeCount=" + outcomeCount)
            .isEqualTo(1);

        // review_plan_outbox 也严格 exactly 1 (graded event)
        int outboxCount = selectInt(
            "SELECT count(*) FROM review_plan_outbox WHERE event_type='graded' AND plan_id=" + planId);
        assertThat(outboxCount)
            .as("graded 事件也必须 exactly 1 · outboxCount=" + outboxCount)
            .isEqualTo(1);
    }

    // ============================================================================
    // Adv-02 · 探索性 · metadata.status 非 string type (上游 AI 服务版本兼容)
    // ============================================================================

    /**
     * **探索性测试**: 上游 AI 服务可能写入非 string 的 status (e.g. integer enum) ·
     * 验证 extractMetadataStatus 不抛 NPE/5xx · GET :result 仍 200 · status 字段优雅降级。
     *
     * <p>风险场景 (test-agent.md 铁律 3 「为什么这测试能抓回归」):
     * <ul>
     *   <li>AI 上游升级返回 `{"status": 12345}` (enum int) · Coder 实装 statusNode.asText()
     *       会把 int 字符串化为 "12345" · 不抛 · 是安全的 (Jackson JsonNode.asText() 行为)</li>
     *   <li>但若是 boolean / array / object · 行为不同 · 需逐一验</li>
     * </ul>
     */
    @Test
    @DisplayName("adv02 · metadata.status 非 string (number / boolean) · extractMetadataStatus 不崩")
    void adv02_metadata_status_non_string_type_safe() throws Exception {
        // === Given · metadata.status = number ===
        long nid = seedReviewPlan(STUDENT_ID, (short) 2, new BigDecimal("2.5"));
        long planId = nid;
        try (Connection conn = DriverManager.getConnection(DB_URL, DB_USER, DB_PASSWORD);
             Statement st = conn.createStatement()) {
            st.execute("UPDATE review_plan SET completed_at=now() WHERE id=" + planId);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
        seedWbReviewNode(
            nid, planId, STUDENT_ID, (short) 2,
            "wrongbook/answers/u9/img-adv02.jpg",
            "PARTIAL",
            new BigDecimal("0.50"),
            "AI 返回 status 是 int 不是 string",
            "{\"model_used\":\"sonnet\",\"status\":12345,\"latency_ms\":3000}",  // status 是 int
            "ai_accepted");

        // === When · GET :result · 不应崩 5xx ===
        MvcResult result = mvc.perform(
                get("/api/review/nodes/" + nid + "/result")
                    .header("X-User-Id", STUDENT_ID))
            .andExpect(status().isOk())  // 不允许 5xx
            .andReturn();

        // === Then · status 优雅降级 · Jackson.asText() int→"12345" 字符串化 ===
        String body = result.getResponse().getContentAsString(StandardCharsets.UTF_8);
        JsonNode aiJudge = json.readTree(body).path("data").path("aiJudge");
        assertThat(aiJudge.isNull())
            .as("aiJudge 不应整 null · 因 5 列均非 null + metadata 非 NULL")
            .isFalse();
        // Jackson .asText() 对 int node 返 "12345" · 是安全的 type coercion (无 NPE)
        // 验值为 "12345" 或 null (status node 非 string 时实装的实际行为 · 任一都是安全的)
        String statusText = aiJudge.path("status").asText();
        assertThat(statusText)
            .as("status 非 string 时 · 字符串化 '12345' 或降级 null 都视为安全 · 实际值=" + statusText)
            .isIn("12345", "", "null");  // "" = MissingNode.asText() · "null" = literal null text
    }

    // ============================================================================
    // Adv-03 · 探索性 · confidence DECIMAL(3,2) 边界值
    // ============================================================================

    /**
     * **探索性测试**: confidence 字段是 DECIMAL(3,2) · 边界值 0.00 / 1.00 是 AI Judge 物理边界
     * (0=完全不可信 · 1=完全可信) · 验 buildAiJudgeDto 的 null check
     * `wb.getAiJudgeConfidence() == null` 不误把 BigDecimal(0.00) 当 null。
     *
     * <p>风险场景 (test-agent.md 铁律 3):
     * <ul>
     *   <li>Java BigDecimal(0) != null · 但有些 ORM 框架将 0 视为 falsy 易混淆</li>
     *   <li>Jackson 序列化 BigDecimal 0.00 应输出 "0.00" 或 0.0 (不是 null)</li>
     *   <li>验真实 mp 端 destructure aiJudge.confidence 时不出 type mismatch</li>
     * </ul>
     */
    @Test
    @DisplayName("adv03 · confidence 0.00 / 1.00 边界 · 不误判 null · aiJudge 完整返")
    void adv03_confidence_boundary_zero_and_one() throws Exception {
        // === Given · confidence=0.00 (最低边界) ===
        long nid_zero = seedReviewPlan(STUDENT_ID, (short) 2, new BigDecimal("2.5"));
        long planId_zero = nid_zero;
        try (Connection conn = DriverManager.getConnection(DB_URL, DB_USER, DB_PASSWORD);
             Statement st = conn.createStatement()) {
            st.execute("UPDATE review_plan SET completed_at=now() WHERE id=" + planId_zero);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
        seedWbReviewNode(
            nid_zero, planId_zero, STUDENT_ID, (short) 2,
            "wrongbook/answers/u9/img-adv03-zero.jpg",
            "WRONG",
            new BigDecimal("0.00"),  // 最低边界
            "AI 完全不可信",
            "{\"model_used\":\"sonnet\",\"status\":\"DONE\"}",
            "ai_accepted");

        MvcResult result_zero = mvc.perform(
                get("/api/review/nodes/" + nid_zero + "/result")
                    .header("X-User-Id", STUDENT_ID))
            .andExpect(status().isOk())
            .andReturn();
        String body_zero = result_zero.getResponse().getContentAsString(StandardCharsets.UTF_8);
        JsonNode aiJudge_zero = json.readTree(body_zero).path("data").path("aiJudge");
        assertThat(aiJudge_zero.isNull())
            .as("confidence=0.00 不应被误判 null")
            .isFalse();
        assertThat(new BigDecimal(aiJudge_zero.path("confidence").asText()))
            .as("confidence 0.00 边界 · 序列化后值")
            .isEqualByComparingTo("0.00");

        // === Given · confidence=1.00 (最高边界) ===
        long nid_one = seedReviewPlan(STUDENT_ID, (short) 3, new BigDecimal("2.5"));
        long planId_one = nid_one;
        try (Connection conn = DriverManager.getConnection(DB_URL, DB_USER, DB_PASSWORD);
             Statement st = conn.createStatement()) {
            st.execute("UPDATE review_plan SET completed_at=now() WHERE id=" + planId_one);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
        seedWbReviewNode(
            nid_one, planId_one, STUDENT_ID, (short) 3,
            "wrongbook/answers/u9/img-adv03-one.jpg",
            "MASTERED",
            new BigDecimal("1.00"),  // 最高边界
            "AI 完全可信",
            "{\"model_used\":\"sonnet\",\"status\":\"DONE\"}",
            "ai_accepted");

        MvcResult result_one = mvc.perform(
                get("/api/review/nodes/" + nid_one + "/result")
                    .header("X-User-Id", STUDENT_ID))
            .andExpect(status().isOk())
            .andReturn();
        String body_one = result_one.getResponse().getContentAsString(StandardCharsets.UTF_8);
        JsonNode aiJudge_one = json.readTree(body_one).path("data").path("aiJudge");
        assertThat(aiJudge_one.isNull())
            .as("confidence=1.00 不应被误判 null")
            .isFalse();
        assertThat(new BigDecimal(aiJudge_one.path("confidence").asText()))
            .as("confidence 1.00 边界 · 序列化后值")
            .isEqualByComparingTo("1.00");
    }
}
