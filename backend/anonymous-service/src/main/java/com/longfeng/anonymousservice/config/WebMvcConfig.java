package com.longfeng.anonymousservice.config;

import com.longfeng.anonymousservice.filter.AnonFilter;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * SC-12-T02 · Wires {@link AnonFilter} into Spring MVC's interceptor chain.
 *
 * <p>Path pattern: {@code /api/anon/**} (all anon-tier endpoints). The mint
 * entry ({@code POST /api/anon/session}) is whitelisted inside the
 * interceptor itself rather than via {@code excludePathPatterns} so the
 * "POST-only" subtle rule is preserved (see {@link AnonFilter} javadoc).
 *
 * <p>Other endpoints under {@code /api/} (e.g. {@code /api/session/resolve},
 * {@code /api/landing/*}, {@code /api/share/*}) are not affected — they sit
 * outside the {@code /api/anon/} prefix.
 */
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    private final AnonFilter anonFilter;

    public WebMvcConfig(AnonFilter anonFilter) {
        this.anonFilter = anonFilter;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(anonFilter).addPathPatterns("/api/anon/**");
    }
}
