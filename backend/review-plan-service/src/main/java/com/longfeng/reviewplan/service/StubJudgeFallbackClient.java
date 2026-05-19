package com.longfeng.reviewplan.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * SC20-T02 · fallback judge client placeholder · 沿 longfeng.ai.judge.fallback-chain 第 2 位.
 *
 * <p>本期 §17 决策 #5 spike 完成前 · fallback 仅是占位 · 必抛 AnswerJudgeAiException ·
 * 让 FallbackOrchestratorLike 知 fallback 也失败 · 终态返 503 + ai_judge_metadata.status='TIMEOUT'.
 * spike 后接入 GPT-4o / 其他 vision provider 时替换实装.
 *
 * <p>注: 本 fallback 字面 name="qianwen-fallback-stub" 与 test-cases.md Round 2 用例 #3 metric counter
 * label 字面 `provider="qianwen-fallback-stub"` 严匹配.
 */
@Component
public class StubJudgeFallbackClient implements AnswerJudgeAiClient {

    public static final String NAME = "qianwen-fallback-stub";

    private static final Logger log = LoggerFactory.getLogger(StubJudgeFallbackClient.class);

    @Override
    public String name() {
        return NAME;
    }

    @Override
    public String judge(String systemPrompt, String userPrompt, String imageUrl) {
        log.info("qianwen-fallback-stub: fallback chain reached · returning AnswerJudgeAiException (no real backup AI provider configured yet · 17 decision 5 P1 spike pending).");
        throw new AnswerJudgeAiException("qianwen-fallback-stub: fallback also failed (placeholder · spike pending)");
    }
}
