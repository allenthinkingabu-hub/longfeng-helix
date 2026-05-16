package com.longfeng.aianalysis.provider;

import com.longfeng.aianalysis.config.AiProperties;
import com.longfeng.aianalysis.service.AnalysisStreamHub;
import com.longfeng.common.dto.AnalysisChunk;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * AI provider fallback chain. Reads chain order from {@code longfeng.ai.fallback-chain}.
 * When a non-primary provider succeeds, emits FALLBACK_MODEL chunk via AnalysisStreamHub.
 */
@Component
public class FallbackOrchestrator {

    private static final Logger log = LoggerFactory.getLogger(FallbackOrchestrator.class);

    private final AiProperties props;
    private final Map<String, AiProvider> providerMap;
    private final AnalysisStreamHub streamHub;

    public FallbackOrchestrator(AiProperties props, List<AiProvider> providers,
                                AnalysisStreamHub streamHub) {
        this.props = props;
        this.providerMap = providers.stream()
                .collect(Collectors.toMap(AiProvider::name, Function.identity()));
        this.streamHub = streamHub;
    }

    /**
     * Try invoking {@code invoker} on each provider in the fallback chain.
     * Emits FALLBACK_MODEL when switching from the active provider to a fallback.
     *
     * @param taskId      for SSE/WS event emission
     * @param activeProvider  the primary provider name
     * @param invoker     function that calls the provider and returns a result
     * @return result from the first successful provider
     * @throws AiProvider.AiProviderException if all providers fail
     */
    public <T> T tryWithFallback(String taskId, String activeProvider,
                                  Function<AiProvider, T> invoker) {
        List<String> chain = props.getFallbackChain();
        AiProvider.AiProviderException lastError = null;

        for (String providerName : chain) {
            AiProvider provider = providerMap.get(providerName);
            if (provider == null) {
                // CLAUDE.md Rule 12 fail-loud: do NOT silent fall-through to stub when a
                // configured provider name has no implementation. Either the deployer wants
                // that provider (and must register a bean) or the chain config is stale.
                log.warn("Configured AI provider '{}' has no bean registered — skipping (no silent stub).",
                        providerName);
                continue;
            }
            try {
                T result = invoker.apply(provider);
                if (!providerName.equals(activeProvider)) {
                    log.info("Fallback: {} -> {}", activeProvider, providerName);
                    streamHub.emit(taskId, AnalysisChunk.fallbackModel(activeProvider, providerName));
                }
                return result;
            } catch (AiProvider.AiProviderException e) {
                log.warn("Provider {} failed: {}", providerName, e.getMessage());
                lastError = e;
            }
        }

        // All providers failed → emit fail + return null
        streamHub.emit(taskId, AnalysisChunk.fail("ai.fallback.manual"));
        if (lastError != null) throw lastError;
        throw new AiProvider.AiProviderException("All AI providers failed");
    }

    public AiProvider resolveProvider(String name) {
        AiProvider p = providerMap.get(name);
        return p != null ? p : providerMap.get("stub");
    }
}
