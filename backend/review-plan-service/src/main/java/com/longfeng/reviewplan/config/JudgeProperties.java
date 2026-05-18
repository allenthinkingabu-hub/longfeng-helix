package com.longfeng.reviewplan.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * SC20-T02 · longfeng.ai.judge.* 配置 binding (沿现役 longfeng.ai.* namespace 加 .judge 子段).
 *
 * <p>biz §6.4 阈值 + SLA + yml key 字面: confidence-accept=0.75 / confidence-fallback=0.5 /
 * timeout-primary-ms=8000 / timeout-fallback-ms=10000 / enable-photo-input=true /
 * image-retention-days=30 + fallback-chain list (primary qianwen + qianwen-fallback-stub).
 */
@Component
@ConfigurationProperties(prefix = "longfeng.ai.judge")
public class JudgeProperties {

    /** 阈值: confidence ≥ accept → status=DONE 不 flag (高置信). */
    private double confidenceAccept = 0.75;

    /** 阈值: fallback ≤ confidence < accept → status=DONE flag=true (中间档). confidence < fallback → status=LOW_CONFIDENCE. */
    private double confidenceFallback = 0.5;

    /** 主 provider timeout (ms). biz §6.4 字面: Qwen-VL primary 8s. */
    private int timeoutPrimaryMs = 8000;

    /** 备 provider timeout (ms). biz §6.4 字面: fallback 10s. 主 8s + 备 10s = 18s SLA 上限. */
    private int timeoutFallbackMs = 10000;

    /** kill switch · false → JudgeController 整体返 403 (本期不实装 · 字段保留供 ops 切换). */
    private boolean enablePhotoInput = true;

    /** OSS lifecycle: 拍照原图保留天数 · §17 决策 #2 字面 30 天. 本期不实装 lifecycle rule (OPS 范畴). */
    private int imageRetentionDays = 30;

    /** Fallback chain · primary 为第一个 · 后续为 fallback. 沿 longfeng.ai.fallback-chain pattern. */
    private List<String> fallbackChain = List.of("qianwen", "qianwen-fallback-stub");

    /** Judge prompt 资源路径前缀 (允许 ops 覆盖 prompt 文案). */
    private String promptResourcePath = "classpath:/prompts/";

    /** Prompt version · 落 ai_judge_metadata.prompt_version 字段 (biz §4.16 line 261 字面). */
    private String promptVersion = "v1";

    public double getConfidenceAccept() { return confidenceAccept; }
    public void setConfidenceAccept(double v) { this.confidenceAccept = v; }
    public double getConfidenceFallback() { return confidenceFallback; }
    public void setConfidenceFallback(double v) { this.confidenceFallback = v; }
    public int getTimeoutPrimaryMs() { return timeoutPrimaryMs; }
    public void setTimeoutPrimaryMs(int v) { this.timeoutPrimaryMs = v; }
    public int getTimeoutFallbackMs() { return timeoutFallbackMs; }
    public void setTimeoutFallbackMs(int v) { this.timeoutFallbackMs = v; }
    public boolean isEnablePhotoInput() { return enablePhotoInput; }
    public void setEnablePhotoInput(boolean v) { this.enablePhotoInput = v; }
    public int getImageRetentionDays() { return imageRetentionDays; }
    public void setImageRetentionDays(int v) { this.imageRetentionDays = v; }
    public List<String> getFallbackChain() { return fallbackChain; }
    public void setFallbackChain(List<String> v) { this.fallbackChain = v; }
    public String getPromptResourcePath() { return promptResourcePath; }
    public void setPromptResourcePath(String v) { this.promptResourcePath = v; }
    public String getPromptVersion() { return promptVersion; }
    public void setPromptVersion(String v) { this.promptVersion = v; }
}
