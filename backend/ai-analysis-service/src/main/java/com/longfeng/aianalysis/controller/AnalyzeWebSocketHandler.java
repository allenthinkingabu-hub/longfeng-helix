package com.longfeng.aianalysis.controller;

import com.longfeng.aianalysis.service.AnalysisStreamHub;
import java.net.URI;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

/**
 * WebSocket handler at /ws/analyze/{taskId}.
 * Mini-program (小程序) endpoint. 30s heartbeat, 60s total timeout.
 * Receives "CANCEL" text to trigger dispose.
 * Shares AnalysisStreamHub sink with SSE (D-AI-Stream single-source pattern).
 */
@Component
public class AnalyzeWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(AnalyzeWebSocketHandler.class);

    private final AnalysisStreamHub streamHub;

    public AnalyzeWebSocketHandler(AnalysisStreamHub streamHub) {
        this.streamHub = streamHub;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        String taskId = extractTaskId(session);
        if (taskId != null) {
            streamHub.registerWs(taskId, session);
            log.info("WS connected: taskId={}, sessionId={}", taskId, session.getId());
        }
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        String taskId = extractTaskId(session);
        if (taskId != null && "CANCEL".equalsIgnoreCase(message.getPayload().trim())) {
            log.info("WS cancel received: taskId={}", taskId);
            streamHub.dispose(taskId);
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        String taskId = extractTaskId(session);
        if (taskId != null) {
            streamHub.removeWs(taskId);
            log.info("WS closed: taskId={}, status={}", taskId, status);
        }
    }

    private String extractTaskId(WebSocketSession session) {
        URI uri = session.getUri();
        if (uri == null) return null;
        String path = uri.getPath();
        // /ws/analyze/{taskId}
        int idx = path.lastIndexOf('/');
        return idx >= 0 ? path.substring(idx + 1) : null;
    }
}
