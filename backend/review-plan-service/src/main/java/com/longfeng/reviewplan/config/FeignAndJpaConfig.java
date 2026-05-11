package com.longfeng.reviewplan.config;

import com.longfeng.reviewplan.feign.CalendarFeignClient;
import com.longfeng.reviewplan.feign.CalendarFeignClientFallback;
import com.longfeng.reviewplan.feign.NotificationFeignClient;
import com.longfeng.reviewplan.feign.dto.CalendarEventCreateReq;
import com.longfeng.reviewplan.feign.dto.CalendarSubscribeResp;
import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/** 启用 JPA + Feign 扫描 · IT 可通过 {@code review.feign.enabled=false} 关 Feign 部分避免 Nacos 依赖. */
@Configuration
@EnableJpaRepositories(basePackages = "com.longfeng.reviewplan.repo")
@EntityScan(basePackages = "com.longfeng.reviewplan.entity")
@EnableJpaAuditing
public class FeignAndJpaConfig {

  @Configuration
  @EnableFeignClients(basePackages = "com.longfeng.reviewplan.feign")
  @ConditionalOnProperty(
      value = "review.feign.enabled",
      havingValue = "true",
      matchIfMissing = true)
  public static class FeignEnabled {}

  /**
   * IT stub · review.feign.enabled=false 时注入空实现，避免 controller 构造器 wiring 失败.
   *
   * <p>同时提供 NotificationFeignClient stub：4 channel 均返回 success=true（幂等空实现）。
   */
  @Configuration
  @ConditionalOnProperty(value = "review.feign.enabled", havingValue = "false")
  public static class FeignDisabled {

    /**
     * IT stub for {@link CalendarFeignClient}. Since SC-01-D03 added a second method
     * ({@code subscribe}), the interface is no longer SAM-compatible and a lambda will not
     * compile · use an anonymous class mirroring {@link #notificationFeignClientStub()} below.
     * The subscribe stub returns the same degrade payload that
     * {@link CalendarFeignClientFallback#subscribe(String)} would emit, so tests that exercise
     * the new endpoint without wiring a per-test MockBean still get a deterministic response.
     */
    @Bean
    CalendarFeignClient calendarFeignClientStub() {
      return new CalendarFeignClient() {
        @Override
        public List<Map<String, Object>> getNodes(LocalDate date) {
          return Collections.emptyList();
        }

        @Override
        public CalendarSubscribeResp subscribe(String eid) {
          return new CalendarSubscribeResp(
              null, eid, null, CalendarFeignClientFallback.WARNING_CALENDAR_SYNC_DELAYED);
        }

        @Override
        public List<Map<String, Object>> batchCreateEvents(List<CalendarEventCreateReq> reqs) {
          // SC-01-C07 IT default · 静默 OK · 走 happy path · 测 503/重试场景的 IT 用 @MockBean 覆盖.
          return Collections.emptyList();
        }
      };
    }

    @Bean
    NotificationFeignClient notificationFeignClientStub() {
      return new NotificationFeignClient() {
        private final SendResp OK = new SendResp(true, "stub-req-id", null, null);

        @Override
        public SendResp sendWxMp(SendReq req) { return OK; }

        @Override
        public SendResp sendApp(SendReq req) { return OK; }

        @Override
        public SendResp sendEmail(SendReq req) { return OK; }

        @Override
        public SendResp sendSms(SendReq req) { return OK; }
      };
    }
  }
}
