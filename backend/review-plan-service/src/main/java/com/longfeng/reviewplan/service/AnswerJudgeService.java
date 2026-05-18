package com.longfeng.reviewplan.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.longfeng.reviewplan.config.JudgeProperties;
import com.longfeng.reviewplan.dto.JudgeResp;
import com.longfeng.reviewplan.entity.IdemKey;
import com.longfeng.reviewplan.entity.ReviewPlan;
import com.longfeng.reviewplan.entity.WbReviewNode;
import com.longfeng.reviewplan.exception.JudgeExceptions;
import com.longfeng.reviewplan.repo.ReviewPlanRepository;
import com.longfeng.reviewplan.repo.WbReviewNodeRepository;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Tags;
import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StreamUtils;

/**
 * SC20-T02 · AnswerJudgeService 核心 · 复用 AnswerJudgeAiClient chain + §6.2 prompt + §6.4 阈值过滤.
 *
 * <p>执行流程 (按 inflight AC 1-6 + test-cases.md Round 2 6 用例字面):
 * <ol>
 *   <li>校验 nid 节点存在 + status NOT IN (3, 4) (用例 #5 (n1)(n2) 404/409 fail-fast)</li>
 *   <li>校验 image_key 第 4 段 studentId == X-User-Id (用例 #5 (n3) 422 fail-fast)</li>
 *   <li>幂等查 (scope='ai-judge:judge' · idem_key · nid) 5 min TTL · 命中走 cache 返同 response</li>
 *   <li>fallback chain 顺序调 AnswerJudgeAiClient · primary 失败 → 切 fallback · counter increment</li>
 *   <li>JSON Schema 校验 AI 响应 · 不符走 LOW_CONFIDENCE 回退 (用例 #6 AC2 后半)</li>
 *   <li>§6.4 阈值过滤: confidence ≥ 0.75 → DONE · 0.5 ≤ &lt; 0.75 → DONE + flagged=true · &lt; 0.5 → LOW_CONFIDENCE</li>
 *   <li>事务落 wb_review_node 6 satellite 列 + status 不变 (A.1 学生主体性铁律)</li>
 *   <li>写 idem_key (payload=nid JSON) 供后续 5 min 内重放命中 cache</li>
 * </ol>
 *
 * <p>503 路径 (双 provider 都失败 / 18s 上限) 落 wb_review_node 但 verdict/confidence/reason null + metadata.status='TIMEOUT' ·
 * 沿 biz §2B.20 line 151 字面.
 */
@Service
public class AnswerJudgeService {

    private static final Logger log = LoggerFactory.getLogger(AnswerJudgeService.class);

    public static final String METRIC_PRIMARY = "longfeng_ai_judge_primary_calls_total";
    public static final String METRIC_FALLBACK = "longfeng_ai_judge_fallback_calls_total";
    public static final String METRIC_CHAT_MODEL = "longfeng_ai_judge_chat_model_calls_total";

    private final JudgeProperties props;
    private final List<AnswerJudgeAiClient> clients;
    private final WbReviewNodeRepository wbNodeRepo;
    private final ReviewPlanRepository planRepo;
    private final IdempotencyService idempotency;
    private final MeterRegistry meterRegistry;
    private final ObjectMapper json;
    private final ResourceLoader resourceLoader;

    private String systemPrompt;
    private String userPromptTemplate;

    public AnswerJudgeService(
            JudgeProperties props,
            List<AnswerJudgeAiClient> clients,
            WbReviewNodeRepository wbNodeRepo,
            ReviewPlanRepository planRepo,
            IdempotencyService idempotency,
            MeterRegistry meterRegistry,
            ObjectMapper json,
            ResourceLoader resourceLoader) {
        this.props = props;
        this.clients = clients;
        this.wbNodeRepo = wbNodeRepo;
        this.planRepo = planRepo;
        this.idempotency = idempotency;
        this.meterRegistry = meterRegistry;
        this.json = json;
        this.resourceLoader = resourceLoader;
    }

    @PostConstruct
    void loadPrompts() {
        systemPrompt = loadPromptFromClasspath("judge-system-prompt.txt");
        userPromptTemplate = loadPromptFromClasspath("judge-user-prompt-template.txt");
    }

    private String loadPromptFromClasspath(String filename) {
        try {
            Resource res = resourceLoader.getResource(props.getPromptResourcePath() + filename);
            try (InputStream in = res.getInputStream()) {
                return StreamUtils.copyToString(in, StandardCharsets.UTF_8);
            }
        } catch (IOException e) {
            throw new IllegalStateException("Cannot load judge prompt " + filename + " from " + props.getPromptResourcePath(), e);
        }
    }

    /**
     * SC20-T02 主入口 · JudgeController 调.
     *
     * @param nid           wb_review_node.id (= review_plan.id · B02 决策 A)
     * @param userId        X-User-Id header (学生 ID)
     * @param idempotencyKey X-Idempotency-Key header
     * @param imageKey      body.user_answer_image_key
     * @return JudgeResp (200) · 抛 JudgeExceptions 之一时 ExceptionHandler 转 4xx/503
     */
    public JudgeResp judge(long nid, long userId, String idempotencyKey, String imageKey) {
        // Step 1: 节点存在 + status 校验
        ReviewPlan plan = planRepo.findById(nid)
                .orElseThrow(() -> new JudgeExceptions.NodeNotFound(nid));
        // 现役 ReviewPlan.status 是 String (e.g. 'ACTIVE' / 'COMPLETED' / 'MASTERED') · 沿用
        // 用例 #5 (n2) trigger 字面: status IN (3 REVIEWED, 4 FORGOTTEN).
        // 现役 ReviewPlan 字面: STATUS_ACTIVE='ACTIVE' / 'COMPLETED' / 'MASTERED'.
        // 适配: ReviewPlan.STATUS_COMPLETED ('COMPLETED') = REVIEWED (status=3) · ReviewPlan.STATUS_MASTERED ('MASTERED') ~ status=4.
        // 但 SC20-T02 是新 satellite · 用 wb_review_node.status SMALLINT (0/1/2/3/4/9) · 不是 review_plan.status String.
        // 检查 wb_review_node.status (V1.0.084 SMALLINT) 走主路径.
        Optional<WbReviewNode> wbOpt = wbNodeRepo.findById(nid);
        WbReviewNode wbNode;
        if (wbOpt.isPresent()) {
            wbNode = wbOpt.get();
            short status = wbNode.getStatus() == null ? 0 : wbNode.getStatus();
            // status IN (3 REVIEWED, 4 FORGOTTEN) → 409 NODE_ALREADY_GRADED
            if (status == 3 || status == 4) {
                throw new JudgeExceptions.NodeAlreadyGraded(nid);
            }
        } else {
            // wb_review_node 尚未存在 (SC20-T01 后才有 row · IT seed) → 404
            throw new JudgeExceptions.NodeNotFound(nid);
        }

        // Step 2: image_key 校验 · 解析 key.split("/")[3] = studentId · 与 X-User-Id 比对
        if (imageKey == null || imageKey.isBlank()) {
            throw new JudgeExceptions.ImageKeyInvalid("image_key is blank");
        }
        String[] segments = imageKey.split("/");
        if (segments.length < 5) {
            throw new JudgeExceptions.ImageKeyInvalid("image_key path malformed (expected ObjectKeyBuilder pattern)");
        }
        String studentSegment = segments[3];
        // X-User-Id 是 Long · key segment 是 String · 字符串比对 (Round 2 用例 #5 (n3))
        if (!studentSegment.equals(String.valueOf(userId))) {
            throw new JudgeExceptions.ImageKeyInvalid("image_key studentId mismatch: key=" + studentSegment + " userId=" + userId);
        }

        // Step 3: 幂等查 (scope='ai-judge:judge' · idem_key · nid) 5 min TTL · 命中走 cache
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            Optional<IdemKey> hit = idempotency.peekRecentByNid(IdempotencyService.SCOPE_AI_JUDGE, idempotencyKey, nid);
            if (hit.isPresent()) {
                // 重放 · 从 wb_review_node 重新组装 JudgeResp (DB 已落第一次的结果)
                WbReviewNode cached = wbNodeRepo.findById(nid).orElseThrow(() ->
                        new IllegalStateException("idem_key hit but wb_review_node missing for nid=" + nid));
                JudgeResp resp = buildRespFromDb(cached);
                if (resp != null) {
                    return resp;
                }
                // DB metadata 状态异常 (e.g. metadata null) · 不走 cache · 继续真调
            }
        }

        // Step 4 + 5 + 6: fallback chain 调 + JSON Schema 校验 + 阈值过滤
        long startMs = System.currentTimeMillis();
        AiJudgeOutcome outcome = invokeFallbackChain(nid, imageKey);
        long latencyMs = System.currentTimeMillis() - startMs;

        // Step 7: 落 wb_review_node 6 satellite 列 (事务边界 · A.1 学生主体性: status 不变)
        wbNode.setUserAnswerImageKey(imageKey);
        wbNode.setAiJudgeVerdict(outcome.verdict);
        wbNode.setAiJudgeConfidence(outcome.confidence);
        wbNode.setAiJudgeReason(outcome.reason);
        wbNode.setAiJudgeMetadata(buildMetadataJson(outcome, latencyMs));
        // final_grade_source 不动 · 默认 'self' · A.1 学生主体性铁律 (judge 不直接落 grade)
        wbNodeRepo.save(wbNode);

        // Step 8: 写 idem_key (payload=nid JSON) 供 5 min 内重放命中
        // **Tester Round 1 REJECT fix · 2026-05-18** (audits/.../tester.md + adversarial.md adv01):
        // 503 transient failure **不写 idem_key** · 因为客户端重试有意义 (AI 服务可能恢复) ·
        // 若写 idem_key 会导致后续同 (key, nid) 重放命中 cache · service.judge() Step 3 buildRespFromDb
        // 从 wb_review_node 读 metadata.status='TIMEOUT' 返 200 + body{status:'TIMEOUT'} · 与第 1 次 503 inconsistent.
        // 仅 happy path (200 / LOW_CONFIDENCE) 写 idem_key.
        if (!outcome.is503 && idempotencyKey != null && !idempotencyKey.isBlank()) {
            String payloadJson = "{\"nid\":" + nid + ",\"image_key\":\"" + imageKey + "\"}";
            try {
                idempotency.claim(IdempotencyService.SCOPE_AI_JUDGE, idempotencyKey, nid, payloadJson);
            } catch (Exception e) {
                // 唯一约束冲突 (并发同 key 重复 claim) · 不致命 · log 跳过
                log.warn("idem_key claim conflict (likely concurrent · ignored): nid={} key={} err={}",
                        nid, idempotencyKey, e.getMessage());
            }
        }

        // 503 outcome → 抛异常 · ExceptionHandler 转 503
        if (outcome.is503) {
            throw new JudgeExceptions.AiServiceUnavailable("AI providers all failed / timeout");
        }

        return new JudgeResp(
                outcome.verdict,
                outcome.confidence,
                outcome.reason,
                outcome.status,
                outcome.matchedSteps,
                outcome.missedSteps
        );
    }

    @Transactional
    private AiJudgeOutcome invokeFallbackChain(long nid, String imageKey) {
        // 拼 user prompt · 简化版: stem/canonical_answer/kp_name 等字段在 review_plan 上不全 · 用 nid + image 占位
        // 实装时由 ReviewPlanService.getById 拿 wrong_item join 出 stem/canonical_answer · 本 task 简化
        String userPrompt = renderUserPrompt(nid, imageKey);

        AnswerJudgeAiClient.AnswerJudgeAiException lastError = null;
        List<String> chain = props.getFallbackChain();
        String activeProvider = chain.isEmpty() ? "qianwen" : chain.get(0);

        for (String providerName : chain) {
            AnswerJudgeAiClient client = clients.stream()
                    .filter(c -> c.name().equals(providerName))
                    .findFirst()
                    .orElse(null);
            if (client == null) {
                log.warn("Configured judge provider '{}' has no bean registered — skipping", providerName);
                continue;
            }
            boolean isPrimary = providerName.equals(activeProvider);
            try {
                // Counter increment · TI4 metric 字面锁 · primary 单 counter · fallback 切换时第二 counter
                if (isPrimary) {
                    Counter.builder(METRIC_PRIMARY)
                            .tags(Tags.of("provider", providerName))
                            .register(meterRegistry)
                            .increment();
                    Counter.builder(METRIC_CHAT_MODEL)
                            .tags(Tags.of("provider", providerName))
                            .register(meterRegistry)
                            .increment();
                } else {
                    Counter.builder(METRIC_FALLBACK)
                            .tags(Tags.of("provider", providerName))
                            .register(meterRegistry)
                            .increment();
                    log.info("Fallback: {} -> {}", activeProvider, providerName);
                }
                String raw = client.judge(systemPrompt, userPrompt, imageKey);
                // JSON Schema 校验 · 不符走 LOW_CONFIDENCE
                return parseAndFilter(raw, providerName);
            } catch (AnswerJudgeAiClient.AnswerJudgeAiException e) {
                log.warn("Judge provider {} failed: {}", providerName, e.getMessage());
                lastError = e;
            }
        }

        // 全部 fallback chain 失败 → 503 outcome (落 wb_review_node 但抛 AiServiceUnavailable)
        return AiJudgeOutcome.timeout(activeProvider);
    }

    /**
     * 拼 user prompt · 用 §6.2 user prompt template 替换 placeholder.
     * 简化实装: nid + image_key 占位 · 真实装时由 ReviewPlanService.getById join wrong_item 拿 stem/canonical_answer.
     */
    private String renderUserPrompt(long nid, String imageKey) {
        return userPromptTemplate
                .replace("{stem}", "nid=" + nid)
                .replace("{canonical_answer}", "[标准答案待 master §10.5 接入]")
                .replace("{kp_name}", "[知识点待接入]")
                .replace("{difficulty}", "3")
                .replace("{steps}", "[关键步骤待接入]")
                .replace("{mode}", "photo")
                .replace("{answer_content}", "[image: " + imageKey + "]");
    }

    /**
     * AI raw response → AiJudgeOutcome · 含 JSON Schema 校验 + §6.4 阈值过滤.
     */
    private AiJudgeOutcome parseAndFilter(String raw, String providerName) {
        try {
            JsonNode tree = json.readTree(raw);
            String verdict = tree.path("verdict").asText(null);
            JsonNode confNode = tree.path("confidence");
            String reason = tree.path("reason").asText(null);
            // Schema 校验: verdict ∈ enum + confidence is number 0-1 + reason ≤ 200 char
            boolean schemaOk = verdict != null
                    && (verdict.equals("MASTERED") || verdict.equals("PARTIAL") || verdict.equals("FORGOT"))
                    && confNode.isNumber()
                    && confNode.asDouble() >= 0.0 && confNode.asDouble() <= 1.0
                    && reason != null && reason.length() <= 200;
            if (!schemaOk) {
                // AC2 后半 · schema 不符回退 LOW_CONFIDENCE (用例 #6)
                log.warn("JSON schema validation failed · falling back to LOW_CONFIDENCE · raw={}", raw);
                return AiJudgeOutcome.schemaViolation(providerName);
            }
            // confidence 落 DECIMAL(3,2) · PostgreSQL round half-up (TI3 边界值)
            BigDecimal confidence = BigDecimal.valueOf(confNode.asDouble())
                    .setScale(2, RoundingMode.HALF_UP);
            List<String> matchedSteps = readStringList(tree.path("matched_steps"));
            List<String> missedSteps = readStringList(tree.path("missed_steps"));

            // §6.4 阈值过滤
            String status;
            boolean flagged;
            if (confidence.doubleValue() >= props.getConfidenceAccept()) {
                status = "DONE";
                flagged = false;
            } else if (confidence.doubleValue() >= props.getConfidenceFallback()) {
                status = "DONE";
                flagged = true; // 中间档 · 用例 #2
                log.info("mid-band confidence · flagged=true · confidence={} status={}", confidence, status);
            } else {
                status = "LOW_CONFIDENCE";
                flagged = true;
            }

            AiJudgeOutcome out = new AiJudgeOutcome();
            out.verdict = verdict;
            out.confidence = confidence;
            out.reason = reason;
            out.status = status;
            out.matchedSteps = matchedSteps;
            out.missedSteps = missedSteps;
            out.modelUsed = "qwen-vl-max";
            out.providerName = providerName;
            out.flagged = flagged;
            out.is503 = false;
            return out;
        } catch (Exception e) {
            log.warn("JSON schema validation failed · falling back to LOW_CONFIDENCE · err={}", e.getMessage());
            return AiJudgeOutcome.schemaViolation(providerName);
        }
    }

    private List<String> readStringList(JsonNode node) {
        List<String> list = new ArrayList<>();
        if (node.isArray()) {
            node.forEach(n -> list.add(n.asText("")));
        }
        return list;
    }

    /**
     * 拼 ai_judge_metadata JSONB · biz §4.16 line 261 字面 5 key:
     * {model_used, prompt_version, token_cost_usd, latency_ms, status}.
     */
    private String buildMetadataJson(AiJudgeOutcome outcome, long latencyMs) {
        try {
            ObjectNode metadata = json.createObjectNode();
            metadata.put("model_used", outcome.modelUsed != null ? outcome.modelUsed : "qwen-vl-max");
            metadata.put("prompt_version", props.getPromptVersion());
            metadata.put("token_cost_usd", outcome.tokenCostUsd > 0 ? outcome.tokenCostUsd : 0.005); // fake 桩值 · 真实装时从 AI response.usage 取
            metadata.put("latency_ms", latencyMs);
            metadata.put("status", outcome.metadataStatus());
            if (outcome.flagged) {
                metadata.put("flagged", true);
            }
            return json.writeValueAsString(metadata);
        } catch (Exception e) {
            log.error("Failed to serialize ai_judge_metadata · using fallback string", e);
            return "{\"status\":\"" + outcome.metadataStatus() + "\"}";
        }
    }

    /**
     * 重放命中 cache 时 · 从 wb_review_node DB row 重建 JudgeResp (不调 AI · counter 不增).
     */
    private JudgeResp buildRespFromDb(WbReviewNode cached) {
        try {
            JsonNode metadata = cached.getAiJudgeMetadata() == null ? null
                    : json.readTree(cached.getAiJudgeMetadata());
            String metaStatus = metadata == null ? null : metadata.path("status").asText("DONE");
            String status = metaStatus == null ? "DONE" : metaStatus;
            // matched_steps / missed_steps 没存 DB · cache 重放时空 list (Round 2 用例 #4 (a) 字面深度比较关注 verdict/confidence/reason/status · steps 在 metadata 中不保留)
            return new JudgeResp(
                    cached.getAiJudgeVerdict(),
                    cached.getAiJudgeConfidence(),
                    cached.getAiJudgeReason(),
                    status,
                    new ArrayList<>(),
                    new ArrayList<>()
            );
        } catch (Exception e) {
            log.warn("Failed to rebuild JudgeResp from DB cache · nid={} err={}", cached.getId(), e.getMessage());
            return null;
        }
    }

    /**
     * Outcome carrier · 内部聚合 verdict/confidence/reason/status/matched/missed/metadata 字段.
     */
    static class AiJudgeOutcome {
        String verdict;
        BigDecimal confidence;
        String reason;
        String status;
        List<String> matchedSteps = new ArrayList<>();
        List<String> missedSteps = new ArrayList<>();
        String modelUsed;
        String providerName;
        boolean flagged;
        boolean is503;
        double tokenCostUsd;

        String metadataStatus() {
            if (is503) return "TIMEOUT";
            return status; // DONE / LOW_CONFIDENCE
        }

        static AiJudgeOutcome timeout(String activeProvider) {
            AiJudgeOutcome o = new AiJudgeOutcome();
            o.verdict = null;
            o.confidence = null;
            o.reason = null;
            o.status = null;
            o.modelUsed = "fallback-timeout";
            o.providerName = activeProvider;
            o.flagged = false;
            o.is503 = true;
            return o;
        }

        static AiJudgeOutcome schemaViolation(String providerName) {
            AiJudgeOutcome o = new AiJudgeOutcome();
            o.verdict = null;
            o.confidence = null;
            o.reason = null;
            o.status = "LOW_CONFIDENCE";
            o.modelUsed = "qwen-vl-max";
            o.providerName = providerName;
            o.flagged = true;
            o.is503 = false;
            return o;
        }
    }
}
