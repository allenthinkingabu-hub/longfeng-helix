package com.longfeng.aianalysis.controller;

import com.longfeng.aianalysis.service.AnalysisStreamHub;
import com.longfeng.common.dto.AnalysisChunk;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * POST /api/ai/fallback/{taskId} · Trigger manual fallback (hand-fill form route).
 * SC-01-C04: emits fail("ai.fallback.manual") + dispose + returns ocrText for FE pre-fill.
 * Idempotent: repeated calls on same taskId return same shape.
 */
@RestController
@RequestMapping("/api/ai")
public class AiFallbackController {

    private static final Logger log = LoggerFactory.getLogger(AiFallbackController.class);

    private final AnalysisStreamHub streamHub;

    public AiFallbackController(AnalysisStreamHub streamHub) {
        this.streamHub = streamHub;
    }

    @PostMapping("/fallback/{taskId}")
    public ResponseEntity<Map<String, Object>> fallback(@PathVariable String taskId) {
        log.info("Fallback requested: taskId={}", taskId);

        String ocrText = streamHub.getOcrText(taskId);
        streamHub.emit(taskId, AnalysisChunk.fail("ai.fallback.manual"));
        streamHub.dispose(taskId);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", "FALLBACK");
        body.put("route", "manual_form");
        body.put("taskId", taskId);
        body.put("ocrText", ocrText);
        return ResponseEntity.ok(body);
    }
}
