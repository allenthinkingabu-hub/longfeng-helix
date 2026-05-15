package com.longfeng.calendar.controller;

import com.longfeng.calendar.dto.CalendarEventCreateReq;
import com.longfeng.calendar.dto.CalendarEventResp;
import com.longfeng.calendar.dto.CalendarSubscribeResp;
import com.longfeng.calendar.service.CalendarEventService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Internal API · Feign target from review-plan-service.
 *
 * <p>Paths aligned with CalendarFeignClient contract:
 * <ul>
 *   <li>POST /internal/events/batch
 *   <li>POST /internal/calendar/events/{eid}/subscribe
 *   <li>DELETE /internal/events (FORGOT cascade soft-delete)
 * </ul>
 */
@RestController
public class CalendarInternalController {

    private final CalendarEventService service;

    public CalendarInternalController(CalendarEventService service) {
        this.service = service;
    }

    /**
     * SC-01-C07 · batch create 7 calendar_event(relation_type=STUDY).
     * Idempotent per idempotency_key on each event.
     */
    @PostMapping("/internal/events/batch")
    public List<CalendarEventResp> batchCreate(
            @RequestBody @Valid List<CalendarEventCreateReq> reqs) {
        return service.batchCreate(reqs);
    }

    /**
     * SC-01-D03 · P09 subscribe internal path.
     */
    @PostMapping("/internal/calendar/events/{eid}/subscribe")
    public CalendarSubscribeResp subscribeInternal(@PathVariable("eid") Long eid) {
        return service.subscribe(eid);
    }

    /**
     * FORGOT cascade · soft-delete events by relation prefix.
     * Called when review plan resets (7 old nodes soft-delete → 7 new).
     */
    @DeleteMapping("/internal/events")
    public int deleteByRelation(
            @RequestParam("relationType") String relationType,
            @RequestParam("relationIdPrefix") String relationIdPrefix) {
        return service.softDeleteByRelation(relationType, relationIdPrefix);
    }
}
