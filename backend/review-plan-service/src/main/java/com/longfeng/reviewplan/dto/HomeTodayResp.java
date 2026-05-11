package com.longfeng.reviewplan.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * SC-01-D01 · GET /api/home/today response · P-HOME 大卡聚合（最小子集）.
 *
 * <p>对齐 spec P-HOME §4 数据契约最关键三字段：{@code today.{total, done, circleProgress}}。
 * 其余 9 字段（streak / weekSparkline / weekStrip / messages / weakKP / quickEntries / studentName）
 * 由 A07 推荐的独立 home-aggregator 模块在 Phase 1 落地，本任务只承载 SC-01 黄金路径所需子集。
 *
 * <p>{@code resume} 用于 P-HOME Resume Banner：B02 决策中 review_session 为 in-memory，
 * 无可恢复持久态 → 当前返 {@code null}（前端隐藏 Resume Banner）。
 */
@Schema(description = "P-HOME 今日聚合（SC-01 MVP 子集）")
@JsonInclude(JsonInclude.Include.NON_NULL)
public record HomeTodayResp(
    @Schema(description = "echo 的时区 ID（IANA）") @JsonProperty("tz") String tz,
    @Schema(description = "今日复习卡片字段") @JsonProperty("today") TodayCard today,
    @Schema(description = "未完成会话恢复元数据（无则 null）") @JsonProperty("resume") Resume resume) {

  @Schema(description = "今日大卡：total/done/circleProgress")
  public record TodayCard(
      @Schema(description = "今日待复习节点总数（active + completed）") @JsonProperty("total")
          int total,
      @Schema(description = "今日已完成节点数") @JsonProperty("done") int done,
      @Schema(description = "圆环进度 0..1（total=0 时为 0）") @JsonProperty("circleProgress")
          double circleProgress) {}

  @Schema(description = "Resume Banner 元数据 · in-memory session 无持久化 → 当前阶段恒 null")
  public record Resume(
      @Schema(description = "未完成的 session id（B02 in-memory · 暂不下发）") @JsonProperty("sid")
          String sid,
      @Schema(description = "下一个待复习 node id（review_plan.id）") @JsonProperty("nextNid")
          String nextNid) {}
}
