package com.longfeng.reviewplan.dto;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import java.math.BigDecimal;
import java.time.Instant;

/**
 * GET /api/review/nodes/{nid}/result response.
 * P09 hero/曲线渲染所需全字段.
 *
 * <p>Snowflake ID (19 位 > 2^53) 必须 ToStringSerializer · 否则 JS Number 截尾导致
 * FE 拿到错 wrongItemId · 再调 getQuestionById 404 退 mock (跟 ReviewPlanDto d4e21f2
 * 同类 bug · 这里补).
 */
public record NodeResultResp(
    @JsonSerialize(using = ToStringSerializer.class) Long planId,
    @JsonSerialize(using = ToStringSerializer.class) Long wrongItemId,
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
