package com.longfeng.reviewplan.dto;

/**
 * P-HOME 「本周回顾」4 stat · 替代之前 FE 写死 MVP_WEEK_STATS = 23/8/2/68%.
 *
 * <p>口径:
 * - mastered: 本周 review_outcome.quality=5 计数 (掌握事件 · 同题多次掌握各算 1)
 * - newItems: 本周新增 wrong_item.status=CONFIRMED 计数 (新错题入库数)
 * - forgotten: 本周 review_outcome.quality=0 计数 (遗忘事件)
 * - masteryRate: mastered * 100 / max(1, mastered + partial + forgotten) ·
 *   本周掌握率 (= 总 grade 事件中掌握所占比) · 无事件 → 0
 */
public record WeeklyStatsResp(
    int mastered,
    int newItems,
    int forgotten,
    int masteryRate
) {}
