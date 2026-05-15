package com.longfeng.aianalysis.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "longfeng.ai")
public class AiProperties {

    private List<String> fallbackChain = List.of("qianwen", "openai", "zhipu");
    private int streamTimeoutSeconds = 60;
    private int chunkIntervalSeconds = 15;
    private int heartbeatIntervalSeconds = 30;

    public List<String> getFallbackChain() { return fallbackChain; }
    public void setFallbackChain(List<String> fallbackChain) { this.fallbackChain = fallbackChain; }
    public int getStreamTimeoutSeconds() { return streamTimeoutSeconds; }
    public void setStreamTimeoutSeconds(int streamTimeoutSeconds) { this.streamTimeoutSeconds = streamTimeoutSeconds; }
    public int getChunkIntervalSeconds() { return chunkIntervalSeconds; }
    public void setChunkIntervalSeconds(int chunkIntervalSeconds) { this.chunkIntervalSeconds = chunkIntervalSeconds; }
    public int getHeartbeatIntervalSeconds() { return heartbeatIntervalSeconds; }
    public void setHeartbeatIntervalSeconds(int heartbeatIntervalSeconds) { this.heartbeatIntervalSeconds = heartbeatIntervalSeconds; }
}
