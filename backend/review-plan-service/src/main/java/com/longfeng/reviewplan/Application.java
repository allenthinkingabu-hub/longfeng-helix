package com.longfeng.reviewplan;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.retry.annotation.EnableRetry;
import org.springframework.scheduling.annotation.EnableAsync;

/** review-plan-service entry point · 落地计划 §9. SC-01-C07: {@code @EnableRetry} 启用
 * {@code spring-retry} {@code @Retryable} 注解处理（calendar-core 503 重试 3 次）. */
@SpringBootApplication(scanBasePackages = {"com.longfeng.reviewplan", "com.longfeng.common"})
@EnableCaching
@EnableAsync
@EnableRetry
public class Application {

  public static void main(String[] args) {
    SpringApplication.run(Application.class, args);
  }
}
