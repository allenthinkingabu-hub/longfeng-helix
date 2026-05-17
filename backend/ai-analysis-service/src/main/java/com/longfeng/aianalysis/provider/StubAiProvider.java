package com.longfeng.aianalysis.provider;

import org.springframework.stereotype.Component;

/**
 * Stub AI provider for development/testing. Returns simulated results.
 * Production providers (qianwen/openai/zhipu) will implement AiProvider with real API calls.
 */
@Component
public class StubAiProvider implements AiProvider {

    @Override
    public String name() {
        return "stub";
    }

    @Override
    public String ocr(String imageUrl) {
        return "已知 f(x) = x² + 2x + 1，求 f(x) 的最小值。";
    }

    @Override
    public AnalysisResponse analyze(String stem, String subject) {
        String steps = """
                [{"step":1,"title":"理解题意","content":"题目要求求二次函数 f(x) = x² + 2x + 1 的最小值"},\
                {"step":2,"title":"配方法","content":"f(x) = (x+1)² ≥ 0"},\
                {"step":3,"title":"求最小值","content":"当 x = -1 时，f(x) 取最小值 0"}]""";
        String kps = "[{\"name\":\"配方法\"},{\"name\":\"二次函数\"}]";
        return new AnalysisResponse(
                "未正确使用配方法求二次函数最值",
                steps,
                kps,
                "stub",
                "stub-v1",
                150
        );
    }
}
