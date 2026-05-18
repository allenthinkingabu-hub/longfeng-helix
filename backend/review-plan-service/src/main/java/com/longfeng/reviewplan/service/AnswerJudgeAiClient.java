package com.longfeng.reviewplan.service;

/**
 * SC20-T02 · AI judge SPI · 抽象 Qwen-VL-Max 调用 + JSON 输出.
 *
 * <p>沿 ai-analysis-service AiProvider 模式 · 但 SPI 独立 (review-plan-service 不依赖 ai-analysis-service).
 * 实装类列表 · 由 FallbackOrchestratorLike 按 longfeng.ai.judge.fallback-chain 顺序调用:
 * <ul>
 *   <li>QianwenJudgeClient (primary · name="qianwen") · 真调 DashScope /chat/completions
 *   <li>StubJudgeFallbackClient (fallback · name="qianwen-fallback-stub") · 占位 fallback ·
 *       本期不真实装 secondary AI · 沿 §17 决策 #5 P1 启动 spike 后再补
 * </ul>
 *
 * <p>IT 用 @MockBean 替换为 fake 实现 · 不调真实 DashScope.
 */
public interface AnswerJudgeAiClient {

    /** Provider name · 对应 longfeng.ai.judge.fallback-chain 中的字面. */
    String name();

    /**
     * 调 AI 判作答 · 返 raw JSON 字符串 (符合 prompt schema · 含 verdict/confidence/reason/matched_steps/missed_steps).
     *
     * @param systemPrompt §6.2 system prompt (字面锁定)
     * @param userPrompt   §6.2 user prompt (动态拼装含 stem/canonical_answer/kp_name 等)
     * @param imageUrl     student answer image OSS URL · 多模态 vision input · 可 null (text-only fallback)
     * @return AI raw response · 期望符合 §6.2 JSON schema · 不符时由调用方走 LOW_CONFIDENCE 回退
     * @throws AnswerJudgeAiException 任何失败 (transport / timeout / blank response) · 触发 fallback chain 切换
     */
    String judge(String systemPrompt, String userPrompt, String imageUrl) throws AnswerJudgeAiException;

    /**
     * SC20-T02 AI 调用异常 · 沿 ai-analysis-service AiProvider.AiProviderException 模式.
     * FallbackOrchestratorLike catch 此异常 · 按 fallback-chain 顺序切换下一 provider.
     */
    class AnswerJudgeAiException extends RuntimeException {
        public AnswerJudgeAiException(String message) { super(message); }
        public AnswerJudgeAiException(String message, Throwable cause) { super(message, cause); }
    }
}
