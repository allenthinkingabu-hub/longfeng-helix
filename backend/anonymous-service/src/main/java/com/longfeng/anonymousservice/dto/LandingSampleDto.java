package com.longfeng.anonymousservice.dto;

import java.util.List;

/**
 * SC-11-T01 · One sample analysed-question card shown in the P-LANDING
 * "see what AI can do" carousel.
 *
 * <p>Wire shape MUST match {@code @longfeng/api-contracts} zod schema
 * {@code LandingSampleSchema} (frontend/packages/api-contracts/src/landing.ts).
 * Field names are camelCase to align with the Jackson default property naming
 * + the frontend zod parse expectation.
 */
public final class LandingSampleDto {

    private final String subject;
    private final String stemText;
    private final List<String> knowledgePoints;
    private final String errorReason;
    private final String correction;

    public LandingSampleDto(
            String subject,
            String stemText,
            List<String> knowledgePoints,
            String errorReason,
            String correction) {
        this.subject = subject;
        this.stemText = stemText;
        this.knowledgePoints = knowledgePoints;
        this.errorReason = errorReason;
        this.correction = correction;
    }

    public String getSubject() {
        return subject;
    }

    public String getStemText() {
        return stemText;
    }

    public List<String> getKnowledgePoints() {
        return knowledgePoints;
    }

    public String getErrorReason() {
        return errorReason;
    }

    public String getCorrection() {
        return correction;
    }
}
