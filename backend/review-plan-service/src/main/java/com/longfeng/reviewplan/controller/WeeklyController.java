package com.longfeng.reviewplan.controller;

import com.longfeng.common.dto.ApiResult;
import com.longfeng.common.exception.BusinessException;
import com.longfeng.common.exception.ErrCode;
import com.longfeng.reviewplan.dto.WeeklyReviewResp;
import com.longfeng.reviewplan.service.WeeklyAggregateService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Clock;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

/**
 * SC-16-T01 · GET /api/home/weekly · P-WEEKLY-REVIEW 完整聚合 controller.
 *
 * <p>主源 biz §10.12 字面 schema · spec P-WEEKLY-REVIEW §5.1 + §5.2 错误码 + §5.3 同 service 双
 * endpoint 架构.
 *
 * <p><b>不变量 INV-1 + INV-6</b>: 调用 {@link WeeklyAggregateService#aggregate(long, ZoneId)} 拿 raw
 * POJO 后投影为 {@link WeeklyReviewResp} · 与 {@link HomeAggregatorController#homeToday} 调同一
 * service · 同一参数 · 防 P-HOME / P-WEEKLY-REVIEW 数据漂移.
 *
 * <p><b>鉴权 MVP</b>: {@code X-User-Id} Header (与 /api/home/today 一致 · 登录 SC-00 上线时升 JWT ·
 * 不允许 T01 单独升). 缺失 / 格式非法 → 401 UNAUTHORIZED (spec §5.2 line 238).
 *
 * <p><b>错误码</b> (spec §5.2):
 * <ul>
 *   <li>401 UNAUTHORIZED · X-User-Id 缺失 / 格式非法
 *   <li>500 INTERNAL · 后端聚合 SQL 失败 / Service 异常 (GlobalExceptionHandler 兜底)
 *   <li>504 GATEWAY_TIMEOUT · 由 service 单测层 @Timeout(800) 验证 (test-cases.md Round 2 透明)
 * </ul>
 *
 * <p><b>学生端脱敏 (INV-2)</b>: response 不含 student_id_hash / parent_id / device_fp ·
 * DTO 不声明这些字段就天然脱敏.
 */
@RestController
@Tag(name = "home-aggregator", description = "P-WEEKLY-REVIEW 周回顾聚合 (SC-16-T01)")
public class WeeklyController {

  private static final String USER_ID_HEADER = "X-User-Id";
  private static final String TIMEZONE_HEADER = "X-User-Timezone";
  private static final String DEFAULT_TZ = "Asia/Shanghai";

  private final WeeklyAggregateService aggregateService;
  private final Clock clock;

  public WeeklyController(WeeklyAggregateService aggregateService, Clock clock) {
    this.aggregateService = aggregateService;
    this.clock = clock;
  }

  @Operation(summary = "P-WEEKLY-REVIEW 完整聚合 (SC-16-T01)")
  @ApiResponse(responseCode = "200", description = "WeeklyReviewResp 完整字段集")
  @ApiResponse(responseCode = "401", description = "X-User-Id 缺失或格式非法")
  @ApiResponse(responseCode = "500", description = "聚合内部错误")
  @GetMapping("/api/home/weekly")
  public ApiResult<WeeklyReviewResp> getWeekly(
      @RequestHeader(value = USER_ID_HEADER, required = false) String userIdHeader,
      @RequestHeader(value = TIMEZONE_HEADER, required = false) String tzHeader) {

    long studentId = parseUserId(userIdHeader);
    ZoneId tz = resolveZone(tzHeader);

    WeeklyAggregateService.WeeklyAggregateRaw raw = aggregateService.aggregate(studentId, tz);
    WeeklyReviewResp resp = projectToWeeklyReviewResp(raw, studentId, clock);
    return ApiResult.ok(resp);
  }

  /**
   * 解析 X-User-Id Header · 缺失 / 非数字 / 非正数 → 401 UNAUTHORIZED (spec §5.2 line 238).
   *
   * <p><b>不可见为 INTERNAL</b>: 不允许把非法 Header 错误退化成 500 (TI2 字面).
   */
  private static long parseUserId(String userIdHeader) {
    if (userIdHeader == null || userIdHeader.isBlank()) {
      throw new BusinessException(
          ErrCode.UNAUTHORIZED, "msgkey:weekly.error.unauthorized");
    }
    try {
      long id = Long.parseLong(userIdHeader.trim());
      if (id <= 0L) {
        throw new BusinessException(
            ErrCode.UNAUTHORIZED, "msgkey:weekly.error.unauthorized");
      }
      return id;
    } catch (NumberFormatException nfe) {
      throw new BusinessException(
          ErrCode.UNAUTHORIZED, "msgkey:weekly.error.unauthorized");
    }
  }

  private static ZoneId resolveZone(String tzHeader) {
    if (tzHeader == null || tzHeader.isBlank()) {
      return ZoneId.of(DEFAULT_TZ);
    }
    try {
      return ZoneId.of(tzHeader);
    } catch (Exception e) {
      return ZoneId.of(DEFAULT_TZ);
    }
  }

  /** raw POJO → WeeklyReviewResp DTO · 学生端脱敏在 DTO 字段集层天然生效 (INV-2). */
  private static WeeklyReviewResp projectToWeeklyReviewResp(
      WeeklyAggregateService.WeeklyAggregateRaw raw, long studentId, Clock clock) {
    List<WeeklyReviewResp.SubjectRadar> radar = new ArrayList<>();
    for (WeeklyAggregateService.SubjectRadarRaw r : raw.subjectRadar) {
      radar.add(new WeeklyReviewResp.SubjectRadar(r.subject(), r.masteryRate(), r.sampleSize()));
    }
    List<WeeklyReviewResp.WeakKp> weakKps = new ArrayList<>();
    for (WeeklyAggregateService.WeakKpRaw w : raw.weakKps) {
      weakKps.add(new WeeklyReviewResp.WeakKp(
          w.kpId(), w.kpName(), w.subject(), w.recentMissCount(), w.totalMissCount()));
    }
    List<WeeklyReviewResp.FailedQ> failedTop = new ArrayList<>();
    for (WeeklyAggregateService.FailedQRaw f : raw.failedTop) {
      failedTop.add(new WeeklyReviewResp.FailedQ(f.questionId(), f.subject(), f.missCount()));
    }

    WeeklyReviewResp.AiInsight ai = new WeeklyReviewResp.AiInsight(
        "WI-" + raw.weekLabel + "-stu" + studentId,
        // MVP: 简单 fallback 文本 · master §6 Spring AI 链路待 SC-16-T03 (P2) 接入
        // biz §10.12 字段 aiInsight ≤ 50 字 · 此处不引入真 AI 依赖避免外部不确定性
        buildInsightText(raw),
        clock.instant().toString()); // 反 wall-clock · 用注入 Clock (INV-3 audit grep 0 命中)
    // 注意: insightId/generatedAt 仅占位 · production 应挂 §6 QuestionAnalyzer (P2 task)

    return new WeeklyReviewResp(
        raw.weekLabel,
        new WeeklyReviewResp.WeekRange(raw.rangeFromIso, raw.rangeToIso),
        new WeeklyReviewResp.Hero(raw.masteryRate, raw.masteryDelta, raw.sparkline),
        radar,
        weakKps,
        new WeeklyReviewResp.Stats(raw.reviewedCount, raw.reviewedDurationMin, raw.newCount),
        failedTop,
        ai);
  }

  /** MVP fallback insight 文本 · ≤ 50 字 · 不引入 Spring AI 依赖 (留 P2). */
  private static String buildInsightText(WeeklyAggregateService.WeeklyAggregateRaw raw) {
    if (raw.reviewedCount == 0) {
      return "本周还没开始 · 拍一道题或开始今日复习";
    }
    if (!raw.weakKps.isEmpty()) {
      WeeklyAggregateService.WeakKpRaw top = raw.weakKps.get(0);
      return String.format("本周在 %s 上栽了 %d 次 · 建议优先专练", top.kpName(), top.recentMissCount());
    }
    return String.format("本周已复习 %d 题 · 继续保持", raw.reviewedCount);
  }
}
