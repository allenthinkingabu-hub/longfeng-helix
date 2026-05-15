package com.longfeng.aianalysis.controller;

import com.longfeng.aianalysis.entity.AnalysisTask;
import com.longfeng.aianalysis.repo.AnalysisTaskRepository;
import com.longfeng.aianalysis.service.AnalysisStreamHub;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * POST /api/ai/cancel/{taskId} · Cancel an ongoing analysis.
 * Idempotent: unknown taskId returns 200 with status CANCELLED.
 */
@RestController
@RequestMapping("/api/ai")
public class AiCancelController {

    private static final Logger log = LoggerFactory.getLogger(AiCancelController.class);

    private final AnalysisStreamHub streamHub;
    private final AnalysisTaskRepository taskRepo;

    public AiCancelController(AnalysisStreamHub streamHub, AnalysisTaskRepository taskRepo) {
        this.streamHub = streamHub;
        this.taskRepo = taskRepo;
    }

    @PostMapping("/cancel/{taskId}")
    public ResponseEntity<Map<String, String>> cancel(@PathVariable String taskId) {
        log.info("Cancel requested: taskId={}", taskId);
        streamHub.dispose(taskId);

        taskRepo.findByTaskId(taskId).ifPresent(t -> {
            if (AnalysisTask.STATUS_ANALYZING.equals(t.getStatus())) {
                t.setStatus(AnalysisTask.STATUS_CANCELLED);
                taskRepo.save(t);
            }
        });

        return ResponseEntity.ok(Map.of("status", "CANCELLED"));
    }
}
