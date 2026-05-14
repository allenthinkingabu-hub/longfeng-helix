package com.longfeng.reviewplan.algo;

import java.math.BigDecimal;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "review.algorithm")
public class AlgorithmConfig {

    private BigDecimal easeInit = new BigDecimal("2.500");
    private BigDecimal easeMin = new BigDecimal("1.300");

    public BigDecimal easeInit() { return easeInit; }
    public void setEaseInit(BigDecimal easeInit) { this.easeInit = easeInit; }
    public BigDecimal easeMin() { return easeMin; }
    public void setEaseMin(BigDecimal easeMin) { this.easeMin = easeMin; }
}
