package com.longfeng.calendar.dto;

import java.time.Instant;

/**
 * Calendar event response DTO · used in batch create echo + getNodes.
 */
public record CalendarEventResp(
        Long id,
        String relationType,
        String relationId,
        Long ownerId,
        String title,
        Instant startAt,
        Instant endAt,
        String state,
        String colorTag,
        boolean subscribed) {}
