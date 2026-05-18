package com.longfeng.reviewplan.repo;

import com.longfeng.reviewplan.entity.ReviewOutcome;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReviewOutcomeRepository extends JpaRepository<ReviewOutcome, Long> {

    List<ReviewOutcome> findByPlanIdOrderByCompletedAtDesc(Long planId, Pageable pageable);

    /**
     * P-HOME weekly-stats · 一次性聚合本周 grade 事件的 3 类计数.
     * 返 [mastered_count, partial_count, forgotten_count].
     * PostgreSQL FILTER 子句 = 单 scan + 多桶 · 比 3 次 count 快得多.
     */
    @Query(
        value = "SELECT "
              + "  COUNT(*) FILTER (WHERE quality = 5) AS mastered, "
              + "  COUNT(*) FILTER (WHERE quality = 3) AS partial, "
              + "  COUNT(*) FILTER (WHERE quality = 0) AS forgotten "
              + "FROM review_outcome "
              + "WHERE user_id = :userId "
              + "AND completed_at >= :weekStart "
              + "AND completed_at < :weekEnd",
        nativeQuery = true)
    Object[] aggregateWeeklyGradeCounts(
        @Param("userId") Long userId,
        @Param("weekStart") java.time.Instant weekStart,
        @Param("weekEnd") java.time.Instant weekEnd);

    /**
     * P-HOME messages · 拿本周最近一次 FORGOT (quality=0) outcome · 派生消息 #3.
     * 单 DB 直接 JOIN wrong_item 拿 subject (避免 cross-service HTTP).
     * 返 [completed_at, plan_id, wrong_item_id, subject].
     */
    @Query(
        value = "SELECT ro.completed_at, ro.plan_id, ro.wrong_item_id, wi.subject "
              + "FROM review_outcome ro "
              + "LEFT JOIN wrong_item wi ON wi.id = ro.wrong_item_id AND wi.deleted_at IS NULL "
              + "WHERE ro.user_id = :userId "
              + "AND ro.quality = 0 "
              + "AND ro.completed_at >= :weekStart "
              + "AND ro.completed_at < :weekEnd "
              + "ORDER BY ro.completed_at DESC LIMIT 1",
        nativeQuery = true)
    List<Object[]> findLatestForgotInWeek(
        @Param("userId") Long userId,
        @Param("weekStart") java.time.Instant weekStart,
        @Param("weekEnd") java.time.Instant weekEnd);

    /**
     * P-HOME weekly-stats · 本周新增 CONFIRMED wrong_item 计数 · 单 DB join 直接查 wrong_item.
     */
    @Query(
        value = "SELECT COUNT(*) FROM wrong_item "
              + "WHERE student_id = :userId "
              + "AND status = 3 "
              + "AND created_at >= :weekStart "
              + "AND created_at < :weekEnd "
              + "AND deleted_at IS NULL",
        nativeQuery = true)
    long countNewWrongItemsInWeek(
        @Param("userId") Long userId,
        @Param("weekStart") java.time.Instant weekStart,
        @Param("weekEnd") java.time.Instant weekEnd);

    /**
     * P-HOME messages · 拿本周最近一条 CONFIRMED wrong_item · 派生消息 #2.
     * 返 [created_at, id, subject, stem_text].
     */
    @Query(
        value = "SELECT created_at, id, subject, stem_text FROM wrong_item "
              + "WHERE student_id = :userId "
              + "AND status = 3 "
              + "AND created_at >= :weekStart "
              + "AND created_at < :weekEnd "
              + "AND deleted_at IS NULL "
              + "ORDER BY created_at DESC LIMIT 1",
        nativeQuery = true)
    List<Object[]> findLatestNewWrongItemInWeek(
        @Param("userId") Long userId,
        @Param("weekStart") java.time.Instant weekStart,
        @Param("weekEnd") java.time.Instant weekEnd);

    /**
     * P07 masteryPct · 批量拿一组 plan 的 latest outcome.ease_factor_after.
     *
     * <p>PostgreSQL DISTINCT ON (plan_id) · 取每 plan 最新 (completed_at DESC) 一行.
     * 一次查询替代 N+1 · ≤ 300ms 内 (spec L151 P95 预算).
     *
     * <p>返回 {@code [plan_id (Long), ease_factor_after (BigDecimal)]} ·
     * 没 outcome 的 plan 不在结果里 (= 没复习过 · 调用方算 mastery 时跳过).
     */
    @Query(
        value = "SELECT DISTINCT ON (plan_id) plan_id, ease_factor_after "
              + "FROM review_outcome "
              + "WHERE plan_id IN (:planIds) "
              + "ORDER BY plan_id, completed_at DESC",
        nativeQuery = true)
    List<Object[]> findLatestEaseByPlanIds(@Param("planIds") List<Long> planIds);

    /**
     * P-HOME weekly-stats masteryRate + SC-16 sparkline · 本周整 avg ease_factor_after.
     *
     * <p>2026-05-18 用户决策: 与 P07 复习页 masteryPct 算法统一 (SM-2 ease 折算).
     * 公式: AVG(ease_factor_after) 跨本周所有 outcome events · 映射 [1.3,3.0]→[0,100].
     * 不做 "latest per plan" 过滤 · 用事件级 avg (与 sparkline 每日 avg 自然一致).
     *
     * <p>返 {@code [avg_ease (BigDecimal), outcome_count (Long)]} · 空周 avg=null count=0.
     */
    @Query(
        value = "SELECT AVG(ease_factor_after) AS avg_ease, COUNT(*) AS cnt "
              + "FROM review_outcome "
              + "WHERE user_id = :userId "
              + "AND completed_at >= :weekStart "
              + "AND completed_at < :weekEnd "
              + "AND ease_factor_after IS NOT NULL",
        nativeQuery = true)
    List<Object[]> aggregateWeeklyAvgEase(
        @Param("userId") Long userId,
        @Param("weekStart") java.time.Instant weekStart,
        @Param("weekEnd") java.time.Instant weekEnd);

    /**
     * SC-16 sparkline · 每日 avg ease_factor_after · 按 student_tz 切日.
     *
     * <p>2026-05-18 用户决策: sparkline 算法和 P07 + weekly-stats masteryRate 统一 ·
     * 每日 avg ease · 映射 [1.3,3.0]→[0,100]. 空日 = 该日 0 outcome → sparkline[i]=null
     * (调用方 group 7 桶 · 缺 day_tz 桶赋 null · 不 forward-fill 不打底 0).
     *
     * <p>返 {@code [day_tz (Timestamp), avg_ease (BigDecimal), cnt (Long)]} · 每天 1 行.
     */
    @Query(
        value = "SELECT date_trunc('day', completed_at AT TIME ZONE :tz) AS day_tz, "
              + "       AVG(ease_factor_after) AS avg_ease, "
              + "       COUNT(*) AS cnt "
              + "FROM review_outcome "
              + "WHERE user_id = :userId "
              + "AND completed_at >= :weekStart "
              + "AND completed_at < :weekEnd "
              + "AND ease_factor_after IS NOT NULL "
              + "GROUP BY 1",
        nativeQuery = true)
    List<Object[]> aggregateDailyAvgEase(
        @Param("userId") Long userId,
        @Param("weekStart") java.time.Instant weekStart,
        @Param("weekEnd") java.time.Instant weekEnd,
        @Param("tz") String tz);
}
