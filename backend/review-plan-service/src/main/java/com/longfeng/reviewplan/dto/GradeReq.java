package com.longfeng.reviewplan.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * POST /api/review/nodes/{nid}/grade request body.
 *
 * <p>SC20-T03 (M-AI-ANSWER-JUDGE §10.18) · 加 finalGradeSource 字段 · 缺省 'self' · 向后兼容
 * (旧客户端不传字段 → record canonical constructor 收 null → toFinalGradeSource() 兜底 'self'.
 * 字段约束 (§4.16): 'self' | 'ai_accepted' | 'ai_overridden').
 *
 * <p>{@code @JsonProperty("final_grade_source")} 让 Jackson 把 snake_case body 字段映射到 record camelCase field
 * (用例 #1/#3/#4 body 字面用 snake_case).
 *
 * <p>三态映射: MASTERED → 5, PARTIAL → 3, FORGOT → 0.
 */
public record GradeReq(
    String grade,
    @JsonProperty("final_grade_source") String finalGradeSource) {

    /** 旧客户端兼容 · 单参 constructor 不传 finalGradeSource → null. */
    public GradeReq(String grade) {
        this(grade, null);
    }

    public int toQuality() {
        if (grade == null) return 3;
        return switch (grade.toUpperCase()) {
            case "MASTERED" -> 5;
            case "PARTIAL" -> 3;
            case "FORGOT" -> 0;
            default -> 3;
        };
    }

    /**
     * 兜底 default 'self' · §10.18 字面 "字段不存在 = 'self'".
     * 但 **空串 / 大小写错 / 非法值不在此兜底** · 由 Controller 校验返 422 INVALID_FINAL_GRADE_SOURCE.
     */
    public String toFinalGradeSource() {
        return finalGradeSource == null ? "self" : finalGradeSource;
    }
}
