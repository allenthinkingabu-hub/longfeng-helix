package com.longfeng.reviewplan;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.longfeng.reviewplan.entity.ReviewPlan;
import com.longfeng.reviewplan.entity.WbReviewNode;
import com.longfeng.reviewplan.repo.ReviewPlanRepository;
import com.longfeng.reviewplan.repo.WbReviewNodeRepository;
import com.longfeng.reviewplan.service.AnswerJudgeAiClient;
import com.longfeng.reviewplan.service.AnswerJudgeAiClient.AnswerJudgeAiException;
import com.longfeng.reviewplan.service.AnswerJudgeService;
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
 * SC22-T02 · AI_SERVICE_UNAVAILABLE 双 provider 双断增强 + wb_judge_ai_timeout 埋点 + 18s 上限验证 + LOW_CONFIDENCE flagged 增强 IT.
 *
 * <p>测试矩阵 (4 IT @Test · 沿 SC20-T02 13 IT 互补):
 * <ol>
 *   <li>it_ac1_doubleProviderTimeout_returns503Within18s · AC1 双 provider 双断 18s 上限 + ai_judge_metadata.status='TIMEOUT'</li>
 *   <li>it_ac2_wbJudgeAiTimeoutCounter_increment · AC2 新 Counter wb_judge_ai_timeout (tags nid + provider) 双断时 increment</li>
 *   <li>it_ac3_lowConfidenceFlaggedTrue · AC3 confidence=0.32 时 ai_judge_metadata.status='LOW_CONFIDENCE' + flagged=true + verdict 仍落 + image_key 非 null</li>
 *   <li>it_ac4_perProviderHardTimeout · AC4 真 sleep 注入 · 验 controller 18s 内必返 503 · 不挂死</li>
 * </ol>
 *
 * <p>Sandbox: PG 15436 · wb_review_node 复用 SC20-T02 schema (V1.0.086 IF NOT EXISTS) · 沿 IntegrationTestBase.
 *
 * <p>反作弊: 测试桩 @MockBean(QianwenJudgeClient) + @MockBean(StubJudgeFallbackClient) · path-A (同步抛) + path-B (Thread.sleep 真挂) 双覆盖.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "longfeng.ai.qianwen.api-key=test-key-sc22",
        "longfeng.ai.judge.timeout-primary-ms=8000",
        "longfeng.ai.judge.timeout-fallback-ms=10000",
        "spring.jpa.hibernate.ddl-auto=none",
        "spring.flyway.ignore-migration-patterns=*:ignored,*:future",
        "spring.flyway.baseline-version=1.0.083"
})
class T02Sc22TimeoutLowConfidenceE2EIT extends IntegrationTestBase {

    static {
        // 安全网 · 沿 SC20-T02 IT pattern · IF NOT EXISTS 幂等
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
            st.execute("CREATE TABLE IF NOT EXISTS idem_key (id BIGINT PRIMARY KEY, scope VARCHAR(64) NOT NULL, "
                    + "idem_key VARCHAR(256) NOT NULL, payload JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now())");
            st.execute("CREATE UNIQUE INDEX IF NOT EXISTS uk_idem_scope_key_nid "
                    + "ON idem_key(scope, idem_key, ((payload->>'nid')))");
        } catch (Exception e) {
            System.err.println("SC22-T02 IT static schema patch skipped: " + e.getMessage());
        }
    }

    @Autowired private MockMvc mvc;
    @Autowired private ReviewPlanRepository planRepo;
    @Autowired private WbReviewNodeRepository wbNodeRepo;
    @Autowired private SnowflakeIdGenerator idGen;
    @Autowired private MeterRegistry meterRegistry;
    @Autowired private ObjectMapper json;

    @MockBean private QianwenJudgeClient qianwenJudgeClient;
    @MockBean private StubJudgeFallbackClient stubJudgeFallbackClient;

    private static final long STUDENT_ID = 22002L;  // SC22-T02 · 与 SC20-T02 (12345) / SC21-T01 (21) / SC21-T03 (213) 隔离
    private static final String AUTH = "Bearer student-22002-jwt";
    private static final String IMAGE_KEY_BASE = "wrongbook/T01/202605/22002/";

    @BeforeEach
    void resetMockClients() {
        when(qianwenJudgeClient.name()).thenReturn("qianwen");
        when(stubJudgeFallbackClient.name()).thenReturn("qianwen-fallback-stub");
        // 默认 fallback stub: 抛 fallback failed
        org.mockito.Mockito.doThrow(new AnswerJudgeAiException("qianwen-fallback-stub: fallback also failed"))
                .when(stubJudgeFallbackClient).judge(anyString(), anyString(), any());
        // 清理 SC22-T02 idem_key + wb_review_node 残留 (跨 test 隔离)
        try (java.sql.Connection conn = java.sql.DriverManager.getConnection(
                "jdbc:postgresql://127.0.0.1:15436/wrongbook", "longfeng", "longfeng_dev");
             java.sql.Statement st = conn.createStatement()) {
            st.execute("DELETE FROM idem_key WHERE scope='ai-judge:judge'");
            st.execute("DELETE FROM wb_review_node WHERE student_id=" + STUDENT_ID);
            st.execute("DELETE FROM review_plan WHERE student_id=" + STUDENT_ID);
        } catch (Exception e) {
            System.err.println("SC22-T02 cleanup skip: " + e.getMessage());
        }
    }

    private long seedNode(short status) {
        long nid = idGen.nextId();
        try (java.sql.Connection conn = java.sql.DriverManager.getConnection(
                "jdbc:postgresql://127.0.0.1:15436/wrongbook", "longfeng", "longfeng_dev");
             java.sql.Statement st = conn.createStatement()) {
            st.execute("INSERT INTO review_plan (id, wrong_item_id, student_id, node_index, strategy_code, "
                    + "start_at, current_level, interval_index, ease_factor, status, next_due_at, created_at, version) "
                    + "VALUES (" + nid + ", " + nid + ", " + STUDENT_ID
                    + ", 2, 'EBBINGHAUS_SM2', "
                    + "now() - INTERVAL '1 hour', 2, 2, 2.5, 0, now() + INTERVAL '1 day', now(), 0) "
                    + "ON CONFLICT (id) DO NOTHING");
        } catch (java.sql.SQLException e) {
            throw new RuntimeException("seed review_plan failed nid=" + nid, e);
        }
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
        return nid;
    }

    // ==========================================================================
    // AC1 · 双 provider 双断 · 18s 上限 + ai_judge_metadata.status='TIMEOUT'
    // ==========================================================================

    @Test
    @DisplayName("ac1 · 双 provider 都同步抛 · 503 + image_key 非 null + verdict/confidence/reason null + metadata.status=TIMEOUT")
    void it_ac1_doubleProviderTimeout_returns503Within18s() throws Exception {
        long nid = seedNode((short) 0);
        String imageKey = IMAGE_KEY_BASE + "sc22ac1.jpg";

        org.mockito.Mockito.doThrow(new AnswerJudgeAiException("primary throws"))
                .when(qianwenJudgeClient).judge(anyString(), anyString(), any());
        org.mockito.Mockito.doThrow(new AnswerJudgeAiException("fallback also throws"))
                .when(stubJudgeFallbackClient).judge(anyString(), anyString(), any());

        long t0 = System.currentTimeMillis();
        mvc.perform(post("/api/review/nodes/" + nid + "/judge")
                        .header("Authorization", AUTH)
                        .header("X-User-Id", String.valueOf(STUDENT_ID))
                        .header("X-Idempotency-Key", "sc22-ac1-key")
                        .contentType("application/json")
                        .content("{\"user_answer_image_key\":\"" + imageKey + "\"}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error_code").value("AI_SERVICE_UNAVAILABLE"));
        long wallClockMs = System.currentTimeMillis() - t0;

        // AC1 · biz §10.17 SLA: 503 必在 18s 内返
        assertThat(wallClockMs).isLessThan(18_000L);

        // AC1 · biz §2B.20 line 151 / §6.4 字面: image_key 仍非 null + ai_judge_* 5 列空 + metadata.status='TIMEOUT'
        WbReviewNode persisted = wbNodeRepo.findById(nid).orElseThrow();
        assertThat(persisted.getUserAnswerImageKey()).isEqualTo(imageKey);
        assertThat(persisted.getAiJudgeVerdict()).isNull();
        assertThat(persisted.getAiJudgeConfidence()).isNull();
        assertThat(persisted.getAiJudgeReason()).isNull();
        assertThat(persisted.getAiJudgeMetadata()).isNotNull();
        JsonNode metadata = json.readTree(persisted.getAiJudgeMetadata());
        assertThat(metadata.path("status").asText()).isEqualTo("TIMEOUT");

        // A.1 学生主体性: status=0 (judge 不动 grade)
        assertThat(persisted.getStatus()).isEqualTo((short) 0);
    }

    // ==========================================================================
    // AC2 · wb_judge_ai_timeout counter (tags nid + provider) 双断时 increment
    // ==========================================================================

    @Test
    @DisplayName("ac2 · 双 provider fail · wb_judge_ai_timeout counter increment (tag nid=<nid> + provider=qianwen)")
    void it_ac2_wbJudgeAiTimeoutCounter_increment() throws Exception {
        long nid = seedNode((short) 0);
        String imageKey = IMAGE_KEY_BASE + "sc22ac2.jpg";

        org.mockito.Mockito.doThrow(new AnswerJudgeAiException("primary fail"))
                .when(qianwenJudgeClient).judge(anyString(), anyString(), any());
        org.mockito.Mockito.doThrow(new AnswerJudgeAiException("fallback fail"))
                .when(stubJudgeFallbackClient).judge(anyString(), anyString(), any());

        // 取调用前 counter 值 (跨 test 共享 context · 算 delta)
        double timeoutCounterBefore = readTimeoutCounter(nid);

        mvc.perform(post("/api/review/nodes/" + nid + "/judge")
                        .header("Authorization", AUTH)
                        .header("X-User-Id", String.valueOf(STUDENT_ID))
                        .header("X-Idempotency-Key", "sc22-ac2-key")
                        .contentType("application/json")
                        .content("{\"user_answer_image_key\":\"" + imageKey + "\"}"))
                .andExpect(status().isServiceUnavailable());

        // AC2 · biz §2B.22 line 222 字面: wb_judge_ai_timeout counter += 1 · tag nid + provider
        double timeoutCounterAfter = readTimeoutCounter(nid);
        assertThat(timeoutCounterAfter - timeoutCounterBefore).isEqualTo(1.0);
    }

    /** 读 wb_judge_ai_timeout counter (tag nid + provider="qianwen") · 不存在返 0. */
    private double readTimeoutCounter(long nid) {
        Search search = Search.in(meterRegistry)
                .name(AnswerJudgeService.METRIC_TIMEOUT)
                .tag("nid", String.valueOf(nid))
                .tag("provider", "qianwen");
        if (search.counter() == null) {
            return 0.0;
        }
        return search.counter().count();
    }

    // ==========================================================================
    // AC3 · LOW_CONFIDENCE flagged=true + verdict 仍落 + image_key 非 null
    // ==========================================================================

    @Test
    @DisplayName("ac3 · confidence=0.32 · metadata.status=LOW_CONFIDENCE + flagged=true + verdict 仍落 + image_key 非 null")
    void it_ac3_lowConfidenceFlaggedTrue() throws Exception {
        long nid = seedNode((short) 0);
        String imageKey = IMAGE_KEY_BASE + "sc22ac3.jpg";

        // primary 返 confidence=0.32 (< 0.5 fallback 阈值)
        when(qianwenJudgeClient.judge(anyString(), anyString(), any())).thenReturn(
                "{\"verdict\":\"PARTIAL\",\"confidence\":0.32,"
                        + "\"reason\":\"答案接近但步骤难辨认 · AI 不确定\","
                        + "\"matched_steps\":[\"步骤 1\"],"
                        + "\"missed_steps\":[\"步骤 2\",\"步骤 3\"]}");

        mvc.perform(post("/api/review/nodes/" + nid + "/judge")
                        .header("Authorization", AUTH)
                        .header("X-User-Id", String.valueOf(STUDENT_ID))
                        .header("X-Idempotency-Key", "sc22-ac3-key")
                        .contentType("application/json")
                        .content("{\"user_answer_image_key\":\"" + imageKey + "\"}"))
                // (a) HTTP 200 + body status=LOW_CONFIDENCE + verdict 仍返 (与 SC20-T05 banner 渲染 fallback 文案分支对接)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("LOW_CONFIDENCE"))
                .andExpect(jsonPath("$.verdict").value("PARTIAL"))
                .andExpect(jsonPath("$.confidence").value(0.32));

        WbReviewNode persisted = wbNodeRepo.findById(nid).orElseThrow();
        // (b) image_key 非 null + verdict + confidence + reason 仍落 (per biz §2B.22 line 213 "ai_judge_* 5 列仍写库")
        assertThat(persisted.getUserAnswerImageKey()).isEqualTo(imageKey);
        assertThat(persisted.getAiJudgeVerdict()).isEqualTo("PARTIAL");
        assertThat(persisted.getAiJudgeConfidence()).isEqualByComparingTo(new BigDecimal("0.32"));
        assertThat(persisted.getAiJudgeReason()).isNotBlank();

        // (c) ai_judge_metadata.status='LOW_CONFIDENCE' + flagged=true
        JsonNode metadata = json.readTree(persisted.getAiJudgeMetadata());
        assertThat(metadata.path("status").asText()).isEqualTo("LOW_CONFIDENCE");
        assertThat(metadata.path("flagged").asBoolean()).isTrue();
    }

    // ==========================================================================
    // AC4 · 真 sleep 注入 · 验 controller 18s 内必返 503 (per-provider timeout 上限保护)
    // ==========================================================================

    @Test
    @DisplayName("ac4 · primary client 真 sleep 9s (> 8s primary timeout) · controller 18s 内 503 · 不挂死")
    void it_ac4_perProviderHardTimeout_within18s() throws Exception {
        long nid = seedNode((short) 0);
        String imageKey = IMAGE_KEY_BASE + "sc22ac4.jpg";

        // path-B (真 sleep 注入 · 验 CompletableFuture.get(timeoutMs) 真截断)
        // primary 真 sleep 9s (> 8s timeout-primary-ms 配置) · fallback 同步抛
        when(qianwenJudgeClient.judge(anyString(), anyString(), any())).thenAnswer(invocation -> {
            try {
                Thread.sleep(9_000L);  // 真挂 9s > 8s primary timeout
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                throw new AnswerJudgeAiException("primary interrupted");
            }
            return "{\"verdict\":\"MASTERED\",\"confidence\":0.9,\"reason\":\"unreachable\"}";
        });
        org.mockito.Mockito.doThrow(new AnswerJudgeAiException("fallback also fail"))
                .when(stubJudgeFallbackClient).judge(anyString(), anyString(), any());

        long t0 = System.currentTimeMillis();
        mvc.perform(post("/api/review/nodes/" + nid + "/judge")
                        .header("Authorization", AUTH)
                        .header("X-User-Id", String.valueOf(STUDENT_ID))
                        .header("X-Idempotency-Key", "sc22-ac4-key")
                        .contentType("application/json")
                        .content("{\"user_answer_image_key\":\"" + imageKey + "\"}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error_code").value("AI_SERVICE_UNAVAILABLE"));
        long wallClockMs = System.currentTimeMillis() - t0;

        // AC4 · biz §10.17 SLA: 503 必在 18s 内 · 即使 primary 真挂 9s · CompletableFuture timeout 8s 截断
        // 上限: 8s primary timeout + ~ms fallback throw + 缓冲 < 18s
        assertThat(wallClockMs).isLessThan(18_000L);
        // 下限: 至少 8s (primary 真 timeout 等待) · 不能 < 7.5s (验真有挂等待)
        assertThat(wallClockMs).isGreaterThanOrEqualTo(7_500L);
    }
}
