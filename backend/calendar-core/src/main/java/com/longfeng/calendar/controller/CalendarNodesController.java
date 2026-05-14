package com.longfeng.calendar.controller;

import com.longfeng.calendar.dto.CalendarEventResp;
import com.longfeng.calendar.service.CalendarEventService;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * GET /calendar/nodes · Feign target from review-plan-service CalendarFeignClient.
 * Path has no /api prefix to match existing Feign contract.
 */
@RestController
public class CalendarNodesController {

    private final CalendarEventService service;

    public CalendarNodesController(CalendarEventService service) {
        this.service = service;
    }

    @GetMapping("/calendar/nodes")
    public List<CalendarEventResp> getNodes(
            @RequestParam("date") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(value = "ownerId", required = false) Long ownerId,
            @RequestHeader(value = "X-User-Timezone", defaultValue = "Asia/Shanghai") String tz) {
        if (ownerId == null) {
            return List.of();
        }
        return service.findByOwnerAndDate(ownerId, date, ZoneId.of(tz));
    }
}
