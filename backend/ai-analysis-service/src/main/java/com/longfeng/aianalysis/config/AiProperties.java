package com.longfeng.aianalysis.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * AI provider configuration · prefix {@code longfeng.ai}.
 * <p>
 * Qianwen (Alibaba Cloud Bailian / DashScope) is the only enabled real provider
 * in this repo · OpenAI-compatible endpoint · Bearer token auth.
 * <p>
 * fallback-chain order is read by FallbackOrchestrator; configured providers
 * that lack an implementation (and there is no stub bean registered) are
 * skipped via Rule 12 fail-loud (no silent fall-through to stub).
 */
@Component
@ConfigurationProperties(prefix = "longfeng.ai")
public class AiProperties {

    private List<String> fallbackChain = List.of("qianwen");
    private int streamTimeoutSeconds = 60;
    private int chunkIntervalSeconds = 15;
    private int heartbeatIntervalSeconds = 30;
    private Qianwen qianwen = new Qianwen();

    public List<String> getFallbackChain() { return fallbackChain; }
    public void setFallbackChain(List<String> fallbackChain) { this.fallbackChain = fallbackChain; }
    public int getStreamTimeoutSeconds() { return streamTimeoutSeconds; }
    public void setStreamTimeoutSeconds(int streamTimeoutSeconds) { this.streamTimeoutSeconds = streamTimeoutSeconds; }
    public int getChunkIntervalSeconds() { return chunkIntervalSeconds; }
    public void setChunkIntervalSeconds(int chunkIntervalSeconds) { this.chunkIntervalSeconds = chunkIntervalSeconds; }
    public int getHeartbeatIntervalSeconds() { return heartbeatIntervalSeconds; }
    public void setHeartbeatIntervalSeconds(int heartbeatIntervalSeconds) { this.heartbeatIntervalSeconds = heartbeatIntervalSeconds; }
    public Qianwen getQianwen() { return qianwen; }
    public void setQianwen(Qianwen qianwen) { this.qianwen = qianwen; }

    /**
     * Alibaba Cloud Bailian / DashScope (Qianwen) configuration.
     * Maps to {@code longfeng.ai.qianwen.*} in application.yml.
     */
    public static class Qianwen {
        /** OpenAI-compat base URL · default DashScope. */
        private String baseUrl = "https://dashscope.aliyuncs.com/compatible-mode/v1";
        /** Bearer token. Reads from env DASHSCOPE_API_KEY first (see application.yml). */
        private String apiKey = "";
        /** Multimodal OCR model. */
        private String ocrModel = "qwen-vl-plus";
        /** Chat / analysis model. */
        private String chatModel = "qwen-plus";
        /** HTTP timeout (ms) · per request. */
        private int timeoutMs = 30_000;

        public String getBaseUrl() { return baseUrl; }
        public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }
        public String getApiKey() { return apiKey; }
        public void setApiKey(String apiKey) { this.apiKey = apiKey; }
        public String getOcrModel() { return ocrModel; }
        public void setOcrModel(String ocrModel) { this.ocrModel = ocrModel; }
        public String getChatModel() { return chatModel; }
        public void setChatModel(String chatModel) { this.chatModel = chatModel; }
        public int getTimeoutMs() { return timeoutMs; }
        public void setTimeoutMs(int timeoutMs) { this.timeoutMs = timeoutMs; }
    }
}
