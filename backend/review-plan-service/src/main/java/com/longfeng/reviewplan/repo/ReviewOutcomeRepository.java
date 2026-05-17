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
}
