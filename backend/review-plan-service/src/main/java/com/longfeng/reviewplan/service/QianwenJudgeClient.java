package com.longfeng.reviewplan.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.longfeng.reviewplan.config.JudgeProperties;
import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

/**
 * SC20-T02 · primary judge client · 调阿里云 DashScope qwen-vl-max (multimodal · image vision).
 *
 * <p>沿 ai-analysis-service QianwenAiProvider 模式 · OpenAI-compat /chat/completions endpoint ·
 * Bearer DASHSCOPE_API_KEY 鉴权 · response_format=json_object 强制 JSON. 与 QianwenAiProvider 解耦:
 * 本类只做 judge 用例 · 不写 OCR / analyze 方法.
 *
 * <p>IT 用 @MockBean 替换 · 不真调 DashScope (不耗 token · 不抖网络).
 */
@Component
public class QianwenJudgeClient implements AnswerJudgeAiClient {

    public static final String NAME = "qianwen";

    private static final Logger log = LoggerFactory.getLogger(QianwenJudgeClient.class);

    private final RestTemplate http;
    private final ObjectMapper json;
    private final String baseUrl;
    private final String apiKey;
    private final String visionModel;

    public QianwenJudgeClient(
            JudgeProperties props,
            RestTemplateBuilder builder,
            ObjectMapper mapper,
            @Value("${longfeng.ai.qianwen.base-url:https://dashscope.aliyuncs.com/compatible-mode/v1}")
            String baseUrl,
            @Value("${longfeng.ai.qianwen.api-key:}") String apiKey,
            @Value("${longfeng.ai.judge.vision-model:qwen-vl-max}") String visionModel) {
        Duration timeout = Duration.ofMillis(props.getTimeoutPrimaryMs());
        this.http = builder.setConnectTimeout(timeout).setReadTimeout(timeout).build();
        this.json = mapper;
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
        this.visionModel = visionModel;
    }

    @Override
    public String name() {
        return NAME;
    }

    @Override
    public String judge(String systemPrompt, String userPrompt, String imageUrl) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new AnswerJudgeAiException("qianwen-judge: api-key not configured (set DASHSCOPE_API_KEY)");
        }
        try {
            ObjectNode body = json.createObjectNode();
            body.put("model", visionModel);
            body.putObject("response_format").put("type", "json_object");
            ArrayNode messages = body.putArray("messages");
            messages.addObject()
                    .put("role", "system")
                    .put("content", systemPrompt);
            ObjectNode userMsg = messages.addObject();
            userMsg.put("role", "user");
            if (imageUrl != null && !imageUrl.isBlank()) {
                ArrayNode content = userMsg.putArray("content");
                content.addObject().put("type", "text").put("text", userPrompt);
                ObjectNode imgPart = content.addObject();
                imgPart.put("type", "image_url");
                imgPart.putObject("image_url").put("url", imageUrl);
            } else {
                userMsg.put("content", userPrompt);
            }

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(apiKey);
            String url = stripTrailingSlash(baseUrl) + "/chat/completions";
            HttpEntity<String> req = new HttpEntity<>(json.writeValueAsString(body), headers);

            ResponseEntity<String> resp = http.exchange(url, HttpMethod.POST, req, String.class);
            if (resp.getStatusCode().isError() || resp.getBody() == null) {
                throw new AnswerJudgeAiException("qianwen-judge: HTTP " + resp.getStatusCode().value());
            }
            JsonNode tree = json.readTree(resp.getBody());
            String content = tree.path("choices").path(0).path("message").path("content").asText("").trim();
            if (content.isEmpty()) {
                throw new AnswerJudgeAiException("qianwen-judge: empty completion content");
            }
            return content;
        } catch (AnswerJudgeAiException e) {
            throw e;
        } catch (RestClientException e) {
            throw new AnswerJudgeAiException("qianwen-judge: transport failure: " + e.getMessage(), e);
        } catch (Exception e) {
            throw new AnswerJudgeAiException("qianwen-judge failed: " + e.getMessage(), e);
        }
    }

    private static String stripTrailingSlash(String s) {
        if (s == null) return "";
        return s.endsWith("/") ? s.substring(0, s.length() - 1) : s;
    }
}
