package com.longfeng.reviewplan.algo;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * SM-2 algorithm implementation (pure function).
 */
public final class SM2Algorithm {

    private SM2Algorithm() {}

    public static SM2Result compute(BigDecimal easeFactor, int intervalDays, int quality, AlgorithmConfig cfg) {
        BigDecimal ef = easeFactor;
        BigDecimal q = BigDecimal.valueOf(quality);
        // SM-2 EF formula: EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
        BigDecimal delta = new BigDecimal("0.1")
                .subtract(BigDecimal.valueOf(5 - quality)
                        .multiply(new BigDecimal("0.08")
                                .add(BigDecimal.valueOf(5 - quality).multiply(new BigDecimal("0.02")))));
        BigDecimal nextEf = ef.add(delta);
        if (nextEf.compareTo(cfg.easeMin()) < 0) {
            nextEf = cfg.easeMin();
        }
        nextEf = nextEf.setScale(3, RoundingMode.HALF_UP);

        int nextInterval;
        if (quality < 3) {
            nextInterval = 1;
        } else if (intervalDays == 0) {
            nextInterval = 1;
        } else {
            nextInterval = Math.max(1, (int) Math.round(intervalDays * nextEf.doubleValue()));
        }

        return new SM2Result(nextEf, nextInterval);
    }
}
