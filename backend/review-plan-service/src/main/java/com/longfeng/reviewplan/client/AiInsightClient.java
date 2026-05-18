package com.longfeng.reviewplan.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpEntity;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

/**
 * SC-16-T03 (2026-05-18) · 调 ai-analysis-service /api/ai/insight/weekly 拿真 AI 生成的
 * P-WEEKLY-REVIEW 复盘文本. 兑现 wxml "WEEKLY INSIGHT · 智能体复盘" 承诺.
 *
 * <p>设计:
 * <ul>
 *   <li>不走 Feign · review-plan-service feign.enabled=false (SC-01 决策) ·
 *       直接 RestTemplate · 配置 ai.service.url 注入.
 *   <li>In-memory ConcurrentHashMap cache · key {sid}:{week} · TTL 7 天.
 *       周维度复盘稳定 · 同周内多次进 P-WEEKLY-REVIEW 走 cache · 减 AI 调用费.
 *   <li>调用失败 / timeout / 5xx → 返 null · 调用方 (WeeklyController) fall back 到
 *       旧 if/else 模板. UI 永远有内容 · 无下限风险.
 * </ul>
 */
@Component
public class AiInsightClient {

    private static final Logger log = LoggerFactory.getLogger(AiInsightClient.class);
    private static final Duration CACHE_TTL = Duration.ofDays(7);

    private final RestTemplate restTemplate;
    private final ObjectMapper json;
    private final Clock clock;
    private final String aiServiceUrl;
    private final ConcurrentHashMap<String, CachedInsight> cache = new ConcurrentHashMap<>();

    public AiInsightClient(
            RestTemplate restTemplate,
            ObjectMapper json,
            Clock clock,
            @Value("${ai.service.url:http://localhost:8083}") String aiServiceUrl) {
        this.restTemplate = restTemplate;
        this.json = json;
        this.clock = clock;
        this.aiServiceUrl = aiServiceUrl;
    }

    /**
     * 拿 AI 周复盘文本 · cache miss 才调 8083 · 失败返 null 让调用方 fallback.
     *
     * @return {insightId, text, generatedAt} 全字段 · 失败时 null
     */
    public Insight fetchWeekly(WeeklyInsightInput input) {
        String cacheKey = input.studentId() + ":" + input.week();
        Instant now = clock.instant();

        CachedInsight cached = cache.get(cacheKey);
        if (cached != null && cached.expiresAt().isAfter(now)) {
            return cached.insight();
        }

        try {
            ObjectNode body = json.createObjectNode();
            body.put("week", input.week());
            body.put("studentId", input.studentId());
            if (input.masteryRate() != null) body.put("masteryRate", input.masteryRate());
            if (input.masteryDelta() != null) body.put("masteryDelta", input.masteryDelta());
            if (input.weakKpName() != null) body.put("weakKpName", input.weakKpName());
            body.put("weakKpMissCount", input.weakKpMissCount());
            body.put("reviewedCount", input.reviewedCount());
            body.put("newCount", input.newCount());

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<String> entity = new HttpEntity<>(body.toString(), headers);

            String url = aiServiceUrl + "/api/ai/insight/weekly";
            String respBody = restTemplate.postForObject(url, entity, String.class);
            if (respBody == null) {
                log.warn("ai insight: empty response from {}", url);
                return null;
            }

            JsonNode parsed = json.readTree(respBody);
            int code = parsed.path("code").asInt(-1);
            if (code != 0) {
                log.warn("ai insight: code={} message={}", code, parsed.path("message").asText(""));
                return null;
            }
            JsonNode data = parsed.path("data");
            String text = data.path("text").asText("");
            String insightId = data.path("insightId").asText("");
            String generatedAt = data.path("generatedAt").asText("");
            if (text.isEmpty()) {
                log.warn("ai insight: empty text in response");
                return null;
            }

            Insight insight = new Insight(insightId, text, generatedAt);
            cache.put(cacheKey, new CachedInsight(insight, now.plus(CACHE_TTL)));
            return insight;
        } catch (RestClientException e) {
            log.warn("ai insight call failed (will fallback): {}", e.getMessage());
            return null;
        } catch (Exception e) {
            log.warn("ai insight unexpected error (will fallback): {}", e.getMessage());
            return null;
        }
    }

    /** Test 用 · 清缓存. */
    public void clearCache() {
        cache.clear();
    }

    public record WeeklyInsightInput(
            String week,
            long studentId,
            Double masteryRate,
            Double masteryDelta,
            String weakKpName,
            int weakKpMissCount,
            int reviewedCount,
            int newCount) {}

    public record Insight(String insightId, String text, String generatedAt) {}

    private record CachedInsight(Insight insight, Instant expiresAt) {}

    @org.springframework.context.annotation.Configuration
    static class Beans {
        @org.springframework.context.annotation.Bean
        @org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean
        RestTemplate restTemplate() {
            return new RestTemplate();
        }
    }
}
