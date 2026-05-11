package com.longfeng.reviewplan.feign;

import com.github.benmanes.caffeine.cache.Cache;
import com.longfeng.reviewplan.feign.dto.CalendarEventCreateReq;
import com.longfeng.reviewplan.feign.dto.CalendarSubscribeResp;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Feign degrade target · SC-10.AC-1 error_paths.0/1 + SC-01-D03.
 *
 * <p>When core-service times out / returns 5xx, Feign routes to this bean. For the {@code getNodes}
 * read path: cache hit returns cached list, cache miss returns empty list (upstream may emit
 * 503 CALENDAR_DEPENDENCY_DOWN). For the {@code subscribe} write path (SC-01-D03): the response
 * carries {@code warningCode=CALENDAR_SYNC_DELAYED}; the controller translates it into a
 * 200 + warning payload per A06 §3 D7 + biz §key_invariants.
 */
@Component
@ConditionalOnProperty(value = "review.feign.enabled", havingValue = "true", matchIfMissing = true)
public class CalendarFeignClientFallback implements CalendarFeignClient {

  private static final Logger LOG = LoggerFactory.getLogger(CalendarFeignClientFallback.class);

  /** A06 §3 D7 · warning code surfaced for the SC-01 P09 calendar write path soft-degrade. */
  public static final String WARNING_CALENDAR_SYNC_DELAYED = "CALENDAR_SYNC_DELAYED";

  private final Cache<String, List<Map<String, Object>>> cache;

  @Autowired
  public CalendarFeignClientFallback(Cache<String, List<Map<String, Object>>> calendarCache) {
    this.cache = calendarCache;
  }

  @Override
  public List<Map<String, Object>> getNodes(LocalDate date) {
    String key = date.toString();
    var cached = cache.getIfPresent(key);
    if (cached != null) {
      LOG.warn("calendar core-service degrade · source=cache · date={}", date);
      return cached;
    }
    LOG.error("calendar core-service degrade · cache MISS · date={} · return empty", date);
    return List.of();
  }

  @Override
  public CalendarSubscribeResp subscribe(String eid) {
    LOG.error(
        "calendar core-service subscribe degrade · eid={} · warningCode={}",
        eid,
        WARNING_CALENDAR_SYNC_DELAYED);
    return new CalendarSubscribeResp(null, eid, null, WARNING_CALENDAR_SYNC_DELAYED);
  }

  /**
   * SC-01-C07 · A06 §3 D6/D9 · batch create degrade: throw {@link CalendarBatchCreateFallback}
   * so the upstream {@code CalendarBatchCreateService#dispatch} {@code @Retryable} can catch it,
   * exhaust 3 attempts, then write the outbox row for {@code CalendarOutboxRelayJob} to retry.
   */
  @Override
  public List<Map<String, Object>> batchCreateEvents(List<CalendarEventCreateReq> reqs) {
    int size = reqs == null ? 0 : reqs.size();
    LOG.error("calendar core-service batchCreateEvents degrade · size={}", size);
    throw new CalendarBatchCreateFallback(
        "calendar core-service unavailable · batchCreateEvents size=" + size);
  }
}
