package com.longfeng.reviewplan.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.longfeng.reviewplan.entity.ReviewPlan;
import com.longfeng.reviewplan.entity.ReviewPlanOutbox;
import com.longfeng.reviewplan.feign.CalendarBatchCreateFallback;
import com.longfeng.reviewplan.feign.CalendarFeignClient;
import com.longfeng.reviewplan.feign.dto.CalendarEventCreateReq;
import com.longfeng.reviewplan.repo.ReviewPlanOutboxRepository;
import com.longfeng.reviewplan.support.SnowflakeIdGenerator;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Recover;
import org.springframework.retry.annotation.Retryable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * SC-01-C07 · A06 §3 D1/D2/D5/D6/D9 · plan 落库后批量 Feign calendar-core 创建 7 条
 * calendar_event(relation_type=STUDY)，503 时 3 次重试，仍失败写 review_plan_outbox 兜底.
 *
 * <p>调用链：{@link ReviewPlanService#createSevenNodes} 末尾 → 本服务 {@link #dispatch} →
 * {@link CalendarFeignClient#batchCreateEvents} → 503 fallback throws
 * {@link CalendarBatchCreateFallback} → {@code @Retryable(maxAttempts=3)} 重试 →
 * 重试耗尽 → {@code @Recover} 写 outbox 一条 {@code calendar_event_batch_create} → 由
 * {@code CalendarOutboxRelayJob} 后续扫表重试（&lt; 5 min 最终一致 · biz §key_invariants）。
 *
 * <p>请求构造遵循 biz §4.9 双向指针：{@code relationType=STUDY}、
 * {@code relationId=question:{wrongItemId}:node:{planId}}。
 */
@Service
public class CalendarBatchCreateService {

  private static final Logger LOG = LoggerFactory.getLogger(CalendarBatchCreateService.class);

  /** SC-01-C07 · biz §2B.2 step 10 · 默认事件时长（startAt + 30min） · A06 §3 D2 默认值. */
  private static final Duration DEFAULT_EVENT_DURATION = Duration.ofMinutes(30);

  /** A06 §3 D1 · 来源服务标记 · 写 calendar_event.source 列. */
  private static final String SOURCE_SERVICE = "review-plan-service";

  /** biz §4.9 · STUDY 类事件默认前端渲染颜色. */
  private static final String STUDY_COLOR_TAG = "#FFC857";

  /** biz §key_invariants · 步骤 10 批量创建状态枚举：均为 SCHEDULED. */
  private static final String STATE_SCHEDULED = "SCHEDULED";

  private final CalendarFeignClient calendarClient;
  private final ReviewPlanOutboxRepository outboxRepo;
  private final SnowflakeIdGenerator idGen;
  private final ObjectMapper jsonMapper;

  @Autowired
  public CalendarBatchCreateService(
      CalendarFeignClient calendarClient,
      ReviewPlanOutboxRepository outboxRepo,
      SnowflakeIdGenerator idGen,
      ObjectMapper jsonMapper) {
    this.calendarClient = calendarClient;
    this.outboxRepo = outboxRepo;
    this.idGen = idGen;
    this.jsonMapper = jsonMapper;
  }

  /**
   * 把 7 个 review_plan 节点转换成 7 条 {@link CalendarEventCreateReq} 并批量推送 calendar-core.
   * 503/网络抖动由 fallback 抛 {@link CalendarBatchCreateFallback} · {@code @Retryable} 重试 3 次后
   * 走 {@link #recover} 写 outbox.
   *
   * <p>事务策略：本方法 {@code REQUIRES_NEW} · 与 createSevenNodes 的 7 行 INSERT 事务解耦，避免
   * Feign 调用阻塞主事务回滚（biz §step 10 性能：≤ 1s · A06 §3 D10 异步语义）。
   */
  @Transactional(propagation = Propagation.REQUIRES_NEW)
  @Retryable(
      retryFor = CalendarBatchCreateFallback.class,
      maxAttempts = 3,
      backoff = @Backoff(delay = 200L, multiplier = 2.0))
  public void dispatch(List<ReviewPlan> nodes) {
    if (nodes == null || nodes.isEmpty()) {
      LOG.debug("calendar batchCreate skipped · nodes empty");
      return;
    }
    List<CalendarEventCreateReq> reqs = toReqs(nodes);
    calendarClient.batchCreateEvents(reqs);
    LOG.info(
        "calendar batchCreate ok · wrongItemId={} · size={}",
        nodes.get(0).getWrongItemId(),
        reqs.size());
  }

  /**
   * {@code @Recover} · 3 次 {@link CalendarBatchCreateFallback} 全部失败后兜底：写一条
   * {@code calendar_event_batch_create} 行入 review_plan_outbox · 由 CalendarOutboxRelayJob 重试.
   *
   * <p>独立事务 {@code REQUIRES_NEW} · 避免 dispatch 自身事务的回滚把 outbox 一并撤销.
   */
  @Recover
  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void recover(CalendarBatchCreateFallback ex, List<ReviewPlan> nodes) {
    if (nodes == null || nodes.isEmpty()) {
      LOG.warn("calendar recover skipped · nodes empty · err={}", ex.getMessage());
      return;
    }
    long wrongItemId = nodes.get(0).getWrongItemId();
    long userId = nodes.get(0).getStudentId();
    long planId = nodes.get(0).getId();
    List<CalendarEventCreateReq> reqs = toReqs(nodes);

    Map<String, Object> payload = new HashMap<>();
    payload.put("wrongItemId", wrongItemId);
    payload.put("userId", userId);
    payload.put("planId", planId);
    payload.put("reqs", reqs);
    payload.put("cause", ex.getMessage());

    ReviewPlanOutbox box = new ReviewPlanOutbox();
    box.setId(idGen.nextId());
    box.setPlanId(planId);
    box.setEventType(ReviewPlanOutbox.EVENT_CALENDAR_BATCH_CREATE);
    try {
      box.setPayload(jsonMapper.writeValueAsString(payload));
    } catch (JsonProcessingException jpe) {
      box.setPayload("{\"_fallback\":\"" + payload.toString().replace('"', '\'') + "\"}");
    }
    outboxRepo.save(box);
    LOG.error(
        "calendar batchCreate retries exhausted · outbox row written · wrongItemId={} · size={}",
        wrongItemId,
        reqs.size());
  }

  /** 把 7 节点转换为 7 条 Feign 入参 (relation_id 用 plan.id 形成 biz §4.9 双向指针). */
  private List<CalendarEventCreateReq> toReqs(List<ReviewPlan> nodes) {
    List<CalendarEventCreateReq> list = new ArrayList<>(nodes.size());
    for (ReviewPlan n : nodes) {
      CalendarEventCreateReq r = new CalendarEventCreateReq();
      r.setRelationType("STUDY");
      r.setRelationId("question:" + n.getWrongItemId() + ":node:" + n.getId());
      r.setOwnerId(n.getStudentId());
      r.setTitle("复习节点 T" + n.getNodeIndex());
      Instant startAt = n.getNextDueAt();
      r.setStartAt(startAt);
      r.setEndAt(startAt.plus(DEFAULT_EVENT_DURATION));
      r.setState(STATE_SCHEDULED);
      r.setColorTag(STUDY_COLOR_TAG);
      r.setSource(SOURCE_SERVICE);
      r.setIdempotencyKey(r.getRelationId());
      list.add(r);
    }
    return list;
  }
}
