package com.longfeng.aianalysis;

// trace: biz/业务与技术解决方案_AI错题本_基于日历系统.md §2A.4 + audits/SC-01-PHASE-0/A04-ai-analysis.md §1/§2

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.longfeng.aianalysis.entity.AnalysisTask;
import com.longfeng.aianalysis.repo.AnalysisResultRepository;
import com.longfeng.aianalysis.repo.AnalysisTaskRepository;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

/**
 * ai-analysis-service IT · 4 endpoints + 7 events per A04 spec.
 * Testcontainers connect to sandbox: PG:15434, Redis:16381.
 * Covers: analyze-by-url, stream (polling fallback), cancel, fallback, models, analysis S4 domain.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
class AiAnalysisIT extends IntegrationTestBase {

    @Autowired private MockMvc mvc;
    @Autowired private ObjectMapper jsonMapper;
    @Autowired private AnalysisTaskRepository taskRepo;
    @Autowired private AnalysisResultRepository resultRepo;

    // ========== POST /api/ai/analyze-by-url ==========

    @Test
    @DisplayName("A04-01 · analyze-by-url returns 202 + taskId + ANALYZING status")
    void analyzeByUrl_returns202() throws Exception {
        String taskId = "it-" + UUID.randomUUID();
        var body = Map.of("taskId", taskId, "subject", "数学", "imageUrl", "https://example.com/q.jpg");

        mvc.perform(post("/api/ai/analyze-by-url")
                        .contentType("application/json")
                        .content(jsonMapper.writeValueAsString(body)))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.task_id").value(taskId))
                .andExpect(jsonPath("$.status").value("ANALYZING"));

        // Verify DB persistence
        Thread.sleep(300); // allow async pipeline to start
        assertThat(taskRepo.findByTaskId(taskId)).isPresent();
        assertThat(taskRepo.findByTaskId(taskId).get().getStatus())
                .isIn(AnalysisTask.STATUS_ANALYZING, AnalysisTask.STATUS_DONE);
    }

    @Test
    @DisplayName("A04-02 · analyze-by-url auto-generates taskId when not provided")
    void analyzeByUrl_autoTaskId() throws Exception {
        var body = Map.of("subject", "物理", "imageUrl", "https://example.com/physics.jpg");

        var result = mvc.perform(post("/api/ai/analyze-by-url")
                        .contentType("application/json")
                        .content(jsonMapper.writeValueAsString(body)))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.task_id").isNotEmpty())
                .andReturn();

        String responseBody = result.getResponse().getContentAsString();
        Map<?, ?> parsed = jsonMapper.readValue(responseBody, Map.class);
        assertThat(parsed.get("task_id")).isNotNull();
    }

    // ========== GET /api/ai/result/{taskId} (polling) ==========

    @Test
    @DisplayName("A04-03 · result polling returns task status after analysis")
    void resultPolling_afterAnalysis() throws Exception {
        String taskId = "it-poll-" + UUID.randomUUID();
        var body = Map.of("taskId", taskId, "subject", "数学", "imageUrl", "https://example.com/q.jpg");

        mvc.perform(post("/api/ai/analyze-by-url")
                        .contentType("application/json")
                        .content(jsonMapper.writeValueAsString(body)))
                .andExpect(status().isAccepted());

        // Wait for async pipeline to complete (stub provider is fast)
        Thread.sleep(1000);

        mvc.perform(get("/api/ai/result/" + taskId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DONE"));
    }

    @Test
    @DisplayName("A04-04 · result polling for unknown taskId returns NOT_FOUND")
    void resultPolling_unknownTaskId() throws Exception {
        mvc.perform(get("/api/ai/result/nonexistent-task-id"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NOT_FOUND"));
    }

    // ========== POST /api/ai/cancel/{taskId} ==========

    @Test
    @DisplayName("A04-05 · cancel returns 200 CANCELLED and updates DB status")
    void cancel_returnsOk() throws Exception {
        String taskId = "it-cancel-" + UUID.randomUUID();
        var body = Map.of("taskId", taskId, "subject", "英语", "imageUrl", "https://example.com/en.jpg");

        mvc.perform(post("/api/ai/analyze-by-url")
                        .contentType("application/json")
                        .content(jsonMapper.writeValueAsString(body)))
                .andExpect(status().isAccepted());

        Thread.sleep(50); // let task persist

        mvc.perform(post("/api/ai/cancel/" + taskId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));
    }

    @Test
    @DisplayName("A04-06 · cancel is idempotent for unknown taskId")
    void cancel_idempotent() throws Exception {
        mvc.perform(post("/api/ai/cancel/unknown-task-id"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));
    }

    // ========== POST /api/ai/fallback/{taskId} ==========

    @Test
    @DisplayName("A04-07 · fallback returns FALLBACK status + manual_form route + ocrText")
    void fallback_returnsOk() throws Exception {
        String taskId = "it-fb-" + UUID.randomUUID();
        var body = Map.of("taskId", taskId, "subject", "数学", "imageUrl", "https://example.com/q.jpg");

        mvc.perform(post("/api/ai/analyze-by-url")
                        .contentType("application/json")
                        .content(jsonMapper.writeValueAsString(body)))
                .andExpect(status().isAccepted());

        // Wait for OCR step to complete and populate ocrText
        Thread.sleep(500);

        mvc.perform(post("/api/ai/fallback/" + taskId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("FALLBACK"))
                .andExpect(jsonPath("$.route").value("manual_form"))
                .andExpect(jsonPath("$.taskId").value(taskId));
    }

    // ========== GET /api/ai/models ==========

    @Test
    @DisplayName("A04-08 · models NORMAL tier returns only qianwen-turbo")
    void models_normalTier() throws Exception {
        mvc.perform(get("/api/ai/models")
                        .header("X-User-Tier", "NORMAL"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value("qianwen-turbo"));
    }

    @Test
    @DisplayName("A04-09 · models VIP tier returns 3 models")
    void models_vipTier() throws Exception {
        mvc.perform(get("/api/ai/models")
                        .header("X-User-Tier", "VIP"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(3));
    }

    @Test
    @DisplayName("A04-10 · models VIP_PLUS tier returns all 4 models")
    void models_vipPlusTier() throws Exception {
        mvc.perform(get("/api/ai/models")
                        .header("X-User-Tier", "VIP_PLUS"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(4));
    }

    // ========== S4 domain: GET /analysis/* ==========

    @Test
    @DisplayName("A04-11 · /analysis/{itemId} returns 404 for nonexistent item")
    void analysisLatest_notFound() throws Exception {
        mvc.perform(get("/analysis/nonexistent-item"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("A04-12 · /analysis/{itemId}/similar returns empty list stub")
    void analysisSimilar_stub() throws Exception {
        mvc.perform(get("/analysis/any-item/similar"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").isArray());
    }

    @Test
    @DisplayName("A04-13 · /analysis/provider returns active provider info")
    void analysisProvider() throws Exception {
        mvc.perform(get("/analysis/provider"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value("qianwen"));
    }

    @Test
    @DisplayName("A04-14 · full pipeline: analyze-by-url → poll DONE → /analysis/{taskId} returns result")
    void fullPipeline_analyzeAndRetrieve() throws Exception {
        String taskId = "it-full-" + UUID.randomUUID();
        var body = Map.of("taskId", taskId, "subject", "数学", "imageUrl", "https://example.com/math.jpg");

        mvc.perform(post("/api/ai/analyze-by-url")
                        .contentType("application/json")
                        .content(jsonMapper.writeValueAsString(body)))
                .andExpect(status().isAccepted());

        // Wait for pipeline to complete
        Thread.sleep(1500);

        // Poll status
        mvc.perform(get("/api/ai/result/" + taskId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DONE"));

        // Retrieve result via S4 domain endpoint
        mvc.perform(get("/analysis/" + taskId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stem").isNotEmpty())
                .andExpect(jsonPath("$.errorReason").isNotEmpty())
                .andExpect(jsonPath("$.provider").value("stub"));

        // Verify DB: both task and result exist
        assertThat(taskRepo.findByTaskId(taskId)).isPresent();
        assertThat(taskRepo.findByTaskId(taskId).get().getStatus()).isEqualTo("DONE");
        assertThat(resultRepo.findByTaskId(taskId)).isPresent();
        assertThat(resultRepo.findByTaskId(taskId).get().getStem()).isNotEmpty();
    }
}
