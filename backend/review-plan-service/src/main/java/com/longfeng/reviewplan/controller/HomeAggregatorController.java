package com.longfeng.reviewplan.controller;

import com.longfeng.common.dto.ApiResult;
import com.longfeng.reviewplan.dto.HomeTodayResp;
import com.longfeng.reviewplan.repo.ReviewPlanRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * SC-01-D01 · GET /api/home/today · P-HOME 大卡聚合 controller.
 *
 * <p>A07 推荐"新建独立 home-aggregator module"承载 9 字段完整聚合；本任务范围限定 MVP 黄金路径
 * 必需子集（today.{total, done, circleProgress} + resume 占位）→ 承载于 review-plan-service（拥有
 * review_plan 数据源）。Phase 1 再剥离至独立 module。
 *
 * <p>语义：
 * <ul>
 *   <li>{@code total} = 今日 {@code next_due_at ∈ [todayStart, todayEnd)} 的 review_plan 行数（含已完成）
 *   <li>{@code done} = 今日 {@code completed_at ∈ [todayStart, todayEnd)} 的 review_plan 行数
 *   <li>{@code circleProgress} = total &gt; 0 ? done / total : 0.0
 *   <li>{@code resume} = null（B02 决策：session in-memory，不存可恢复元数据）
 * </ul>
 */
@RestController
@Tag(name = "home-aggregator", description = "P-HOME 主聚合（SC-01-D01 · MVP 子集）")
public class HomeAggregatorController {

  private static final String USER_ID_HEADER = "X-User-Id";
  private static final String TIMEZONE_HEADER = "X-User-Timezone";
  private static final String DEFAULT_TZ = "Asia/Shanghai";

  private final ReviewPlanRepository planRepo;

  public HomeAggregatorController(ReviewPlanRepository planRepo) {
    this.planRepo = planRepo;
  }

  @Operation(summary = "P-HOME 今日聚合（SC-01-D01）· today.{total,done,circleProgress} + resume")
  @ApiResponse(responseCode = "200", description = "today 聚合")
  @GetMapping("/api/home/today")
  public ApiResult<HomeTodayResp> homeToday(
      @RequestParam(value = "tz", required = false) String tzParam,
      @RequestHeader(value = USER_ID_HEADER, defaultValue = "0") Long userId,
      @RequestHeader(value = TIMEZONE_HEADER, required = false) String tzHeader) {

    String useTz = pickTz(tzParam, tzHeader);
    ZoneId zone = resolveZone(useTz);
    LocalDate today = LocalDate.now(zone);
    Instant start = today.atStartOfDay(zone).toInstant();
    Instant end = today.plusDays(1).atStartOfDay(zone).toInstant();

    int total = planRepo.findDueOnDate(userId, start, end).size();
    int done = (int) planRepo.countCompletedOnDate(userId, start, end);
    double circleProgress = total > 0 ? (double) done / (double) total : 0.0;

    HomeTodayResp.TodayCard card = new HomeTodayResp.TodayCard(total, done, circleProgress);
    // B02 决策：session 是 in-memory · resume 元数据无持久化 → 返 null（前端隐藏 banner）
    HomeTodayResp resp = new HomeTodayResp(useTz, card, null);
    return ApiResult.ok(resp);
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
