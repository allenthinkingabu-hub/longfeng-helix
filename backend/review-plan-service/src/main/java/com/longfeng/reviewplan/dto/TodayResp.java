package com.longfeng.reviewplan.dto;

import java.util.List;

/**
 * GET /api/review/today response.
 *
 * <p>spec L97-98 (design/system/pages/P07-review-today.spec.md) 要求返回:
 * - progressPct: doneCount/totalCount * 100 (FE 自算 · 与 hero "已完成" 同 mastered 口径 ·
 *   spec 字面 GRADED · drift surface: 我们用 mastered 更贴近用户视角 ·
 *   见 pages/review-today/index.ts 注释 L75-80)
 * - masteryPct: SM-2 ease_factor 聚合 from wb_review_outcome (本字段 · BE 算)
 *
 * <p>masteryPct 公式: 对今日所有 plan 拿 latest outcome.ease_factor_after,
 * avg(ease) 映射 [1.3, 3.0] → [0, 100]. 没 outcome (今日全新没复习过) → 0%.
 */
public record TodayResp(
    List<ReviewPlanDto> items,
    int total,
    String tz,
    // 0-100 · spec L98 · null/0 = 今日所有题目均未复习过 (诚实 · 不假装有进度)
    Integer masteryPct
) {}
