package com.longfeng.common.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * SSE / WebSocket event payload for AI analysis 4-step pipeline.
 * <p>
 * 7 event types aligned with P03 spec section 4 type union + SC-01-C04 FALLBACK_MODEL extension.
 * Factory methods enforce field invariants per type.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AnalysisChunk {

    public enum Type {
        STEP_START, STEP_DONE, PARTIAL_JSON, DONE, FAIL, CANCELLED, FALLBACK_MODEL
    }

    /** Legacy stage enum for WS / IT backward compatibility. */
    public enum Stage {
        OCR, ANALYSIS, STEPS, DONE, FAIL, CANCELLED
    }

    private Type type;
    private Stage stage;
    private Integer step;
    private Long durationMs;
    private String chunk;
    private Object result;
    private String errorCode;
    private Integer progressPct;

    public AnalysisChunk() {}

    // ========== Factory methods ==========

    public static AnalysisChunk stepStart(int step) {
        AnalysisChunk c = new AnalysisChunk();
        c.type = Type.STEP_START;
        c.step = step;
        c.progressPct = step * 25;
        return c;
    }

    public static AnalysisChunk stepDone(int step, long durationMs) {
        AnalysisChunk c = new AnalysisChunk();
        c.type = Type.STEP_DONE;
        c.step = step;
        c.durationMs = durationMs;
        c.progressPct = step * 25;
        return c;
    }

    public static AnalysisChunk partialJson(String fragment) {
        AnalysisChunk c = new AnalysisChunk();
        c.type = Type.PARTIAL_JSON;
        c.chunk = fragment;
        return c;
    }

    public static AnalysisChunk done(Object result) {
        AnalysisChunk c = new AnalysisChunk();
        c.type = Type.DONE;
        c.result = result;
        return c;
    }

    public static AnalysisChunk fail(String errorCode) {
        AnalysisChunk c = new AnalysisChunk();
        c.type = Type.FAIL;
        c.errorCode = errorCode;
        return c;
    }

    public static AnalysisChunk failAtStep(int step, String errorCode) {
        AnalysisChunk c = new AnalysisChunk();
        c.type = Type.FAIL;
        c.step = step;
        c.errorCode = errorCode;
        return c;
    }

    public static AnalysisChunk cancelled() {
        AnalysisChunk c = new AnalysisChunk();
        c.type = Type.CANCELLED;
        return c;
    }

    public static AnalysisChunk fallbackModel(String from, String to) {
        AnalysisChunk c = new AnalysisChunk();
        c.type = Type.FALLBACK_MODEL;
        c.chunk = from + "\u2192" + to;
        return c;
    }

    // Legacy factory methods for WS/IT compat
    public static AnalysisChunk ocr() {
        AnalysisChunk c = new AnalysisChunk();
        c.stage = Stage.OCR;
        return c;
    }

    public static AnalysisChunk analysis(String text) {
        AnalysisChunk c = new AnalysisChunk();
        c.stage = Stage.ANALYSIS;
        c.chunk = text;
        return c;
    }

    public static AnalysisChunk steps(Object steps) {
        AnalysisChunk c = new AnalysisChunk();
        c.stage = Stage.STEPS;
        c.result = steps;
        return c;
    }

    /** Maps legacy Stage to Type for event name resolution. */
    public String eventName() {
        if (type != null) return type.name();
        if (stage != null) {
            return switch (stage) {
                case OCR -> Type.STEP_START.name();
                case ANALYSIS -> Type.PARTIAL_JSON.name();
                case STEPS -> Type.STEP_DONE.name();
                case DONE -> Type.DONE.name();
                case FAIL -> Type.FAIL.name();
                case CANCELLED -> Type.CANCELLED.name();
            };
        }
        return "MESSAGE";
    }

    // ========== Getters / Setters ==========

    public Type getType() { return type; }
    public void setType(Type type) { this.type = type; }
    public Stage getStage() { return stage; }
    public void setStage(Stage stage) { this.stage = stage; }
    public Integer getStep() { return step; }
    public void setStep(Integer step) { this.step = step; }
    public Long getDurationMs() { return durationMs; }
    public void setDurationMs(Long durationMs) { this.durationMs = durationMs; }
    public String getChunk() { return chunk; }
    public void setChunk(String chunk) { this.chunk = chunk; }
    public Object getResult() { return result; }
    public void setResult(Object result) { this.result = result; }
    public String getErrorCode() { return errorCode; }
    public void setErrorCode(String errorCode) { this.errorCode = errorCode; }
    public Integer getProgressPct() { return progressPct; }
    public void setProgressPct(Integer progressPct) { this.progressPct = progressPct; }
}
