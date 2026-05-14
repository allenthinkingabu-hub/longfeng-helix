package com.longfeng.reviewplan.dto;

import java.util.List;

/**
 * POST /api/review/sessions request body.
 * B02 决策 A · in-memory session · date/node_ids/tz 全可选.
 */
public record CreateSessionReq(
    String date,
    List<Long> node_ids,
    String tz
) {}
