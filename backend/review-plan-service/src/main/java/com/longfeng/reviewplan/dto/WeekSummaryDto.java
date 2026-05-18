package com.longfeng.reviewplan.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * SC-16-T01 · GET /api/home/today 扩展字段 · weekSummary 4 字段投影.
 *
 * <p>主源: biz §10.13 P-HOME 共享投影 · spec P-HOME §5.2 weekSummary 字段集.
 *
 * <p><b>不变量 INV-6 (key_invariants[4])</b>: P-HOME 4 数字 (masteryRate / sparkline[7] /
 * streak / newCount) 仅从此投影消费 · 不允许 P-HOME 单独发 SQL · 不允许 P-HOME 调
 * /api/home/weekly (冗余 payload + 重复 RTT).
 *
 * <p><b>空值语义</b> (用户 2026-05-16 决策 · biz §10.14 字面照实现):
 * <ul>
 *   <li>{@code masteryRate}: 空周 (0 GRADED) → {@code null} 不是 0.0
 *   <li>{@code sparkline[i]}: 空日 → {@code null} 不是 0 · 不 forward-fill
 *   <li>{@code streak}: integer ≥ 0 · 学生注册首日且今日无复习 → 0
 *   <li>{@code newCount}: integer ≥ 0 · 空周 → 0 (不为 null · 计数字段语义)
 * </ul>
 *
 * <p><b>JSON include = ALWAYS</b>: 即使 {@code masteryRate} = null 也必须显式输出 "masteryRate": null
 * (P-HOME 前端约定 null 显 "—%" · 字段缺失会让前端 fallback 到 0 误显 "0%").
 */
@Schema(description = "P-HOME 本周 Bento 4 字段投影 (SC-16-T01 · biz §10.13 字面)")
@JsonInclude(JsonInclude.Include.ALWAYS)
public record WeekSummaryDto(
    @Schema(description = "ISO 8601 week e.g. 2026-W20") @JsonProperty("week") String week,
    @Schema(description = "本周掌握率 0..1 · 空周 null") @JsonProperty("masteryRate")
        Double masteryRate,
    @Schema(description = "7 天每日掌握率折线 · 空日 null · 长度严格 7") @JsonProperty("sparkline")
        List<Double> sparkline,
    @Schema(description = "Streak 天数 · yesterday-back · integer ≥ 0") @JsonProperty("streak")
        int streak,
    @Schema(description = "本周新增错题数 · integer ≥ 0 · 空周 0") @JsonProperty("newCount")
        int newCount) {}
