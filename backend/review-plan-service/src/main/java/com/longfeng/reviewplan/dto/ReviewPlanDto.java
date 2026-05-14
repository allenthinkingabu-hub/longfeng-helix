package com.longfeng.reviewplan.dto;

import com.longfeng.reviewplan.entity.ReviewPlan;
import java.math.BigDecimal;
import java.time.Instant;

/** ReviewPlan entity → DTO 映射. */
public record ReviewPlanDto(
    Long id,
    Long wrongItemId,
    Long studentId,
    int nodeIndex,
    String strategyCode,
    Instant startAt,
    BigDecimal easeFactor,
    String status,
    Instant nextDueAt,
    Instant completedAt,
    int totalReview,
    int totalForget
) {
    public static ReviewPlanDto from(ReviewPlan p) {
        String statusStr = p.getStatus() != null && p.getStatus() == ReviewPlan.STATUS_MASTERED
            ? "MASTERED" : "ACTIVE";
        return new ReviewPlanDto(
            p.getId(),
            p.getWrongItemId(),
            p.getStudentId(),
            p.getNodeIndex() == null ? 0 : p.getNodeIndex(),
            p.getStrategyCode(),
            p.getStartAt(),
            p.getEaseFactor(),
            statusStr,
            p.getNextDueAt(),
            p.getCompletedAt(),
            p.getTotalReview() == null ? 0 : p.getTotalReview(),
            p.getTotalForget() == null ? 0 : p.getTotalForget()
        );
    }
}
