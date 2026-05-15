package com.longfeng.calendar.dto;

/**
 * Subscribe response · mirrors review-plan-service CalendarSubscribeResp shape.
 * POST /internal/calendar/events/{eid}/subscribe + POST /api/calendar/events/{eid}/subscribe.
 */
public record CalendarSubscribeResp(
        Long eventId,
        boolean subscribed,
        String subscribedAt,
        String warningCode) {}
