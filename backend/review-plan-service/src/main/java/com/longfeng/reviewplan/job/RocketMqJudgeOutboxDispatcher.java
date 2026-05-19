package com.longfeng.reviewplan.job;

import org.apache.rocketmq.spring.core.RocketMQTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.stereotype.Component;

/**
 * SC21-T01 · 生产实现 · 使用 RocketMQTemplate.syncSend() 投递 outbox payload.
 *
 * <p>条件启用 {@code review.judge-outbox.dispatcher=rocketmq} · IT 用 {@code stub} 替代 (走 @MockBean).
 *
 * <p>沿现役 {@code rocketmq-spring-boot-starter} pattern · {@code name-server=127.0.0.1:9876}
 * 在 application.yml 已配 · 本地 dev 无 broker 时 sendOneWay 会 timeout · relay 走 retry path.
 */
@Component
@ConditionalOnProperty(
    value = "review.judge-outbox.dispatcher",
    havingValue = "rocketmq",
    matchIfMissing = false)
public class RocketMqJudgeOutboxDispatcher implements JudgeOutboxDispatcher {

  private static final Logger LOG = LoggerFactory.getLogger(RocketMqJudgeOutboxDispatcher.class);

  private final RocketMQTemplate template;

  public RocketMqJudgeOutboxDispatcher(RocketMQTemplate template) {
    this.template = template;
  }

  @Override
  public void dispatch(String topic, String payload) throws DispatchException {
    try {
      var result = template.syncSend(topic, MessageBuilder.withPayload(payload).build());
      if (result == null) {
        throw new DispatchException("rocketmq syncSend returned null result");
      }
      LOG.info("judge-outbox rocketmq dispatched · topic={} · sendStatus={} · msgId={}",
          topic, result.getSendStatus(), result.getMsgId());
    } catch (DispatchException e) {
      throw e;
    } catch (Exception e) {
      throw new DispatchException("rocketmq dispatch failed: " + e.getMessage(), e);
    }
  }
}
