package com.longfeng.reviewplan.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * SC21-T01 · 仅在 {@code review.judge-outbox.enabled=true} 时启 Spring Scheduling.
 *
 * <p>不全局启 · 避免本地 dev 默认就跑 (CalendarOutboxRelayJob 也是 ConditionalOnProperty 防默启).
 *
 * <p>生产配置: {@code review.judge-outbox.enabled=true} + {@code review.judge-outbox.dispatcher=rocketmq}.
 */
@Configuration
@ConditionalOnProperty(
    value = "review.judge-outbox.enabled",
    havingValue = "true",
    matchIfMissing = false)
@EnableScheduling
public class JudgeOutboxSchedulingConfig {
}
