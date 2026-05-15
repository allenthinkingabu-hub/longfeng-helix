package com.longfeng.reviewplan.dto;

/** POST /api/review/sessions/{sid}/next response. */
public record NextInSessionResp(
    Long next_nid,
    int completed,
    int total,
    boolean done
) {}
