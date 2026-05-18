package com.longfeng.reviewplan.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * SC-16-T01 · GET /api/home/weekly response · P-WEEKLY-REVIEW 完整聚合.
 *
 * <p>主源: biz §10.12 · spec P-WEEKLY-REVIEW §5.1 字符级.
 *
 * <p><b>顶层 8 keys set equality</b> (test-cases.md Case 1 字面卡):
 * {@code {week, range, hero, subjectRadar, weakKPs, stats, failedTop, aiInsight}}.
 *
 * <p><b>学生端脱敏 (INV-2)</b>: 不含 {@code student_id_hash} / {@code parent_id} /
 * {@code device_fp} 三字段 (与家长端 P-OBSERVER /api/observer/overview 字段集不同).
 *
 * <p><b>JSON include = ALWAYS</b>: 防字段缺失 → 前端 destructure 拿 undefined 漂移.
 */
@Schema(description = "P-WEEKLY-REVIEW 周回顾聚合 (SC-16-T01)")
@JsonInclude(JsonInclude.Include.ALWAYS)
public record WeeklyReviewResp(
    @Schema(description = "ISO 8601 week e.g. 2026-W20") @JsonProperty("week") String week,
    @Schema(description = "周边界 from 周一 to 周日 student_tz") @JsonProperty("range")
        WeekRange range,
    @Schema(description = "Hero · 掌握率 + delta + 折线") @JsonProperty("hero") Hero hero,
    @Schema(description = "学科雷达 4-6 项") @JsonProperty("subjectRadar")
        List<SubjectRadar> subjectRadar,
    @Schema(description = "薄弱 KP top 3 · recentMissCount DESC") @JsonProperty("weakKPs")
        List<WeakKp> weakKPs,
    @Schema(description = "本周节奏 stats") @JsonProperty("stats") Stats stats,
    @Schema(description = "失败题 top 5") @JsonProperty("failedTop") List<FailedQ> failedTop,
    @Schema(description = "AI 一句话复盘") @JsonProperty("aiInsight") AiInsight aiInsight) {

  /** {@code range.{from,to}} · ISO 8601 date string · 学生 tz 周一-周日. */
  public record WeekRange(
      @JsonProperty("from") String from, @JsonProperty("to") String to) {}

  /** {@code hero.{masteryRate,masteryDelta,sparkline}} · 顶层 3 子字段. */
  public record Hero(
      @JsonProperty("masteryRate") Double masteryRate,
      @JsonProperty("masteryDelta") Double masteryDelta,
      @JsonProperty("sparkline") List<Double> sparkline) {}

  /** {@code subjectRadar[i].{subject,masteryRate,sampleSize}}. */
  public record SubjectRadar(
      @JsonProperty("subject") String subject,
      @JsonProperty("masteryRate") Double masteryRate,
      @JsonProperty("sampleSize") int sampleSize) {}

  /**
   * {@code weakKPs[i]} · 按 {@code recentMissCount DESC} 排序 · length ≤ 3 (INV-4).
   * 不按 totalMissCount 排 (test-cases.md Case 5 反诱饵).
   */
  public record WeakKp(
      @JsonProperty("kpId") String kpId,
      @JsonProperty("kpName") String kpName,
      @JsonProperty("subject") String subject,
      @JsonProperty("recentMissCount") int recentMissCount,
      @JsonProperty("totalMissCount") int totalMissCount) {}

  /** {@code stats.{reviewedCount,reviewedDurationMin,newCount}}. */
  public record Stats(
      @JsonProperty("reviewedCount") int reviewedCount,
      @JsonProperty("reviewedDurationMin") int reviewedDurationMin,
      @JsonProperty("newCount") int newCount) {}

  /** {@code failedTop[i]} · max 5. thumbnailUrl 2026-05-18 加 ·
   *  wrong_item.origin_image_key 经 MinIO public endpoint 构完整 URL · 前端 image src 直接消费. */
  public record FailedQ(
      @JsonProperty("questionId") String questionId,
      @JsonProperty("subject") String subject,
      @JsonProperty("missCount") int missCount,
      @JsonProperty("thumbnailUrl") String thumbnailUrl) {}

  /** {@code aiInsight.{insightId,text,generatedAt}} · 3 子字段. */
  public record AiInsight(
      @JsonProperty("insightId") String insightId,
      @JsonProperty("text") String text,
      @JsonProperty("generatedAt") String generatedAt) {}
}
