package com.longfeng.aianalysis.provider;

import static org.assertj.core.api.Assertions.assertThat;

import com.longfeng.aianalysis.IntegrationTestBase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

/**
 * Regression test for SC01-MP-BUG-AI-FAKE attempt-1 round-2.
 *
 * <p><b>What this guards</b>: prior to the round-2 fix, {@link QianwenAiProvider} had two
 * unannotated constructors (the primary three-arg one for production wiring, plus a
 * package-private test-seam constructor for unit tests with a fake {@link
 * org.springframework.web.client.RestTemplate}). Spring 6 / Boot 3.2 saw two ambiguous
 * candidate constructors, fell back to looking for a no-arg constructor, found none, and
 * blew up the application context with
 * {@code BeanInstantiationException: NoSuchMethodException: <init>()}.
 *
 * <p>The unit-test suite ({@link QianwenAiProviderTest}) was green because it constructed
 * the provider directly via the test-seam path, bypassing Spring — i.e. unit tests said
 * 13/13 PASS while {@code mvn spring-boot:run} failed at startup. This is the BE analogue
 * of the "vitest ✓ ≠ real browser" alignment failure called out in CLAUDE.md.
 *
 * <p>This test exercises the production code path: a real {@code @SpringBootTest} container
 * resolves the bean and confirms wiring. If anyone re-introduces a second ambiguous
 * constructor or removes the {@code @Autowired} marker, this test FAILs at context refresh
 * before any assertions even run, surfacing the regression loudly.
 */
@SpringBootTest
class QianwenAiProviderWireTest extends IntegrationTestBase {

    @Autowired private QianwenAiProvider provider;

    @Test
    @DisplayName("wire · Spring context loads QianwenAiProvider via the @Autowired primary constructor (regression for BeanInstantiationException)")
    void contextLoadsAndWiresProvider() {
        assertThat(provider).isNotNull();
        assertThat(provider.name()).isEqualTo("qianwen");
        var desc = provider.describe();
        assertThat(desc.get("name")).isEqualTo("qianwen");
        assertThat(desc.get("chatModel")).isEqualTo("qwen-plus");
        assertThat(desc.get("ocrModel")).isEqualTo("qwen-vl-max");
        // api-key is wired (env var or inflight literal · either way: configured)
        assertThat(desc.get("apiKeyConfigured")).isEqualTo("true");
    }
}
