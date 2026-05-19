package com.longfeng.reviewplan.job;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * SC21-T01 · 本地 dev 占位 dispatcher · 仅 log payload · 不真发 RocketMQ.
 *
 * <p>条件启用 {@code review.judge-outbox.dispatcher=stub} (默认 application.yml).
 *
 * <p>生产部署改 {@code review.judge-outbox.dispatcher=rocketmq} · IT 一般用 @MockBean 替换.
 */
@Component
@ConditionalOnProperty(
    value = "review.judge-outbox.dispatcher",
    havingValue = "stub",
    matchIfMissing = true)
public class StubJudgeOutboxDispatcher implements JudgeOutboxDispatcher {

  private static final Logger LOG = LoggerFactory.getLogger(StubJudgeOutboxDispatcher.class);

  @Override
  public void dispatch(String topic, String payload) {
    LOG.info("judge-outbox stub dispatched (no real send) · topic={} · payload={}",
        topic, payload);
  }
}
