package com.longfeng.anonymousservice.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * SC-12-T08 · Configuration for the cross-service forward to
 * {@code wrongbook-service POST /api/wb/questions} (biz §2B.13 F08).
 *
 * <p>Prefix {@code anon.wrongbook} keeps this disjoint from
 * {@link AiAnalysisProperties} (prefix {@code anon.ai-analysis}) and from
 * {@link AnonStorageProperties} (prefix {@code anon.storage}). That isolation
 * is important — when the IT for the 502 path
 * ({@code claim_when_wrongbook_down_returns_502}) overrides {@code
 * anon.wrongbook.base-url} via {@code @DynamicPropertySource} the override
 * MUST NOT cascade into the analyze path's base URL.
 *
 * <p>User iron rule (2026-05-18) · <b>NO MOCK</b>. The bean reusing the
 * existing {@code aiAnalysisRestTemplate} (same timeouts) talks to the real
 * wrongbook-service:8082 sandbox in tests too. The 502 path IT simply
 * repoints {@code base-url} at {@code http://localhost:65535} so the
 * RestTemplate gets a real kernel-issued ECONNREFUSED — that's still real
 * networking, not a mock.
 *
 * <p>Default targets the local sandbox where wrongbook-service listens on
 * {@code localhost:8082} (verified live during T08 implementation —
 * {@code curl} with the documented body returns 201 + {@code data.qid}).
 */
@Component
@ConfigurationProperties(prefix = "anon.wrongbook")
public class AnonClaimProperties {

    /** Base URL of wrongbook-service. Sandbox default → {@code http://localhost:8082}. */
    private String baseUrl = "http://localhost:8082";

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }
}
