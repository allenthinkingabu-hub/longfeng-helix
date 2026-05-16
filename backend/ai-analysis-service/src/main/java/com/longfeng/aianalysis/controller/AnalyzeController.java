package com.longfeng.aianalysis.controller;

import com.longfeng.aianalysis.config.AiProperties;
import com.longfeng.aianalysis.entity.AnalysisTask;
import com.longfeng.aianalysis.repo.AnalysisTaskRepository;
import com.longfeng.aianalysis.service.AnalysisStreamHub;
import com.longfeng.aianalysis.service.QuestionAnalyzerImpl;
import com.longfeng.common.dto.ApiResult;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * P03 real-time analysis entry point (/api/ai/*).
 * Distinct from /analysis/* S4 review domain (AnalysisController).
 * <p>
 * Endpoints: analyze (multipart sync), analyze-by-url (async 202), stream (SSE), result (polling).
 */
@RestController
@RequestMapping("/api/ai")
public class AnalyzeController {

    private static final Logger log = LoggerFactory.getLogger(AnalyzeController.class);

    private final QuestionAnalyzerImpl analyzer;
    private final AnalysisStreamHub streamHub;
    private final AnalysisTaskRepository taskRepo;
    private final AiProperties aiProps;

    public AnalyzeController(QuestionAnalyzerImpl analyzer,
                             AnalysisStreamHub streamHub,
                             AnalysisTaskRepository taskRepo,
                             AiProperties aiProps) {
        this.analyzer = analyzer;
        this.streamHub = streamHub;
        this.taskRepo = taskRepo;
        this.aiProps = aiProps;
    }

    /**
     * POST /api/ai/analyze-by-url · async 202.
     * Body: {task_id?, subject, image_url} → creates task → kicks off async pipeline → returns taskId + status.
     */
    @PostMapping("/analyze-by-url")
    public ResponseEntity<Map<String, Object>> analyzeByUrl(
            @Valid @RequestBody AnalyzeByUrlReq req) {
        String taskId = req.taskId() != null && !req.taskId().isBlank()
                ? req.taskId() : UUID.randomUUID().toString();

        analyzer.startAnalysis(taskId, req.subject(), req.imageUrl(), null);
        log.info("analyze-by-url: taskId={}, subject={}", taskId, req.subject());

        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(Map.of("task_id", taskId, "status", "ANALYZING"));
    }

    /**
     * POST /api/ai/analyze · sync entrypoint used by MP P03 analyzing page.
     *
     * <p>Honor caller-provided {@code taskId} when present so that
     * {@code analysis_result.task_id == qid} for the closing GET /api/ai/{qid}/answer.
     * Falls back to a random UUID only when the caller does not pass one (legacy CLI / debug).
     *
     * <p>SC01-MP-BUG-AI-FAKE root cause #3: previously hardcoded {@code UUID.randomUUID()},
     * breaking the task_id↔qid closure → P04 GET answered 404 silently.
     */
    @PostMapping("/analyze")
    public ResponseEntity<ApiResult<Map<String, Object>>> analyze(
            @RequestBody AnalyzeByUrlReq req) {
        String taskId = (req.taskId() != null && !req.taskId().isBlank())
                ? req.taskId() : UUID.randomUUID().toString();
        AnalysisTask task = analyzer.startAnalysis(taskId, req.subject(), req.imageUrl(), null);
        return ResponseEntity.ok(ApiResult.ok(Map.of(
                "task_id", task.getTaskId(),
                "status", task.getStatus()
        )));
    }

    /**
     * GET /api/ai/stream/{taskId} · SSE text/event-stream.
     * 7 event types: STEP_START, STEP_DONE, PARTIAL_JSON, DONE, FAIL, CANCELLED, FALLBACK_MODEL.
     * D-SSE headers: X-Accel-Buffering: no, Cache-Control: no-cache.
     */
    @GetMapping(value = "/stream/{taskId}", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@PathVariable String taskId) {
        long timeoutMs = aiProps.getStreamTimeoutSeconds() * 1000L;
        SseEmitter emitter = streamHub.subscribe(taskId, timeoutMs);
        log.info("SSE stream subscribed: taskId={}", taskId);
        return emitter;
    }

    /**
     * GET /api/ai/result/{taskId} · polling fallback.
     * Returns ANALYZING / DONE / FAILED / CANCELLED.
     */
    @GetMapping("/result/{taskId}")
    public ResponseEntity<Map<String, String>> result(@PathVariable String taskId) {
        return taskRepo.findByTaskId(taskId)
                .map(t -> ResponseEntity.ok(Map.of("status", t.getStatus())))
                .orElse(ResponseEntity.ok(Map.of("status", "NOT_FOUND")));
    }

    // ========== Request DTOs ==========

    public record AnalyzeByUrlReq(
            String taskId,
            @NotBlank String subject,
            @NotBlank String imageUrl
    ) {}
}
