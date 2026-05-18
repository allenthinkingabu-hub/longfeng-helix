package com.longfeng.anonymousservice.config;

import java.time.Duration;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

/**
 * SC-12-T06 · Real HTTP client bean used by {@code AnonAnalyzeService} to
 * forward to {@code ai-analysis-service:8083}.
 *
 * <p>Choice: {@code RestTemplate} (Servlet-blocking) rather than {@code WebClient}.
 * Anonymous-service runs on {@code spring-boot-starter-web} (Servlet stack) and
 * already pulls {@code spring-web} transitively, so {@code RestTemplate} is on
 * the classpath without any new starter dependency. Adding
 * {@code spring-boot-starter-webflux} just for one outbound call would risk
 * double-binding (Servlet + Reactive both up) and bloat the boot footprint.
 * The trade-off is acceptable: {@code POST /api/anon/analyze-by-url} is a
 * single forward step (fire-and-forget 202 from upstream), so blocking I/O
 * fits naturally inside the Servlet thread for P0.
 *
 * <p>User iron rule (2026-05-18) · <b>NO MOCK</b>: the bean returned here is
 * the real {@code RestTemplate} that ITs use too. The 502 path IT
 * ({@code analyze_when_ai_service_down_returns_502}) does NOT mock this bean;
 * it simply repoints {@code anon.ai-analysis.base-url} via
 * {@code @TestPropertySource} at an unreachable port, so the RestTemplate
 * gets a real connection-refused from the kernel.
 *
 * <p>Timeouts are sourced from {@link AiAnalysisProperties} so a deployment can
 * tune them per environment without code change.
 */
@Configuration
public class AnonRestTemplateConfig {

    /** Bean name pinned so the consumer can {@code @Qualifier("aiAnalysisRestTemplate")} it. */
    public static final String BEAN_NAME = "aiAnalysisRestTemplate";

    @Bean(name = BEAN_NAME)
    public RestTemplate aiAnalysisRestTemplate(AiAnalysisProperties props,
                                               RestTemplateBuilder builder) {
        // NB: Spring Boot 3.2.x uses setConnectTimeout/setReadTimeout (NOT the
        // SB-3.4+ connectTimeout/readTimeout DSL). Calling .connectTimeout(...)
        // here trips a "cannot find symbol" compile error against this parent
        // POM's resolved spring-boot version.
        return builder
                .setConnectTimeout(Duration.ofMillis(props.getConnectTimeoutMs()))
                .setReadTimeout(Duration.ofMillis(props.getReadTimeoutMs()))
                .build();
    }
}
