package com.longfeng.reviewplan.dto;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * GET /api/review/nodes/{nid}/result response.
 * P09 hero/曲线渲染所需全字段.
 */
public record NodeResultResp(
    Long planId,
    Long wrongItemId,
    int nodeIndex,
    String nodeState,
    Integer quality,
    BigDecimal easeBefore,
    BigDecimal easeAfter,
    Integer intervalBefore,
    Integer intervalAfter,
    Instant nextDueAt,
    Long durationMs,
    boolean mastered
) {}
