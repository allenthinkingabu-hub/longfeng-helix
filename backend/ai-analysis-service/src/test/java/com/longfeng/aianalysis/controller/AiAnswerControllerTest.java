package com.longfeng.aianalysis.controller;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.longfeng.aianalysis.entity.AnalysisResult;
import com.longfeng.aianalysis.entity.AnalysisTask;
import com.longfeng.aianalysis.repo.AnalysisResultRepository;
import com.longfeng.aianalysis.repo.AnalysisTaskRepository;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Unit tests for {@link AiAnswerController} GET /api/ai/{qid}/answer.
 *
 * <p>Covers the three contracts established in test-cases.md ## 实现注释 #3:
 * <ol>
 *   <li>PG row exists, task DONE → 200 + full body (test-case #1 + #4 happy / closure)</li>
 *   <li>PG row missing → 404 + {"code":"AI_ANSWER_NOT_FOUND"} (test-case #2)</li>
 *   <li>PG row exists, task FAILED → 200 + empty body (test-case #3 degraded)</li>
 * </ol>
 *
 * <p>Also asserts the 字段映射 contract (FE AiAnswer ↔ BE AnalysisResult):
 * <pre>
 *   AiAnswer.qid             == request qid
 *   AiAnswer.taskId          == result.taskId
 *   AiAnswer.reasonMarkdown  == result.errorReason
 *   AiAnswer.provider        == result.provider
 *   AiAnswer.modelInfo.name  == result.provider (e.g. "qianwen")
 *   AiAnswer.modelInfo.version == result.model (e.g. "qwen-plus") OR "fail" when degraded
 *   AiAnswer.steps[]         == parsed JSON of result.steps · {stepNo,text}+
 * </pre>
 */
@WebMvcTest(controllers = AiAnswerController.class)
@Import(AiAnswerControllerTest.JacksonBean.class)
class AiAnswerControllerTest {

    @Autowired private MockMvc mvc;
    @MockBean private AnalysisResultRepository resultRepo;
    @MockBean private AnalysisTaskRepository taskRepo;

    @org.springframework.boot.test.context.TestConfiguration
    static class JacksonBean {
        @org.springframework.context.annotation.Bean
        @org.springframework.context.annotation.Primary
        ObjectMapper jsonMapper() {
            return new ObjectMapper();
        }
    }

    private AnalysisResult result;

    @BeforeEach
    void seed() {
        result = new AnalysisResult();
        result.setId(1L);
        result.setTaskId("Q-AI-FAKE-001");
        result.setStem("已知 f(x)=x²−4x+3 求顶点");
        result.setErrorReason("对顶点式 (x-h)²+k 的 h, k 含义混淆");
        result.setSteps("[{\"stepNo\":1,\"text\":\"配方：f(x)=(x-2)²-1\"},"
                + "{\"stepNo\":2,\"text\":\"识别顶点 (h,k) = (2, -1)\"},"
                + "{\"stepNo\":3,\"text\":\"对称轴方程 x = h = 2\"}]");
        result.setProvider("qianwen");
        result.setModel("qwen-plus");
        result.setUsageTokens(412);
    }

    @Test
    @DisplayName("test-case #1 · happy · 200 + full body + AiAnswer.* shape")
    void happyPathReturnsFullAnswer() throws Exception {
        when(resultRepo.findByTaskId(eq("Q-AI-FAKE-001"))).thenReturn(Optional.of(result));
        AnalysisTask task = new AnalysisTask();
        task.setTaskId("Q-AI-FAKE-001");
        task.setStatus(AnalysisTask.STATUS_DONE);
        when(taskRepo.findByTaskId(eq("Q-AI-FAKE-001"))).thenReturn(Optional.of(task));

        mvc.perform(get("/api/ai/Q-AI-FAKE-001/answer"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("application/json"))
                .andExpect(jsonPath("$.qid").value("Q-AI-FAKE-001"))
                .andExpect(jsonPath("$.taskId").value("Q-AI-FAKE-001"))
                .andExpect(jsonPath("$.provider").value("qianwen"))
                .andExpect(jsonPath("$.modelInfo.name").value("qianwen"))
                .andExpect(jsonPath("$.modelInfo.version").value("qwen-plus"))
                .andExpect(jsonPath("$.reasonMarkdown")
                        .value("对顶点式 (x-h)²+k 的 h, k 含义混淆"))
                .andExpect(jsonPath("$.steps.length()").value(3))
                .andExpect(jsonPath("$.steps[0].stepNo").value(1))
                .andExpect(jsonPath("$.steps[0].text")
                        .value("配方：f(x)=(x-2)²-1"));
    }

    @Test
    @DisplayName("test-case #2 · 404 · PG analysis_result missing → AI_ANSWER_NOT_FOUND")
    void notFound404() throws Exception {
        when(resultRepo.findByTaskId(eq("Q-NO-ANSWER-002"))).thenReturn(Optional.empty());

        mvc.perform(get("/api/ai/Q-NO-ANSWER-002/answer"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("AI_ANSWER_NOT_FOUND"))
                .andExpect(jsonPath("$.message").exists());
    }

    @Test
    @DisplayName("test-case #3 · 200 degraded · task FAILED → empty body + modelInfo.version=fail")
    void taskFailedDegraded() throws Exception {
        AnalysisResult failedResult = new AnalysisResult();
        failedResult.setId(2L);
        failedResult.setTaskId("Q-AI-FAILED-003");
        failedResult.setProvider("qianwen");
        failedResult.setModel("qwen-plus");
        when(resultRepo.findByTaskId(eq("Q-AI-FAILED-003"))).thenReturn(Optional.of(failedResult));
        AnalysisTask task = new AnalysisTask();
        task.setTaskId("Q-AI-FAILED-003");
        task.setStatus(AnalysisTask.STATUS_FAILED);
        when(taskRepo.findByTaskId(eq("Q-AI-FAILED-003"))).thenReturn(Optional.of(task));

        mvc.perform(get("/api/ai/Q-AI-FAILED-003/answer"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.qid").value("Q-AI-FAILED-003"))
                .andExpect(jsonPath("$.reasonMarkdown").value(""))
                .andExpect(jsonPath("$.steps.length()").value(0))
                .andExpect(jsonPath("$.provider").value("qianwen"))
                .andExpect(jsonPath("$.modelInfo.version").value("fail"));
    }

    @Test
    @DisplayName("test-case #4 · closure · response taskId mirrors request qid (BE honored caller taskId)")
    void taskIdMirrorsRequestQid() throws Exception {
        result.setTaskId("Q-CLOSED-LOOP-004");
        when(resultRepo.findByTaskId(eq("Q-CLOSED-LOOP-004"))).thenReturn(Optional.of(result));
        AnalysisTask t = new AnalysisTask();
        t.setTaskId("Q-CLOSED-LOOP-004");
        t.setStatus(AnalysisTask.STATUS_DONE);
        when(taskRepo.findByTaskId(eq("Q-CLOSED-LOOP-004"))).thenReturn(Optional.of(t));

        mvc.perform(get("/api/ai/Q-CLOSED-LOOP-004/answer"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.qid").value("Q-CLOSED-LOOP-004"))
                .andExpect(jsonPath("$.taskId").value("Q-CLOSED-LOOP-004"))
                .andExpect(jsonPath("$.provider").value("qianwen"));
    }

    @Test
    @DisplayName("edge · steps JSON malformed → 200 with empty steps (not 500)")
    void stepsMalformedDoesNotCrash() throws Exception {
        result.setSteps("not-json");
        when(resultRepo.findByTaskId(eq("Q-AI-FAKE-001"))).thenReturn(Optional.of(result));
        AnalysisTask t = new AnalysisTask();
        t.setTaskId("Q-AI-FAKE-001");
        t.setStatus(AnalysisTask.STATUS_DONE);
        when(taskRepo.findByTaskId(eq("Q-AI-FAKE-001"))).thenReturn(Optional.of(t));

        mvc.perform(get("/api/ai/Q-AI-FAKE-001/answer"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.steps.length()").value(0))
                .andExpect(jsonPath("$.reasonMarkdown")
                        .value("对顶点式 (x-h)²+k 的 h, k 含义混淆"));
    }
}
