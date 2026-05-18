package com.longfeng.calendar.controller;

import com.longfeng.calendar.dto.CalendarEventResp;
import com.longfeng.calendar.dto.CalendarMonthResp;
import com.longfeng.calendar.dto.CalendarSubscribeResp;
import com.longfeng.calendar.service.CalendarEventService;
import com.longfeng.common.dto.ApiResult;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
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
     * Query events by date · single-day query (Feign target / observer day-list).
     *
     * <p>Discriminator: {@code params = "date"} · disjoint from {@link #listByMonth}.
     */
    @GetMapping(value = "/events", params = "date")
    public ApiResult<List<CalendarEventResp>> listByDate(
            @RequestParam("ownerId") Long ownerId,
            @RequestParam("date") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestHeader(value = "X-User-Timezone", defaultValue = "Asia/Shanghai") String tz) {
        List<CalendarEventResp> events = service.findByOwnerAndDate(
                ownerId, date, ZoneId.of(tz));
        return ApiResult.ok(events);
    }

    /**
     * P10 spec §5 #1 · GET /api/calendar/events?month=YYYY-MM.
     *
     * <p>Spec path/method字符级 (spec L143): query 中 {@code month} 形如 "2026-05" ·
     * {@code ownerId} 由 X-User-Id header 注入 (与 wrongbook-service /api/wb/*
     * 同模式) · 未来真鉴权后由网关替换. Returns
     * {@code {month, days:[{date, events:[...]}]}}.
     *
     * <p>P95 budget: ≤ 500ms (spec §11 行 1). 当前 impl 为单 SQL + 内存 bucket ·
     * 月均 ≤ 200 events (TC-05.06 上限) 一次 query 即可.
     */
    @GetMapping(value = "/events", params = "month")
    public ApiResult<CalendarMonthResp> listByMonth(
            @RequestParam("month") String month,
            @RequestHeader(value = "X-User-Id", required = false) Long headerUserId,
            @RequestParam(value = "ownerId", required = false) Long ownerIdParam,
            @RequestHeader(value = "X-User-Timezone", defaultValue = "Asia/Shanghai") String tz) {
        Long ownerId = ownerIdParam != null ? ownerIdParam : headerUserId;
        if (ownerId == null) {
            // 未鉴权 · 返空月而非 401 · 与 P-HOME /api/home/today 兜底一致.
            return ApiResult.ok(new CalendarMonthResp(month, List.of()));
        }
        YearMonth ym;
        try {
            ym = YearMonth.parse(month);
        } catch (DateTimeParseException e) {
            // 格式错 · 同样返空月让 FE 落 EMPTY 态 (不 throw 400 · 状态机 §6 只定义 5xx/timeout)
            return ApiResult.ok(new CalendarMonthResp(month, List.of()));
        }
        return ApiResult.ok(service.findByOwnerAndMonth(ownerId, ym, ZoneId.of(tz)));
    }
}
