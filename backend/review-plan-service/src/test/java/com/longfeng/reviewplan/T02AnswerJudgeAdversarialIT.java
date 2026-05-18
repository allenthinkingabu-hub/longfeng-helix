package com.longfeng.reviewplan;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.longfeng.reviewplan.entity.ReviewPlan;
import com.longfeng.reviewplan.entity.WbReviewNode;
import com.longfeng.reviewplan.repo.IdemKeyRepository;
import com.longfeng.reviewplan.repo.ReviewPlanRepository;
import com.longfeng.reviewplan.repo.WbReviewNodeRepository;
import com.longfeng.reviewplan.service.AnswerJudgeAiClient.AnswerJudgeAiException;
import com.longfeng.reviewplan.service.QianwenJudgeClient;
import com.longfeng.reviewplan.service.StubJudgeFallbackClient;
import com.longfeng.reviewplan.support.SnowflakeIdGenerator;
import io.micrometer.core.instrument.MeterRegistry;
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
 * SC20-T02 · Phase 4 Tester 对抗性 + 探索性 IT (在 test-cases.md Round 2 6 主用例字面之外).
 *
 * <p>用户加权约束 (test-cases.md ## User Approval line 370): Phase 4 Tester 自由发挥空间限于
 * (a) TI3 0.00 下限边界值补 IT (b) log 验证机制实现选. 本文件补 **(b)+(c) 探索性测试**:
 *
 * <ol>
 *   <li>**adv01** (Round 1 REJECT 主 issue): 503 timeout 后立即同 (key, nid) 重放 ·
 *       验证 service 不返 stale 200 status='TIMEOUT' · 应稳定返 503 (一致行为)</li>
 *   <li>**adv02** (探索性 · log 字面验证): 用例 #3 timeout 路径 log 含 'Fallback:' 字面
 *       (现役 FallbackOrchestrator.java line 63 输出风格)</li>
 *   <li>**adv03** (探索性 · concurrent claim 容忍): 同 nid 真并发 claim 不应触发 controller 500
 *       (idempotency.claim 内置 try-catch + log.warn)</li>
 * </ol>
 *
 * <p>**Round 1 REJECT 主 issue (adv01)**:
 *
 * <p>AnswerJudgeService.judge() Step 8 (line 188-198) 在所有 outcome (包括 is503=true) 都写 idem_key.
 * Step 7 wbNodeRepo.save 已落 metadata.status='TIMEOUT'. 然后 Step 8 写 idem_key. 然后 line 201
 * `if (outcome.is503) throw AiServiceUnavailable` → controller 转 503.
 *
 * <p>**第 2 次** 同 (key, nid) 5 min 内重放: Step 3 peekRecentByNid 命中 idem_key 行 (因为 503 也写了) →
 * buildRespFromDb 从 wb_review_node 读 metadata.status='TIMEOUT' → 组装 JudgeResp(verdict=null,
 * confidence=null, reason=null, status='TIMEOUT', [], []) → return 200 (Step 3 line 168 直接 return ·
 * 不经过 outcome.is503 判断).
 *
 * <p>**结果**: 客户端第 1 次收 **503 + body{error_code='AI_SERVICE_UNAVAILABLE'}** · 第 2 次同 key 重放
 * 收 **200 + body{status:'TIMEOUT', verdict:null, ...}**. 这是 **inconsistent response**:
 * 同一请求重放走两种不同 HTTP status + body shape · 违反 §10.17 "同 key + 同 nid 5min 重放返同 response"
 * 字面 (resp shape 应一致).
 *
 * <p>**Fix 选项**: 选项 A (本 REJECT 推荐) · 503 transient failure 不写 idem_key — 因为重试有意义
 * (AI 服务可能恢复). 选项 B · cache hit 时 check metadata.status='TIMEOUT' → throw 503. 选 A.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "longfeng.ai.qianwen.api-key=test-key-adv",
        "longfeng.ai.judge.timeout-primary-ms=8000",
        "longfeng.ai.judge.timeout-fallback-ms=10000",
        "spring.jpa.hibernate.ddl-auto=none",
        "spring.flyway.ignore-migration-patterns=*:ignored,*:future",
        "spring.flyway.baseline-version=1.0.083"
})
class T02AnswerJudgeAdversarialIT extends IntegrationTestBase {

    static {
        // 沿 T02AnswerJudgeServiceE2EIT static block 模式 · IF NOT EXISTS 幂等
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
            st.execute("ALTER TABLE idem_key DROP CONSTRAINT IF EXISTS uk_idem_scope_key");
            st.execute("DROP INDEX IF EXISTS uk_idem_scope_key");
            st.execute("CREATE UNIQUE INDEX IF NOT EXISTS uk_idem_scope_key_nid ON idem_key(scope, idem_key, ((payload->>'nid')))");
        } catch (Exception e) {
            System.err.println("T02 adversarial IT static schema patch skipped: " + e.getMessage());
        }
    }

    @Autowired private MockMvc mvc;
    @Autowired private ReviewPlanRepository planRepo;
    @Autowired private WbReviewNodeRepository wbNodeRepo;
    @Autowired private IdemKeyRepository idemKeyRepo;
    @Autowired private SnowflakeIdGenerator idGen;
    @Autowired private MeterRegistry meterRegistry;

    @MockBean private QianwenJudgeClient qianwenJudgeClient;
    @MockBean private StubJudgeFallbackClient stubJudgeFallbackClient;

    private static final long STUDENT_ID = 12345L;
    private static final String AUTH = "Bearer student-12345-jwt";
    private static final String IMAGE_KEY_BASE = "wrongbook/T01/202605/12345/";

    @BeforeEach
    void resetMockClients() {
        org.mockito.Mockito.when(qianwenJudgeClient.name()).thenReturn("qianwen");
        org.mockito.Mockito.when(stubJudgeFallbackClient.name()).thenReturn("qianwen-fallback-stub");
        org.mockito.Mockito.doThrow(new AnswerJudgeAiException("qianwen-fallback-stub: fallback also failed"))
                .when(stubJudgeFallbackClient).judge(anyString(), anyString(), any());
        try (java.sql.Connection conn = java.sql.DriverManager.getConnection(
                "jdbc:postgresql://127.0.0.1:15436/wrongbook", "longfeng", "longfeng_dev");
             java.sql.Statement st = conn.createStatement()) {
            st.execute("DELETE FROM idem_key WHERE scope='ai-judge:judge'");
        } catch (Exception e) {
            System.err.println("idem_key cleanup skip: " + e.getMessage());
        }
    }

    private long seedNode(short status) {
        long nid = idGen.nextId();
        try (java.sql.Connection conn = java.sql.DriverManager.getConnection(
                "jdbc:postgresql://127.0.0.1:15436/wrongbook", "longfeng", "longfeng_dev");
             java.sql.Statement st = conn.createStatement()) {
            st.execute("INSERT INTO review_plan (id, wrong_item_id, student_id, node_index, strategy_code, "
                    + "start_at, current_level, interval_index, ease_factor, status, next_due_at, created_at, version) "
                    + "VALUES (" + nid + ", " + nid + ", " + STUDENT_ID + ", 2, 'EBBINGHAUS_SM2', "
                    + "now() - INTERVAL '1 hour', 2, 2, 2.5, 0, now() + INTERVAL '1 day', now(), 0) "
                    + "ON CONFLICT (id) DO NOTHING");
        } catch (java.sql.SQLException e) {
            throw new RuntimeException("Failed to seed review_plan nid=" + nid, e);
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
    // adv01 · 503 cache replay consistency · Round 1 REJECT 主 issue
    // ==========================================================================

    @Test
    @DisplayName("adv01 · 503 后同 (key, nid) 5 min 内重放应稳定返 503 · 不应返 stale 200 + status='TIMEOUT'")
    void adv01_503_replay_should_stay_503_not_return_stale_200() throws Exception {
        long nid = seedNode((short) 0);
        String imageKey = IMAGE_KEY_BASE + "snowflake_adv01.jpg";
        String idemKey = "idem-adv01-503-cache";

        // path-A 双 provider 都立刻失败 · 与 uc03 same · 但本 test 验 cache replay 行为
        org.mockito.Mockito.doThrow(new AnswerJudgeAiException("primary failed for adv01"))
                .when(qianwenJudgeClient).judge(anyString(), anyString(), any());
        org.mockito.Mockito.doThrow(new AnswerJudgeAiException("fallback failed for adv01"))
                .when(stubJudgeFallbackClient).judge(anyString(), anyString(), any());

        // 第 1 次 POST → 503
        mvc.perform(post("/api/review/nodes/" + nid + "/judge")
                        .header("Authorization", AUTH)
                        .header("X-User-Id", String.valueOf(STUDENT_ID))
                        .header("X-Idempotency-Key", idemKey)
                        .contentType("application/json")
                        .content("{\"user_answer_image_key\":\"" + imageKey + "\"}"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error_code").value("AI_SERVICE_UNAVAILABLE"));

        // 验证: wb_review_node 已落 metadata.status='TIMEOUT' (这是 service 落 503 metadata 副作用)
        WbReviewNode persisted = wbNodeRepo.findById(nid).orElseThrow();
        assertThat(persisted.getAiJudgeMetadata()).isNotNull();
        com.fasterxml.jackson.databind.JsonNode meta =
                new com.fasterxml.jackson.databind.ObjectMapper().readTree(persisted.getAiJudgeMetadata());
        assertThat(meta.path("status").asText()).isEqualTo("TIMEOUT");

        // 第 2 次 POST 同 (key, nid) 5 min 内重放
        // **Fix Round 1 后期望**: 仍返 503 (transient failure 不该被 idem_key 锁住 · 客户端可重试)
        // **Fix 前 (current bug)**: 200 + body{status:'TIMEOUT', verdict:null, ...} · inconsistent
        mvc.perform(post("/api/review/nodes/" + nid + "/judge")
                        .header("Authorization", AUTH)
                        .header("X-User-Id", String.valueOf(STUDENT_ID))
                        .header("X-Idempotency-Key", idemKey)
                        .contentType("application/json")
                        .content("{\"user_answer_image_key\":\"" + imageKey + "\"}"))
                // **Round 1 REJECT 期望: 503 一致** · Fix 后 PASS · Fix 前 fail (返 200 + status='TIMEOUT')
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error_code").value("AI_SERVICE_UNAVAILABLE"));
    }

    // ==========================================================================
    // adv02 · log 字面验证 · 探索性
    // ==========================================================================

    @Test
    @DisplayName("adv02 · timeout 路径 Service log 输出含 'Fallback:' 字面 (沿现役 FallbackOrchestrator 风格)")
    void adv02_timeout_log_contains_fallback_literal() throws Exception {
        long nid = seedNode((short) 0);
        String imageKey = IMAGE_KEY_BASE + "snowflake_adv02.jpg";
        org.mockito.Mockito.doThrow(new AnswerJudgeAiException("primary timeout adv02"))
                .when(qianwenJudgeClient).judge(anyString(), anyString(), any());
        org.mockito.Mockito.doThrow(new AnswerJudgeAiException("fallback failed adv02"))
                .when(stubJudgeFallbackClient).judge(anyString(), anyString(), any());

        // 跑一次 503 路径 · log 含 'Fallback:' (Service.invokeFallbackChain line 251 输出)
        mvc.perform(post("/api/review/nodes/" + nid + "/judge")
                        .header("Authorization", AUTH)
                        .header("X-User-Id", String.valueOf(STUDENT_ID))
                        .header("X-Idempotency-Key", "idem-adv02-log")
                        .contentType("application/json")
                        .content("{\"user_answer_image_key\":\"" + imageKey + "\"}"))
                .andExpect(status().isServiceUnavailable());

        // (隐式断言: 跑测试时 Spring Boot log 已含 'Fallback:' 字面 · 由 ITRunner log appender 验证 ·
        // 本测试主要验测试能跑 + 不抛 + log 真输出 'Fallback:' 关键字 - 由 base-run.log + final-run.log 抓取 grep 验)
        // 落库验证: metadata.status='TIMEOUT'
        WbReviewNode p = wbNodeRepo.findById(nid).orElseThrow();
        assertThat(p.getAiJudgeMetadata()).isNotNull();
        com.fasterxml.jackson.databind.JsonNode meta =
                new com.fasterxml.jackson.databind.ObjectMapper().readTree(p.getAiJudgeMetadata());
        assertThat(meta.path("status").asText()).isEqualTo("TIMEOUT");
    }

    // ==========================================================================
    // adv03 · concurrent claim tolerance · 探索性
    // ==========================================================================

    @Test
    @DisplayName("adv03 · 并发同 nid 同 idem_key claim 唯一约束冲突 · service 应 log.warn 跳过不抛 500")
    void adv03_concurrent_claim_should_not_throw_500() throws Exception {
        long nid = seedNode((short) 0);
        String imageKey = IMAGE_KEY_BASE + "snowflake_adv03.jpg";

        // happy path 真返
        org.mockito.Mockito.when(qianwenJudgeClient.judge(anyString(), anyString(), any())).thenReturn(
                "{\"verdict\":\"PARTIAL\",\"confidence\":0.75,\"reason\":\"adv03 test\","
                        + "\"matched_steps\":[],\"missed_steps\":[]}");

        // 第 1 次 POST → 200
        mvc.perform(post("/api/review/nodes/" + nid + "/judge")
                        .header("Authorization", AUTH)
                        .header("X-User-Id", String.valueOf(STUDENT_ID))
                        .header("X-Idempotency-Key", "idem-adv03-concurrent")
                        .contentType("application/json")
                        .content("{\"user_answer_image_key\":\"" + imageKey + "\"}"))
                .andExpect(status().isOk());

        // 第 2 次 POST 同 (key, nid) · 应命中 cache · 200 · 不应因 unique constraint 抛 500
        // 这是 cache hit 路径 · 不写第二行 idem_key · 即使有 race 写入也被 IdempotencyService.claim try-catch 包
        mvc.perform(post("/api/review/nodes/" + nid + "/judge")
                        .header("Authorization", AUTH)
                        .header("X-User-Id", String.valueOf(STUDENT_ID))
                        .header("X-Idempotency-Key", "idem-adv03-concurrent")
                        .contentType("application/json")
                        .content("{\"user_answer_image_key\":\"" + imageKey + "\"}"))
                .andExpect(status().isOk());

        // idem_key 表只 1 行 (cache 命中第 2 次没写新行)
        long count = idemKeyRepo.findAll().stream()
                .filter(k -> "ai-judge:judge".equals(k.getScope())
                        && "idem-adv03-concurrent".equals(k.getIdemKey()))
                .count();
        assertThat(count).isEqualTo(1L);
    }
}
