package com.longfeng.reviewplan.feign;

/**
 * SC-01-C07 · A06 §3 D6/D9 · calendar-core 批量创建 503/网络抖动时由
 * {@link CalendarFeignClientFallback#batchCreateEvents(java.util.List)} 抛出的标记异常。
 *
 * <p>{@code CalendarBatchCreateService#dispatch} 用 {@code @Retryable} 拦截本异常重试 3 次，
 * 仍失败则进入 outbox 兜底分支（event_type={@code calendar_event_batch_create}），由
 * {@code CalendarOutboxRelayJob} 后续扫表重试。
 *
 * <p>命名采用 {@code RuntimeException} 以避免污染调用栈的 checked-exception 声明（与本仓既有
 * {@code PlanNotFoundException} / {@code PlanMasteredException} 同款风格）。
 */
public class CalendarBatchCreateFallback extends RuntimeException {

  private static final long serialVersionUID = 1L;

  public CalendarBatchCreateFallback(String message) {
    super(message);
  }

  public CalendarBatchCreateFallback(String message, Throwable cause) {
    super(message, cause);
  }
}
