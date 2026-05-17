package com.longfeng.reviewplan.dto;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;

/**
 * POST /api/review/sessions/{sid}/next response.
 * Snowflake ID 走 ToStringSerializer · 否则 JS 精度截尾.
 */
public record NextInSessionResp(
    @JsonSerialize(using = ToStringSerializer.class) Long next_nid,
    int completed,
    int total,
    boolean done
) {}
