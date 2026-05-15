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

    record AnalysisResponse(String errorReason, String steps, String provider, String model, int tokens) {}

    class AiProviderException extends RuntimeException {
        public AiProviderException(String message) { super(message); }
        public AiProviderException(String message, Throwable cause) { super(message, cause); }
    }
}
