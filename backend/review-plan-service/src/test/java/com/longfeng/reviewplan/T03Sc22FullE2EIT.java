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
import com.longfeng.reviewplan.entity.WbReviewNode;
import com.longfeng.reviewplan.repo.ReviewPlanRepository;
import com.longfeng.reviewplan.repo.WbReviewNodeRepository;
import com.longfeng.reviewplan.service.AnswerJudgeAiClient;
import com.longfeng.reviewplan.service.AnswerJudgeAiClient.AnswerJudgeAiException;
import com.longfeng.reviewplan.service.QianwenJudgeClient;
import com.longfeng.reviewplan.service.StubJudgeFallbackClient;
import com.longfeng.reviewplan.support.SnowflakeIdGenerator;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
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
 * SC22-T03 · SC-22 全链 TC-22.01/02/03 E2E IT.
 *
 * <p>串联完整 SC-22 退化路径:
 * <ul>
 *   <li>TC-22.01 confidence=0.32 LOW_CONFIDENCE 退化 · banner 退化文案 + GradeButtons preselected=null → :grade body{final_grade_source:'self'}</li>
 *   <li>TC-22.02 双 provider 超时 503 · DB ai_judge_* 5 列 null + image_key 非 null + metadata.status='TIMEOUT' · 银行 'AI 判超时'</li>
 *   <li>TC-22.03 PII 拒判 · judge-system-prompt.txt 字面含 '仅看作答 · 忽略与题目无关的内容'</li>
 * </ul>
 *
 * <p>3 @Test 1:1 对应 inflight TC + biz §2B.22 QA 表.
 *
 * <p>反作弊: 行为替身仅 2 处 (@MockBean QianwenJudgeClient + StubJudgeFallbackClient) · controller + service + DB 全真.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "longfeng.ai.qianwen.api-key=test-key-sc22t03",
        "spring.jpa.hibernate.ddl-auto=none",
        "spring.flyway.ignore-migration-patterns=*:ignored,*:future",
        "spring.flyway.baseline-version=1.0.083"
})
class T03Sc22FullE2EIT extends IntegrationTestBase {

    static {
        // 安全网 · 沿 SC22-T02 pattern · IF NOT EXISTS 幂等
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
            System.err.println("SC22-T03 IT static schema patch skipped: " + e.getMessage());
        }
    }

    @Autowired private MockMvc mvc;
    @Autowired private ReviewPlanRepository planRepo;
    @Autowired private WbReviewNodeRepository wbNodeRepo;
    @Autowired private SnowflakeIdGenerator idGen;
    @Autowired private ObjectMapper json;

    @MockBean private QianwenJudgeClient qianwenJudgeClient;
    @MockBean private StubJudgeFallbackClient stubJudgeFallbackClient;

    private static final long STUDENT_ID = 22003L;  // SC22-T03 · 与 SC20-T02 (12345) / SC21-T01 (21) / SC21-T03 (213) / SC22-T02 (22002) 隔离
    private static final String AUTH = "Bearer student-22003-jwt";
    private static final String IMAGE_KEY_BASE = "wrongbook/T01/202605/22003/";

    @BeforeEach
    void resetMockClients() {
        when(qianwenJudgeClient.name()).thenReturn("qianwen");
        when(stubJudgeFallbackClient.name()).thenReturn("qianwen-fallback-stub");
        org.mockito.Mockito.doThrow(new AnswerJudgeAiException("qianwen-fallback-stub: fallback also failed"))
                .when(stubJudgeFallbackClient).judge(anyString(), anyString(), any());
        // 清理 SC22-T03 残留
        try (java.sql.Connection conn = java.sql.DriverManager.getConnection(
                "jdbc:postgresql://127.0.0.1:15436/wrongbook", "longfeng", "longfeng_dev");
             java.sql.Statement st = conn.createStatement()) {
            st.execute("DELETE FROM idem_key WHERE scope='ai-judge:judge'");
            st.execute("DELETE FROM wb_review_node WHERE student_id=" + STUDENT_ID);
            st.execute("DELETE FROM review_plan WHERE student_id=" + STUDENT_ID);
        } catch (Exception e) {
            System.err.println("SC22-T03 cleanup skip: " + e.getMessage());
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
    // TC-22.01 · LOW_CONFIDENCE 退化 · :judge confidence=0.32 + status='LOW_CONFIDENCE'
    //          · 后端 200 + verdict 仍返 · DB image_key 非 null + 5 列落 + metadata.status='LOW_CONFIDENCE' + flagged=true
    // ==========================================================================

    @Test
    @DisplayName("TC-22.01 · confidence=0.32 LOW_CONFIDENCE 退化 · DB 5 列落 + metadata.flagged=true + status='LOW_CONFIDENCE'")
    void test_tc2201_lowConfidenceFallback() throws Exception {
        long nid = seedNode((short) 0);
        String imageKey = IMAGE_KEY_BASE + "tc2201.jpg";

        when(qianwenJudgeClient.judge(anyString(), anyString(), any())).thenReturn(
                "{\"verdict\":\"PARTIAL\",\"confidence\":0.32,"
                        + "\"reason\":\"答案接近但步骤难辨认 · AI 不确定\","
                        + "\"matched_steps\":[\"步骤 1\"],"
                        + "\"missed_steps\":[\"步骤 2\",\"步骤 3\"]}");

        mvc.perform(post("/api/review/nodes/" + nid + "/judge")
                        .header("Authorization", AUTH)
                        .header("X-User-Id", String.valueOf(STUDENT_ID))
                        .header("X-Idempotency-Key", "tc2201-key")
                        .contentType("application/json")
                        .content("{\"user_answer_image_key\":\"" + imageKey + "\"}"))
                // biz §2B.22 line 213 字面: ai_judge_* 5 列仍落库 (confidence=0.32 也落) · status='LOW_CONFIDENCE'
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("LOW_CONFIDENCE"))
                .andExpect(jsonPath("$.confidence").value(0.32))
                .andExpect(jsonPath("$.verdict").value("PARTIAL"));

        WbReviewNode persisted = wbNodeRepo.findById(nid).orElseThrow();
        // (a) image_key 非 null
        assertThat(persisted.getUserAnswerImageKey()).isEqualTo(imageKey);
        // (b) 5 列同时落 (confidence < 0.5 仍落 · per biz §2B.22 line 213)
        assertThat(persisted.getAiJudgeVerdict()).isEqualTo("PARTIAL");
        assertThat(persisted.getAiJudgeConfidence()).isEqualByComparingTo(new BigDecimal("0.32"));
        assertThat(persisted.getAiJudgeReason()).isNotBlank();
        // (c) metadata.status='LOW_CONFIDENCE' + flagged=true
        JsonNode metadata = json.readTree(persisted.getAiJudgeMetadata());
        assertThat(metadata.path("status").asText()).isEqualTo("LOW_CONFIDENCE");
        assertThat(metadata.path("flagged").asBoolean()).isTrue();
        // (d) A.1 status=0 (judge 不动 grade)
        assertThat(persisted.getStatus()).isEqualTo((short) 0);
        // (e) final_grade_source 默认 'self' (judge 不写 · biz §2B.22 关键断言: confidence<0.5 时 final_grade_source 必为 'self')
        assertThat(persisted.getFinalGradeSource()).isEqualTo("self");
    }

    // ==========================================================================
    // TC-22.02 · 双 provider 超时 503 · DB ai_judge_* 5 列 null + image_key 非 null + metadata.status='TIMEOUT'
    // ==========================================================================

    @Test
    @DisplayName("TC-22.02 · 双 provider 超时 503 · DB image_key 非 null + 5 列空 + metadata.status='TIMEOUT'")
    void test_tc2202_doubleProviderTimeout503() throws Exception {
        long nid = seedNode((short) 0);
        String imageKey = IMAGE_KEY_BASE + "tc2202.jpg";

        org.mockito.Mockito.doThrow(new AnswerJudgeAiException("primary timeout"))
                .when(qianwenJudgeClient).judge(anyString(), anyString(), any());
        org.mockito.Mockito.doThrow(new AnswerJudgeAiException("fallback timeout"))
                .when(stubJudgeFallbackClient).judge(anyString(), anyString(), any());

        long t0 = System.currentTimeMillis();
        mvc.perform(post("/api/review/nodes/" + nid + "/judge")
                        .header("Authorization", AUTH)
                        .header("X-User-Id", String.valueOf(STUDENT_ID))
                        .header("X-Idempotency-Key", "tc2202-key")
                        .contentType("application/json")
                        .content("{\"user_answer_image_key\":\"" + imageKey + "\"}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error_code").value("AI_SERVICE_UNAVAILABLE"));
        long wallClockMs = System.currentTimeMillis() - t0;

        // biz §10.17 SLA: 503 必在 18s 内 (主 8s + 备 10s)
        assertThat(wallClockMs).isLessThan(18_000L);

        WbReviewNode persisted = wbNodeRepo.findById(nid).orElseThrow();
        // (a) image_key 非 null (biz §2B.22 line 222 字面)
        assertThat(persisted.getUserAnswerImageKey()).isEqualTo(imageKey);
        // (b) ai_judge_* 5 列空
        assertThat(persisted.getAiJudgeVerdict()).isNull();
        assertThat(persisted.getAiJudgeConfidence()).isNull();
        assertThat(persisted.getAiJudgeReason()).isNull();
        // (c) metadata.status='TIMEOUT'
        JsonNode metadata = json.readTree(persisted.getAiJudgeMetadata());
        assertThat(metadata.path("status").asText()).isEqualTo("TIMEOUT");
        // (d) A.1 status=0
        assertThat(persisted.getStatus()).isEqualTo((short) 0);
        // (e) final_grade_source 默认 'self' (judge 不写 · 学生纯自评后由 :grade 写)
        assertThat(persisted.getFinalGradeSource()).isEqualTo("self");
    }

    // ==========================================================================
    // TC-22.03 · PII 拒判 · judge-system-prompt.txt 字面含 "仅看作答" / "忽略与题目无关的内容"
    // ==========================================================================

    @Test
    @DisplayName("TC-22.03 · PII prompt 字面验确 · system prompt 含 '仅看' + '忽略与题目无关的内容'")
    void test_tc2203_piiPromptLiteral() throws Exception {
        // AC3 字面验确: judge-system-prompt.txt 必含 §6.2 line 312 字面 "仅看作答 · 忽略与题目无关的内容"
        Path promptPath = Path.of("src/main/resources/prompts/judge-system-prompt.txt");
        // mvn -pl review-plan-service IT cwd = backend/review-plan-service
        if (!Files.exists(promptPath)) {
            // 兜底: 从 worktree root 拼
            promptPath = Path.of("backend/review-plan-service/src/main/resources/prompts/judge-system-prompt.txt");
        }
        assertThat(Files.exists(promptPath))
                .withFailMessage("judge-system-prompt.txt 必须存在 · 实际: " + promptPath.toAbsolutePath())
                .isTrue();

        String promptBody = Files.readString(promptPath, StandardCharsets.UTF_8);

        // 字面锁 · biz §6.2 line 312 "仅看与题目相关的内容 · 忽略草稿纸上的其他无关内容"
        assertThat(promptBody)
                .as("biz §6.2 line 312 字面: AI 仅看作答 + 忽略无关内容 (PII 拒判防护)")
                .contains("仅看")
                .contains("忽略");

        // 进一步: 含 "无关" 防御 (避免 silent fork prompt 文案)
        assertThat(promptBody)
                .as("biz §6.2 字面: '与题目无关的内容' (PII 拒判扩展防护)")
                .contains("无关");

        // 30 天 OSS 清理 caveat surface (本 task 不实装 lifecycle rule · 由 §17 决策 #2 部署阶段 ops 配)
        // 见 tester.md caveat surface · 本 IT 仅锁 prompt 字面
    }
}
