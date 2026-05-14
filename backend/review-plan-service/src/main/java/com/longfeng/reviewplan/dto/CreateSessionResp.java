package com.longfeng.reviewplan.dto;

import java.util.List;

/** POST /api/review/sessions response. */
public record CreateSessionResp(
    String sid,
    List<Long> nids,
    int total
) {}
