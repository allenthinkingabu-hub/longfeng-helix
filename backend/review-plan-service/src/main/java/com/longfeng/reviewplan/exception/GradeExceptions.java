package com.longfeng.reviewplan.exception;

/**
 * SC20-T03 · POST /api/review/nodes/{nid}/grade 错误码异常集 · 沿 JudgeExceptions sealed 模式.
 *
 * <p>3 个 RuntimeException 子类 · 由 ReviewPlanController 局部 @ExceptionHandler 映射到 HTTP status + ApiResult.fail.
 *
 * <p>字面映射 (test-cases.md Round 2 #3 / #6 子断言 #a / #6 子断言 #d-1):
 * <ul>
 *   <li>{@link InvalidFinalGradeSource} → 422 · code=42210 · message 含 'INVALID_FINAL_GRADE_SOURCE'</li>
 *   <li>{@link GradeSourceMismatch} → 422 · code=42211 · message 含 'GRADE_SOURCE_MISMATCH'</li>
 *   <li>{@link NodeAlreadyGraded} → 409 · code=40902 · message 含 'NODE_ALREADY_GRADED'</li>
 * </ul>
 *
 * <p>全部 RuntimeException 子类 · @Transactional 默认 rollback (test-cases.md Round 2 #3 字面要求 partial write 禁).
 */
public final class GradeExceptions {

    private GradeExceptions() {}

    /**
     * 422 · final_grade_source 字段值不在 enum {'self', 'ai_accepted', 'ai_overridden'} 内 ·
     * 或大小写错 / 空串 / 超 VARCHAR(16) 长度. Round 2 用例 #6 子断言 #a 4 子情况.
     */
    public static class InvalidFinalGradeSource extends RuntimeException {
        public InvalidFinalGradeSource(String message) {
            super(message);
        }
    }

    /**
     * 422 · final_grade_source 与 ai_judge_verdict 字段约束 (§4.16) 不一致:
     * - 'ai_accepted' ⟹ ai_judge_verdict === grade
     * - 'ai_overridden' ⟹ ai_judge_verdict != grade
     * Round 2 用例 #3 字面.
     */
    public static class GradeSourceMismatch extends RuntimeException {
        public GradeSourceMismatch(String message) {
            super(message);
        }
    }

    /**
     * 409 · 节点已 grade · master §10.5 idempotency 现役行为 (plan.completedAt != null 或 status=MASTERED).
     * Round 2 用例 #6 子断言 #d-1.
     */
    public static class NodeAlreadyGraded extends RuntimeException {
        public NodeAlreadyGraded(String message) {
            super(message);
        }
    }

    /**
     * 403 · 跨用户访问 · plan.student_id != X-User-Id header.
     * Round 2 用例 #6 子断言 #c · A.1 学生主体性宪法.
     */
    public static class NodeNotOwned extends RuntimeException {
        public NodeNotOwned(String message) {
            super(message);
        }
    }
}
