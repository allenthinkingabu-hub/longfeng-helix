package com.longfeng.reviewplan.config;

import java.time.Clock;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * SC-16-T01 · {@link Clock} bean · 反 wall-clock 依赖.
 *
 * <p>所有时间敏感 service (e.g. {@link com.longfeng.reviewplan.service.WeeklyAggregateService})
 * 必须 inject {@link Clock} 而不是直接调 {@code Instant.now()} / {@code LocalDate.now()} ·
 * 让 IT/UT 可注入 {@code Clock.fixed(...)} 锁时间.
 *
 * <p>audit grep 验证 production code 0 命中 {@code LocalDate.now()} / {@code Instant.now()}
 * 在 weekly 链路 (controller / service / util).
 *
 * <p>{@code ConditionalOnMissingBean}: IT 可通过 {@code @MockBean Clock} 覆盖 (Spring Test 自动
 * replace primary bean).
 */
@Configuration
public class ClockConfig {

  @Bean
  @ConditionalOnMissingBean(Clock.class)
  public Clock systemClock() {
    return Clock.systemUTC();
  }
}
