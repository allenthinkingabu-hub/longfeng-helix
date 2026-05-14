package com.longfeng.aianalysis.controller;

import com.longfeng.aianalysis.entity.AnalysisResult;
import com.longfeng.aianalysis.repo.AnalysisResultRepository;
import com.longfeng.aianalysis.repo.AnalysisTaskRepository;
import com.longfeng.aianalysis.service.AnalysisStreamHub;
import com.longfeng.common.dto.AnalysisChunk;
import com.longfeng.common.dto.ApiResult;
import com.longfeng.common.exception.BusinessException;
import com.longfeng.common.exception.ErrCode;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * S4 review domain endpoints (/analysis/*).
 * Distinct from /api/ai/* P03 real-time analysis (AnalyzeController).
 */
@RestController
@RequestMapping("/analysis")
public class AnalysisController {

    private static final Logger log = LoggerFactory.getLogger(AnalysisController.class);

    private final AnalysisResultRepository resultRepo;
    private final AnalysisTaskRepository taskRepo;
    private final AnalysisStreamHub streamHub;

    public AnalysisController(AnalysisResultRepository resultRepo,
                              AnalysisTaskRepository taskRepo,
                              AnalysisStreamHub streamHub) {
        this.resultRepo = resultRepo;
        this.taskRepo = taskRepo;
        this.streamHub = streamHub;
    }

    /** GET /analysis/{itemId} · Latest analysis result for a given item (task). */
    @GetMapping("/{itemId}")
    public ResponseEntity<AnalysisResult> latest(@PathVariable String itemId) {
        AnalysisResult result = resultRepo.findByTaskId(itemId)
                .orElseThrow(() -> new BusinessException(ErrCode.RESOURCE_NOT_FOUND,
                        "msgkey:analysis.error.not_found"));
        return ResponseEntity.ok(result);
    }

    /** GET /analysis/{itemId}/similar · pgvector similar questions (stub). */
    @GetMapping("/{itemId}/similar")
    public ResponseEntity<ApiResult<Object>> similar(@PathVariable String itemId) {
        return ResponseEntity.ok(ApiResult.ok(java.util.List.of()));
    }

    /** GET /analysis/{itemId}/stream · Replay stored explain chunks as SSE. */
    @GetMapping(value = "/{itemId}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@PathVariable String itemId) {
        SseEmitter emitter = new SseEmitter(30_000L);
        resultRepo.findByTaskId(itemId).ifPresentOrElse(
                result -> {
                    try {
                        emitter.send(SseEmitter.event()
                                .name(AnalysisChunk.Type.DONE.name())
                                .data(result));
                        emitter.complete();
                    } catch (Exception e) {
                        emitter.completeWithError(e);
                    }
                },
                () -> {
                    try {
                        emitter.send(SseEmitter.event()
                                .name(AnalysisChunk.Type.FAIL.name())
                                .data(Map.of("errorCode", "analysis.not_found")));
                        emitter.complete();
                    } catch (Exception e) {
                        emitter.completeWithError(e);
                    }
                }
        );
        return emitter;
    }

    /** POST /analysis/{itemId}/retry · Admin-only re-trigger analysis. */
    @PostMapping("/{itemId}/retry")
    public ResponseEntity<Void> retry(@PathVariable String itemId) {
        log.info("Retry requested for itemId={}", itemId);
        return ResponseEntity.status(HttpStatus.ACCEPTED).build();
    }

    /** GET /analysis/provider · Current active provider info. */
    @GetMapping("/provider")
    public ResponseEntity<Map<String, String>> provider() {
        return ResponseEntity.ok(Map.of("active", "qianwen", "status", "healthy"));
    }
}
