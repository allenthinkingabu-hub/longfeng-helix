package com.longfeng.anonymousservice.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * SC-12-T09 · 游客每日配额限制 · 运行时通过 application.yml 调整 · 无需改代码.
 *
 * <p>Prefix {@code anon.quota.*} 与 {@link AnonStorageProperties} (anon.storage),
 * {@link AnonClaimProperties} (anon.wrongbook), {@link AiAnalysisProperties}
 * (anon.ai-analysis) 维持平级 disjoint, 防止互相覆盖.
 *
 * <p>默认值与 biz 规格对齐:
 * <ul>
 *   <li>{@code deviceLimitPerDay = 1} (biz §2A.3.2 「单设备单日硬上限 1 次」)</li>
 *   <li>{@code ipLimitPerDay = 10} (biz §2B.13 「IP bucket 10/day」)</li>
 * </ul>
 *
 * <p>覆盖方式 (优先级 env > yml):
 * <pre>
 *   ANON_QUOTA_DEVICE_LIMIT_PER_DAY=100 mvn spring-boot:run
 *   或编辑 application.yml: anon.quota.device-limit-per-day: 100
 * </pre>
 */
@Component
@ConfigurationProperties(prefix = "anon.quota")
public class AnonQuotaProperties {

    /** 单设备单日配额 · biz §2A.3.2 默认 1. */
    private long deviceLimitPerDay = 1L;

    /** IP 每日配额 · biz §2B.13 默认 10. */
    private long ipLimitPerDay = 10L;

    public long getDeviceLimitPerDay() {
        return deviceLimitPerDay;
    }

    public void setDeviceLimitPerDay(long deviceLimitPerDay) {
        this.deviceLimitPerDay = deviceLimitPerDay;
    }

    public long getIpLimitPerDay() {
        return ipLimitPerDay;
    }

    public void setIpLimitPerDay(long ipLimitPerDay) {
        this.ipLimitPerDay = ipLimitPerDay;
    }
}
