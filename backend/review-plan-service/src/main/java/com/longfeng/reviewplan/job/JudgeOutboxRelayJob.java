package com.longfeng.reviewplan.job;

import com.longfeng.reviewplan.entity.WbJudgeOutbox;
import com.longfeng.reviewplan.repo.WbJudgeOutboxRepository;
import com.longfeng.reviewplan.service.JudgeOutboxService;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.Instant;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * SC21-T01 · RLHF override outbox 投递 relay · biz §2B.21 步 5 + §12 S5.6.5.
 *
 * <p>周期 5min (可调) · 扫 {@code status='PENDING' AND retry_count < 5} · 投 RocketMQ topic
 * {@code ai-judge.overridden} · 成功置 {@code status='SENT'} · 失败 {@code retry_count++} +
 * {@code last_retry_at=now} · 第 5 次失败 → {@code status='FAILED'} + counter 告警.
 *
 * <p>条件启用 {@code review.judge-outbox.enabled=true} · IT/local 默认关 · IT 直接调 {@link #execute}.
 *
 * <p>设计沿 {@link CalendarOutboxRelayJob} 现役 pattern · 仅 dispatch 端从 Feign 换成
 * {@link JudgeOutboxDispatcher} (RocketMQ 抽象 · 便于 IT 替换).
 *
 * <p>AC3 字面 · AC4 监控埋点 · AC5 RocketMQ 不可用时主链不影响 (本 relay 与 grade 主链解耦).
 */
@Component
public class JudgeOutboxRelayJob {

  private static final Logger LOG = LoggerFactory.getLogger(JudgeOutboxRelayJob.class);
  private static final int BATCH_SIZE = 200;
  private static final String TOPIC = "ai-judge.overridden";

  private final WbJudgeOutboxRepository repo;
  private final JudgeOutboxDispatcher dispatcher;
  private final JudgeOutboxService outboxService;
  private final TransactionTemplate txTemplate;

  // AC4 监控埋点
  private final Counter scanCounter;
  private final Counter dispatchedCounter;
  private final Counter failedCounter;
  private final AtomicLong pendingGaugeRef = new AtomicLong(0);

  public JudgeOutboxRelayJob(
      WbJudgeOutboxRepository repo,
      JudgeOutboxDispatcher dispatcher,
      JudgeOutboxService outboxService,
      PlatformTransactionManager txManager,
      MeterRegistry meterRegistry) {
    this.repo = repo;
    this.dispatcher = dispatcher;
    this.outboxService = outboxService;
    this.txTemplate = new TransactionTemplate(txManager);
    this.scanCounter =
        Counter.builder("wb_judge_outbox_scan_total").register(meterRegistry);
    this.dispatchedCounter =
        Counter.builder("wb_judge_outbox_dispatched_total").register(meterRegistry);
    this.failedCounter =
        Counter.builder("wb_judge_outbox_fail_total").register(meterRegistry);
    Gauge.builder("wb_judge_outbox_pending_total", pendingGaugeRef, AtomicLong::doubleValue)
        .register(meterRegistry);
  }

  /** AC3 · 默认 5min 一次 · 可调 {@code review.judge-outbox.relay-interval-ms}. */
  @Scheduled(fixedDelayString = "${review.judge-outbox.relay-interval-ms:300000}")
  public void relay() {
    execute();
  }

  /** 业务入口 (IT 直接调 · 不经 @Scheduled). 返回成功 dispatched 行数. */
  public int execute() {
    // AC4: pending gauge 实时更新 (scan 前 snapshot)
    long pendingCount = repo.countByStatus(WbJudgeOutbox.STATUS_PENDING);
    pendingGaugeRef.set(pendingCount);

    List<WbJudgeOutbox> batch =
        repo.findPendingForRelay(
            WbJudgeOutbox.STATUS_PENDING,
            WbJudgeOutbox.MAX_RETRY,
            PageRequest.of(0, BATCH_SIZE));
    scanCounter.increment();
    if (batch.isEmpty()) {
      return 0;
    }
    int delivered = 0;
    // TI3 · FIFO 串行投递 (batch 已按 createdAt ASC 排序 · 单线程 for 循环不并发)
    for (WbJudgeOutbox row : batch) {
      Boolean ok = txTemplate.execute(s -> processOne(row));
      if (Boolean.TRUE.equals(ok)) {
        delivered++;
      }
    }
    LOG.info("judge-outbox-relay · scanned={} · dispatched={} · pending_total={}",
        batch.size(), delivered, pendingCount);
    return delivered;
  }

  /** 处理单行 · payload 构建 → dispatcher.dispatch → 成功置 SENT · 失败 retry_count++. */
  private boolean processOne(WbJudgeOutbox row) {
    String payload = outboxService.buildPayloadJson(row, System.currentTimeMillis());
    try {
      dispatcher.dispatch(TOPIC, payload);
      row.setStatus(WbJudgeOutbox.STATUS_SENT);
      row.setLastRetryAt(Instant.now());
      repo.save(row);
      dispatchedCounter.increment();
      LOG.info("judge-outbox dispatched · id={} · nid={} · ai={} · user={}",
          row.getId(), row.getNid(), row.getAiVerdict(), row.getUserVerdict());
      return true;
    } catch (JudgeOutboxDispatcher.DispatchException ex) {
      // AC5 · RocketMQ 不可达 · 不抛上层 · retry_count++
      bumpRetryOrFail(row, ex);
      return false;
    } catch (RuntimeException ex) {
      // 任意意外 (DB 写失败 etc.) · 也走 retry 路径
      bumpRetryOrFail(row, ex);
      return false;
    }
  }

  private void bumpRetryOrFail(WbJudgeOutbox row, Throwable cause) {
    short next = (short) (row.getRetryCount() == null ? 1 : row.getRetryCount() + 1);
    row.setRetryCount(next);
    row.setLastRetryAt(Instant.now());
    if (next >= WbJudgeOutbox.MAX_RETRY) {
      row.setStatus(WbJudgeOutbox.STATUS_FAILED);
      failedCounter.increment();
      LOG.error("judge-outbox FAILED (max retry reached) · id={} · nid={} · retry={} · cause={}",
          row.getId(), row.getNid(), next, cause.getMessage());
    } else {
      LOG.warn("judge-outbox attempt failed · id={} · nid={} · retry={} · cause={}",
          row.getId(), row.getNid(), next, cause.getMessage());
    }
    repo.save(row);
  }
}
