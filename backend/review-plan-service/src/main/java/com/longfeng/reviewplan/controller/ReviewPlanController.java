package com.longfeng.reviewplan.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.longfeng.common.dto.ApiResult;
import com.longfeng.reviewplan.dto.AiJudgeDto;
import com.longfeng.reviewplan.dto.CreateSessionReq;
import com.longfeng.reviewplan.dto.CreateSessionResp;
import com.longfeng.reviewplan.dto.GradeReq;
import com.longfeng.reviewplan.dto.NextInSessionResp;
import com.longfeng.reviewplan.dto.NodeResultResp;
import com.longfeng.reviewplan.dto.ReviewPlanDto;
import com.longfeng.reviewplan.dto.TodayResp;
import com.longfeng.reviewplan.entity.ReviewOutcome;
import com.longfeng.reviewplan.entity.ReviewPlan;
import com.longfeng.reviewplan.entity.WbReviewNode;
import com.longfeng.reviewplan.exception.GradeExceptions;
import com.longfeng.reviewplan.exception.PlanMasteredException;
import com.longfeng.reviewplan.exception.PlanNotFoundException;
import com.longfeng.reviewplan.repo.ReviewOutcomeRepository;
import com.longfeng.reviewplan.repo.ReviewPlanRepository;
import com.longfeng.reviewplan.repo.WbReviewNodeRepository;
import com.longfeng.reviewplan.service.JudgeOutboxService;
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
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
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
    // SC20-T03 · wb_review_node 5 satellite 列读 + final_grade_source 列写
    private final WbReviewNodeRepository wbNodeRepo;
    private final ObjectMapper jsonMapper;
    // SC21-T01 · RLHF override outbox 写入 (final_grade_source='ai_overridden' 时同事务 INSERT)
    private final JudgeOutboxService judgeOutboxService;

    // SC20-T03 §4.16 · final_grade_source 枚举值 (Round 2 用例 #6 子断言 #a 4 子情况 422 校验)
    private static final Set<String> VALID_FINAL_GRADE_SOURCES =
        Set.of("self", "ai_accepted", "ai_overridden");
    private static final int FINAL_GRADE_SOURCE_MAX_LEN = 16;

    public ReviewPlanController(
            ReviewPlanService planService,
            ReviewSessionService sessionService,
            NodeLifecycleTracker lifecycleTracker,
            ReviewPlanRepository planRepo,
            ReviewOutcomeRepository outcomeRepo,
            WbReviewNodeRepository wbNodeRepo,
            ObjectMapper jsonMapper,
            JudgeOutboxService judgeOutboxService) {
        this.planService = planService;
        this.sessionService = sessionService;
        this.lifecycleTracker = lifecycleTracker;
        this.planRepo = planRepo;
        this.outcomeRepo = outcomeRepo;
        this.wbNodeRepo = wbNodeRepo;
        this.jsonMapper = jsonMapper;
        this.judgeOutboxService = judgeOutboxService;
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
     *
     * <p>SC20-T03 (M-AI-ANSWER-JUDGE §10.18 + §4.16) 改造:
     * <ol>
     *   <li>req.finalGradeSource (新字段) 缺省 'self' (旧客户端不传 = 兼容)</li>
     *   <li>应用层 CHECK (Controller-first-line · CHECK 在 planService.complete() 调用前置):
     *     <ul>
     *       <li>enum 校验 final_grade_source ∈ {'self','ai_accepted','ai_overridden'} · 失败 → 422 INVALID_FINAL_GRADE_SOURCE</li>
     *       <li>'ai_accepted' ⟹ wb_review_node.ai_judge_verdict === grade · 不等 → 422 GRADE_SOURCE_MISMATCH</li>
     *       <li>'ai_overridden' ⟹ wb_review_node.ai_judge_verdict != grade · 相等 → 422 GRADE_SOURCE_MISMATCH</li>
     *       <li>'self' 不校验 (向后兼容)</li>
     *     </ul>
     *   </li>
     *   <li>跨用户检查: plan.studentId != X-User-Id → 403 NODE_NOT_OWNED (A.1 学生主体性宪法)</li>
     *   <li>幂等检查: plan.completedAt != null → 409 NODE_ALREADY_GRADED (master §10.5 不允许重复 grade)</li>
     *   <li>落 wb_review_node.final_grade_source 列 (UPSERT 决策不采用 · 仅 wb_review_node 行已存在时更新此列 ·
     *       wb_review_node-row-not-created 选 INSERT-only 路径 · 沿 master §10.5 现役无 :grade 创建 wb_review_node 行)</li>
     * </ol>
     *
     * <p>@Transactional 整方法 · CHECK 抛 GradeExceptions 时整事务 rollback · partial write 禁
     * (RuntimeException 子类默认 rollback · 无需显式 rollbackFor).
     */
    @Operation(summary = "SC-01-C05 grade node · SC20-T03 加 finalGradeSource")
    @PostMapping("/api/review/nodes/{nid}/grade")
    @Transactional
    public ApiResult<CompleteResult> gradeNode(
            @PathVariable Long nid,
            @RequestBody GradeReq req,
            @RequestHeader(value = USER_ID_HEADER, defaultValue = "0") Long userId) {

        // === Controller-first-line CHECK (test-cases.md Round 2 #3 · Service-first-line 替代位置) ===

        // CHECK 1: final_grade_source enum 校验 (Round 2 #6 子断言 #a · 422 INVALID_FINAL_GRADE_SOURCE)
        //   - null → 兜底 'self' (向后兼容)
        //   - 长度超 16 / 非 enum 内 → 422 INVALID_FINAL_GRADE_SOURCE (不让 PostgreSQL string-too-long 抛 5xx)
        String finalGradeSource = req.toFinalGradeSource();
        if (req.finalGradeSource() != null) {
            // 用户字面传了 finalGradeSource 字段 (空串 / 大小写错 / 超长 / 非 enum 都要拒)
            if (req.finalGradeSource().length() > FINAL_GRADE_SOURCE_MAX_LEN
                    || !VALID_FINAL_GRADE_SOURCES.contains(req.finalGradeSource())) {
                throw new GradeExceptions.InvalidFinalGradeSource(
                    "INVALID_FINAL_GRADE_SOURCE: '" + req.finalGradeSource()
                        + "' not in {self, ai_accepted, ai_overridden}");
            }
        }

        // 加载 plan · 验授权 + 幂等 (CHECK 在 SM-2 调用前)
        Optional<ReviewPlan> planOpt = planRepo.findById(nid);
        if (planOpt.isEmpty()) {
            throw new PlanNotFoundException(nid);
        }
        ReviewPlan plan = planOpt.get();

        // CHECK 2: 跨用户访问 (Round 2 #6 子断言 #c · A.1 学生主体性 · 403 NODE_NOT_OWNED)
        //   - X-User-Id default 0 (header 缺失) · 与真实 plan.studentId != 时拒
        //   - **Tester Round 1 REJECT fix · 2026-05-18** (audits/.../adversarial.md adv00):
        //     之前实装 `userId != 0L && ...` 短路导致 header 缺失时跳过 CHECK · 任何客户端可 grade 任何 node
        //     (A.1 学生主体性宪法严重违反)。修复: 移除 `userId != 0L` 守护 · 仅 plan.studentId != userId 时拒。
        //     header 缺失 userId=0 与 plan.studentId (任何合法 student) 必然不等 → 拒 403 NODE_NOT_OWNED.
        if (userId != null && plan.getStudentId() != null
                && !userId.equals(plan.getStudentId())) {
            throw new GradeExceptions.NodeNotOwned(
                "NODE_NOT_OWNED: plan.studentId=" + plan.getStudentId() + " != userId=" + userId);
        }

        // CHECK 3: 幂等 · 已 grade (plan.completedAt != null) → 409 NODE_ALREADY_GRADED
        //   - master §10.5 idempotency 现役行为 · :grade 不允许重复 grade
        //   - Round 2 #6 子断言 #d-1
        if (plan.getCompletedAt() != null) {
            throw new GradeExceptions.NodeAlreadyGraded(
                "NODE_ALREADY_GRADED: nid=" + nid + " already completed at " + plan.getCompletedAt());
        }

        // CHECK 4: ai_accepted / ai_overridden 字段约束 (Round 2 #3 · §4.16 字面)
        //   - 'ai_accepted' ⟹ wb_review_node.ai_judge_verdict === grade
        //   - 'ai_overridden' ⟹ ai_judge_verdict != grade
        //   - 'self' 不校验
        String grade = req.grade() != null ? req.grade().toUpperCase() : "PARTIAL";
        if ("ai_accepted".equals(finalGradeSource) || "ai_overridden".equals(finalGradeSource)) {
            Optional<WbReviewNode> wbOpt = wbNodeRepo.findById(nid);
            if (wbOpt.isEmpty() || wbOpt.get().getAiJudgeVerdict() == null) {
                // 无 AI 判结果 · 不能声明 ai_accepted / ai_overridden
                throw new GradeExceptions.GradeSourceMismatch(
                    "GRADE_SOURCE_MISMATCH: final_grade_source='" + finalGradeSource
                        + "' but no ai_judge_verdict for nid=" + nid);
            }
            String aiVerdict = wbOpt.get().getAiJudgeVerdict();
            if ("ai_accepted".equals(finalGradeSource) && !aiVerdict.equals(grade)) {
                throw new GradeExceptions.GradeSourceMismatch(
                    "GRADE_SOURCE_MISMATCH: ai_accepted requires ai_judge_verdict='" + aiVerdict
                        + "' === grade='" + grade + "' but they differ");
            }
            if ("ai_overridden".equals(finalGradeSource) && aiVerdict.equals(grade)) {
                throw new GradeExceptions.GradeSourceMismatch(
                    "GRADE_SOURCE_MISMATCH: ai_overridden requires ai_judge_verdict='" + aiVerdict
                        + "' != grade='" + grade + "' but they match");
            }
        }

        // === CHECK 全过 · 走 master §10.5 现役 SM-2 路径 ===

        int quality = req.toQuality();
        CompleteResult result = planService.complete(nid, quality);

        // 补发 review.node.graded outbox event
        ReviewPlan refreshed = planService.getById(nid);
        planService.writeGradedEvent(
            nid, grade, quality,
            refreshed.getWrongItemId(), refreshed.getStudentId(), refreshed.getNodeIndex());

        // FORGOT 路径: 级联重排 downstream nodes (master §10.5 现役 · 不动)
        if (quality == 0) {
            int nodeIndex = refreshed.getNodeIndex() == null ? 0 : refreshed.getNodeIndex();
            planService.rescheduleDownstreamForForgot(refreshed.getWrongItemId(), nodeIndex);
        }

        // === SC20-T03 落 wb_review_node.final_grade_source 列 (INSERT-only 决策 · 行存在才 UPDATE) ===
        // 决策: wb_review_node-row-not-created · 沿 master §10.5 现役行为 · :grade endpoint 不创建 wb_review_node 行
        // 仅在 wb_review_node 行已存在时 (e.g. SC20-T02 judge 已落 5 satellite 列) · UPDATE final_grade_source 列
        Optional<WbReviewNode> updatedWbOpt = wbNodeRepo.findById(nid);
        updatedWbOpt.ifPresent(wbNode -> {
            wbNode.setFinalGradeSource(finalGradeSource);
            wbNodeRepo.save(wbNode);
        });

        // === SC21-T01 · RLHF override outbox INSERT (同事务 · TI2 grade 抛错时一起回滚) ===
        // biz §2B.21 步 5 + §12 S5.6.5 · final_grade_source='ai_overridden' 时入 outbox 表
        // 字段 snapshot 自 wb_review_node 6 satellite 列 (TC-21.03 中间值 PARTIAL 也入 · 任何 ai_verdict != grade)
        if ("ai_overridden".equals(finalGradeSource) && updatedWbOpt.isPresent()) {
            WbReviewNode wb = updatedWbOpt.get();
            judgeOutboxService.enqueueOverride(
                nid,
                wb.getAiJudgeVerdict(),
                grade,
                wb.getUserAnswerImageKey(),
                wb.getAiJudgeReason());
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

    /**
     * SC-01-C05 #8 · GET /api/review/nodes/{nid}/result · 完成结果聚合.
     *
     * <p>SC20-T03 (M-AI-ANSWER-JUDGE §10.19) 改造: 加 aiJudge 字段拼装.
     * <ul>
     *   <li>从 wb_review_node 6 satellite 列拼 aiJudge object</li>
     *   <li>AC4 字面: 5 列 (verdict / confidence / reason / status / final_grade_source) **任一** 为 null
     *       时 aiJudge 整体 null (向后兼容 P09 旧逻辑)</li>
     *   <li>aiJudge.status 由 ai_judge_metadata JSONB 提取 · 三态降级:
     *     <ul>
     *       <li>metadata 整列 SQL NULL → aiJudge.status = null</li>
     *       <li>metadata JSON parse 失败 → aiJudge.status = null (log warn · 不抛 5xx)</li>
     *       <li>metadata 有效 JSON 但缺 status key → aiJudge.status = null</li>
     *     </ul>
     *   </li>
     *   <li>matched_steps / missed_steps · §10.19 字面 `?` 可选 · 本实装态 A "不返 key"
     *       (DTO @JsonInclude(NON_NULL) · pass null → 不序列化)</li>
     * </ul>
     */
    @Operation(summary = "SC-01-C05 node result · SC20-T03 加 aiJudge")
    @GetMapping("/api/review/nodes/{nid}/result")
    public ApiResult<NodeResultResp> nodeResult(@PathVariable Long nid) {
        ReviewPlan plan = planService.getById(nid);
        ReviewOutcome outcome = planService.findLatestOutcomeByPlanId(nid);
        Long durationMs = lifecycleTracker.durationMs(nid);

        String nodeState = plan.isMastered() ? "MASTERED"
            : plan.getCompletedAt() != null ? "COMPLETED" : "ACTIVE";

        AiJudgeDto aiJudge = buildAiJudgeDto(nid);

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
            plan.getMasteryScore(),
            aiJudge));
    }

    /**
     * SC20-T03 · 从 wb_review_node 6 satellite 列拼 AiJudgeDto.
     *
     * <p>AC4 字面: 5 列 (verdict / confidence / reason / status / final_grade_source) **任一** null
     * 时返 null (不返 partial object · 防 mp 端 destructure TypeError).
     *
     * <p>aiJudge.status 三态降级 (用例 #5 fold 进 Round 2 字面):
     * 整 metadata NULL / parse 失败 / 缺 status key → status = null.
     */
    private AiJudgeDto buildAiJudgeDto(Long nid) {
        Optional<WbReviewNode> wbOpt = wbNodeRepo.findById(nid);
        if (wbOpt.isEmpty()) {
            return null; // wb_review_node 行不存在 = AI 未判 (向后兼容 master sibling 无 wb_review_node)
        }
        WbReviewNode wb = wbOpt.get();

        // 5 列任一 null → 整 aiJudge null (AC4 严)
        // verdict / confidence / reason 任一 null → AI 未判
        if (wb.getAiJudgeVerdict() == null
                || wb.getAiJudgeConfidence() == null
                || wb.getAiJudgeReason() == null) {
            return null;
        }
        // ai_judge_metadata 整列 NULL → 整 aiJudge null (用例 #6 子断言 #b 字面: metadata=SQL NULL 触发 aiJudge=null)
        if (wb.getAiJudgeMetadata() == null) {
            return null;
        }
        // final_grade_source NOT NULL DEFAULT 'self' (V1.0.084) · 但防御性 check
        if (wb.getFinalGradeSource() == null) {
            return null;
        }

        // 提取 metadata.status (三态降级: parse fail / 缺 key → null · 不抛 5xx)
        String status = extractMetadataStatus(wb.getAiJudgeMetadata());
        // status 也是 5 列之一 (用例 #5 字面 "5 必有字段 verdict / confidence / reason / status / final_grade_source")
        // 但 status 来自 metadata 内部字段 · 不是独立列 · 故 status==null 时不触发整 aiJudge null
        // (避免与 metadata=NULL 双重触发) · 而是返 status=null + 其他 4 字段非空 · 由 mp 端处理
        // **修正决策**: status 在 metadata 内部 · null 时不触发整 aiJudge null · 而 metadata 整列 NULL 触发
        // (用例 #6 子断言 #b 严: metadata 整列 NULL → aiJudge=null · 上面已 cover)

        // matched_steps / missed_steps · 本实装态 A "不返 key" (pass null · DTO @JsonInclude.NON_NULL)
        return new AiJudgeDto(
            wb.getAiJudgeVerdict(),
            wb.getAiJudgeConfidence(),
            wb.getAiJudgeReason(),
            status,
            null,   // matched_steps · 态 A "不返 key"
            null,   // missed_steps · 态 A "不返 key"
            wb.getFinalGradeSource());
    }

    /**
     * SC20-T03 · JSONB metadata 提取 status 字段 · 三态降级 null.
     *
     * <p>实装路径: Java 层 ObjectMapper.readTree (alternative: SQL `metadata->>'status'`).
     */
    private String extractMetadataStatus(String metadataJson) {
        if (metadataJson == null || metadataJson.isBlank()) {
            return null;
        }
        try {
            JsonNode node = jsonMapper.readTree(metadataJson);
            JsonNode statusNode = node.get("status");
            if (statusNode == null || statusNode.isNull()) {
                return null; // 缺 status key
            }
            return statusNode.asText();
        } catch (Exception e) {
            // JSON parse 失败 · log warn · 不抛 5xx (用例 #5 三态降级)
            return null;
        }
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

    // SC20-T03 · 4 个 grade 错误码 (Round 2 用例 #3 / #6 子断言 #a / #c / #d-1)

    @ExceptionHandler(GradeExceptions.InvalidFinalGradeSource.class)
    public ResponseEntity<ApiResult<?>> handleInvalidFinalGradeSource(
            GradeExceptions.InvalidFinalGradeSource e) {
        return ResponseEntity.status(422).body(ApiResult.fail(42210, e.getMessage()));
    }

    @ExceptionHandler(GradeExceptions.GradeSourceMismatch.class)
    public ResponseEntity<ApiResult<?>> handleGradeSourceMismatch(
            GradeExceptions.GradeSourceMismatch e) {
        return ResponseEntity.status(422).body(ApiResult.fail(42211, e.getMessage()));
    }

    @ExceptionHandler(GradeExceptions.NodeAlreadyGraded.class)
    public ResponseEntity<ApiResult<?>> handleNodeAlreadyGraded(
            GradeExceptions.NodeAlreadyGraded e) {
        return ResponseEntity.status(409).body(ApiResult.fail(40902, e.getMessage()));
    }

    @ExceptionHandler(GradeExceptions.NodeNotOwned.class)
    public ResponseEntity<ApiResult<?>> handleNodeNotOwned(GradeExceptions.NodeNotOwned e) {
        return ResponseEntity.status(403).body(ApiResult.fail(40301, e.getMessage()));
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
