package com.longfeng.reviewplan.service;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/**
 * SC-01-C05 · in-memory opened/revealed timestamps.
 *
 * <p>Reboot 后丢失 — 当前 B02 决策显式接受。Phase 1+ 可下沉到 review_outcome 新增列。
 */
@Component
public class NodeLifecycleTracker {

    private final Map<Long, Instant> openedAt = new ConcurrentHashMap<>();
    private final Map<Long, Instant> revealedAt = new ConcurrentHashMap<>();

    public void markOpened(Long nid) {
        openedAt.putIfAbsent(nid, Instant.now());
    }

    public void markRevealed(Long nid) {
        revealedAt.putIfAbsent(nid, Instant.now());
    }

    public Instant getOpenedAt(Long nid) {
        return openedAt.get(nid);
    }

    public Instant getRevealedAt(Long nid) {
        return revealedAt.get(nid);
    }

    /**
     * 计算从 opened 到 now 的时长（毫秒）. 未记录 openedAt 时返回 null.
     */
    public Long durationMs(Long nid) {
        Instant opened = openedAt.get(nid);
        if (opened == null) return null;
        return Instant.now().toEpochMilli() - opened.toEpochMilli();
    }
}
