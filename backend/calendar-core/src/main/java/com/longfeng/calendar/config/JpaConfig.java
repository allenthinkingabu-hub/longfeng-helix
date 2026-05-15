package com.longfeng.calendar.config;

import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;

/**
 * JPA configuration · BACKEND_GUIDANCE §2 pattern (aligned with review-plan-service FeignAndJpaConfig).
 */
@Configuration
@EnableJpaRepositories(basePackages = "com.longfeng.calendar.repo")
@EntityScan(basePackages = "com.longfeng.calendar.entity")
@EnableJpaAuditing
public class JpaConfig {
}
