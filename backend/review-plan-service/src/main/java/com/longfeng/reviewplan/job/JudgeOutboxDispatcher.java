package com.longfeng.reviewplan.job;

/**
 * SC21-T01 · 抽象 RocketMQ 投递端 · 供 {@link JudgeOutboxRelayJob} 调用 · IT 时可替换为 stub.
 *
 * <p>生产实现 {@link RocketMqJudgeOutboxDispatcher} · 使用 {@code RocketMQTemplate.syncSend()}.
 *
 * <p>IT 实现 (T01Sc21OverrideOutboxE2EIT 中) 用 @MockBean 或 stub 接管 · 验 retry / FAILED 路径
 * 而不真启 RocketMQ broker.
 */
public interface JudgeOutboxDispatcher {

  /**
   * 投递 1 条 outbox payload 到 RocketMQ topic {@code ai-judge.overridden}.
   *
   * @param topic   一般固定 {@code ai-judge.overridden}
   * @param payload JSON 字符串 · 由 {@link com.longfeng.reviewplan.service.JudgeOutboxService#buildPayloadJson} 构建
   * @throws DispatchException MQ broker 不可达 / send timeout / RocketMQ 内部 error · relay 捕获后 retry_count++
   */
  void dispatch(String topic, String payload) throws DispatchException;

  /** RocketMQ 投递失败的 sentinel exception · relay 视为可重试. */
  class DispatchException extends RuntimeException {
    public DispatchException(String msg) { super(msg); }
    public DispatchException(String msg, Throwable cause) { super(msg, cause); }
  }
}
