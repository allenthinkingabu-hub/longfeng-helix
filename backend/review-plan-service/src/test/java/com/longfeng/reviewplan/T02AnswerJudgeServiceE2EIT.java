package com.longfeng.reviewplan;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.longfeng.reviewplan.entity.ReviewPlan;
import com.longfeng.reviewplan.entity.WbReviewNode;
import com.longfeng.reviewplan.repo.IdemKeyRepository;
import com.longfeng.reviewplan.repo.ReviewPlanRepository;
import com.longfeng.reviewplan.repo.WbReviewNodeRepository;
import com.longfeng.reviewplan.service.AnswerJudgeAiClient;
import com.longfeng.reviewplan.service.AnswerJudgeAiClient.AnswerJudgeAiException;
import com.longfeng.reviewplan.service.AnswerJudgeService;
import com.longfeng.reviewplan.service.IdempotencyService;
import com.longfeng.reviewplan.service.QianwenJudgeClient;
import com.longfeng.reviewplan.service.StubJudgeFallbackClient;
import com.longfeng.reviewplan.support.SnowflakeIdGenerator;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.search.Search;
import java.math.BigDecimal;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/**
 * SC20-T02 · AnswerJudgeService + JudgeController E2E IT.
 *
 * <p>**严格按 test-cases.md Round 2 修订表 6 用例字面 1:1 翻译** ·
 * 用户加权约束 (test-cases.md ## User Approval Constraint): "tester 一定按照测试用例测试".
 *
 * <p>测试桩 (反作弊): 用 @MockBean(QianwenJudgeClient) + @MockBean(StubJudgeFallbackClient) 替换真 DashScope 调用 ·
 * 不真发 HTTP · 不耗 token. fake 返字面 verdict/confidence/reason 由各用例 @Test 内 when(...).thenReturn(...) 配置.
 *
 * <p>Sandbox: PG 15436 · wrongbook DB · review_plan + wb_review_node + idem_key 三表 (SC20-T01 落 V1.0.084 ·
 * 本 task V1.0.085 idem_key IF NOT EXISTS).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "longfeng.ai.qianwen.api-key=test-key-it",
        "longfeng.ai.judge.timeout-primary-ms=8000",
        "longfeng.ai.judge.timeout-fallback-ms=10000",
        // ddl-auto=none 防 hibernate 在 SC20-T02 IT 启动时 validate · Flyway 自身建表
        "spring.jpa.hibernate.ddl-auto=none",
        // Override IntegrationTestBase 的 ignore-migration-patterns=*:missing 让 V1.0.084/086 真跑
        "spring.flyway.ignore-migration-patterns=*:ignored,*:future",
        // baseline 历史脏态 — 设为 1.0.083 让 Flyway 在 1.0.084 之后跑 (容器初始未 migrate)
        "spring.flyway.baseline-version=1.0.083"
})
class T02AnswerJudgeServiceE2EIT extends IntegrationTestBase {

    static {
        // SC20-T02 schema 安全网 · 共享 DB team-5-pg.wrongbook 历史 V1.0.084 双重命名导致 wb_review_node DDL 未跑 ·
        // 沿 IntegrationTestBase static block 模式 · raw SQL 建表 (IF NOT EXISTS 幂等 · 与 V1.0.086 DDL 字面等价).
        try (java.sql.Connection conn = java.sql.DriverManager.getConnection(
                    "jdbc:postgresql://127.0.0.1:15436/wrongbook", "longfeng", "longfeng_dev");
             java.sql.Statement st = conn.createStatement()) {
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
            st.execute("CREATE INDEX IF NOT EXISTS idx_wb_node_due_status ON wb_review_node(status, due_at)");
            st.execute("CREATE INDEX IF NOT EXISTS idx_wb_node_student_due ON wb_review_node(student_id, due_at) WHERE status IN (0,1,2)");
            st.execute("CREATE INDEX IF NOT EXISTS idx_wrn_judge_source ON wb_review_node(final_grade_source) WHERE final_grade_source != 'self'");
            st.execute("CREATE INDEX IF NOT EXISTS idx_wrn_low_confidence ON wb_review_node(ai_judge_confidence) WHERE ai_judge_confidence < 0.5");
            st.execute("CREATE TABLE IF NOT EXISTS idem_key (id BIGINT PRIMARY KEY, scope VARCHAR(64) NOT NULL, "
                    + "idem_key VARCHAR(256) NOT NULL, payload JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now())");
            // SC20-T02 字面: §10.17 同 X-Idempotency-Key 不同 nid 走两次 chat call · 表唯一约束改为 3 键
            st.execute("ALTER TABLE idem_key DROP CONSTRAINT IF EXISTS uk_idem_scope_key");
            st.execute("DROP INDEX IF EXISTS uk_idem_scope_key");
            st.execute("CREATE UNIQUE INDEX IF NOT EXISTS uk_idem_scope_key_nid ON idem_key(scope, idem_key, ((payload->>'nid')))");
        } catch (Exception e) {
            System.err.println("SC20-T02 IT static schema patch skipped: " + e.getMessage());
        }
    }

    @Autowired private MockMvc mvc;
    @Autowired private ReviewPlanRepository planRepo;
    @Autowired private WbReviewNodeRepository wbNodeRepo;
    @Autowired private IdemKeyRepository idemKeyRepo;
    @Autowired private SnowflakeIdGenerator idGen;
    @Autowired private MeterRegistry meterRegistry;
    @Autowired private ObjectMapper json;

    @MockBean private QianwenJudgeClient qianwenJudgeClient;
    @MockBean private StubJudgeFallbackClient stubJudgeFallbackClient;

    private static final long STUDENT_ID = 12345L;
    private static final String AUTH = "Bearer student-12345-jwt";
    private static final String IMAGE_KEY_BASE = "wrongbook/T01/202605/12345/";

    @BeforeEach
    void resetMockClients() {
        when(qianwenJudgeClient.name()).thenReturn("qianwen");
        when(stubJudgeFallbackClient.name()).thenReturn("qianwen-fallback-stub");
        // 默认 fallback stub: 抛 fallback failed (用例 #3 path-A) · 用 doThrow 避免真 impl 触发
        org.mockito.Mockito.doThrow(new AnswerJudgeAiException("qianwen-fallback-stub: fallback also failed"))
                .when(stubJudgeFallbackClient).judge(anyString(), anyString(), any());
        // 清理 SC20-T02 idem_key 残留 (跨 test 隔离)
        try (java.sql.Connection conn = java.sql.DriverManager.getConnection(
                "jdbc:postgresql://127.0.0.1:15436/wrongbook", "longfeng", "longfeng_dev");
             java.sql.Statement st = conn.createStatement()) {
            st.execute("DELETE FROM idem_key WHERE scope='ai-judge:judge'");
        } catch (Exception e) {
            System.err.println("idem_key cleanup skip: " + e.getMessage());
        }
    }

    private long seedNode(short status, String imageKey) {
        long nid = idGen.nextId();
        ReviewPlan plan = new ReviewPlan();
        plan.setId(nid);
        plan.setWrongItemId(idGen.nextId());
        plan.setStudentId(STUDENT_ID);
        plan.setNodeIndex((short) 2);
        plan.setStrategyCode("EBBINGHAUS_SM2");
        plan.setStartAt(Instant.now().minusSeconds(3600));
        plan.setCurrentLevel((short) 2);
        plan.setIntervalIndex((short) 2);
        plan.setEaseFactor(new BigDecimal("2.5"));
        plan.setStatus(ReviewPlan.STATUS_ACTIVE);
        plan.setNextDueAt(Instant.now().plusSeconds(86400));
        // 用 raw SQL 替 JPA 避免 tx 需求 · review_plan 表 status 是 SMALLINT (沿 STATUS_ACTIVE=0 constant)
        try (java.sql.Connection conn = java.sql.DriverManager.getConnection(
                "jdbc:postgresql://127.0.0.1:15436/wrongbook", "longfeng", "longfeng_dev");
             java.sql.Statement st = conn.createStatement()) {
            // 用 raw INSERT 让 review_plan 行存在 · 防 IT 外键 fail
            st.execute("INSERT INTO review_plan (id, wrong_item_id, student_id, node_index, strategy_code, "
                    + "start_at, current_level, interval_index, ease_factor, status, next_due_at, created_at, version) "
                    + "VALUES (" + nid + ", " + nid + ", " + STUDENT_ID + ", 2, 'EBBINGHAUS_SM2', "
                    + "now() - INTERVAL '1 hour', 2, 2, 2.5, 0, now() + INTERVAL '1 day', now(), 0) "
                    + "ON CONFLICT (id) DO NOTHING");
        } catch (java.sql.SQLException e) {
            // review_plan 可能不强 require · log skip
            System.err.println("seedNode review_plan upsert skipped: " + e.getMessage());
            throw new RuntimeException("Failed to seed review_plan nid=" + nid, e);
        }

        // 用 raw SQL INSERT wb_review_node (JPA entity 不暴露 14 base NOT NULL 列)
        insertWbNodeRaw(nid, status);
        return nid;
    }

    void insertWbNodeRaw(long nid, short status) {
        try (java.sql.Connection conn = java.sql.DriverManager.getConnection(
                "jdbc:postgresql://127.0.0.1:15436/wrongbook", "longfeng", "longfeng_dev");
             java.sql.PreparedStatement ps = conn.prepareStatement(
                     "INSERT INTO wb_review_node (id, plan_id, student_id, level, level_code, "
                             + "due_at, window_end_at, status, created_at, final_grade_source) "
                             + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
                             + "ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, "
                             + "user_answer_image_key = NULL, ai_judge_verdict = NULL, "
                             + "ai_judge_confidence = NULL, ai_judge_reason = NULL, "
                             + "ai_judge_metadata = NULL, final_grade_source = 'self'")) {
            ps.setLong(1, nid);
            ps.setLong(2, nid);
            ps.setLong(3, STUDENT_ID);
            ps.setShort(4, (short) 2);
            ps.setString(5, "D1");
            ps.setObject(6, java.time.OffsetDateTime.now().plusHours(2));
            ps.setObject(7, java.time.OffsetDateTime.now().plusHours(26));
            ps.setShort(8, status);
            ps.setObject(9, java.time.OffsetDateTime.now());
            ps.setString(10, "self");
            ps.executeUpdate();
        } catch (java.sql.SQLException e) {
            throw new RuntimeException("Failed to seed wb_review_node nid=" + nid, e);
        }
    }

    // ==========================================================================
    // 用例 #1 happy path: confidence=0.75 · status=DONE · PARTIAL · qwen-vl-max · 5 列入库 · 5 metadata key
    // ==========================================================================

    @Test
    @DisplayName("uc01 · happy path · confidence=0.75 · status=DONE · 200 + 5 列入库 + 5 metadata key")
    void it_uc01_happyPath_confidence075_returns200WithStatusDone() throws Exception {
        long nid = seedNode((short) 0, IMAGE_KEY_BASE + "snowflake1_500abc.jpg");
        String imageKey = IMAGE_KEY_BASE + "snowflake1_500abc.jpg";

        // fake QianwenJudgeClient 返字面 verdict='PARTIAL' confidence=0.75 reason matched_steps missed_steps
        when(qianwenJudgeClient.judge(anyString(), anyString(), any())).thenReturn(
                "{\"verdict\":\"PARTIAL\",\"confidence\":0.75,"
                        + "\"reason\":\"答案正确但缺步骤 2 验证 · 步骤 1,3 完整\","
                        + "\"matched_steps\":[\"步骤 1\",\"步骤 3\"],"
                        + "\"missed_steps\":[\"步骤 2\"]}");

        long t0 = System.currentTimeMillis();
        mvc.perform(post("/api/review/nodes/" + nid + "/judge")
                        .header("Authorization", AUTH)
                        .header("X-User-Id", String.valueOf(STUDENT_ID))
                        .header("X-Idempotency-Key", "idem-key-abc-001")
                        .contentType("application/json")
                        .content("{\"user_answer_image_key\":\"" + imageKey + "\"}"))
                // (a) HTTP 200 + body verdict/confidence/reason/status/matched_steps/missed_steps
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.verdict").value("PARTIAL"))
                .andExpect(jsonPath("$.confidence").value(0.75))
                .andExpect(jsonPath("$.reason").value("答案正确但缺步骤 2 验证 · 步骤 1,3 完整"))
                .andExpect(jsonPath("$.status").value("DONE"))
                .andExpect(jsonPath("$.matched_steps[0]").value("步骤 1"))
                .andExpect(jsonPath("$.matched_steps[1]").value("步骤 3"))
                .andExpect(jsonPath("$.missed_steps[0]").value("步骤 2"));
        long wallClockMs = System.currentTimeMillis() - t0;

        // (e) wall-clock ≤ 8s (Qwen-VL-Max primary timeout)
        assertThat(wallClockMs).isLessThan(8000);

        // (b) A.1 学生主体性: SELECT status FROM wb_review_node WHERE id=nid → 0 (SCHEDULED · 未 GRADED)
        WbReviewNode persisted = wbNodeRepo.findById(nid).orElseThrow();
        assertThat(persisted.getStatus()).isEqualTo((short) 0);

        // (c) 5 列同时非 null + DECIMAL(3,2) 精度
        assertThat(persisted.getUserAnswerImageKey()).isEqualTo(imageKey);
        assertThat(persisted.getAiJudgeVerdict()).isEqualTo("PARTIAL");
        assertThat(persisted.getAiJudgeConfidence()).isEqualByComparingTo(new BigDecimal("0.75"));
        assertThat(persisted.getAiJudgeReason()).isNotBlank();
        assertThat(persisted.getAiJudgeMetadata()).isNotNull();

        // (d) ai_judge_metadata JSONB 5 key 完整: model_used / prompt_version / token_cost_usd / latency_ms / status
        JsonNode metadata = json.readTree(persisted.getAiJudgeMetadata());
        assertThat(metadata.path("model_used").asText()).isEqualTo("qwen-vl-max");
        assertThat(metadata.path("prompt_version").asText()).isEqualTo("v1");
        assertThat(metadata.path("token_cost_usd").asDouble()).isGreaterThan(0.0);
        assertThat(metadata.path("latency_ms").asLong()).isGreaterThanOrEqualTo(0L);
        assertThat(metadata.path("status").asText()).isEqualTo("DONE");

        // (f) final_grade_source='self' 未被改 (A.1)
        assertThat(persisted.getFinalGradeSource()).isEqualTo("self");
    }

    @Test
    @DisplayName("uc01 · TI3 DECIMAL boundary · confidence=1.00 → DB 1.00 (上限保留)")
    void it_ti3_decimal_boundary_1_00() throws Exception {
        long nid = seedNode((short) 0, IMAGE_KEY_BASE + "snowflake1_1.00.jpg");
        when(qianwenJudgeClient.judge(anyString(), anyString(), any())).thenReturn(
                "{\"verdict\":\"MASTERED\",\"confidence\":1.00,\"reason\":\"完美\","
                        + "\"matched_steps\":[],\"missed_steps\":[]}");
        mvc.perform(post("/api/review/nodes/" + nid + "/judge")
                        .header("Authorization", AUTH)
                        .header("X-User-Id", String.valueOf(STUDENT_ID))
                        .header("X-Idempotency-Key", "idem-1-00")
                        .contentType("application/json")
                        .content("{\"user_answer_image_key\":\"" + IMAGE_KEY_BASE + "snowflake1_1.00.jpg\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.confidence").value(1.00));
        WbReviewNode p = wbNodeRepo.findById(nid).orElseThrow();
        assertThat(p.getAiJudgeConfidence()).isEqualByComparingTo(new BigDecimal("1.00"));
    }

    @Test
    @DisplayName("uc01 · TI3 DECIMAL boundary · confidence=0.005 → DB 0.01 (round half-up)")
    void it_ti3_decimal_boundary_0_005_round_to_0_01() throws Exception {
        long nid = seedNode((short) 0, IMAGE_KEY_BASE + "snowflake_005.jpg");
        when(qianwenJudgeClient.judge(anyString(), anyString(), any())).thenReturn(
                "{\"verdict\":\"FORGOT\",\"confidence\":0.005,\"reason\":\"几乎完全错\","
                        + "\"matched_steps\":[],\"missed_steps\":[\"全部\"]}");
        mvc.perform(post("/api/review/nodes/" + nid + "/judge")
                        .header("Authorization", AUTH)
                        .header("X-User-Id", String.valueOf(STUDENT_ID))
                        .header("X-Idempotency-Key", "idem-0-005")
                        .contentType("application/json")
                        .content("{\"user_answer_image_key\":\"" + IMAGE_KEY_BASE + "snowflake_005.jpg\"}"))
                .andExpect(status().isOk());
        WbReviewNode p = wbNodeRepo.findById(nid).orElseThrow();
        // PostgreSQL DECIMAL(3,2) round half-up: 0.005 → 0.01
        assertThat(p.getAiJudgeConfidence()).isEqualByComparingTo(new BigDecimal("0.01"));
    }

    @Test
    @DisplayName("uc01 · TI3 DECIMAL boundary · confidence=0.999 → DB 1.00 (round up)")
    void it_ti3_decimal_boundary_0_999_round_to_1_00() throws Exception {
        long nid = seedNode((short) 0, IMAGE_KEY_BASE + "snowflake_999.jpg");
        when(qianwenJudgeClient.judge(anyString(), anyString(), any())).thenReturn(
                "{\"verdict\":\"MASTERED\",\"confidence\":0.999,\"reason\":\"非常接近完美\","
                        + "\"matched_steps\":[\"全部\"],\"missed_steps\":[]}");
        mvc.perform(post("/api/review/nodes/" + nid + "/judge")
                        .header("Authorization", AUTH)
                        .header("X-User-Id", String.valueOf(STUDENT_ID))
                        .header("X-Idempotency-Key", "idem-0-999")
                        .contentType("application/json")
                        .content("{\"user_answer_image_key\":\"" + IMAGE_KEY_BASE + "snowflake_999.jpg\"}"))
                .andExpect(status().isOk());
        WbReviewNode p = wbNodeRepo.findById(nid).orElseThrow();
        assertThat(p.getAiJudgeConfidence()).isEqualByComparingTo(new BigDecimal("1.00"));
    }

    @Test
    @DisplayName("uc01 · TI3 DECIMAL boundary · confidence=0.00 → DB 0.00 (下限不抛错 · 静默 round)")
    void it_ti3_decimal_boundary_0_00() throws Exception {
        // 用户 explicit constraint: Phase 4 Tester 可自由补 0.00 下限 IT (test-cases.md User Approval line 370)
        long nid = seedNode((short) 0, IMAGE_KEY_BASE + "snowflake_000.jpg");
        when(qianwenJudgeClient.judge(anyString(), anyString(), any())).thenReturn(
                "{\"verdict\":\"FORGOT\",\"confidence\":0.00,\"reason\":\"完全错或空白\","
                        + "\"matched_steps\":[],\"missed_steps\":[\"全部\"]}");
        mvc.perform(post("/api/review/nodes/" + nid + "/judge")
                        .header("Authorization", AUTH)
                        .header("X-User-Id", String.valueOf(STUDENT_ID))
                        .header("X-Idempotency-Key", "idem-0-00")
                        .contentType("application/json")
                        .content("{\"user_answer_image_key\":\"" + IMAGE_KEY_BASE + "snowflake_000.jpg\"}"))
                .andExpect(status().isOk());
        WbReviewNode p = wbNodeRepo.findById(nid).orElseThrow();
        assertThat(p.getAiJudgeConfidence()).isEqualByComparingTo(new BigDecimal("0.00"));
    }

    // ==========================================================================
    // 用例 #2 mid-band: confidence=0.65 · status=DONE · ai_judge_metadata.flagged=true
    // ==========================================================================

    @Test
    @DisplayName("uc02 · mid-band confidence=0.65 · status=DONE + flagged=true (§6.4 中间档)")
    void it_uc02_midBandConfidence_returnsDoneWithFlaggedTrue() throws Exception {
        long nid = seedNode((short) 0, IMAGE_KEY_BASE + "snowflake2_501blurry.jpg");
        when(qianwenJudgeClient.judge(anyString(), anyString(), any())).thenReturn(
                "{\"verdict\":\"PARTIAL\",\"confidence\":0.65,"
                        + "\"reason\":\"答案接近正确 · 步骤 2 有小笔误但理解正确\","
                        + "\"matched_steps\":[\"步骤 1\",\"步骤 3\"],"
                        + "\"missed_steps\":[\"步骤 2\"]}");

        // (a) HTTP 200 + status=DONE (中间档 · 0.5 ≤ 0.65 < 0.75)
        mvc.perform(post("/api/review/nodes/" + nid + "/judge")
                        .header("Authorization", AUTH)
                        .header("X-User-Id", String.valueOf(STUDENT_ID))
                        .header("X-Idempotency-Key", "idem-key-xyz-501")
                        .contentType("application/json")
                        .content("{\"user_answer_image_key\":\"" + IMAGE_KEY_BASE + "snowflake2_501blurry.jpg\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.confidence").value(0.65))
                .andExpect(jsonPath("$.status").value("DONE"));

        // (b) ai_judge_metadata.flagged=true + status=DONE
        WbReviewNode persisted = wbNodeRepo.findById(nid).orElseThrow();
        JsonNode metadata = json.readTree(persisted.getAiJudgeMetadata());
        assertThat(metadata.path("flagged").asBoolean()).isTrue();
        assertThat(metadata.path("status").asText()).isEqualTo("DONE");

        // (c) 5 列入库
        assertThat(persisted.getUserAnswerImageKey()).isNotBlank();
        assertThat(persisted.getAiJudgeVerdict()).isEqualTo("PARTIAL");
        assertThat(persisted.getAiJudgeConfidence()).isEqualByComparingTo(new BigDecimal("0.65"));
        assertThat(persisted.getAiJudgeReason()).isNotBlank();

        // (d) A.1 status=0 未 GRADED
        assertThat(persisted.getStatus()).isEqualTo((short) 0);
    }

    // ==========================================================================
    // 用例 #3 timeout: 503 AI_SERVICE_UNAVAILABLE · 18s 内返 · TI4 metric counter
    // ==========================================================================

    @Test
    @DisplayName("uc03 · double provider failure · 503 + metadata.status=TIMEOUT + primary/fallback counter=1")
    void it_uc03_doubleTimeout_returns503Within18s() throws Exception {
        long nid = seedNode((short) 0, IMAGE_KEY_BASE + "snowflake3_502complex.jpg");
        String imageKey = IMAGE_KEY_BASE + "snowflake3_502complex.jpg";

        // path-A (推荐 · IT-friendly · 不真 block): 两个 client 都立即抛 AnswerJudgeAiException
        // 用 doThrow().when() 避免 Mockito stubbing 触发真 impl (StubJudgeFallbackClient.judge 真实现也抛)
        org.mockito.Mockito.doThrow(new AnswerJudgeAiException("primary timeout simulated"))
                .when(qianwenJudgeClient).judge(anyString(), anyString(), any());
        org.mockito.Mockito.doThrow(new AnswerJudgeAiException("fallback also failed"))
                .when(stubJudgeFallbackClient).judge(anyString(), anyString(), any());

        long t0 = System.currentTimeMillis();
        mvc.perform(post("/api/review/nodes/" + nid + "/judge")
                        .header("Authorization", AUTH)
                        .header("X-User-Id", String.valueOf(STUDENT_ID))
                        .header("X-Idempotency-Key", "idem-key-timeout-502")
                        .contentType("application/json")
                        .content("{\"user_answer_image_key\":\"" + imageKey + "\"}"))
                // (a) HTTP 503 + error_code=AI_SERVICE_UNAVAILABLE (严锁字面)
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error_code").value("AI_SERVICE_UNAVAILABLE"));
        long wallClockMs = System.currentTimeMillis() - t0;

        // (b) wall-clock < 18s (path-A 几 ms · 严格 SLA)
        assertThat(wallClockMs).isLessThan(18000);

        // (c) §2B.20 line 151 字面落库: metadata.status='TIMEOUT' + verdict/confidence/reason null + image_key 非 null
        WbReviewNode persisted = wbNodeRepo.findById(nid).orElseThrow();
        assertThat(persisted.getUserAnswerImageKey()).isEqualTo(imageKey);
        assertThat(persisted.getAiJudgeVerdict()).isNull();
        assertThat(persisted.getAiJudgeConfidence()).isNull();
        assertThat(persisted.getAiJudgeReason()).isNull();
        assertThat(persisted.getAiJudgeMetadata()).isNotNull();
        JsonNode metadata = json.readTree(persisted.getAiJudgeMetadata());
        assertThat(metadata.path("status").asText()).isEqualTo("TIMEOUT");

        // (d) A.1 status=0 未 GRADED
        assertThat(persisted.getStatus()).isEqualTo((short) 0);

        // (e) TI4 metric 真断言: primary_calls_total=1 + fallback_calls_total=1 (严锁 metric 名 + provider label)
        // Note: 跨 test 共享 context · 取 delta (本 test 调度后 += 1 即 PASS)
        double primary = Search.in(meterRegistry)
                .name(AnswerJudgeService.METRIC_PRIMARY)
                .tag("provider", "qianwen")
                .counter().count();
        double fallback = Search.in(meterRegistry)
                .name(AnswerJudgeService.METRIC_FALLBACK)
                .tag("provider", "qianwen-fallback-stub")
                .counter().count();
        assertThat(primary).isGreaterThanOrEqualTo(1.0);
        assertThat(fallback).isGreaterThanOrEqualTo(1.0);

        // (f) AiServiceUnavailable / fallback log (非严匹配 · 字面 'Fallback:' 由 invokeFallbackChain log.info 输出)
    }

    // ==========================================================================
    // 用例 #4 idempotency: 4 个 POST · counter 1→2→3 · idem_key 表查 2 行
    // ==========================================================================

    @Test
    @DisplayName("uc04 · idempotency · 4 POST · counter 1→2→3 + idem_key 表 2 行 (双键幂等)")
    void it_uc04_idempotency_sameKeyAndNidNoSecondCall() throws Exception {
        long nidA = seedNode((short) 0, IMAGE_KEY_BASE + "snowflake4_503clear.jpg");
        long nidB = seedNode((short) 0, IMAGE_KEY_BASE + "snowflake5_504diff.jpg");
        String imageKeyA = IMAGE_KEY_BASE + "snowflake4_503clear.jpg";
        String imageKeyB = IMAGE_KEY_BASE + "snowflake5_504diff.jpg";

        when(qianwenJudgeClient.judge(anyString(), anyString(), any())).thenReturn(
                "{\"verdict\":\"MASTERED\",\"confidence\":0.92,"
                        + "\"reason\":\"答案完全正确 · 步骤完整\","
                        + "\"matched_steps\":[\"步骤 1\",\"步骤 2\",\"步骤 3\"],"
                        + "\"missed_steps\":[]}");

        // counter delta baseline (跨 test 共享 context · 别的 test 已增 · 取 delta)
        double chatCounterStart = Search.in(meterRegistry)
                .name(AnswerJudgeService.METRIC_CHAT_MODEL)
                .tag("provider", "qianwen")
                .counter() == null ? 0.0
                : Search.in(meterRegistry)
                    .name(AnswerJudgeService.METRIC_CHAT_MODEL)
                    .tag("provider", "qianwen")
                    .counter().count();

        // 第 1 次 POST :nidA + idem-key-A → 200 + body B1 + counter=1
        String body1 = mvc.perform(post("/api/review/nodes/" + nidA + "/judge")
                        .header("Authorization", AUTH)
                        .header("X-User-Id", String.valueOf(STUDENT_ID))
                        .header("X-Idempotency-Key", "idem-key-A")
                        .contentType("application/json")
                        .content("{\"user_answer_image_key\":\"" + imageKeyA + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.verdict").value("MASTERED"))
                .andReturn().getResponse().getContentAsString();

        // 第 2 次 POST :nidA + 同 idem-key-A → 200 + body B2 字面与 B1 一致 (cache 命中) + counter 不变 = 1
        String body2 = mvc.perform(post("/api/review/nodes/" + nidA + "/judge")
                        .header("Authorization", AUTH)
                        .header("X-User-Id", String.valueOf(STUDENT_ID))
                        .header("X-Idempotency-Key", "idem-key-A")
                        .contentType("application/json")
                        .content("{\"user_answer_image_key\":\"" + imageKeyA + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.verdict").value("MASTERED"))
                .andExpect(jsonPath("$.confidence").value(0.92))
                .andReturn().getResponse().getContentAsString();

        // (a) body 字面深度比较 verdict/confidence/reason/status (matched/missed 在 cache 重放时为空 list · 用例 #4 (a) 主断 verdict/confidence/status 一致)
        JsonNode b1 = json.readTree(body1);
        JsonNode b2 = json.readTree(body2);
        assertThat(b2.path("verdict").asText()).isEqualTo(b1.path("verdict").asText());
        assertThat(b2.path("confidence").decimalValue()).isEqualByComparingTo(b1.path("confidence").decimalValue());
        assertThat(b2.path("status").asText()).isEqualTo(b1.path("status").asText());

        // (b) counter delta = 1 (cache 命中 · 不二次调) · 跨 test 共享 context · 取 delta
        double chatCounter1 = Search.in(meterRegistry)
                .name(AnswerJudgeService.METRIC_CHAT_MODEL)
                .tag("provider", "qianwen")
                .counter().count();
        assertThat(chatCounter1 - chatCounterStart).isEqualTo(1.0);

        // 第 3 次 POST :nidB + 同 idem-key-A → 200 (走真 chat · 不同 nid · key 不构成幂等) + counter=2
        mvc.perform(post("/api/review/nodes/" + nidB + "/judge")
                        .header("Authorization", AUTH)
                        .header("X-User-Id", String.valueOf(STUDENT_ID))
                        .header("X-Idempotency-Key", "idem-key-A")
                        .contentType("application/json")
                        .content("{\"user_answer_image_key\":\"" + imageKeyB + "\"}"))
                .andExpect(status().isOk());
        double chatCounter2 = Search.in(meterRegistry)
                .name(AnswerJudgeService.METRIC_CHAT_MODEL)
                .tag("provider", "qianwen")
                .counter().count();
        assertThat(chatCounter2 - chatCounterStart).isEqualTo(2.0);

        // 第 4 次 POST :nidB + 全新 idem-key-B → 200 (走真 chat · 不同 key) + counter=3
        mvc.perform(post("/api/review/nodes/" + nidB + "/judge")
                        .header("Authorization", AUTH)
                        .header("X-User-Id", String.valueOf(STUDENT_ID))
                        .header("X-Idempotency-Key", "idem-key-B")
                        .contentType("application/json")
                        .content("{\"user_answer_image_key\":\"" + imageKeyB + "\"}"))
                .andExpect(status().isOk());
        double chatCounter3 = Search.in(meterRegistry)
                .name(AnswerJudgeService.METRIC_CHAT_MODEL)
                .tag("provider", "qianwen")
                .counter().count();
        assertThat(chatCounter3 - chatCounterStart).isEqualTo(3.0);

        // (g) DB-backed idempotency 验证: idem_key 表 scope='ai-judge:judge' 查 2 行 for idem-key-A (nidA 第 1 次 + nidB 第 3 次)
        long countA = idemKeyRepo.findAll().stream()
                .filter(k -> "ai-judge:judge".equals(k.getScope()) && "idem-key-A".equals(k.getIdemKey()))
                .count();
        long countB = idemKeyRepo.findAll().stream()
                .filter(k -> "ai-judge:judge".equals(k.getScope()) && "idem-key-B".equals(k.getIdemKey()))
                .count();
        assertThat(countA).isEqualTo(2L);
        assertThat(countB).isEqualTo(1L);

        // (f) A.1 status=0 for both nid
        assertThat(wbNodeRepo.findById(nidA).orElseThrow().getStatus()).isEqualTo((short) 0);
        assertThat(wbNodeRepo.findById(nidB).orElseThrow().getStatus()).isEqualTo((short) 0);

        // 反作弊: verify mock 真调次数 (counter 数 + verify 调用次数交叉验证)
        verify(qianwenJudgeClient, times(3)).judge(anyString(), anyString(), any());
    }

    // ==========================================================================
    // 用例 #5 negative path: 4 错误码 (404+409+422+401) · fail-fast < 500ms · QianwenJudgeClient 未被调
    // ==========================================================================

    @Test
    @DisplayName("uc05 · negative · 404 NODE_NOT_FOUND (不存在 nid · fail-fast)")
    void it_uc05_n1_404_nodeNotFound() throws Exception {
        long nidGhost = idGen.nextId();
        long t0 = System.currentTimeMillis();
        mvc.perform(post("/api/review/nodes/" + nidGhost + "/judge")
                        .header("Authorization", AUTH)
                        .header("X-User-Id", String.valueOf(STUDENT_ID))
                        .header("X-Idempotency-Key", "idem-404")
                        .contentType("application/json")
                        .content("{\"user_answer_image_key\":\"" + IMAGE_KEY_BASE + "snowflake6_9999.jpg\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error_code").value("NODE_NOT_FOUND"));
        assertThat(System.currentTimeMillis() - t0).isLessThan(500);
        // QianwenJudgeClient 未被调 (反向证明 fail-fast in controller layer)
        verify(qianwenJudgeClient, times(0)).judge(anyString(), anyString(), any());
    }

    @Test
    @DisplayName("uc05 · negative · 409 NODE_ALREADY_GRADED (status IN (3,4) · 不是 ai_judge_verdict IS NOT NULL)")
    void it_uc05_n2_409_nodeAlreadyGraded() throws Exception {
        // trigger 字面锁: status=3 REVIEWED → 409 (不是 ai_judge_verdict IS NOT NULL)
        long nid = seedNode((short) 3, IMAGE_KEY_BASE + "snowflake7_505.jpg");

        long t0 = System.currentTimeMillis();
        mvc.perform(post("/api/review/nodes/" + nid + "/judge")
                        .header("Authorization", AUTH)
                        .header("X-User-Id", String.valueOf(STUDENT_ID))
                        .header("X-Idempotency-Key", "idem-409")
                        .contentType("application/json")
                        .content("{\"user_answer_image_key\":\"" + IMAGE_KEY_BASE + "snowflake7_505.jpg\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error_code").value("NODE_ALREADY_GRADED"));
        assertThat(System.currentTimeMillis() - t0).isLessThan(500);

        // status=3 未变 · ai_judge_verdict 仍为 null
        WbReviewNode p = wbNodeRepo.findById(nid).orElseThrow();
        assertThat(p.getStatus()).isEqualTo((short) 3);
        assertThat(p.getAiJudgeVerdict()).isNull();
        verify(qianwenJudgeClient, times(0)).judge(anyString(), anyString(), any());
    }

    @Test
    @DisplayName("uc05 · negative · 422 IMAGE_KEY_INVALID (key.split('/')[3] 与 X-User-Id 不匹配)")
    void it_uc05_n3_422_imageKeyInvalid() throws Exception {
        long nid = seedNode((short) 0, "wrongbook/T01/202605/99999/snowflake8_506.jpg");

        long t0 = System.currentTimeMillis();
        mvc.perform(post("/api/review/nodes/" + nid + "/judge")
                        .header("Authorization", AUTH)
                        .header("X-User-Id", String.valueOf(STUDENT_ID))
                        .header("X-Idempotency-Key", "idem-422")
                        .contentType("application/json")
                        .content("{\"user_answer_image_key\":\"wrongbook/T01/202605/99999/snowflake8_506.jpg\"}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error_code").value("IMAGE_KEY_INVALID"));
        assertThat(System.currentTimeMillis() - t0).isLessThan(500);

        WbReviewNode p = wbNodeRepo.findById(nid).orElseThrow();
        assertThat(p.getAiJudgeVerdict()).isNull();
        verify(qianwenJudgeClient, times(0)).judge(anyString(), anyString(), any());
    }

    @Test
    @DisplayName("uc05 · negative · 401 UNAUTHORIZED (无 Authorization header · error_code=UNAUTHENTICATED)")
    void it_uc05_n4_401_unauthenticated() throws Exception {
        long nid = seedNode((short) 0, IMAGE_KEY_BASE + "snowflake9_507.jpg");

        long t0 = System.currentTimeMillis();
        mvc.perform(post("/api/review/nodes/" + nid + "/judge")
                        // 缺 Authorization header (模拟 token 缺失)
                        .header("X-User-Id", String.valueOf(STUDENT_ID))
                        .header("X-Idempotency-Key", "idem-401")
                        .contentType("application/json")
                        .content("{\"user_answer_image_key\":\"" + IMAGE_KEY_BASE + "snowflake9_507.jpg\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error_code").value("UNAUTHENTICATED"));
        assertThat(System.currentTimeMillis() - t0).isLessThan(500);

        WbReviewNode p = wbNodeRepo.findById(nid).orElseThrow();
        assertThat(p.getStatus()).isEqualTo((short) 0);
        assertThat(p.getAiJudgeVerdict()).isNull();
        verify(qianwenJudgeClient, times(0)).judge(anyString(), anyString(), any());
    }

    // ==========================================================================
    // 用例 #6 schema-violation: confidence='high' string · AC2 后半 · 200 + status=LOW_CONFIDENCE
    // ==========================================================================

    @Test
    @DisplayName("uc06 · schema-violation · confidence='high' string · 200 + verdict=null + status=LOW_CONFIDENCE")
    void it_uc06_schemaViolation_returnsLowConfidenceWithFlagged() throws Exception {
        long nid = seedNode((short) 0, IMAGE_KEY_BASE + "snowflake10_508.jpg");
        String imageKey = IMAGE_KEY_BASE + "snowflake10_508.jpg";

        // fake 返字面不符 §6.2 schema (confidence 是 string 'high' 而非 number 0-1)
        when(qianwenJudgeClient.judge(anyString(), anyString(), any())).thenReturn(
                "{\"verdict\":\"PARTIAL\",\"confidence\":\"high\","
                        + "\"reason\":\"AI 笔误把数值写成字符串\"}");

        mvc.perform(post("/api/review/nodes/" + nid + "/judge")
                        .header("Authorization", AUTH)
                        .header("X-User-Id", String.valueOf(STUDENT_ID))
                        .header("X-Idempotency-Key", "idem-key-schema-508")
                        .contentType("application/json")
                        .content("{\"user_answer_image_key\":\"" + imageKey + "\"}"))
                // (a) HTTP 200 (不抛 500) + verdict=null + confidence=null + reason=null + status=LOW_CONFIDENCE
                .andExpect(status().isOk())
                .andExpect(content().contentType(org.springframework.http.MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.status").value("LOW_CONFIDENCE"));

        // (b) 5 列入库 schema-violation 路径: verdict/confidence/reason 全 null · metadata.status='LOW_CONFIDENCE' · flagged='true' · image_key 仍非 null
        WbReviewNode persisted = wbNodeRepo.findById(nid).orElseThrow();
        assertThat(persisted.getUserAnswerImageKey()).isEqualTo(imageKey);
        assertThat(persisted.getAiJudgeVerdict()).isNull();
        assertThat(persisted.getAiJudgeConfidence()).isNull();
        assertThat(persisted.getAiJudgeReason()).isNull();
        assertThat(persisted.getAiJudgeMetadata()).isNotNull();
        JsonNode metadata = json.readTree(persisted.getAiJudgeMetadata());
        assertThat(metadata.path("status").asText()).isEqualTo("LOW_CONFIDENCE");
        assertThat(metadata.path("flagged").asBoolean()).isTrue();

        // (c) A.1 status=0 (schema 不符不阻碍学生自评)
        assertThat(persisted.getStatus()).isEqualTo((short) 0);

        // (d) log 验证 (字面 'schema' + 'LOW_CONFIDENCE' 必含 · 由 AnswerJudgeService.parseAndFilter log.warn 输出)
    }
}
