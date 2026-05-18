package com.longfeng.reviewplan.controller;

import com.longfeng.common.dto.ApiResult;
import com.longfeng.reviewplan.dto.HomeTodayResp;
import com.longfeng.reviewplan.dto.WeekSummaryDto;
import com.longfeng.reviewplan.repo.ReviewPlanRepository;
import com.longfeng.reviewplan.service.WeeklyAggregateService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.Duration;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;

/**
 * SC-01-D01 · GET /api/home/today · P-HOME 大卡聚合 controller.
 *
 * <p>SC-16 2026-05-16 扩展: response 加 {@code weekSummary} 4 字段投影 · 调同一
 * {@link WeeklyAggregateService#aggregate(long, ZoneId)} 同一参数 (INV-1 + INV-6) ·
 * 既有 today.{total,done,circleProgress} + resume 不动 (向后兼容).
 *
 * <p>语义:
 *
 * <ul>
 *   <li>{@code total} = 今日 {@code next_due_at ∈ [todayStart, todayEnd)} 的 review_plan 行数
 *   <li>{@code done} = 今日 {@code completed_at ∈ [todayStart, todayEnd)} 的 review_plan 行数
 *   <li>{@code circleProgress} = total &gt; 0 ? done / total : 0.0
 *   <li>{@code resume} = null (B02 决策: session in-memory)
 *   <li>{@code weekSummary} = 同 weekly_aggregate service 4 字段投影 (SC-16-T01)
 * </ul>
 */
@RestController
@Tag(name = "home-aggregator", description = "P-HOME 主聚合 (SC-01-D01 · SC-16 增量 weekSummary)")
public class HomeAggregatorController {

  private static final Logger LOG = LoggerFactory.getLogger(HomeAggregatorController.class);
  private static final String USER_ID_HEADER = "X-User-Id";
  private static final String TIMEZONE_HEADER = "X-User-Timezone";
  private static final String DEFAULT_TZ = "Asia/Shanghai";

  private final ReviewPlanRepository planRepo;
  private final WeeklyAggregateService weeklyAggregateService;
  private final Clock clock;
  // 短超时 (1s connect / 2s read) · 防 wrongbook 不可用时 P-HOME 首屏卡死 (spec §9 异常态降级)
  private final RestTemplate http = new RestTemplateBuilder()
      .setConnectTimeout(Duration.ofSeconds(1))
      .setReadTimeout(Duration.ofSeconds(2))
      .build();

  /**
   * wrongbook-service internal stats endpoint · 算累计已掌握题数 (mastery=2 OR ARCHIVED) ·
   * 供 P-HOME hero "掌握 N 题" chip 用. 5xx / timeout / 网络异常 → 降级 masteredTotal=0 (不阻塞首页).
   */
  @Value("${wrongbook.stats.mastered-count-url:http://localhost:8082/internal/students/{studentId}/mastered-count}")
  private String wrongbookMasteredCountUrl;

  public HomeAggregatorController(
      ReviewPlanRepository planRepo,
      WeeklyAggregateService weeklyAggregateService,
      Clock clock) {
    this.planRepo = planRepo;
    this.weeklyAggregateService = weeklyAggregateService;
    this.clock = clock;
  }

  @Operation(
      summary =
          "P-HOME 今日聚合 (SC-01-D01) + 本周 weekSummary 4 字段投影 (SC-16-T01)")
  @ApiResponse(responseCode = "200", description = "today 聚合 + weekSummary")
  @GetMapping("/api/home/today")
  public ApiResult<HomeTodayResp> homeToday(
      @RequestParam(value = "tz", required = false) String tzParam,
      @RequestHeader(value = USER_ID_HEADER, defaultValue = "0") Long userId,
      @RequestHeader(value = TIMEZONE_HEADER, required = false) String tzHeader) {

    String useTz = pickTz(tzParam, tzHeader);
    ZoneId zone = resolveZone(useTz);
    // 通过 Clock 注入取当前时间 · 反 wall-clock 依赖 (INV-3 · audit grep 0 命中)
    Instant now = clock.instant();
    LocalDate today = now.atZone(zone).toLocalDate();
    Instant start = today.atStartOfDay(zone).toInstant();
    Instant end = today.plusDays(1).atStartOfDay(zone).toInstant();

    int total = planRepo.findDueOnDate(userId, start, end).size();
    int done = (int) planRepo.countCompletedOnDate(userId, start, end);
    double circleProgress = total > 0 ? (double) done / (double) total : 0.0;
    long masteredTotal = fetchMasteredTotal(userId);

    HomeTodayResp.TodayCard card =
        new HomeTodayResp.TodayCard(total, done, circleProgress, masteredTotal);

    // SC-16-T01 · weekSummary 投影 · 同一 weekly_aggregate service 同一参数 (INV-1 + INV-6)
    WeekSummaryDto weekSummary = projectWeekSummary(userId, zone);

    HomeTodayResp resp = new HomeTodayResp(useTz, card, null, weekSummary);
    return ApiResult.ok(resp);
  }

  /**
   * 跨服务调 wrongbook-service 算累计已掌握题数. 失败时降级返 0 · 不抛出 (P-HOME 首屏不能因 wrongbook
   * 不可用而整体 5xx · 满足 spec §9 异常态 "部分数据正在同步" 降级语义).
   */
  @SuppressWarnings("unchecked")
  private long fetchMasteredTotal(Long studentId) {
    try {
      Map<String, Object> resp =
          http.getForObject(wrongbookMasteredCountUrl, Map.class, studentId);
      if (resp == null) return 0L;
      Object data = resp.get("data");
      if (!(data instanceof Map)) return 0L;
      Object count = ((Map<String, Object>) data).get("count");
      if (count instanceof Number n) return n.longValue();
      return 0L;
    } catch (Exception e) {
      LOG.warn("[P-HOME] fetchMasteredTotal failed for student {} · degrade to 0 · {}",
          studentId, e.getMessage());
      return 0L;
    }
  }

  /**
   * SC-16-T01 · 调 {@link WeeklyAggregateService} 拿 raw POJO 后投影到 {@link WeekSummaryDto} 4
   * 字段. **不允许内嵌独立 SQL** (INV-1 + INV-6 · audit grep 验证).
   */
  private WeekSummaryDto projectWeekSummary(long studentId, ZoneId zone) {
    WeeklyAggregateService.WeeklyAggregateRaw raw =
        weeklyAggregateService.aggregate(studentId, zone);
    return new WeekSummaryDto(
        raw.weekLabel, raw.masteryRate, raw.sparkline, raw.streak, raw.newCount);
  }

  private static String pickTz(String tzParam, String tzHeader) {
    if (tzParam != null && !tzParam.isBlank()) return tzParam;
    if (tzHeader != null && !tzHeader.isBlank()) return tzHeader;
    return DEFAULT_TZ;
  }

  private static ZoneId resolveZone(String tz) {
    if (tz == null || tz.isBlank()) return ZoneId.of(DEFAULT_TZ);
    try {
      return ZoneId.of(tz);
    } catch (Exception e) {
      return ZoneId.of(DEFAULT_TZ);
    }
  }
}
