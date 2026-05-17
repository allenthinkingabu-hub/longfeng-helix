package com.longfeng.anonymousservice.dto;

/**
 * SC-11-T01 · Three headline numbers shown above the P-LANDING hero CTA.
 *
 * <p>Wire shape MUST match {@code @longfeng/api-contracts} zod schema
 * {@code LandingKpiResponseSchema}. All counts are non-negative integers.
 * P0 backs these with in-memory constants (no OLAP read); P1 will swap to a
 * Doris/ClickHouse projection.
 */
public final class LandingKpiDto {

    private final long cumulativeQuestions;
    private final long dailyAnalyses;
    private final long happyUsers;

    public LandingKpiDto(long cumulativeQuestions, long dailyAnalyses, long happyUsers) {
        this.cumulativeQuestions = cumulativeQuestions;
        this.dailyAnalyses = dailyAnalyses;
        this.happyUsers = happyUsers;
    }

    public long getCumulativeQuestions() {
        return cumulativeQuestions;
    }

    public long getDailyAnalyses() {
        return dailyAnalyses;
    }

    public long getHappyUsers() {
        return happyUsers;
    }
}
