package com.longfeng.reviewplan.feign.dto;

public record CalendarSubscribeResp(
        String id,
        String eid,
        String subscribedAt,
        String warningCode) {}
