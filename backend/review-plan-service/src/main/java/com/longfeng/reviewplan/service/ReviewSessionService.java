package com.longfeng.reviewplan.service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;

/**
 * SC-01-C05 · B02 决策 A · in-memory session store.
 *
 * <p>会话生命周期：POST /api/review/sessions create → POST /sessions/{sid}/next 翻页 →
 * done=true 自然结束。Reboot 后丢失（B02 显式接受）。
 */
@Service
public class ReviewSessionService {

    private final Map<String, Session> store = new ConcurrentHashMap<>();

    /** 创建 session · 返回 sid. */
    public Session create(List<Long> nids) {
        String sid = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        Session session = new Session(sid, new ArrayList<>(nids), 0);
        store.put(sid, session);
        return session;
    }

    /** 获取下一个待复习的 nid · 并推进 cursor. */
    public PeekResult peekNext(String sid) {
        Session s = store.get(sid);
        if (s == null) {
            return new PeekResult(null, 0, 0, true);
        }
        int total = s.nids.size();
        int cursor = s.cursor;
        if (cursor >= total) {
            return new PeekResult(null, total, total, true);
        }
        Long nextNid = s.nids.get(cursor);
        s.cursor = cursor + 1;
        boolean done = s.cursor >= total;
        return new PeekResult(nextNid, s.cursor, total, done);
    }

    public Session get(String sid) {
        return store.get(sid);
    }

    public static class Session {
        public final String sid;
        public final List<Long> nids;
        public volatile int cursor;

        public Session(String sid, List<Long> nids, int cursor) {
            this.sid = sid;
            this.nids = Collections.unmodifiableList(nids);
            this.cursor = cursor;
        }
    }

    public record PeekResult(Long nextNid, int completed, int total, boolean done) {}
}
