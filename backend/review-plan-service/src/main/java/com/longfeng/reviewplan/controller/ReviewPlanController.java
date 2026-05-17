package com.longfeng.reviewplan.controller;

import com.longfeng.common.dto.ApiResult;
import com.longfeng.reviewplan.dto.CreateSessionReq;
import com.longfeng.reviewplan.dto.CreateSessionResp;
import com.longfeng.reviewplan.dto.GradeReq;
import com.longfeng.reviewplan.dto.NextInSessionResp;
import com.longfeng.reviewplan.dto.NodeResultResp;
import com.longfeng.reviewplan.dto.ReviewPlanDto;
import com.longfeng.reviewplan.dto.TodayResp;
import com.longfeng.reviewplan.entity.ReviewOutcome;
import com.longfeng.reviewplan.entity.ReviewPlan;
import com.longfeng.reviewplan.exception.PlanMasteredException;
import com.longfeng.reviewplan.exception.PlanNotFoundException;
import com.longfeng.reviewplan.repo.ReviewOutcomeRepository;
import com.longfeng.reviewplan.repo.ReviewPlanRepository;
import com.longfeng.reviewplan.service.NodeLifecycleTracker;
import com.longfeng.reviewplan.service.ReviewPlanService;
import com.longfeng.reviewplan.service.ReviewPlanService.CompleteResult;
import com.longfeng.reviewplan.service.ReviewSessionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * S5 · review-plan-service 主控制器.
 *
 * <p>15 端点：7 BE-13 legacy (/review-plans/*) + 8 SC-01-C05 (/api/review/*).
 *
 * <p>FE destructures: 所有端点统一用 ApiResult 信封 (§7.1 "默认").
 * B02 决策 A: nid ≡ review_plan.id, HTTP/DTO 层做命名映射.
 */
@RestController
@Tag(name = "review-plans", description = "S5 · 复习计划 · SM-2 + Ebbinghaus 7 nodes")
public class ReviewPlanController {

    private static final String DEFAULT_TZ = "Asia/Shanghai";
    private static final String USER_ID_HEADER = "X-User-Id";

    private final ReviewPlanService planService;
    private final ReviewSessionService sessionService;
    private final NodeLifecycleTracker lifecycleTracker;
    private final ReviewPlanRepository planRepo;
    private final ReviewOutcomeRepository outcomeRepo;

    public ReviewPlanController(
            ReviewPlanService planService,
            ReviewSessionService sessionService,
            NodeLifecycleTracker lifecycleTracker,
            ReviewPlanRepository planRepo,
            ReviewOutcomeRepository outcomeRepo) {
        this.planService = planService;
        this.sessionService = sessionService;
        this.lifecycleTracker = lifecycleTracker;
        this.planRepo = planRepo;
        this.outcomeRepo = outcomeRepo;
    }

    // =======================================================================
    // BE-13 legacy endpoints
    // =======================================================================

    /** BE-13 日视图 · GET /review-plans?date=&subject= */
    @Operation(summary = "BE-13 日视图")
    @GetMapping("/review-plans")
    public ApiResult<List<ReviewPlanDto>> dayView(
            @RequestParam String date,
            @RequestParam(required = false) String subject,
            @RequestHeader(value = USER_ID_HEADER, defaultValue = "0") Long userId) {
        ZoneId zone = ZoneId.of(DEFAULT_TZ);
        LocalDate d = LocalDate.parse(date);
        Instant start = d.atStartOfDay(zone).toInstant();
        Instant end = d.plusDays(1).atStartOfDay(zone).toInstant();
        List<ReviewPlan> plans = planService.getDayPlans(userId, start, end);
        List<ReviewPlanDto> dtos = plans.stream().map(ReviewPlanDto::from).collect(Collectors.toList());
        return ApiResult.ok(dtos);
    }

    /** BE-13 游标翻页 · GET /review-plans/list */
    @Operation(summary = "BE-13 游标翻页")
    @GetMapping("/review-plans/list")
    public ApiResult<List<ReviewPlanDto>> listByCursor(
            @RequestParam(name = "user_id") Long userId,
            @RequestParam(defaultValue = "-1") int status,
            @RequestParam(required = false) Long cursor,
            @RequestParam(defaultValue = "20") int limit) {
        List<ReviewPlan> plans = planService.listByCursor(userId, status, cursor, limit);
        List<ReviewPlanDto> dtos = plans.stream().map(ReviewPlanDto::from).collect(Collectors.toList());
        return ApiResult.ok(dtos);
    }

    /** BE-13 单 plan 详情 · GET /review-plans/{id} */
    @Operation(summary = "单 plan 详情")
    @GetMapping("/review-plans/{id}")
    public ApiResult<ReviewPlanDto> getById(@PathVariable Long id) {
        ReviewPlan plan = planService.getById(id);
        return ApiResult.ok(ReviewPlanDto.from(plan));
    }

    /** SC-08 复习主循环 · POST /review-plans/{id}/complete · SM-2 + 乐观锁 + Outbox */
    @Operation(summary = "SC-08 复习完成")
    @PostMapping("/review-plans/{id}/complete")
    public ApiResult<CompleteResult> complete(
            @PathVariable Long id,
            @RequestBody Map<String, Integer> body) {
        int quality = body.getOrDefault("quality", 3);
        CompleteResult result = planService.complete(id, quality);
        return ApiResult.ok(result);
    }

    /**
     * P04 "保存并开启复习" · 同步创建 7 个 review_plan 节点 (EBBINGHAUS_SM2).
     *
     * <p>SC-01-MP 落地：本地 dev 无 RocketMQ 时，由 wrongbook-service 在 save 事务后
     * 同步 HTTP 调用本端点直接生成 plan（消费者侧 createSevenNodes 仍保留作为 MQ 路径）。
     * 幂等：底层 {@code planRepo.existsByWrongItemId} + 唯一索引兜底 (wrong_item_id, node_index)
     * 保证同一 wrong_item 重复触发只生成一次 7 行。
     *
     * <p>Request body: {@code {wrongItemId: long, studentId: long, occurredAt?: ISO8601 string}}
     * Response: {@code {nodeCount: int}} · 0 表示已存在（幂等跳过）。
     */
    /**
     * P05-LIST · 批量拿 wrongItemId 列表中每个 item 的"下一个未完成节点".
     * wrongbook-service 在 listQuestions 时调本端点 · 把 nextDueAt + nodeStage
     * 注入 P05 列表卡 (替代之前永远 "暂未安排" 的 UX 损失).
     *
     * <p>Request body: {@code {wrongItemIds: [long...]}}
     * Response: {@code [{wrongItemId, nodeIndex, nextDueAt}, ...]} ·
     *   只返有 active plan 的 item · 没 plan 的 item caller 自行降级.
     */
    @Operation(summary = "P05 批量拿 next-due 节点")
    @PostMapping("/internal/plans/next-due-by-items")
    public ApiResult<List<Map<String, Object>>> nextDueByItems(@RequestBody Map<String, Object> body) {
        @SuppressWarnings("unchecked")
        List<Object> rawIds = (List<Object>) body.getOrDefault("wrongItemIds", List.of());
        if (rawIds == null || rawIds.isEmpty()) {
            return ApiResult.ok(List.of());
        }
        List<Long> ids = rawIds.stream()
                .map(o -> Long.valueOf(o.toString()))
                .collect(Collectors.toList());
        List<Object[]> rows = planRepo.findNextDueByWrongItemIds(ids);
        List<Map<String, Object>> out = rows.stream()
                .map(r -> {
                    Map<String, Object> m = new java.util.HashMap<>();
                    m.put("wrongItemId", ((Number) r[0]).longValue());
                    m.put("nodeIndex", ((Number) r[1]).intValue());
                    m.put("nextDueAt", r[2] == null ? null : r[2].toString());
                    return m;
                })
                .collect(Collectors.toList());
        return ApiResult.ok(out);
    }

    @Operation(summary = "P04 保存并开启复习 · 同步创建 7 节点")
    @PostMapping("/internal/plans/from-question")
    public ApiResult<Map<String, Object>> createFromQuestion(@RequestBody Map<String, Object> body) {
        Object wrongItemIdRaw = body.get("wrongItemId");
        Object studentIdRaw = body.get("studentId");
        if (wrongItemIdRaw == null || studentIdRaw == null) {
            throw new IllegalArgumentException("wrongItemId and studentId are required");
        }
        Long wrongItemId = Long.valueOf(wrongItemIdRaw.toString());
        Long studentId = Long.valueOf(studentIdRaw.toString());
        Instant base = parseOccurredAt(body.get("occurredAt"));
        List<ReviewPlan> created = planService.createSevenNodes(wrongItemId, studentId, base);
        return ApiResult.ok(Map.of("nodeCount", created.size()));
    }

    private static Instant parseOccurredAt(Object raw) {
        if (raw == null) return Instant.now();
        String s = raw.toString();
        if (s.isBlank()) return Instant.now();
        try {
            return Instant.parse(s);
        } catch (Exception e) {
            return Instant.now();
        }
    }

    /** admin 学期初清空 · POST /review-plans/batch-reset · X-Admin: true */
    @Operation(summary = "BE-13 admin batch reset")
    @PostMapping("/review-plans/batch-reset")
    public ApiResult<Integer> batchReset(
            @RequestHeader(value = USER_ID_HEADER, defaultValue = "0") Long userId,
            @RequestHeader(value = "X-Admin", required = false) String admin) {
        int affected = planService.batchReset(userId);
        return ApiResult.ok(affected);
    }

    /** BE-13 按 id 批量软删 · POST /review-plans/batch-reset-by-ids */
    @Operation(summary = "BE-13 batch reset by ids")
    @PostMapping("/review-plans/batch-reset-by-ids")
    public ApiResult<Integer> batchResetByIds(@RequestBody Map<String, List<Long>> body) {
        List<Long> planIds = body.getOrDefault("plan_ids", List.of());
        int affected = planService.batchResetByIds(planIds);
        return ApiResult.ok(affected);
    }

    /** SC-09 学情聚合 · GET /review-stats?range=&subject= */
    @Operation(summary = "SC-09 学情聚合")
    @GetMapping("/review-stats")
    public ApiResult<Map<String, Object>> reviewStats(
            @RequestParam(required = false) String range,
            @RequestParam(required = false) String subject,
            @RequestHeader(value = USER_ID_HEADER, defaultValue = "0") Long userId) {
        // MVP: 返回 today 的基础统计 · Phase 2 再按 range/subject 细分
        ZoneId zone = ZoneId.of(DEFAULT_TZ);
        LocalDate today = LocalDate.now(zone);
        Instant start = today.atStartOfDay(zone).toInstant();
        Instant end = today.plusDays(1).atStartOfDay(zone).toInstant();
        int totalDue = planRepo.findDueOnDate(userId, start, end).size();
        long completedToday = planRepo.countCompletedOnDate(userId, start, end);
        return ApiResult.ok(Map.of(
            "totalDue", totalDue,
            "completedToday", completedToday,
            "range", range == null ? "today" : range));
    }

    // =======================================================================
    // SC-01-C05 · /api/review/* endpoints (8)
    // =======================================================================

    /** SC-01-C05 #1 · POST /api/review/sessions · 内存 session（B02 决策 A）. */
    @Operation(summary = "SC-01-C05 create session")
    @PostMapping("/api/review/sessions")
    public ApiResult<CreateSessionResp> createSession(
            @RequestBody(required = false) CreateSessionReq req,
            @RequestHeader(value = USER_ID_HEADER, defaultValue = "0") Long userId) {
        List<Long> nids;
        if (req != null && req.node_ids() != null && !req.node_ids().isEmpty()) {
            nids = req.node_ids();
        } else {
            // 默认: 获取今日所有 due plans
            String tz = req != null && req.tz() != null ? req.tz() : DEFAULT_TZ;
            ZoneId zone = resolveZone(tz);
            LocalDate date = req != null && req.date() != null
                ? LocalDate.parse(req.date()) : LocalDate.now(zone);
            Instant start = date.atStartOfDay(zone).toInstant();
            Instant end = date.plusDays(1).atStartOfDay(zone).toInstant();
            nids = planService.getDayPlans(userId, start, end)
                .stream().map(ReviewPlan::getId).collect(Collectors.toList());
        }
        ReviewSessionService.Session session = sessionService.create(nids);
        return ApiResult.ok(new CreateSessionResp(session.sid, session.nids, session.nids.size()));
    }

    /**
     * SC-01-C05 #2 · GET /api/review/today?tz= · 今日待复习.
     *
     * <p>窗口语义: [today_start, today_end + LATE_NIGHT_LOOKAHEAD_HOURS) ·
     * lookahead 4h 解决"晚上保存的题 T0=+2h 落入次日凌晨, 永远进不来今日窗口"问题
     * (NODE_OFFSETS[0] = Duration.ofHours(2) · spec §SC-01.10 Q-D 起点不动)。
     * UX 语义: "今天能做的复习" 而非死板的日历日切。
     */
    private static final java.time.Duration LATE_NIGHT_LOOKAHEAD = java.time.Duration.ofHours(4);

    @Operation(summary = "SC-01-C05 today due nodes")
    @GetMapping("/api/review/today")
    public ApiResult<TodayResp> today(
            @RequestParam(value = "tz", required = false) String tz,
            @RequestHeader(value = USER_ID_HEADER, defaultValue = "0") Long userId) {
        ZoneId zone = resolveZone(tz);
        LocalDate today = LocalDate.now(zone);
        Instant start = today.atStartOfDay(zone).toInstant();
        Instant end = today.plusDays(1).atStartOfDay(zone).toInstant().plus(LATE_NIGHT_LOOKAHEAD);
        List<ReviewPlan> plans = planService.getDayPlans(userId, start, end);

        // P07-RENDER · 单库迁移后 (2026-05-17 用户拍板 C 方案) 同库 join wrong_item ·
        // 一次性拿所有 plan 的 subject+stem · 内存 enrich · 比 FE N+1 调用快得多.
        // 没 wrong_item (FK miss / 已删) 的 plan 走 null 字段 · FE 降级渲染.
        java.util.Map<Long, String[]> wiMap = new java.util.HashMap<>();
        if (!plans.isEmpty()) {
            List<Long> wiIds = plans.stream().map(ReviewPlan::getWrongItemId).distinct().toList();
            List<Object[]> rows = planRepo.findSubjectStemByIds(wiIds);
            for (Object[] r : rows) {
                wiMap.put(((Number) r[0]).longValue(),
                        new String[] { r[1] == null ? null : r[1].toString(),
                                       r[2] == null ? null : r[2].toString() });
            }
        }
        List<ReviewPlanDto> items = plans.stream().map(p -> {
            String[] sx = wiMap.get(p.getWrongItemId());
            return ReviewPlanDto.from(p, sx == null ? null : sx[0], sx == null ? null : sx[1]);
        }).collect(Collectors.toList());
        String useTz = tz != null && !tz.isBlank() ? tz : DEFAULT_TZ;

        // P07 masteryPct · spec L98 ease_factor 聚合 from review_outcome ·
        // 公式: avg(latest ease_factor_after) 映射 [1.3, 3.0] → [0, 100].
        // 0 outcome (今日所有题全新没复习过) → 0% · 诚实 · 不假装有 mastery.
        Integer masteryPct = computeMasteryPct(plans);

        return ApiResult.ok(new TodayResp(items, items.size(), useTz, masteryPct));
    }

    /**
     * P07 掌握度% · spec L98 ease_factor 聚合.
     *
     * <p>SM-2 ease 范围 [1.3, 3.0] · 线性映射:
     * <pre>
     *   1.3 (SM-2 floor)  → 0%
     *   2.5 (init)        → 70.6%
     *   3.0 (cap)         → 100%
     * </pre>
     *
     * <p>每题取 latest outcome (= 最新一次 grade 后的 ease). 没 outcome 的题跳过 (= 未复习过).
     * 全今日 plan 都无 outcome → 0%. 用 plan.ease_factor 同等价但 spec 明文说 "来源 review_outcome",
     * 严格走 spec.
     */
    private Integer computeMasteryPct(List<ReviewPlan> plans) {
        if (plans.isEmpty()) return 0;
        List<Long> planIds = plans.stream().map(ReviewPlan::getId).toList();
        List<Object[]> easeRows = outcomeRepo.findLatestEaseByPlanIds(planIds);
        if (easeRows.isEmpty()) return 0;

        double sum = 0;
        int count = 0;
        for (Object[] r : easeRows) {
            if (r.length < 2 || r[1] == null) continue;
            java.math.BigDecimal ease = (java.math.BigDecimal) r[1];
            sum += ease.doubleValue();
            count++;
        }
        if (count == 0) return 0;

        double avgEase = sum / count;
        // (avgEase - 1.3) / (3.0 - 1.3) * 100 · clamp [0,100]
        double pct = Math.max(0, Math.min(100, (avgEase - 1.3) / 1.7 * 100));
        return (int) Math.round(pct);
    }

    /** SC-01-C05 #3 · GET /api/review/nodes/{nid} · 节点详情. */
    @Operation(summary = "SC-01-C05 node detail")
    @GetMapping("/api/review/nodes/{nid}")
    public ApiResult<ReviewPlanDto> getNode(@PathVariable Long nid) {
        ReviewPlan plan = planService.getById(nid);
        return ApiResult.ok(ReviewPlanDto.from(plan));
    }

    /** SC-01-C05 #4 · POST /api/review/nodes/{nid}/open · 发 review.node.opened outbox. */
    @Operation(summary = "SC-01-C05 open node")
    @PostMapping("/api/review/nodes/{nid}/open")
    public ApiResult<Void> openNode(@PathVariable Long nid) {
        planService.openNode(nid);
        lifecycleTracker.markOpened(nid);
        return ApiResult.ok(null);
    }

    /** SC-01-C05 #5 · POST /api/review/nodes/{nid}/reveal · 记 revealed_at · spec §5 #2. */
    @Operation(summary = "SC-01-C05 reveal node")
    @PostMapping("/api/review/nodes/{nid}/reveal")
    public ApiResult<Map<String, Object>> revealNode(@PathVariable Long nid) {
        // 确认 plan 存在 (404 if missing)
        planService.getById(nid);
        lifecycleTracker.markRevealed(nid);
        Instant revealedAt = lifecycleTracker.getRevealedAt(nid);
        return ApiResult.ok(Map.of(
            "nid", nid,
            "revealedAt", revealedAt != null ? revealedAt.toString() : Instant.now().toString()));
    }

    /**
     * SC-01-C05 #6 · POST /api/review/nodes/{nid}/grade.
     * MASTERED→5 / PARTIAL→3 / FORGOT→0 三态映射 + SM-2 compute + outbox graded event.
     * FORGOT 路径走 SC-01-C08 级联重排.
     */
    @Operation(summary = "SC-01-C05 grade node")
    @PostMapping("/api/review/nodes/{nid}/grade")
    public ApiResult<CompleteResult> gradeNode(
            @PathVariable Long nid,
            @RequestBody GradeReq req) {
        int quality = req.toQuality();
        CompleteResult result = planService.complete(nid, quality);

        // 补发 review.node.graded outbox event
        ReviewPlan plan = planService.getById(nid);
        String grade = req.grade() != null ? req.grade().toUpperCase() : "PARTIAL";
        planService.writeGradedEvent(
            nid, grade, quality,
            plan.getWrongItemId(), plan.getStudentId(), plan.getNodeIndex());

        // FORGOT 路径: 级联重排 downstream nodes
        if (quality == 0) {
            int nodeIndex = plan.getNodeIndex() == null ? 0 : plan.getNodeIndex();
            planService.rescheduleDownstreamForForgot(plan.getWrongItemId(), nodeIndex);
        }

        return ApiResult.ok(result);
    }

    /** SC-01-C05 #7 · POST /api/review/sessions/{sid}/next · 会话翻页. */
    @Operation(summary = "SC-01-C05 next in session")
    @PostMapping("/api/review/sessions/{sid}/next")
    public ApiResult<NextInSessionResp> nextInSession(@PathVariable String sid) {
        ReviewSessionService.PeekResult peek = sessionService.peekNext(sid);
        return ApiResult.ok(new NextInSessionResp(
            peek.nextNid(), peek.completed(), peek.total(), peek.done()));
    }

    /** SC-01-C05 #8 · GET /api/review/nodes/{nid}/result · 完成结果聚合. */
    @Operation(summary = "SC-01-C05 node result")
    @GetMapping("/api/review/nodes/{nid}/result")
    public ApiResult<NodeResultResp> nodeResult(@PathVariable Long nid) {
        ReviewPlan plan = planService.getById(nid);
        ReviewOutcome outcome = planService.findLatestOutcomeByPlanId(nid);
        Long durationMs = lifecycleTracker.durationMs(nid);

        String nodeState = plan.isMastered() ? "MASTERED"
            : plan.getCompletedAt() != null ? "COMPLETED" : "ACTIVE";

        return ApiResult.ok(new NodeResultResp(
            plan.getId(),
            plan.getWrongItemId(),
            plan.getNodeIndex() == null ? 0 : plan.getNodeIndex(),
            nodeState,
            outcome != null ? (int) outcome.getQuality() : null,
            outcome != null ? outcome.getEaseFactorBefore() : null,
            outcome != null ? outcome.getEaseFactorAfter() : null,
            outcome != null ? outcome.getIntervalDaysBefore() : null,
            outcome != null ? outcome.getIntervalDaysAfter() : null,
            plan.getNextDueAt(),
            durationMs,
            plan.isMastered(),
            plan.getMasteryScore()));
    }

    // =======================================================================
    // Exception handlers (local · PlanNotFoundException / PlanMasteredException
    // extend RuntimeException, not BusinessException)
    // =======================================================================

    @ExceptionHandler(PlanNotFoundException.class)
    public ResponseEntity<ApiResult<?>> handleNotFound(PlanNotFoundException e) {
        return ResponseEntity.status(404).body(ApiResult.fail(40401, e.getMessage()));
    }

    @ExceptionHandler(PlanMasteredException.class)
    public ResponseEntity<ApiResult<?>> handleMastered(PlanMasteredException e) {
        return ResponseEntity.status(409).body(ApiResult.fail(40901, e.getMessage()));
    }

    // =======================================================================
    // Helpers
    // =======================================================================

    private static ZoneId resolveZone(String tz) {
        if (tz == null || tz.isBlank()) return ZoneId.of(DEFAULT_TZ);
        try {
            return ZoneId.of(tz);
        } catch (Exception e) {
            return ZoneId.of(DEFAULT_TZ);
        }
    }
}
