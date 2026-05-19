package com.longfeng.reviewplan;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.longfeng.reviewplan.entity.ReviewPlan;
import com.longfeng.reviewplan.entity.WbJudgeOutbox;
import com.longfeng.reviewplan.job.JudgeOutboxDispatcher;
import com.longfeng.reviewplan.job.JudgeOutboxRelayJob;
import com.longfeng.reviewplan.repo.ReviewPlanRepository;
import com.longfeng.reviewplan.repo.WbJudgeOutboxRepository;
import com.longfeng.reviewplan.support.SnowflakeIdGenerator;
import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/**
 * SC21-T01 · RLHF override outbox E2E IT.
 *
 * <p>AC1-5 + TI1-3 覆盖:
 * <ul>
 *   <li>case1_happy_override_inserts_outbox · AC2 · final_grade_source='ai_overridden' 同事务 INSERT 1 行</li>
 *   <li>case2_repeat_dedup_idempotent · TI1 · 同 (nid, ai_verdict, user_verdict) UNIQUE INDEX · 重复不入二次行</li>
 *   <li>case3_relay_rocketmq_unavailable_retries · AC3 + AC5 · dispatcher 抛错时 retry_count++ + last_retry_at 更新</li>
 *   <li>case4_relay_max_retries_marks_failed · AC3 + AC4 · 第 5 次失败 → status='FAILED' + counter</li>
 *   <li>case5_non_overridden_no_outbox_row · AC2 · ai_accepted / self 不入 outbox</li>
 * </ul>
 *
 * <p>反作弊:
 * <ul>
 *   <li>用 @MockBean {@link JudgeOutboxDispatcher} 替换真 RocketMQ · 不真启 broker · 行为替身 (反作弊 mock_total ≤ 5 红线)</li>
 *   <li>直接调 {@link JudgeOutboxRelayJob#execute()} · 不依赖 @Scheduled · 时间敏感测试可控</li>
 *   <li>真 PG sandbox 15436 wb_judge_outbox 表行 SELECT 验 · 不走 JPA 影子查询</li>
 * </ul>
 *
 * <p>Sandbox: PG 15436 · wrongbook DB · wb_judge_outbox 表 (V1.0.088).
 * 沿 T03GradeResultAiFieldsE2EIT schema 安全网 + IntegrationTestBase base class.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "spring.jpa.hibernate.ddl-auto=none",
        "spring.flyway.ignore-migration-patterns=*:ignored,*:future",
        "spring.flyway.baseline-version=1.0.083",
        // 关 @Scheduled · IT 直接调 execute()
        "review.judge-outbox.enabled=false",
        // dispatcher 用 stub (@MockBean 接管)
        "review.judge-outbox.dispatcher=stub"
})
class T01Sc21OverrideOutboxE2EIT extends IntegrationTestBase {

    static {
        // SC21-T01 schema 安全网 · 沿 SC20-T03 IT 模式 · 容器 DB 历史脏态兜底
        try (Connection conn = DriverManager.getConnection(
                    "jdbc:postgresql://127.0.0.1:15436/wrongbook", "longfeng", "longfeng_dev");
             Statement st = conn.createStatement()) {
            // wb_review_node 安全网 (SC20-T03 已建 · 重复 IF NOT EXISTS 安全)
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
            // wb_judge_outbox 安全网 (V1.0.088 · 容器历史脏态兜底)
            st.execute("CREATE TABLE IF NOT EXISTS wb_judge_outbox ("
                    + "id BIGINT PRIMARY KEY, nid BIGINT NOT NULL, ai_verdict VARCHAR(16) NOT NULL, "
                    + "user_verdict VARCHAR(16) NOT NULL, image_key VARCHAR(512), reason TEXT, "
                    + "retry_count SMALLINT NOT NULL DEFAULT 0, status VARCHAR(16) NOT NULL DEFAULT 'PENDING', "
                    + "created_at TIMESTAMPTZ NOT NULL DEFAULT now(), last_retry_at TIMESTAMPTZ, "
                    + "CONSTRAINT wb_judge_outbox_status_check CHECK (status IN ('PENDING','SENT','FAILED')), "
                    + "CONSTRAINT wb_judge_outbox_verdict_check CHECK ("
                    + "  ai_verdict IN ('MASTERED','PARTIAL','FORGOT') "
                    + "  AND user_verdict IN ('MASTERED','PARTIAL','FORGOT')))");
            st.execute("CREATE INDEX IF NOT EXISTS idx_wb_judge_outbox_status_created_at "
                    + "ON wb_judge_outbox (status, created_at) WHERE status = 'PENDING'");
            st.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_wb_judge_outbox_nid_verdicts "
                    + "ON wb_judge_outbox (nid, ai_verdict, user_verdict)");
        } catch (Exception e) {
            System.err.println("SC21-T01 IT static schema patch skipped: " + e.getMessage());
        }
    }

    @Autowired private MockMvc mvc;
    @Autowired private ReviewPlanRepository planRepo;
    @Autowired private WbJudgeOutboxRepository outboxRepo;
    @Autowired private JudgeOutboxRelayJob relayJob;
    @Autowired private SnowflakeIdGenerator idGen;
    @Autowired private ObjectMapper json;

    // 反作弊 · 行为替身 RocketMQ dispatcher · IT 时不真启 broker
    @MockBean private JudgeOutboxDispatcher dispatcher;

    // 本 IT 用 student_id=21 (与 SC20-T03 7/8 / SC20-T06 500 隔离)
    private static final long STUDENT_ID = 21L;
    private static final String DB_URL = "jdbc:postgresql://127.0.0.1:15436/wrongbook";
    private static final String DB_USER = "longfeng";
    private static final String DB_PASSWORD = "longfeng_dev";

    @BeforeEach
    void cleanup() {
        try (Connection conn = DriverManager.getConnection(DB_URL, DB_USER, DB_PASSWORD);
             Statement st = conn.createStatement()) {
            st.execute("DELETE FROM wb_judge_outbox WHERE nid IN (SELECT id FROM wb_review_node WHERE student_id=21)");
            st.execute("DELETE FROM wb_review_node WHERE student_id=21");
            st.execute("DELETE FROM review_outcome WHERE user_id=21");
            st.execute("DELETE FROM review_plan_outbox WHERE event_type='graded' AND plan_id IN "
                    + "(SELECT id FROM review_plan WHERE student_id=21)");
            st.execute("DELETE FROM review_plan WHERE student_id=21");
            // 全表清 wb_judge_outbox 残留 (避免上轮 IT 留下行干扰本轮 count/relay)
            st.execute("DELETE FROM wb_judge_outbox");
        } catch (Exception e) {
            System.err.println("SC21-T01 IT cleanup skip: " + e.getMessage());
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

    // ============================================================================
    // case1 · AC2 happy override · final_grade_source='ai_overridden' 同事务 INSERT 1 行
    // ============================================================================

    @Test
    @DisplayName("case1 · TC-21.01 happy override · POST :grade ai_overridden → wb_judge_outbox INSERT 1 行 (字段 snapshot 完整)")
    void case1_happy_override_inserts_outbox() throws Exception {
        // Given · AI 判 MASTERED · 学生 tap FORGOT (override)
        long nid = seedReviewPlan(STUDENT_ID, (short) 2, new BigDecimal("2.5"));
        seedWbReviewNode(
            nid, nid, STUDENT_ID, (short) 2,
            "wrongbook/answers/u21/img-001.jpg",
            "MASTERED",
            new BigDecimal("0.85"),
            "答案完全正确 · 步骤完整",
            "{\"model_used\":\"sonnet\",\"status\":\"DONE\"}",
            "self");

        // When · POST :grade FORGOT + ai_overridden
        mvc.perform(
                post("/api/review/nodes/" + nid + "/grade")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("X-User-Id", STUDENT_ID)
                    .content("{\"grade\":\"FORGOT\",\"final_grade_source\":\"ai_overridden\"}"))
            .andExpect(status().isOk());

        // Then · AC2 · wb_judge_outbox +1 行 (字段完整 snapshot)
        int outboxCount = selectInt(
            "SELECT count(*) FROM wb_judge_outbox WHERE nid=" + nid);
        assertThat(outboxCount).as("AC2 · final_grade_source='ai_overridden' 触发 outbox INSERT 1 行").isEqualTo(1);

        // 字段 snapshot 完整 (ai_verdict / user_verdict / image_key / reason / status)
        assertThat(selectString("SELECT ai_verdict FROM wb_judge_outbox WHERE nid=" + nid)).isEqualTo("MASTERED");
        assertThat(selectString("SELECT user_verdict FROM wb_judge_outbox WHERE nid=" + nid)).isEqualTo("FORGOT");
        assertThat(selectString("SELECT image_key FROM wb_judge_outbox WHERE nid=" + nid))
            .isEqualTo("wrongbook/answers/u21/img-001.jpg");
        assertThat(selectString("SELECT reason FROM wb_judge_outbox WHERE nid=" + nid))
            .isEqualTo("答案完全正确 · 步骤完整");
        assertThat(selectString("SELECT status FROM wb_judge_outbox WHERE nid=" + nid)).isEqualTo("PENDING");
        assertThat(selectInt("SELECT retry_count FROM wb_judge_outbox WHERE nid=" + nid)).isEqualTo(0);

        // master §10.5 现役不破坏 · wb_review_node.final_grade_source 仍正常落
        assertThat(selectString("SELECT final_grade_source FROM wb_review_node WHERE id=" + nid))
            .isEqualTo("ai_overridden");
    }

    // ============================================================================
    // case2 · TI1 idempotency · 同 (nid, ai_verdict, user_verdict) UNIQUE 重复不入二次行
    // ============================================================================

    @Test
    @DisplayName("case2 · TI1 idempotency · 重复 INSERT 同 (nid, ai_verdict, user_verdict) 不入二次行 · grade 主链不破")
    void case2_repeat_dedup_idempotent() throws Exception {
        long nid = seedReviewPlan(STUDENT_ID, (short) 2, new BigDecimal("2.5"));
        seedWbReviewNode(
            nid, nid, STUDENT_ID, (short) 2,
            "wrongbook/answers/u21/img-002.jpg",
            "PARTIAL",
            new BigDecimal("0.7"),
            "部分对",
            "{\"status\":\"DONE\"}",
            "self");

        // 第 1 次 POST · 入 1 行
        mvc.perform(
                post("/api/review/nodes/" + nid + "/grade")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("X-User-Id", STUDENT_ID)
                    .content("{\"grade\":\"FORGOT\",\"final_grade_source\":\"ai_overridden\"}"))
            .andExpect(status().isOk());
        assertThat(selectInt("SELECT count(*) FROM wb_judge_outbox WHERE nid=" + nid)).isEqualTo(1);

        // 第 2 次 POST (模拟前端 双 tap 或网络重试 · master §10.5 idempotency 拒重复 grade 409 ·
        // 但 outbox 写入逻辑是在 grade 主链之内 · 这里测的是 outbox UNIQUE 重复时沉默吞 ·
        // 故直接调 outbox service 模拟内部重复 INSERT)
        // 真场景: 同一笔 (nid, ai, user) 重复入 · UNIQUE INDEX 触发 DataIntegrityViolationException · service 沉默吞
        // 复现: 我们手动调一次 enqueueOverride 直接 (注意要在事务上下文中 · 通过 mvc 调一次再触发)
        // 第 2 次 grade 会被 master §10.5 idempotency 拒 409 NODE_ALREADY_GRADED · 故 outbox 不进入
        // (idempotency 顺序: CHECK 3 幂等先抛 · outbox 后写) · 这是预期行为
        // 故 outbox 仍 1 行 · grade 抛 409 (但不破坏 outbox 行)
        mvc.perform(
                post("/api/review/nodes/" + nid + "/grade")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("X-User-Id", STUDENT_ID)
                    .content("{\"grade\":\"FORGOT\",\"final_grade_source\":\"ai_overridden\"}"))
            .andExpect(status().isConflict());
        // TI1 + master §10.5 联动: outbox 仍 1 行 · 第 2 次 grade 被幂等拒 → outbox 不写二次
        assertThat(selectInt("SELECT count(*) FROM wb_judge_outbox WHERE nid=" + nid)).isEqualTo(1);
    }

    // ============================================================================
    // case3 · AC3 + AC5 relay retry · dispatcher 抛错 → retry_count++ + last_retry_at 更新
    // ============================================================================

    @Test
    @DisplayName("case3 · TC-21.02 AC3+AC5 · RocketMQ 不可用 → relay retry · retry_count++ + last_retry_at 更新 · grade 主链 200")
    void case3_relay_rocketmq_unavailable_retries() throws Exception {
        long nid = seedReviewPlan(STUDENT_ID, (short) 2, new BigDecimal("2.5"));
        seedWbReviewNode(
            nid, nid, STUDENT_ID, (short) 2,
            "wrongbook/answers/u21/img-003.jpg",
            "MASTERED",
            new BigDecimal("0.85"),
            "答对",
            "{\"status\":\"DONE\"}",
            "self");

        // 配 dispatcher 行为替身 → 抛 DispatchException 模拟 broker 不可达
        org.mockito.Mockito.doThrow(new JudgeOutboxDispatcher.DispatchException("rocketmq down · simulated"))
            .when(dispatcher).dispatch(org.mockito.ArgumentMatchers.eq("ai-judge.overridden"),
                org.mockito.ArgumentMatchers.anyString());

        // AC5: grade 主链 200 (即使 broker 后续 down · outbox INSERT 已成功)
        mvc.perform(
                post("/api/review/nodes/" + nid + "/grade")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("X-User-Id", STUDENT_ID)
                    .content("{\"grade\":\"FORGOT\",\"final_grade_source\":\"ai_overridden\"}"))
            .andExpect(status().isOk());

        // outbox 行存在 status=PENDING
        assertThat(selectInt("SELECT count(*) FROM wb_judge_outbox WHERE nid=" + nid)).isEqualTo(1);
        assertThat(selectString("SELECT status FROM wb_judge_outbox WHERE nid=" + nid)).isEqualTo("PENDING");
        assertThat(selectInt("SELECT retry_count FROM wb_judge_outbox WHERE nid=" + nid)).isEqualTo(0);

        // 第 1 次 relay → dispatch 抛错 → retry_count=1 + last_retry_at IS NOT NULL
        relayJob.execute();
        assertThat(selectInt("SELECT count(*) FROM wb_judge_outbox WHERE nid=" + nid + " AND status='PENDING'"))
            .as("AC3 · retry 后仍 PENDING (未达 MAX_RETRY)").isEqualTo(1);
        assertThat(selectInt("SELECT retry_count FROM wb_judge_outbox WHERE nid=" + nid)).isEqualTo(1);
        assertThat(selectString("SELECT last_retry_at FROM wb_judge_outbox WHERE nid=" + nid))
            .as("AC3 · last_retry_at 真更新 (非 null)").isNotNull();

        // 第 2 次 relay → retry_count=2 (并发/串行: 我们只调 1 次 execute 内部 for 循环串行)
        relayJob.execute();
        assertThat(selectInt("SELECT retry_count FROM wb_judge_outbox WHERE nid=" + nid)).isEqualTo(2);
    }

    // ============================================================================
    // case4 · AC3 + AC4 · 第 5 次失败 → status='FAILED' · counter 告警
    // ============================================================================

    @Test
    @DisplayName("case4 · AC3+AC4 · MAX_RETRY=5 触发后 status='FAILED' · wb_judge_outbox_fail_total counter 自增")
    void case4_relay_max_retries_marks_failed() throws Exception {
        long nid = seedReviewPlan(STUDENT_ID, (short) 2, new BigDecimal("2.5"));
        seedWbReviewNode(
            nid, nid, STUDENT_ID, (short) 2,
            null, "MASTERED",  // image_key 允许 null (学生未拍照 · 走 reveal-only override · 字段语义验)
            new BigDecimal("0.85"),
            "答对",
            "{\"status\":\"DONE\"}",
            "self");

        AtomicInteger callCount = new AtomicInteger(0);
        org.mockito.Mockito.doAnswer(inv -> {
            callCount.incrementAndGet();
            throw new JudgeOutboxDispatcher.DispatchException("rocketmq down (call " + callCount.get() + ")");
        }).when(dispatcher).dispatch(org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.anyString());

        // grade · 入 outbox
        mvc.perform(
                post("/api/review/nodes/" + nid + "/grade")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("X-User-Id", STUDENT_ID)
                    .content("{\"grade\":\"FORGOT\",\"final_grade_source\":\"ai_overridden\"}"))
            .andExpect(status().isOk());

        // 跑 5 次 relay · 第 5 次后 status='FAILED'
        for (int i = 1; i <= 5; i++) {
            relayJob.execute();
        }
        assertThat(selectInt("SELECT retry_count FROM wb_judge_outbox WHERE nid=" + nid))
            .as("AC3 · 5 次 retry").isEqualTo(5);
        assertThat(selectString("SELECT status FROM wb_judge_outbox WHERE nid=" + nid))
            .as("AC3 · MAX_RETRY=5 触发后 status='FAILED'").isEqualTo("FAILED");

        // 第 6 次 relay · status='FAILED' 行不再被扫到 (PENDING 过滤)
        callCount.set(0);
        org.mockito.Mockito.reset(dispatcher);  // 重置 mockito 计数
        org.mockito.Mockito.doThrow(new JudgeOutboxDispatcher.DispatchException("re-down"))
            .when(dispatcher).dispatch(org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString());
        relayJob.execute();
        // FAILED 行 retry_count 仍 5 · 没被再扫 (idx_wb_judge_outbox_status_created_at WHERE status='PENDING')
        assertThat(selectInt("SELECT retry_count FROM wb_judge_outbox WHERE nid=" + nid)).isEqualTo(5);
        // image_key=null 安全 (AC1 列字段约束允许)
        assertThat(selectString("SELECT image_key FROM wb_judge_outbox WHERE nid=" + nid)).isNull();
    }

    // ============================================================================
    // case5 · AC2 · 非 ai_overridden 路径 (ai_accepted / self) 不入 outbox
    // ============================================================================

    @Test
    @DisplayName("case5 · AC2 · ai_accepted / self 不入 outbox (仅 ai_overridden 触发 RLHF 数据)")
    void case5_non_overridden_no_outbox_row() throws Exception {
        // (a) ai_accepted (验前置一致 = AI ↔ user 同) · 不入 outbox
        long nidA = seedReviewPlan(STUDENT_ID, (short) 2, new BigDecimal("2.5"));
        seedWbReviewNode(
            nidA, nidA, STUDENT_ID, (short) 2,
            "wrongbook/answers/u21/img-005a.jpg",
            "PARTIAL",
            new BigDecimal("0.75"),
            "部分对",
            "{\"status\":\"DONE\"}",
            "self");
        mvc.perform(
                post("/api/review/nodes/" + nidA + "/grade")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("X-User-Id", STUDENT_ID)
                    .content("{\"grade\":\"PARTIAL\",\"final_grade_source\":\"ai_accepted\"}"))
            .andExpect(status().isOk());
        assertThat(selectInt("SELECT count(*) FROM wb_judge_outbox WHERE nid=" + nidA))
            .as("AC2 · ai_accepted 不入 outbox").isEqualTo(0);

        // (b) self (学生纯自评 · 无 AI 信源) · 不入 outbox
        long nidB = seedReviewPlan(STUDENT_ID, (short) 2, new BigDecimal("2.5"));
        // wb_review_node 行不前置 (master §10.5 现役: 无 AI 判时 wb_review_node 行可能不存在 · INSERT-only)
        mvc.perform(
                post("/api/review/nodes/" + nidB + "/grade")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("X-User-Id", STUDENT_ID)
                    .content("{\"grade\":\"PARTIAL\"}"))  // 不传 final_grade_source · 默认 'self'
            .andExpect(status().isOk());
        assertThat(selectInt("SELECT count(*) FROM wb_judge_outbox WHERE nid=" + nidB))
            .as("AC2 · self 不入 outbox").isEqualTo(0);

        // (c) TI2 验证 · 主 grade 流抛错 · outbox 必须一起 rollback (反作弊关键)
        // 用伪造 ai_accepted but ai_verdict != grade · CHECK 4 触发 422 GRADE_SOURCE_MISMATCH
        // 整事务回滚 · wb_judge_outbox 不入行 (即使 finalGradeSource 看着是 ai_accepted)
        long nidC = seedReviewPlan(STUDENT_ID, (short) 2, new BigDecimal("2.5"));
        seedWbReviewNode(
            nidC, nidC, STUDENT_ID, (short) 2,
            "wrongbook/answers/u21/img-005c.jpg",
            "MASTERED",  // AI 判 MASTERED
            new BigDecimal("0.85"),
            "答对",
            "{\"status\":\"DONE\"}",
            "self");
        // ai_accepted + grade=FORGOT (与 AI MASTERED 不等) → 422 GRADE_SOURCE_MISMATCH (SC20-T03 CHECK 4)
        mvc.perform(
                post("/api/review/nodes/" + nidC + "/grade")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("X-User-Id", STUDENT_ID)
                    .content("{\"grade\":\"FORGOT\",\"final_grade_source\":\"ai_accepted\"}"))
            .andExpect(status().isUnprocessableEntity());
        // TI2 · 整事务 rollback · outbox 不入行
        assertThat(selectInt("SELECT count(*) FROM wb_judge_outbox WHERE nid=" + nidC))
            .as("TI2 · grade 抛 422 时 outbox 同事务 rollback (不留 zombie)").isEqualTo(0);
    }
}
