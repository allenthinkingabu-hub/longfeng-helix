package com.longfeng.calendar.controller;

import com.longfeng.calendar.dto.CalendarEventResp;
import com.longfeng.calendar.dto.CalendarSubscribeResp;
import com.longfeng.calendar.service.CalendarEventService;
import com.longfeng.common.dto.ApiResult;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Public calendar API · path prefix /api/calendar.
 *
 * <p>P09 spec §5 #3: POST /api/calendar/events/{eid}/subscribe
 * <p>GET /calendar/nodes (Feign target · no /api prefix for backward compat)
 */
@RestController
@RequestMapping("/api/calendar")
public class CalendarApiController {

    private final CalendarEventService service;

    public CalendarApiController(CalendarEventService service) {
        this.service = service;
    }

    /**
     * P09 spec §5 #3 · POST /api/calendar/events/{eid}/subscribe.
     * Idempotent · replays return current snapshot.
     */
    @PostMapping("/events/{eid}/subscribe")
    public ApiResult<CalendarSubscribeResp> subscribe(
            @PathVariable("eid") Long eid,
            @RequestHeader(value = "X-User-Id", required = false) String userId,
            @RequestHeader(value = "X-Idempotency-Key", required = false) String idemKey,
            @RequestHeader(value = "X-Request-Id", required = false) String requestId) {
        CalendarSubscribeResp resp = service.subscribe(eid);
        return ApiResult.ok(resp);
    }

    /**
     * Query events by date · used by P10 monthly view + Feign getNodes.
     */
    @GetMapping("/events")
    public ApiResult<List<CalendarEventResp>> listByDate(
            @RequestParam("ownerId") Long ownerId,
            @RequestParam("date") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestHeader(value = "X-User-Timezone", defaultValue = "Asia/Shanghai") String tz) {
        List<CalendarEventResp> events = service.findByOwnerAndDate(
                ownerId, date, ZoneId.of(tz));
        return ApiResult.ok(events);
    }
}
