package com.longfeng.reviewplan.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * SC-01-D01 · GET /api/home/today response · P-HOME 大卡聚合.
 *
 * <p>对齐 spec P-HOME §4 数据契约: {@code today.{total, done, circleProgress}} + {@code resume}.
 *
 * <p>SC-16 2026-05-16 增量: 新增 {@code weekSummary} 字段 (P-HOME 本周 Bento 4 数字投影 ·
 * masteryRate / sparkline[7] / streak / newCount) · biz §10.13 P-HOME 共享投影. 既有 today /
 * resume 子集**不动** (向后兼容).
 *
 * <p>{@code resume} 用于 P-HOME Resume Banner: B02 决策 review_session in-memory · 无可恢复持久态 →
 * 当前返 {@code null}.
 *
 * <p>{@code weekSummary} 4 字段从同一 {@code weekly_aggregate} service 调用结果投影 (INV-1 + INV-6)
 * · 不允许 controller 内嵌独立 SQL.
 */
@Schema(description = "P-HOME 今日聚合 (SC-01 + SC-16 增量 weekSummary)")
@JsonInclude(JsonInclude.Include.NON_NULL)
public record HomeTodayResp(
    @Schema(description = "echo 的时区 ID (IANA)") @JsonProperty("tz") String tz,
    @Schema(description = "今日复习卡片字段") @JsonProperty("today") TodayCard today,
    @Schema(description = "未完成会话恢复元数据 (无则 null)") @JsonProperty("resume") Resume resume,
    @Schema(description = "本周 Bento 4 字段投影 (SC-16-T01)") @JsonProperty("weekSummary")
        WeekSummaryDto weekSummary) {

  @Schema(description = "今日大卡: total/done/circleProgress")
  public record TodayCard(
      @Schema(description = "今日待复习节点总数") @JsonProperty("total") int total,
      @Schema(description = "今日已完成节点数") @JsonProperty("done") int done,
      @Schema(description = "圆环进度 0..1") @JsonProperty("circleProgress") double circleProgress) {}

  @Schema(description = "Resume Banner 元数据 · 当前阶段恒 null")
  public record Resume(
      @Schema(description = "未完成的 session id") @JsonProperty("sid") String sid,
      @Schema(description = "下一个待复习 node id") @JsonProperty("nextNid") String nextNid) {}
}
