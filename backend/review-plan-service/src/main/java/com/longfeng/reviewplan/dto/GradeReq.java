package com.longfeng.reviewplan.dto;

/**
 * POST /api/review/nodes/{nid}/grade request body.
 * 三态映射: MASTERED→5, PARTIAL→3, FORGOT→0.
 */
public record GradeReq(String grade) {

    public int toQuality() {
        if (grade == null) return 3;
        return switch (grade.toUpperCase()) {
            case "MASTERED" -> 5;
            case "PARTIAL" -> 3;
            case "FORGOT" -> 0;
            default -> 3;
        };
    }
}
