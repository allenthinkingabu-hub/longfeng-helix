package com.longfeng.reviewplan.exception;

/**
 * SC20-T02 · JudgeController 错误码异常集 · 沿现役 PlanNotFoundException + PlanMasteredException 模式.
 *
 * <p>5 个 sealed exception · 由 GlobalExceptionHandler 映射到 HTTP status + JudgeErrorResp.
 * 字面映射 (test-cases.md AC6):
 * <ul>
 *   <li>{@link Unauthenticated} → 401 · error_code='UNAUTHENTICATED'</li>
 *   <li>{@link NodeNotFound} → 404 · error_code='NODE_NOT_FOUND'</li>
 *   <li>{@link NodeAlreadyGraded} → 409 · error_code='NODE_ALREADY_GRADED'</li>
 *   <li>{@link ImageKeyInvalid} → 422 · error_code='IMAGE_KEY_INVALID'</li>
 *   <li>{@link AiServiceUnavailable} → 503 · error_code='AI_SERVICE_UNAVAILABLE'</li>
 * </ul>
 */
public final class JudgeExceptions {

    private JudgeExceptions() {}

    public static class Unauthenticated extends RuntimeException {
        public Unauthenticated(String message) { super(message); }
    }

    public static class NodeNotFound extends RuntimeException {
        private final Long nid;
        public NodeNotFound(Long nid) {
            super("Review node not found: " + nid);
            this.nid = nid;
        }
        public Long getNid() { return nid; }
    }

    public static class NodeAlreadyGraded extends RuntimeException {
        private final Long nid;
        public NodeAlreadyGraded(Long nid) {
            super("Review node already graded: " + nid);
            this.nid = nid;
        }
        public Long getNid() { return nid; }
    }

    public static class ImageKeyInvalid extends RuntimeException {
        public ImageKeyInvalid(String message) { super(message); }
    }

    public static class AiServiceUnavailable extends RuntimeException {
        public AiServiceUnavailable(String message) { super(message); }
        public AiServiceUnavailable(String message, Throwable cause) { super(message, cause); }
    }
}
