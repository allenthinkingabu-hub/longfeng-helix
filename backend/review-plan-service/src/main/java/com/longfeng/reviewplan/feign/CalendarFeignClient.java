package com.longfeng.reviewplan.feign;

import com.longfeng.reviewplan.feign.dto.CalendarEventCreateReq;
import com.longfeng.reviewplan.feign.dto.CalendarSubscribeResp;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;

/**
 * calendar-platform core-service Feign · SC-10.AC-1 + SC-01-D03.
 *
 * <p>Sentinel circuit-breaker (via {@code @SentinelResource}) · degrade target
 * {@link CalendarFeignClientFallback}. url defaults to localhost · in production resolved via
 * Nacos service discovery.
 */
@FeignClient(
    name = "core-service",
    url = "${calendar.core-service.url:http://localhost:18080}",
    fallback = CalendarFeignClientFallback.class)
public interface CalendarFeignClient {

  @GetMapping("/calendar/nodes")
  List<Map<String, Object>> getNodes(
      @RequestParam("date") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date);

  /**
   * SC-01-D03 · P09 「+add to calendar」 · subscribe the generated calendar_event to the current
   * user's calendar.
   *
   * <p>Path aligned with cross-team contract draft
   * ({@code audits/SC-01-PHASE-0/B03-decision.md} §3): calendar-core exposes the internal API
   * {@code POST /internal/calendar/events/{eid}/subscribe}.
   *
   * <p>On 503 / timeout the call is routed to
   * {@link CalendarFeignClientFallback#subscribe(String)} which returns
   * {@code warningCode=CALENDAR_SYNC_DELAYED}; the upstream controller turns that into a
   * 200 + warning response per A06 §3 D7.
   */
  @PostMapping("/internal/calendar/events/{eid}/subscribe")
  CalendarSubscribeResp subscribe(@PathVariable("eid") String eid);

  /**
   * SC-01-C07 · A06 §3 D1 · plan 落库后批量 Feign 创建 7 条 calendar_event(relation_type=STUDY).
   *
   * <p>Path aligned with cross-team contract draft
   * ({@code audits/SC-01-PHASE-0/B03-decision.md} §3): calendar-core exposes
   * {@code POST /internal/events/batch} with body {@code List<CalendarEventCreateReq>}.
   *
   * <p>On 503 / network error the call routes to
   * {@link CalendarFeignClientFallback#batchCreateEvents(List)} which throws
   * {@link CalendarBatchCreateFallback} to trigger the orchestrator's outbox-fallback path
   * (per A06 §3 D5/D9).
   *
   * @param reqs 7 calendar_event creation requests (relation_type=STUDY, relation_id=
   *     {@code question:{itemId}:node:{nodeId}})
   * @return list of created event ids (echo from calendar-core)
   */
  @PostMapping("/internal/events/batch")
  List<Map<String, Object>> batchCreateEvents(@RequestBody List<CalendarEventCreateReq> reqs);
}
