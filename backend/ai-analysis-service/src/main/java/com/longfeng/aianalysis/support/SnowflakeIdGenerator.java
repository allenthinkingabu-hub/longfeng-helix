package com.longfeng.aianalysis.support;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Snowflake 64-bit ID generator. Thread-safe within a single JVM.
 * Worker ID configured via {@code longfeng.snowflake.worker-id}.
 */
@Component
public class SnowflakeIdGenerator {

    private static final long EPOCH = 1700000000000L;
    private static final int WORKER_BITS = 10;
    private static final int SEQ_BITS = 12;
    private static final long MAX_SEQ = (1L << SEQ_BITS) - 1;

    private final long workerId;
    private long lastTs = -1L;
    private long seq = 0L;

    public SnowflakeIdGenerator(@Value("${longfeng.snowflake.worker-id:4}") long workerId) {
        if (workerId < 0 || workerId >= (1L << WORKER_BITS)) {
            throw new IllegalArgumentException("worker-id out of range: " + workerId);
        }
        this.workerId = workerId;
    }

    public synchronized long nextId() {
        long ts = System.currentTimeMillis();
        if (ts == lastTs) {
            seq = (seq + 1) & MAX_SEQ;
            if (seq == 0) {
                while (ts <= lastTs) { ts = System.currentTimeMillis(); }
            }
        } else {
            seq = 0;
        }
        lastTs = ts;
        return ((ts - EPOCH) << (WORKER_BITS + SEQ_BITS)) | (workerId << SEQ_BITS) | seq;
    }
}
