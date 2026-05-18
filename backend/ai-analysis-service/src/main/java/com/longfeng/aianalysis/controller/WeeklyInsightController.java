package com.longfeng.aianalysis.controller;

import com.longfeng.aianalysis.config.AiProperties;
import com.longfeng.aianalysis.provider.AiProvider;
import com.longfeng.aianalysis.provider.FallbackOrchestrator;
import com.longfeng.common.dto.ApiResult;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * SC-16-T03 (2026-05-18) · P-WEEKLY-REVIEW AI 周复盘文本生成 endpoint.
 *
 * <p>调用方: review-plan-service WeeklyController · 喂周聚合摘要 · 出 ≤ 50 字自然语言点评.
 * 兑现 wxml "WEEKLY INSIGHT · 智能体复盘" 承诺 (废旧 if/else 模板).
 *
 * <p>Cache + fallback 由调用方负责 (本 service 无状态).
 */
@RestController
@RequestMapping("/api/ai/insight")
public class WeeklyInsightController {

    private static final Logger log = LoggerFactory.getLogger(WeeklyInsightController.class);

    private final FallbackOrchestrator orchestrator;
    private final AiProperties aiProps;

    public WeeklyInsightController(FallbackOrchestrator orchestrator, AiProperties aiProps) {
        this.orchestrator = orchestrator;
        this.aiProps = aiProps;
    }

    @PostMapping("/weekly")
    public ResponseEntity<ApiResult<WeeklyInsightResp>> generate(@Valid @RequestBody WeeklyInsightReq req) {
        String activeProvider = aiProps.getFallbackChain().isEmpty()
                ? "stub" : aiProps.getFallbackChain().get(0);

        AiProvider.WeeklyInsightInput input = new AiProvider.WeeklyInsightInput(
                req.week(),
                req.masteryRate(),
                req.masteryDelta(),
                req.weakKpName(),
                req.weakKpMissCount() == null ? 0 : req.weakKpMissCount(),
                req.reviewedCount() == null ? 0 : req.reviewedCount(),
                req.newCount() == null ? 0 : req.newCount());

        try {
            AiProvider.WeeklyInsightResponse resp = orchestrator.tryWithFallback(
                    "weekly-insight-" + req.week() + "-" + req.studentId(),
                    activeProvider,
                    p -> p.generateWeeklyInsight(input));

            String insightId = "WI-" + req.week() + "-stu" + req.studentId();
            return ResponseEntity.ok(ApiResult.ok(new WeeklyInsightResp(
                    insightId, resp.text(), Instant.now().toString(),
                    resp.provider(), resp.model(), resp.tokens())));
        } catch (AiProvider.AiProviderException e) {
            log.warn("weekly insight AI all-providers-failed: {}", e.getMessage());
            // 不在此 fall back 到模板 · 让调用方 (review-plan-service) 自己 fall back 旧文案 ·
            // 因为模板文案设计在 review-plan-service · 保 ai-analysis-service 单一职责.
            return ResponseEntity.status(503).body(ApiResult.fail(50301, "ai.insight.unavailable"));
        }
    }

    public record WeeklyInsightReq(
            @NotBlank String week,
            @NotNull Long studentId,
            Double masteryRate,
            Double masteryDelta,
            String weakKpName,
            Integer weakKpMissCount,
            Integer reviewedCount,
            Integer newCount) {}

    public record WeeklyInsightResp(
            String insightId, String text, String generatedAt,
            String provider, String model, int tokens) {}
}
