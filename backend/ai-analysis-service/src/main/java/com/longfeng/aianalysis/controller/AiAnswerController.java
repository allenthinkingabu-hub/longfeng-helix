package com.longfeng.aianalysis.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.longfeng.aianalysis.entity.AnalysisResult;
import com.longfeng.aianalysis.entity.AnalysisTask;
import com.longfeng.aianalysis.repo.AnalysisResultRepository;
import com.longfeng.aianalysis.repo.AnalysisTaskRepository;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * GET /api/ai/{qid}/answer · MP P04 result page · AI answer retrieval.
 *
 * <p>Looks up {@link AnalysisResult} by {@code task_id == qid} (the task_id↔qid closure
 * established by Coder via {@code AnalyzeController.analyze} honoring caller-provided taskId).
 *
 * <p>Response contract (FE {@code AiAnswer} in {@code src/api/ai.ts}):
 * <pre>
 *   {
 *     qid:            string,           // == request qid (closure anchor)
 *     taskId:         string,           // == request qid (BE honored caller taskId)
 *     reasonMarkdown: string,           // analysis_result.error_reason
 *     confidence:    number,           // 0..1 · best-effort proxy when not surfaced upstream
 *     provider:       string,           // analysis_result.provider · e.g. "qianwen"
 *     modelInfo:      { name, version },// {provider, model}
 *     steps:          [{stepNo,text}],  // parsed from analysis_result.steps JSON
 *   }
 * </pre>
 *
 * <p>404 contract: PG analysis_result has no row for task_id=qid → 404 NotFound + body
 * {@code {code: "AI_ANSWER_NOT_FOUND", message: "..."}}.
 * <p>200 + empty body contract: row exists but analysis_task.status=FAILED →
 * {@code {qid, taskId, reasonMarkdown:"", steps:[], provider, modelInfo:{name, version:"fail"}}}.
 *
 * <p>trace: SC01-MP-BUG-AI-FAKE · test-cases.md · ## 字段映射 contract + ## 实现注释 #3.
 */
@RestController
@RequestMapping("/api/ai")
public class AiAnswerController {

    private static final Logger log = LoggerFactory.getLogger(AiAnswerController.class);

    private final AnalysisResultRepository resultRepo;
    private final AnalysisTaskRepository taskRepo;
    private final ObjectMapper jsonMapper;

    public AiAnswerController(AnalysisResultRepository resultRepo,
                              AnalysisTaskRepository taskRepo,
                              ObjectMapper jsonMapper) {
        this.resultRepo = resultRepo;
        this.taskRepo = taskRepo;
        this.jsonMapper = jsonMapper;
    }

    @GetMapping("/{qid}/answer")
    public ResponseEntity<Map<String, Object>> answer(@PathVariable String qid) {
        Optional<AnalysisResult> maybeResult = resultRepo.findByTaskId(qid);
        if (maybeResult.isEmpty()) {
            log.info("AI answer 404 · qid={} · no analysis_result row", qid);
            return ResponseEntity.status(404).body(Map.of(
                    "code", "AI_ANSWER_NOT_FOUND",
                    "message", "No AI analysis result for qid " + qid
            ));
        }

        AnalysisResult r = maybeResult.get();
        // Detect FAILED business state (degraded path · 200 + empty body)
        boolean failed = taskRepo.findByTaskId(qid)
                .map(t -> AnalysisTask.STATUS_FAILED.equals(t.getStatus()))
                .orElse(false);

        String provider = r.getProvider() == null ? "" : r.getProvider();
        String model = r.getModel() == null ? "" : r.getModel();

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("qid", qid);
        body.put("taskId", r.getTaskId()); // == qid when closure works
        body.put("provider", provider);

        Map<String, String> modelInfo = new LinkedHashMap<>();
        modelInfo.put("name", provider);
        modelInfo.put("version", failed ? "fail" : model);
        body.put("modelInfo", modelInfo);

        if (failed) {
            // 业务降级：reasonMarkdown 空 · steps 空 · FE 显示 fallback 文案 · 不进 ERROR 态
            body.put("reasonMarkdown", "");
            body.put("steps", List.of());
            body.put("stem", r.getStem() == null ? "" : r.getStem());
            body.put("confidence", 0.0);
            log.info("AI answer 200 (degraded) · qid={} · task FAILED", qid);
            return ResponseEntity.ok(body);
        }

        body.put("reasonMarkdown", r.getErrorReason() == null ? "" : r.getErrorReason());
        body.put("steps", parseSteps(r.getSteps()));
        // OCR'd stem lives on analysis_result.stem · wrongbook-service does not persist it
        // back to wb_question, so P04 needs the AI sidecar to surface stem too. Otherwise
        // the result page shows the AI diagnosis with an empty 题干 banner.
        body.put("stem", r.getStem() == null ? "" : r.getStem());
        // 当前 schema 未持久化 confidence · 给保守 default 0.0 让 FE 不显示置信度
        body.put("confidence", 0.0);
        return ResponseEntity.ok(body);
    }

    private List<Map<String, Object>> parseSteps(String stepsJson) {
        if (stepsJson == null || stepsJson.isBlank()) {
            return List.of();
        }
        try {
            List<Map<String, Object>> raw = jsonMapper.readValue(stepsJson,
                    new TypeReference<List<Map<String, Object>>>() {});
            // Normalize: ensure stepNo + text present so FE rendering is stable.
            List<Map<String, Object>> out = new ArrayList<>(raw.size());
            int n = 0;
            for (Map<String, Object> s : raw) {
                Map<String, Object> norm = new LinkedHashMap<>();
                Object stepNo = s.containsKey("stepNo") ? s.get("stepNo")
                        : s.containsKey("step") ? s.get("step")
                        : (++n);
                norm.put("stepNo", stepNo);
                Object text = s.containsKey("text") ? s.get("text")
                        : s.getOrDefault("content", "");
                norm.put("text", text);
                if (s.containsKey("title")) norm.put("title", s.get("title"));
                if (s.containsKey("formula")) norm.put("formula", s.get("formula"));
                out.add(norm);
            }
            return out;
        } catch (Exception e) {
            log.warn("AI answer steps parse failed: {}", e.getMessage());
            return List.of();
        }
    }
}
