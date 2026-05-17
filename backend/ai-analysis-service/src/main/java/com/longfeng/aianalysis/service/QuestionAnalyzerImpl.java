package com.longfeng.aianalysis.service;

import com.longfeng.aianalysis.config.AiProperties;
import com.longfeng.aianalysis.entity.AnalysisResult;
import com.longfeng.aianalysis.entity.AnalysisTask;
import com.longfeng.aianalysis.provider.AiProvider;
import com.longfeng.aianalysis.provider.FallbackOrchestrator;
import com.longfeng.aianalysis.repo.AnalysisResultRepository;
import com.longfeng.aianalysis.repo.AnalysisTaskRepository;
import com.longfeng.aianalysis.support.SnowflakeIdGenerator;
import com.longfeng.common.dto.AnalysisChunk;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 4-step analysis pipeline:
 * <ol>
 *   <li>Image preprocessing</li>
 *   <li>OCR (extract question text)</li>
 *   <li>Error diagnosis (AI analysis)</li>
 *   <li>Solution generation</li>
 * </ol>
 * Emits STEP_START/STEP_DONE/PARTIAL_JSON/DONE/FAIL events via AnalysisStreamHub.
 */
@Service
public class QuestionAnalyzerImpl {

    private static final Logger log = LoggerFactory.getLogger(QuestionAnalyzerImpl.class);

    private final AnalysisStreamHub streamHub;
    private final FallbackOrchestrator fallbackOrchestrator;
    private final AiProperties aiProperties;
    private final AnalysisTaskRepository taskRepo;
    private final AnalysisResultRepository resultRepo;
    private final SnowflakeIdGenerator idGen;
    private final ExecutorService executor = Executors.newFixedThreadPool(4);

    public QuestionAnalyzerImpl(AnalysisStreamHub streamHub,
                                FallbackOrchestrator fallbackOrchestrator,
                                AiProperties aiProperties,
                                AnalysisTaskRepository taskRepo,
                                AnalysisResultRepository resultRepo,
                                SnowflakeIdGenerator idGen) {
        this.streamHub = streamHub;
        this.fallbackOrchestrator = fallbackOrchestrator;
        this.aiProperties = aiProperties;
        this.taskRepo = taskRepo;
        this.resultRepo = resultRepo;
        this.idGen = idGen;
    }

    /**
     * Launch async 4-step analysis pipeline. Returns immediately after persisting the task.
     */
    @Transactional
    public AnalysisTask startAnalysis(String taskId, String subject, String imageUrl, Long studentId) {
        AnalysisTask task = new AnalysisTask();
        task.setId(idGen.nextId());
        task.setTaskId(taskId);
        task.setSubject(subject);
        task.setImageUrl(imageUrl);
        task.setStudentId(studentId);
        task.setStatus(AnalysisTask.STATUS_ANALYZING);
        taskRepo.saveAndFlush(task);

        // Async pipeline
        CompletableFuture.runAsync(() -> runPipeline(taskId, subject, imageUrl), executor);
        return task;
    }

    private void runPipeline(String taskId, String subject, String imageUrl) {
        String activeProvider = aiProperties.getFallbackChain().isEmpty()
                ? "stub" : aiProperties.getFallbackChain().get(0);
        try {
            // Step 1: Image preprocessing
            long t1 = System.currentTimeMillis();
            streamHub.emit(taskId, AnalysisChunk.stepStart(1));
            // Simulated preprocessing (validation, resize, etc.)
            Thread.sleep(100);
            streamHub.emit(taskId, AnalysisChunk.stepDone(1, System.currentTimeMillis() - t1));

            // Step 2: OCR
            long t2 = System.currentTimeMillis();
            streamHub.emit(taskId, AnalysisChunk.stepStart(2));
            String stem = fallbackOrchestrator.tryWithFallback(taskId, activeProvider,
                    p -> p.ocr(imageUrl));
            streamHub.putOcrText(taskId, stem);
            streamHub.emit(taskId, AnalysisChunk.partialJson("{\"stem\":\"" + escapeJson(stem) + "\"}"));
            streamHub.emit(taskId, AnalysisChunk.stepDone(2, System.currentTimeMillis() - t2));

            // Step 3: Error diagnosis
            long t3 = System.currentTimeMillis();
            streamHub.emit(taskId, AnalysisChunk.stepStart(3));
            AiProvider.AnalysisResponse analysis = fallbackOrchestrator.tryWithFallback(
                    taskId, activeProvider, p -> p.analyze(stem, subject));
            streamHub.emit(taskId, AnalysisChunk.partialJson(
                    "{\"errorReason\":\"" + escapeJson(analysis.errorReason()) + "\"}"));
            streamHub.emit(taskId, AnalysisChunk.stepDone(3, System.currentTimeMillis() - t3));

            // Step 4: Solution generation (persist result)
            long t4 = System.currentTimeMillis();
            streamHub.emit(taskId, AnalysisChunk.stepStart(4));
            persistResult(taskId, stem, analysis);
            streamHub.emit(taskId, AnalysisChunk.stepDone(4, System.currentTimeMillis() - t4));

            // DONE
            AnalysisResult result = resultRepo.findByTaskId(taskId).orElse(null);
            streamHub.emit(taskId, AnalysisChunk.done(result));
            streamHub.complete(taskId);

            // Update task status
            taskRepo.findByTaskId(taskId).ifPresent(t -> {
                t.setStatus(AnalysisTask.STATUS_DONE);
                taskRepo.save(t);
            });

        } catch (AiProvider.AiProviderException e) {
            log.error("Analysis pipeline failed for taskId={}: {}", taskId, e.getMessage());
            streamHub.emit(taskId, AnalysisChunk.fail(e.getMessage()));
            streamHub.complete(taskId);
            markFailed(taskId);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            streamHub.emit(taskId, AnalysisChunk.fail("ai.interrupted"));
            streamHub.complete(taskId);
            markFailed(taskId);
        } catch (Exception e) {
            log.error("Unexpected error in pipeline for taskId={}", taskId, e);
            streamHub.emit(taskId, AnalysisChunk.fail("ai.internal"));
            streamHub.complete(taskId);
            markFailed(taskId);
        }
    }

    void persistResult(String taskId, String stem, AiProvider.AnalysisResponse analysis) {
        AnalysisResult result = new AnalysisResult();
        result.setId(idGen.nextId());
        result.setTaskId(taskId);
        result.setStem(stem);
        result.setErrorReason(analysis.errorReason());
        result.setSteps(analysis.steps());
        result.setKnowledgePoints(analysis.knowledgePoints());
        result.setProvider(analysis.provider());
        result.setModel(analysis.model());
        result.setUsageTokens(analysis.tokens());
        resultRepo.saveAndFlush(result);
    }

    private void markFailed(String taskId) {
        taskRepo.findByTaskId(taskId).ifPresent(t -> {
            t.setStatus(AnalysisTask.STATUS_FAILED);
            taskRepo.save(t);
        });
    }

    private static String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"")
                .replace("\n", "\\n").replace("\r", "\\r");
    }
}
