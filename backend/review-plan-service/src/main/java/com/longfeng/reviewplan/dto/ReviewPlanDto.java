package com.longfeng.reviewplan.dto;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import com.longfeng.reviewplan.entity.ReviewPlan;
import java.math.BigDecimal;
import java.time.Instant;

/** ReviewPlan entity → DTO 映射. P07 today 加 subject/stem (single-DB join 拿). */
public record ReviewPlanDto(
    // Snowflake ID 19 位 > 2^53 · JS Number 精度只到 ~9e15 · 直接序列化成 long ·
    // 客户端拿到尾数被截 (...770945 → ...770940). 必须 ToStringSerializer 转字符串.
    @JsonSerialize(using = ToStringSerializer.class) Long id,
    @JsonSerialize(using = ToStringSerializer.class) Long wrongItemId,
    @JsonSerialize(using = ToStringSerializer.class) Long studentId,
    int nodeIndex,
    String strategyCode,
    Instant startAt,
    BigDecimal easeFactor,
    String status,
    Instant nextDueAt,
    Instant completedAt,
    int totalReview,
    int totalForget,
    // P07-RENDER · 来自 wrong_item 单库 join · today() 路径 enrich · 其他路径 null:
    String subject,    // 'math'/'physics'/... · FE 自己 i18n 映射 "数学" 等标签
    String stem        // 题干 (FE 2 行截断)
) {
    public static ReviewPlanDto from(ReviewPlan p) {
        return from(p, null, null);
    }

    public static ReviewPlanDto from(ReviewPlan p, String subject, String stem) {
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
            p.getTotalForget() == null ? 0 : p.getTotalForget(),
            subject,
            stem
        );
    }
}
