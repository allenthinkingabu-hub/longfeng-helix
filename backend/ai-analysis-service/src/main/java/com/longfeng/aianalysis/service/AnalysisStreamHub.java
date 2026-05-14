package com.longfeng.aianalysis.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.longfeng.common.dto.AnalysisChunk;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

/**
 * Central hub for SSE + WebSocket streaming per taskId.
 * Implements D-AI-Stream single-source pattern: both SSE and WS share the same emit path.
 */
@Component
public class AnalysisStreamHub {

    private static final Logger log = LoggerFactory.getLogger(AnalysisStreamHub.class);

    private final Map<String, List<SseEmitter>> sseSubscribers = new ConcurrentHashMap<>();
    private final Map<String, WebSocketSession> wsSubscribers = new ConcurrentHashMap<>();
    private final Map<String, String> ocrTexts = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper;

    public AnalysisStreamHub(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public SseEmitter subscribe(String taskId, long timeoutMs) {
        SseEmitter emitter = new SseEmitter(timeoutMs);
        sseSubscribers.computeIfAbsent(taskId, k -> new CopyOnWriteArrayList<>()).add(emitter);
        emitter.onCompletion(() -> removeSseSubscriber(taskId, emitter));
        emitter.onTimeout(() -> removeSseSubscriber(taskId, emitter));
        emitter.onError(e -> removeSseSubscriber(taskId, emitter));
        return emitter;
    }

    public void registerWs(String taskId, WebSocketSession session) {
        wsSubscribers.put(taskId, session);
    }

    public void removeWs(String taskId) {
        wsSubscribers.remove(taskId);
    }

    public void emit(String taskId, AnalysisChunk chunk) {
        // SSE subscribers
        List<SseEmitter> emitters = sseSubscribers.get(taskId);
        if (emitters != null) {
            for (SseEmitter emitter : emitters) {
                try {
                    emitter.send(SseEmitter.event()
                            .name(chunk.eventName())
                            .data(chunk));
                } catch (IOException e) {
                    log.debug("SSE send failed for taskId={}, removing subscriber", taskId);
                    removeSseSubscriber(taskId, emitter);
                }
            }
        }
        // WS subscriber
        WebSocketSession ws = wsSubscribers.get(taskId);
        if (ws != null && ws.isOpen()) {
            try {
                String json = objectMapper.writeValueAsString(chunk);
                ws.sendMessage(new TextMessage(json));
            } catch (IOException e) {
                log.debug("WS send failed for taskId={}", taskId);
            }
        }
    }

    public void complete(String taskId) {
        List<SseEmitter> emitters = sseSubscribers.remove(taskId);
        if (emitters != null) {
            for (SseEmitter emitter : emitters) {
                try { emitter.complete(); } catch (Exception ignored) {}
            }
        }
        WebSocketSession ws = wsSubscribers.remove(taskId);
        if (ws != null && ws.isOpen()) {
            try { ws.close(); } catch (IOException ignored) {}
        }
    }

    /** Cancel: emit CANCELLED frame, then complete all subscribers + cleanup. */
    public void cancel(String taskId) {
        emit(taskId, AnalysisChunk.cancelled());
        complete(taskId);
    }

    /** Dispose: emit CANCELLED, complete, and clear ocrTexts. */
    public void dispose(String taskId) {
        cancel(taskId);
        ocrTexts.remove(taskId);
    }

    public void putOcrText(String taskId, String text) {
        if (text != null && !text.isBlank()) {
            ocrTexts.put(taskId, text);
        }
    }

    public String getOcrText(String taskId) {
        return ocrTexts.get(taskId);
    }

    public boolean hasSubscribers(String taskId) {
        List<SseEmitter> emitters = sseSubscribers.get(taskId);
        boolean hasSse = emitters != null && !emitters.isEmpty();
        WebSocketSession ws = wsSubscribers.get(taskId);
        boolean hasWs = ws != null && ws.isOpen();
        return hasSse || hasWs;
    }

    private void removeSseSubscriber(String taskId, SseEmitter emitter) {
        List<SseEmitter> emitters = sseSubscribers.get(taskId);
        if (emitters != null) {
            emitters.remove(emitter);
            if (emitters.isEmpty()) {
                sseSubscribers.remove(taskId);
            }
        }
    }
}
