package com.longfeng.reviewplan.dto;

import java.util.List;

/** GET /api/review/today response. */
public record TodayResp(
    List<ReviewPlanDto> items,
    int total,
    String tz
) {}
