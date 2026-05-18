package com.longfeng.reviewplan.dto;

import java.util.List;

/**
 * P-HOME 「本周日程」周历下每日彩色 dots · 替代之前 FE 写死 PLACEHOLDER_DOTS_BY_WEEKDAY.
 *
 * <p>每条 day 对应周一→周日 7 天 (本周内) · dots 来自当日 active review_plan 的 node_index 映射:
 * - T0/T1 → '#FF3B30' (red · 早期高频复习)
 * - T2/T3 → '#FF9500' (orange · 中期)
 * - T4/T5/T6 → '#34C759' (green · 长周期)
 *
 * <p>'考试' '家庭' (mockup 提到的红/紫 dots) 没有对应 BE schema (无 exam/family_event 表) ·
 * MVP 不实现 · spec L151 列在 weekStrip Phase 1+ 范畴.
 */
public record WeekDotsResp(
    List<DayDots> days
) {
    public record DayDots(
        String date,     // 'YYYY-MM-DD'
        List<String> dots // 颜色 hex 列表 · 桶内去重保留出现顺序
    ) {}
}
