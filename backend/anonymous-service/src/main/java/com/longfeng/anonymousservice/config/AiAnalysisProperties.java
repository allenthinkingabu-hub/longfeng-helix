package com.longfeng.anonymousservice.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * SC-12-T06 · Configuration for the real HTTP forward to
 * {@code ai-analysis-service} (biz §2B.13 F04).
 *
 * <p>Prefix {@code anon.ai-analysis} keeps this disjoint from
 * {@link AnonStorageProperties} (prefix {@code anon.storage}) so the two
 * configuration roots cannot accidentally collide in YAML or env-var binding.
 * Defaults target the local sandbox where ai-analysis-service listens on
 * {@code localhost:8083} (verified live during T06 implementation —
 * {@code POST http://localhost:8083/api/ai/analyze-by-url} returns
 * {@code 202 ANALYZING} for valid bodies, {@code 400} for empty bodies).
 *
 * <p>User iron rule (2026-05-18): <b>NO MOCK</b>. WebClient / RestTemplate
 * MUST forward to the real ai-analysis-service in tests too; WireMock,
 * MockWebServer, spring-cloud-contract stubs, and {@code @MockBean RestTemplate}
 * are all banned. This properties bean exists so the IT for the 502 path can
 * point at an unreachable port ({@code http://localhost:65535}) via
 * {@code @TestPropertySource} without monkey-patching the RestTemplate bean
 * itself — that's the only allowed "alteration", and even that is real
 * networking (real connection-refused, not a mock).
 *
 * <p>Timeouts are conservatively low to keep the IT suite snappy: 2s connect,
 * 5s read. A failing test against a saturated CI box would still surface as
 * timeout (RestClientException) → 502, which is the exact error path we
 * want exercised by case (e).
 */
@Component
@ConfigurationProperties(prefix = "anon.ai-analysis")
public class AiAnalysisProperties {

    /** Base URL of ai-analysis-service. Sandbox default → {@code http://localhost:8083}. */
    private String baseUrl = "http://localhost:8083";

    /** TCP connect timeout in milliseconds (default 2000). */
    private long connectTimeoutMs = 2000;

    /** Socket read timeout in milliseconds (default 5000). */
    private long readTimeoutMs = 5000;

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public long getConnectTimeoutMs() {
        return connectTimeoutMs;
    }

    public void setConnectTimeoutMs(long connectTimeoutMs) {
        this.connectTimeoutMs = connectTimeoutMs;
    }

    public long getReadTimeoutMs() {
        return readTimeoutMs;
    }

    public void setReadTimeoutMs(long readTimeoutMs) {
        this.readTimeoutMs = readTimeoutMs;
    }
}
