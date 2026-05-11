package com.longfeng.reviewplan.job;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.longfeng.reviewplan.entity.ReviewPlanOutbox;
import com.longfeng.reviewplan.feign.CalendarBatchCreateFallback;
import com.longfeng.reviewplan.feign.CalendarFeignClient;
import com.longfeng.reviewplan.feign.dto.CalendarEventCreateReq;
import com.longfeng.reviewplan.repo.ReviewPlanOutboxRepository;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.Instant;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * SC-01-C07 · A06 §3 D9 · review_plan_outbox 中 {@code calendar_event_batch_create} 行的 relay job.
 *
 * <p>周期 30s · 扫 {@code status=pending AND event_type='calendar_event_batch_create'
 * AND retry_count &lt; 3} · 调 {@link CalendarFeignClient#batchCreateEvents} · 成功置
 * {@code status=dispatched + dispatched_at=now} · 失败 {@code retry_count++} · 3 次后置
 * {@code status=failed} · 满足 biz §key_invariants "&lt; 5 min 最终一致".
 *
 * <p>条件启用 {@code review.job.enabled=true} · IT/local 默认关 · IT 直接调 {@link #execute}.
 *
 * <p>设计模仿 {@code PushTaskRelayJob} · 仅 1 张表，不需要复杂的多渠道 fallback.
 */
@Component
@ConditionalOnProperty(value = "review.job.enabled", havingValue = "true", matchIfMissing = false)
public class CalendarOutboxRelayJob {

  private static final Logger LOG = LoggerFactory.getLogger(CalendarOutboxRelayJob.class);
  private static final int BATCH_SIZE = 200;
  private static final short MAX_RETRY = 3;

  private final ReviewPlanOutboxRepository outboxRepo;
  private final CalendarFeignClient calendarClient;
  private final ObjectMapper jsonMapper;
  private final TransactionTemplate txTemplate;

  private final Counter scanCounter;
  private final Counter dispatchedCounter;
  private final Counter failedCounter;

  @Autowired
  public CalendarOutboxRelayJob(
      ReviewPlanOutboxRepository outboxRepo,
      CalendarFeignClient calendarClient,
      ObjectMapper jsonMapper,
      PlatformTransactionManager txManager,
      MeterRegistry meterRegistry) {
    this.outboxRepo = outboxRepo;
    this.calendarClient = calendarClient;
    this.jsonMapper = jsonMapper;
    this.txTemplate = new TransactionTemplate(txManager);
    this.scanCounter =
        Counter.builder("calendar_outbox_relay_scan_total").register(meterRegistry);
    this.dispatchedCounter =
        Counter.builder("calendar_outbox_relay_dispatched_total").register(meterRegistry);
    this.failedCounter =
        Counter.builder("calendar_outbox_relay_failed_total").register(meterRegistry);
  }

  @Scheduled(fixedDelayString = "${review.calendar.relay-interval-ms:30000}")
  public void relay() {
    execute();
  }

  /** 业务入口（IT 直接调此方法 · 不经 @Scheduled）. 返回成功 dispatched 行数. */
  public int execute() {
    List<ReviewPlanOutbox> batch =
        outboxRepo.findPendingByEventType(
            ReviewPlanOutbox.STATUS_PENDING,
            ReviewPlanOutbox.EVENT_CALENDAR_BATCH_CREATE,
            MAX_RETRY,
            PageRequest.of(0, BATCH_SIZE));
    scanCounter.increment();
    if (batch.isEmpty()) {
      return 0;
    }
    int delivered = 0;
    for (ReviewPlanOutbox row : batch) {
      Boolean ok = txTemplate.execute(s -> processOne(row));
      if (Boolean.TRUE.equals(ok)) {
        delivered++;
      }
    }
    LOG.info("calendar-outbox-relay · scanned={} · dispatched={}", batch.size(), delivered);
    return delivered;
  }

  /** 处理单行 outbox · 解析 payload.reqs → 调 Feign → 成功置 dispatched · 失败 retry_count++. */
  private boolean processOne(ReviewPlanOutbox row) {
    List<CalendarEventCreateReq> reqs;
    try {
      reqs = parseReqs(row.getPayload());
    } catch (JsonProcessingException e) {
      LOG.error(
          "calendar-outbox-relay payload parse fail · id={} · err={}",
          row.getId(),
          e.getMessage());
      bumpRetryOrFail(row, true);
      return false;
    }

    try {
      calendarClient.batchCreateEvents(reqs);
      row.setStatus(ReviewPlanOutbox.STATUS_DISPATCHED);
      row.setDispatchedAt(Instant.now());
      outboxRepo.save(row);
      dispatchedCounter.increment();
      LOG.info(
          "calendar-outbox-relay dispatched · id={} · planId={}",
          row.getId(),
          row.getPlanId());
      return true;
    } catch (CalendarBatchCreateFallback ex) {
      LOG.warn(
          "calendar-outbox-relay attempt failed · id={} · retry={} · err={}",
          row.getId(),
          row.getRetryCount(),
          ex.getMessage());
      bumpRetryOrFail(row, false);
      return false;
    } catch (RuntimeException ex) {
      LOG.warn(
          "calendar-outbox-relay runtime · id={} · retry={} · err={}",
          row.getId(),
          row.getRetryCount(),
          ex.getMessage());
      bumpRetryOrFail(row, false);
      return false;
    }
  }

  private void bumpRetryOrFail(ReviewPlanOutbox row, boolean fatal) {
    short next = (short) (row.getRetryCount() == null ? 1 : row.getRetryCount() + 1);
    row.setRetryCount(next);
    if (fatal || next >= MAX_RETRY) {
      row.setStatus(ReviewPlanOutbox.STATUS_FAILED);
      failedCounter.increment();
    }
    outboxRepo.save(row);
  }

  /** payload jsonb → {@code List<CalendarEventCreateReq>}（取 "reqs" 字段）. */
  private List<CalendarEventCreateReq> parseReqs(String payload) throws JsonProcessingException {
    JsonNode root = jsonMapper.readTree(payload);
    JsonNode reqsNode = root.get("reqs");
    if (reqsNode == null || reqsNode.isNull()) {
      return List.of();
    }
    return jsonMapper.convertValue(reqsNode, new TypeReference<List<CalendarEventCreateReq>>() {});
  }
}
