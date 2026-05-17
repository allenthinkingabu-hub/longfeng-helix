package com.longfeng.reviewplan.controller;

import com.longfeng.common.dto.ApiResult;
import com.longfeng.reviewplan.dto.MessagesResp;
import com.longfeng.reviewplan.dto.WeekDotsResp;
import com.longfeng.reviewplan.dto.WeeklyStatsResp;
import com.longfeng.reviewplan.repo.ReviewOutcomeRepository;
import com.longfeng.reviewplan.repo.ReviewPlanRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * P-HOME 真值聚合 · 替代 FE MVP_WEEK_STATS / PLACEHOLDER_DOTS / MVP_MESSAGES 写死 mock.
 *
 * <p>3 个端点:
 * - GET /api/home/weekly-stats   · 本周 mastered/newItems/forgotten/masteryRate
 * - GET /api/home/week-dots      · 本周每日 plan T 级颜色 dots
 * - GET /api/home/messages/recent · 派生 ≤3 条消息 (无 message-service · 从现有数据合成)
 *
 * <p>放 review-plan-service 是因为聚合主表 review_outcome + review_plan 都在这里 ·
 * wrong_item 通过单库 JOIN 直查 · 避免 cross-service HTTP.
 */
@RestController
@Tag(name = "p-home", description = "P-HOME 真值聚合 (替代 FE mock)")
public class HomeController {

    private static final String DEFAULT_TZ = "Asia/Shanghai";
    private static final String USER_ID_HEADER = "X-User-Id";

    private final ReviewOutcomeRepository outcomeRepo;
    private final ReviewPlanRepository planRepo;

    public HomeController(ReviewOutcomeRepository outcomeRepo, ReviewPlanRepository planRepo) {
        this.outcomeRepo = outcomeRepo;
        this.planRepo = planRepo;
    }

    // =============================================================
    // GET /api/home/weekly-stats
    // =============================================================

    @Operation(summary = "P-HOME 本周回顾 4 stat")
    @GetMapping("/api/home/weekly-stats")
    public ApiResult<WeeklyStatsResp> weeklyStats(
            @RequestParam(value = "tz", required = false) String tz,
            @RequestHeader(value = USER_ID_HEADER, defaultValue = "0") Long userId) {
        ZoneId zone = resolveZone(tz);
        Instant[] win = weekWindow(zone);

        Object[] agg = outcomeRepo.aggregateWeeklyGradeCounts(userId, win[0], win[1]);
        int mastered = 0, partial = 0, forgotten = 0;
        if (agg != null && agg.length >= 3) {
            // PG returns count(*) as bigint · Java map → Long → int
            mastered = agg[0] == null ? 0 : ((Number) agg[0]).intValue();
            partial = agg[1] == null ? 0 : ((Number) agg[1]).intValue();
            forgotten = agg[2] == null ? 0 : ((Number) agg[2]).intValue();
        }
        int newItems = (int) outcomeRepo.countNewWrongItemsInWeek(userId, win[0], win[1]);

        int totalEvents = mastered + partial + forgotten;
        int masteryRate = totalEvents == 0 ? 0
            : (int) Math.round(mastered * 100.0 / totalEvents);

        return ApiResult.ok(new WeeklyStatsResp(mastered, newItems, forgotten, masteryRate));
    }

    // =============================================================
    // GET /api/home/week-dots
    // =============================================================

    /** node_index → 颜色映射 · 与 mockup 01_home.html 周历 dots 对齐 (T1 红/T3 橙/T6 绿). */
    private static String dotColorForNode(int nodeIndex) {
        if (nodeIndex <= 1) return "#FF3B30";  // T0/T1 早期高频 · 红
        if (nodeIndex <= 3) return "#FF9500";  // T2/T3 中期 · 橙
        return "#34C759";                       // T4..T6 长周期 · 绿
    }

    @Operation(summary = "P-HOME 本周日程 dots")
    @GetMapping("/api/home/week-dots")
    public ApiResult<WeekDotsResp> weekDots(
            @RequestParam(value = "tz", required = false) String tz,
            @RequestHeader(value = USER_ID_HEADER, defaultValue = "0") Long userId) {
        ZoneId zone = resolveZone(tz);
        Instant[] win = weekWindow(zone);

        List<Object[]> rows = planRepo.findWeekDueRaw(userId, win[0], win[1]);

        // 桶分组 by day-of-week (周一→周日 7 桶) · 每桶颜色去重保顺序
        LocalDate monday = LocalDate.now(zone).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        List<Set<String>> bucketColors = new ArrayList<>(7);
        for (int i = 0; i < 7; i++) bucketColors.add(new LinkedHashSet<>());

        for (Object[] r : rows) {
            if (r[0] == null || r[1] == null) continue;
            Instant nextDue = (Instant) r[0];
            int nodeIdx = ((Number) r[1]).intValue();
            ZonedDateTime zdt = nextDue.atZone(zone);
            int dayIdx = (zdt.getDayOfWeek().getValue() - 1); // Mon=0..Sun=6
            if (dayIdx < 0 || dayIdx >= 7) continue;
            bucketColors.get(dayIdx).add(dotColorForNode(nodeIdx));
        }

        List<WeekDotsResp.DayDots> days = new ArrayList<>(7);
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd");
        for (int i = 0; i < 7; i++) {
            LocalDate d = monday.plusDays(i);
            days.add(new WeekDotsResp.DayDots(d.format(fmt), new ArrayList<>(bucketColors.get(i))));
        }
        return ApiResult.ok(new WeekDotsResp(days));
    }

    // =============================================================
    // GET /api/home/messages/recent
    // =============================================================

    @Operation(summary = "P-HOME 最近消息 · 派生 ≤3 条")
    @GetMapping("/api/home/messages/recent")
    public ApiResult<MessagesResp> recentMessages(
            @RequestParam(value = "tz", required = false) String tz,
            @RequestHeader(value = USER_ID_HEADER, defaultValue = "0") Long userId) {
        ZoneId zone = resolveZone(tz);
        Instant[] win = weekWindow(zone);
        Instant now = Instant.now();

        List<MessagesResp.MessageItem> msgs = new ArrayList<>();

        // #1 下次复习提醒
        List<Object[]> nextDue = planRepo.findNextDueWithSubject(userId, now);
        if (!nextDue.isEmpty()) {
            Object[] r = nextDue.get(0);
            Instant dueAt = (Instant) r[0];
            int nodeIdx = ((Number) r[2]).intValue();
            String subjectKey = r[4] == null ? "" : r[4].toString();
            String subject = subjectLabel(subjectKey);
            String relTime = humanizeRelative(now, dueAt);
            msgs.add(new MessagesResp.MessageItem(
                String.format("记忆曲线 T%d · %s", nodeIdx, subject.isEmpty() ? "复习提醒" : subject),
                String.format("%s · 即将到期", relTime),
                relTime,
                "bell",
                "#5856D6",
                "ind"
            ));
        }

        // #2 本周新增错题
        List<Object[]> newWi = outcomeRepo.findLatestNewWrongItemInWeek(userId, win[0], win[1]);
        if (!newWi.isEmpty()) {
            Object[] r = newWi.get(0);
            Instant createdAt = (Instant) r[0];
            String subjectKey = r[2] == null ? "" : r[2].toString();
            String subject = subjectLabel(subjectKey);
            String stem = r[3] == null ? "" : r[3].toString();
            String stemSnippet = stem.length() > 18 ? stem.substring(0, 18) + "…" : stem;
            String dateLabel = createdAt.atZone(zone).format(DateTimeFormatter.ofPattern("M 月 d 日"));
            msgs.add(new MessagesResp.MessageItem(
                String.format("新增错题 · %s", subject.isEmpty() ? "学科" : subject),
                stemSnippet.isEmpty() ? dateLabel : stemSnippet,
                dateLabel,
                "calendar-o",
                "#FF2D55",
                "pnk"
            ));
        }

        // #3 本周最近遗忘
        List<Object[]> forgot = outcomeRepo.findLatestForgotInWeek(userId, win[0], win[1]);
        if (!forgot.isEmpty()) {
            Object[] r = forgot.get(0);
            Instant completedAt = (Instant) r[0];
            String subjectKey = r[3] == null ? "" : r[3].toString();
            String subject = subjectLabel(subjectKey);
            String dateLabel = completedAt.atZone(zone).format(DateTimeFormatter.ofPattern("M 月 d 日"));
            msgs.add(new MessagesResp.MessageItem(
                String.format("%s 遗忘重排", subject.isEmpty() ? "记忆曲线" : subject),
                "ease 重置 · 7 节点已重建",
                dateLabel,
                "clock-o",
                "#30B0C7",
                "tea"
            ));
        }

        return ApiResult.ok(new MessagesResp(msgs));
    }

    // =============================================================
    // Helpers
    // =============================================================

    private static ZoneId resolveZone(String tz) {
        if (tz == null || tz.isBlank()) return ZoneId.of(DEFAULT_TZ);
        try {
            return ZoneId.of(tz);
        } catch (Exception e) {
            return ZoneId.of(DEFAULT_TZ);
        }
    }

    /** 本周 [weekStart, weekEnd) UTC instants · ISO 周一 00:00 → 下周一 00:00. */
    private static Instant[] weekWindow(ZoneId zone) {
        LocalDate today = LocalDate.now(zone);
        LocalDate monday = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        Instant start = monday.atStartOfDay(zone).toInstant();
        Instant end = monday.plusDays(7).atStartOfDay(zone).toInstant();
        return new Instant[] { start, end };
    }

    /** BE wrong_item.subject enum 字符串 → 中文 label. 与 FE 映射对齐. */
    private static String subjectLabel(String key) {
        if (key == null) return "";
        switch (key.toLowerCase()) {
            case "math": return "数学";
            case "physics": return "物理";
            case "chemistry": return "化学";
            case "english": return "英语";
            case "chinese": return "语文";
            default: return "";
        }
    }

    /** Humanize 距离 now 的相对时间 · 用于消息 #1 副文. */
    private static String humanizeRelative(Instant now, Instant target) {
        long diffMs = target.toEpochMilli() - now.toEpochMilli();
        if (diffMs < 0) return "已到期";
        long diffMin = diffMs / 60_000L;
        if (diffMin < 60) return diffMin + " min";
        long diffHr = diffMin / 60L;
        if (diffHr < 24) return diffHr + " h";
        long diffDay = diffHr / 24L;
        return diffDay + " 天";
    }
}
