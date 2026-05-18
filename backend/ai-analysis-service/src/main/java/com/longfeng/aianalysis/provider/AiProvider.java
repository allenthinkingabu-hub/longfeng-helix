package com.longfeng.aianalysis.provider;

/**
 * SPI for AI model invocation. Each provider (qianwen, openai, zhipu) implements this interface.
 * FallbackOrchestrator chains providers for resilience.
 */
public interface AiProvider {

    /** Provider name (e.g. "qianwen", "openai", "zhipu"). */
    String name();

    /** Invoke OCR: extract question text from image URL. */
    String ocr(String imageUrl) throws AiProviderException;

    /** Invoke analysis: diagnose error reason + generate solution steps. */
    AnalysisResponse analyze(String stem, String subject) throws AiProviderException;

    /**
     * 2026-05-18 SC-16-T03 · P-WEEKLY-REVIEW AI 复盘文案生成 ·
     * 兑现 wxml "WEEKLY INSIGHT · 智能体复盘" 承诺 (旧 if/else 模板已废).
     *
     * <p>调 chat model (非 vision) · 喂周聚合摘要 · 输出 ≤ 50 字自然语言点评.
     * Cache + fallback 由调用方 (review-plan-service AiInsightClient) 负责.
     */
    WeeklyInsightResponse generateWeeklyInsight(WeeklyInsightInput input) throws AiProviderException;

    /**
     * @param knowledgePoints JSON array string of {name:string} · 可为空数组 "[]" ·
     *   新版 (2026-05-17 followup) 加 · P09 KP 显示和 KpChart 依赖.
     */
    record AnalysisResponse(String errorReason, String steps, String knowledgePoints,
                            String provider, String model, int tokens) {}

    /**
     * 周复盘 AI 输入摘要. masteryRate/masteryDelta 0..1 fraction (调用方 ×100 显). 可空字段:
     * masteryDelta=null (上周无数据 · 不显 delta) · weakKpName=null (无 KP 数据).
     */
    record WeeklyInsightInput(
        String week,                // "2026-W21"
        Double masteryRate,         // 0..1 · 整周 SM-2 折算
        Double masteryDelta,        // null=上周无对比
        String weakKpName,          // null/empty=无薄弱 KP
        int weakKpMissCount,        // weakKpName 不为空时的本周错次数
        int reviewedCount,          // 本周已复习题数
        int newCount                // 本周新增错题数
    ) {}

    record WeeklyInsightResponse(String text, String provider, String model, int tokens) {}

    class AiProviderException extends RuntimeException {
        public AiProviderException(String message) { super(message); }
        public AiProviderException(String message, Throwable cause) { super(message, cause); }
    }
}
