package com.longfeng.reviewplan.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.longfeng.reviewplan.algo.AlgorithmConfig;
import com.longfeng.reviewplan.algo.SM2Algorithm;
import com.longfeng.reviewplan.algo.SM2Result;
import com.longfeng.reviewplan.entity.ReviewOutcome;
import com.longfeng.reviewplan.entity.ReviewPlan;
import com.longfeng.reviewplan.entity.ReviewPlanOutbox;
import com.longfeng.reviewplan.exception.PlanMasteredException;
import com.longfeng.reviewplan.exception.PlanNotFoundException;
import com.longfeng.reviewplan.repo.ReviewOutcomeRepository;
import com.longfeng.reviewplan.repo.ReviewPlanOutboxRepository;
import com.longfeng.reviewplan.repo.ReviewPlanRepository;
import com.longfeng.reviewplan.support.SnowflakeIdGenerator;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * review-plan-service 核心业务 · 落地计划 §9.5 / §9.7 Step 5.
 *
 * <p>3 能力：
 *
 * <ul>
 *   <li>{@link #createSevenNodes}（SC-07.AC-1 · Consumer 侧调用 · 幂等 INSERT 7 行）
 *   <li>{@link #complete}（SC-08.AC-1 · POST /review-plans/{id}/complete · 乐观锁 + Outbox）
 *   <li>{@code mastered} 自动触发 · 连续 3 次 ease≥2.8（Q-G）
 * </ul>
 */
@Service
public class ReviewPlanService {

  private static final Logger LOG = LoggerFactory.getLogger(ReviewPlanService.class);

  /** 7 节点偏移（SC-07.AC-1 · Q-B/D 决策）· 索引对应 node_index 0..6. */
  public static final Duration[] NODE_OFFSETS = {
      Duration.ofHours(2), // T0 · 创建后 2h · Q-D
      Duration.ofDays(1),
      Duration.ofDays(2),
      Duration.ofDays(4),
      Duration.ofDays(7),
      Duration.ofDays(14),
      Duration.ofDays(30),
  };

  public static final int MASTERED_CONSECUTIVE_COUNT = 3;
  public static final BigDecimal MASTERED_EASE_THRESHOLD = new BigDecimal("2.8");

  private final ReviewPlanRepository planRepo;
  private final ReviewOutcomeRepository outcomeRepo;
  private final ReviewPlanOutboxRepository outboxRepo;
  private final SnowflakeIdGenerator idGen;
  private final AlgorithmConfig cfg;
  private final ObjectMapper jsonMapper;
  /** SC-01-C07 · A06 §3 D1 · 7 节点落库后批量推送 calendar-core（503 重试 + outbox 兜底）. */
  private final CalendarBatchCreateService calendarBatchCreate;

  @Autowired
  public ReviewPlanService(
      ReviewPlanRepository planRepo,
      ReviewOutcomeRepository outcomeRepo,
      ReviewPlanOutboxRepository outboxRepo,
      SnowflakeIdGenerator idGen,
      AlgorithmConfig cfg,
      ObjectMapper jsonMapper,
      CalendarBatchCreateService calendarBatchCreate) {
    this.planRepo = planRepo;
    this.outcomeRepo = outcomeRepo;
    this.outboxRepo = outboxRepo;
    this.idGen = idGen;
    this.cfg = cfg;
    this.jsonMapper = jsonMapper;
    this.calendarBatchCreate = calendarBatchCreate;
  }

  /**
   * SC-07.AC-1 · Consumer 幂等 INSERT 7 行 · 基于 baseInstant + {@link #NODE_OFFSETS} 偏移.
   *
   * @return 7 行 review_plan · 若已存在 · 返回空 list（幂等跳过）
   */
  @Transactional
  public List<ReviewPlan> createSevenNodes(Long wrongItemId, Long studentId, Instant baseInstant) {
    if (planRepo.existsByWrongItemId(wrongItemId)) {
      return List.of();
    }
    List<ReviewPlan> rows = new ArrayList<>(NODE_OFFSETS.length);
    for (int i = 0; i < NODE_OFFSETS.length; i++) {
      ReviewPlan p = new ReviewPlan();
      p.setId(idGen.nextId());
      p.setWrongItemId(wrongItemId);
      p.setStudentId(studentId);
      p.setNodeIndex((short) i);
      p.setStrategyCode("EBBINGHAUS_SM2");
      p.setStartAt(baseInstant);
      p.setCurrentLevel((short) i);
      p.setIntervalIndex((short) i);
      p.setEaseFactor(cfg.easeInit());
      p.setStatus(ReviewPlan.STATUS_ACTIVE);
      p.setNextDueAt(baseInstant.plus(NODE_OFFSETS[i]));
      rows.add(p);
    }
    List<ReviewPlan> persisted;
    try {
      persisted = planRepo.saveAll(rows);
    } catch (DataIntegrityViolationException e) {
      // 唯一索引兜底 (wrong_item_id, node_index) · 并发重投（MQ 重投）· 视为幂等跳过
      return List.of();
    }
    // SC-01-C07 · A06 §3 D1 · plan 7 行落库后批量推 calendar-core（503 走 3 次重试 + outbox 兜底）.
    // 调用走独立事务（REQUIRES_NEW），失败不回滚 7 行 review_plan；幂等保证：A06 §3 D2 用
    // relationId=question:{itemId}:node:{planId} · calendar-core 侧按 idempotencyKey 去重.
    try {
      calendarBatchCreate.dispatch(persisted);
    } catch (RuntimeException ex) {
      // recover 写 outbox 已在另一事务完成；此处吞掉异常避免阻塞 createSevenNodes 调用方（Consumer）.
      LOG.warn(
          "calendar batchCreate dispatch terminated with runtime exception (outbox should cover) "
              + "· wrongItemId={} · err={}",
          wrongItemId,
          ex.getMessage());
    }
    return persisted;
  }

  /**
   * SC-08.AC-1 · POST /review-plans/{id}/complete.
   *
   * <p>单事务：加行锁读 → SM-2 compute → UPDATE 乐观锁 → INSERT outcome → Outbox. 连续 3 次 ease≥2.8 触发
   * mastered · 软删全 7 行 + 发 review.mastered.
   *
   * @return CompleteResult 内含 nextReviewAt + easeFactorAfter + mastered 标志
   */
  @Transactional
  public CompleteResult complete(Long planId, int quality) {
    ReviewPlan plan =
        planRepo.findByIdForUpdate(planId).orElseThrow(() -> new PlanNotFoundException(planId));
    if (plan.isMastered()) {
      throw new PlanMasteredException(planId);
    }

    BigDecimal easeBefore = plan.getEaseFactor();
    int intervalBeforeDays = daysOrOne(plan.getNextDueAt(), plan.getStartAt());

    SM2Result r = SM2Algorithm.compute(easeBefore, intervalBeforeDays, quality, cfg);

    Instant now = Instant.now();
    Instant nextDueAt = now.plus(Duration.ofDays(r.nextIntervalDays()));

    plan.setEaseFactor(r.nextEaseFactor());
    plan.setIntervalIndex((short) Math.min(6, plan.getIntervalIndex() + 1));
    plan.setCurrentLevel(plan.getIntervalIndex());
    plan.setNextDueAt(nextDueAt);
    plan.setCompletedAt(now);
    plan.setTotalReview(plan.getTotalReview() + 1);
    if (quality < 3) {
      plan.setTotalForget(plan.getTotalForget() + 1);
      plan.setConsecutiveGoodCount((short) 0);
    } else {
      short next =
          (short)
              (r.nextEaseFactor().compareTo(MASTERED_EASE_THRESHOLD) >= 0
                  ? (plan.getConsecutiveGoodCount() + 1)
                  : 0);
      plan.setConsecutiveGoodCount(next);
    }
    planRepo.save(plan);

    // 审计
    ReviewOutcome outcome = new ReviewOutcome();
    outcome.setId(idGen.nextId());
    outcome.setPlanId(plan.getId());
    outcome.setWrongItemId(plan.getWrongItemId());
    outcome.setUserId(plan.getStudentId());
    outcome.setQuality((short) quality);
    outcome.setEaseFactorBefore(easeBefore);
    outcome.setEaseFactorAfter(r.nextEaseFactor());
    outcome.setIntervalDaysBefore(intervalBeforeDays);
    outcome.setIntervalDaysAfter(r.nextIntervalDays());
    outcome.setCompletedAt(now);
    outcomeRepo.save(outcome);

    // Outbox · review.completed
    writeOutbox(
        plan.getId(),
        ReviewPlanOutbox.EVENT_COMPLETED,
        Map.of(
            "planId", plan.getId(),
            "wrongItemId", plan.getWrongItemId(),
            "userId", plan.getStudentId(),
            "quality", quality,
            "nodeIndex", plan.getNodeIndex(),
            "nextReviewAt", nextDueAt.toString(),
            "easeFactorAfter", r.nextEaseFactor().toPlainString(),
            "mastered", false));

    // Q-G · 检查 mastered 触发（聚合根原子性）
    boolean masteredTriggered =
        plan.getConsecutiveGoodCount() >= MASTERED_CONSECUTIVE_COUNT && !plan.isMastered();
    if (masteredTriggered) {
      planRepo.markAllMasteredByWrongItemId(plan.getWrongItemId(), now);
      writeOutbox(
          plan.getId(),
          ReviewPlanOutbox.EVENT_MASTERED,
          Map.of(
              "wrongItemId", plan.getWrongItemId(),
              "userId", plan.getStudentId(),
              "masteredAt", now.toString()));
    }

    return new CompleteResult(plan.getId(), nextDueAt, r.nextEaseFactor(), masteredTriggered);
  }

  private void writeOutbox(Long planId, String eventType, Map<String, Object> payload) {
    ReviewPlanOutbox outbox = new ReviewPlanOutbox();
    outbox.setId(idGen.nextId());
    outbox.setPlanId(planId);
    outbox.setEventType(eventType);
    try {
      outbox.setPayload(jsonMapper.writeValueAsString(payload));
    } catch (JsonProcessingException e) {
      // 降级 · 仍然写字符串形式的 payload · 否则整事务失败
      outbox.setPayload("{\"_fallback\":\"" + payload.toString().replace('"', '\'') + "\"}");
    }
    outboxRepo.save(outbox);
  }

  private int daysOrOne(Instant nextDueAt, Instant startAt) {
    if (nextDueAt == null || startAt == null) return 0;
    long days = Duration.between(startAt, nextDueAt).toDays();
    return (int) Math.max(0, days);
  }

  /** POST /review-plans/batch-reset · admin · 学期初软删该学生所有 active plan. */
  @Transactional
  public int batchReset(Long studentId) {
    return planRepo.softDeleteAllActiveByStudentId(studentId);
  }

  /** GET /review-plans/{id} · 单节点详情 · 404 when missing or mastered. */
  @Transactional(readOnly = true)
  public ReviewPlan getById(Long planId) {
    return planRepo.findById(planId).orElseThrow(() -> new PlanNotFoundException(planId));
  }

  /**
   * GET /review-plans?date= · 日视图 · 按学生 ID + 给定日期 UTC 时间窗 过滤.
   *
   * @param studentId 学生 ID
   * @param startOfDayUtc 当日 00:00 UTC（调用方按用户 timezone 换算）
   * @param endOfDayUtc 次日 00:00 UTC
   */
  @Transactional(readOnly = true)
  public List<ReviewPlan> getDayPlans(Long studentId, Instant startOfDayUtc, Instant endOfDayUtc) {
    return planRepo.findDueOnDate(studentId, startOfDayUtc, endOfDayUtc);
  }

  /** complete 返回值 · 用于 Controller Response. planId Snowflake 走字符串. */
  public record CompleteResult(
      @com.fasterxml.jackson.databind.annotation.JsonSerialize(
          using = com.fasterxml.jackson.databind.ser.std.ToStringSerializer.class)
      Long planId, Instant nextReviewAt, BigDecimal easeFactorAfter, boolean mastered) {}

  // =======================================================================
  // BE-13 (S5 caveat) · cursor list + batch-reset-by-ids
  // =======================================================================

  /**
   * BE-13 · GET /review-plans/list · cursor 翻页. statusOpt: -1=不过滤 / 0=ACTIVE / 1=MASTERED.
   * cursorId=null → 首页（用 Long.MAX_VALUE 作 sentinel）. limit clamp 到 [1, 100].
   */
  @Transactional(readOnly = true)
  public List<ReviewPlan> listByCursor(Long studentId, int statusOpt, Long cursorId, int limit) {
    int safeLimit = Math.min(100, Math.max(1, limit));
    Long safeCursor = cursorId == null ? Long.MAX_VALUE : cursorId;
    return planRepo.findListByStudentCursor(studentId, statusOpt, safeCursor, safeLimit);
  }

  /**
   * BE-13 · POST /review-plans/batch-reset-by-ids · 按 plan_ids 软删. 空列表 → 0. 返回实际 rowsAffected.
   */
  @Transactional
  public int batchResetByIds(List<Long> planIds) {
    if (planIds == null || planIds.isEmpty()) return 0;
    return planRepo.softDeleteByIds(planIds);
  }

  // =======================================================================
  // SC-01-C05 · review-endpoints support (open/grade events, latest outcome,
  // FORGOT downstream reschedule)
  // =======================================================================

  /**
   * SC-01-C05 · POST /api/review/nodes/{nid}/open · 写 outbox `review.node.opened`.
   *
   * <p>幂等：重复 POST /open 仍写一行 outbox（spec invariant 是 "≥ 1 条" · 多写无害）。 plan 不存在直接 throw
   * PlanNotFoundException · plan mastered 时 throw PlanMasteredException.
   */
  @Transactional
  public void openNode(Long planId) {
    ReviewPlan plan = planRepo.findById(planId).orElseThrow(() -> new PlanNotFoundException(planId));
    if (plan.isMastered()) {
      throw new PlanMasteredException(planId);
    }
    writeOutbox(
        plan.getId(),
        ReviewPlanOutbox.EVENT_OPENED,
        Map.of(
            "planId", plan.getId(),
            "wrongItemId", plan.getWrongItemId(),
            "userId", plan.getStudentId(),
            "nodeIndex", plan.getNodeIndex(),
            "openedAt", Instant.now().toString()));
  }

  /**
   * SC-01-C05 · POST /api/review/nodes/{nid}/grade 完成后补发 `review.node.graded` 事件.
   *
   * <p>承担 spec invariant "review.node.graded ≥ 1 条"（`complete()` 内部写的是 `completed`，是 BE-13
   * 既有语义，不可改名，故新事件分开发）。
   */
  @Transactional
  public void writeGradedEvent(Long planId, String grade, int quality, Long wrongItemId,
      Long userId, Short nodeIndex) {
    writeOutbox(
        planId,
        ReviewPlanOutbox.EVENT_GRADED,
        Map.of(
            "planId", planId,
            "wrongItemId", wrongItemId,
            "userId", userId,
            "nodeIndex", nodeIndex,
            "grade", grade,
            "quality", quality,
            "gradedAt", Instant.now().toString()));
  }

  /**
   * SC-01-C05 · FORGOT 重排：将本错题 fromNodeIndex+1..6 的所有未完成 plan 的 next_due_at 重锚到 now + NODE_OFFSETS[i]
   * （以 fromNodeIndex 对应节点的当前时间为锚）.
   *
   * <p>等价于"忘了"之后把后续节点曲线整体平移到当前时间起算，符合艾宾浩斯遗忘后重新开始的语义.
   *
   * <p>仅影响 active 且 deleted_at IS NULL 的行 · 已 mastered 不动 · 返回受影响行数.
   */
  @Transactional
  public int rescheduleDownstreamForForgot(Long wrongItemId, int fromNodeIndex) {
    if (fromNodeIndex >= NODE_OFFSETS.length - 1) {
      return 0; // T6 forgot · 无 downstream
    }
    Instant anchor = Instant.now();
    List<ReviewPlan> all = planRepo.findByWrongItemIdOrderByNodeIndexAsc(wrongItemId);
    int affected = 0;
    for (ReviewPlan p : all) {
      int idx = p.getNodeIndex() == null ? 0 : p.getNodeIndex();
      if (idx <= fromNodeIndex) continue;
      if (p.getStatus() == null || p.getStatus() != ReviewPlan.STATUS_ACTIVE) continue;
      Duration offset = NODE_OFFSETS[idx];
      // 以 fromNodeIndex 节点起 · downstream 节点相对当前节点的偏移差 = 全局偏移
      // 简化：直接用 anchor + NODE_OFFSETS[idx] 作为新 due time
      p.setNextDueAt(anchor.plus(offset));
      planRepo.save(p);
      affected++;
    }
    // TODO(SC-01-C08): trigger calendar batch delete + recreate via Feign + outbox
    return affected;
  }

  /**
   * SC-01-C05 · GET /api/review/nodes/{nid}/result 聚合 · 查 plan 最近一次 ReviewOutcome 流水（按 completed_at
   * desc 取 1）。
   *
   * @return 最近一次 outcome · 不存在返 null（节点未评分过的场景）。
   */
  @Transactional(readOnly = true)
  public ReviewOutcome findLatestOutcomeByPlanId(Long planId) {
    List<ReviewOutcome> list = outcomeRepo.findByPlanIdOrderByCompletedAtDesc(
        planId, PageRequest.of(0, 1));
    return list.isEmpty() ? null : list.get(0);
  }
}
