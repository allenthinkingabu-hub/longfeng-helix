package com.longfeng.reviewplan.controller;

import com.longfeng.common.dto.ApiResult;
import com.longfeng.reviewplan.feign.CalendarFeignClient;
import com.longfeng.reviewplan.feign.dto.CalendarSubscribeResp;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * P09 订阅日历事件 · POST /api/calendar/events/{eid}/subscribe.
 * A06 §3 D3 · 代理调 calendar-core internal API.
 */
@RestController
@Tag(name = "calendar-subscribe", description = "P09 · 日历事件订阅")
public class CalendarSubscribeController {

    private final CalendarFeignClient calendarClient;

    public CalendarSubscribeController(CalendarFeignClient calendarClient) {
        this.calendarClient = calendarClient;
    }

    @Operation(summary = "P09 · subscribe calendar event")
    @PostMapping("/api/calendar/events/{eid}/subscribe")
    public ApiResult<CalendarSubscribeResp> subscribe(@PathVariable String eid) {
        CalendarSubscribeResp resp = calendarClient.subscribe(eid);
        return ApiResult.ok(resp);
    }
}
