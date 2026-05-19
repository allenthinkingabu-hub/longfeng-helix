package com.longfeng.wrongbook.repo;

import com.longfeng.wrongbook.entity.WrongItem;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WrongItemRepository extends JpaRepository<WrongItem, Long> {

    @Query(value = "SELECT * FROM wrong_item w WHERE w.deleted_at IS NULL"
         + " AND w.student_id = :studentId"
         + " AND (cast(:subject as varchar) IS NULL OR w.subject = cast(:subject as varchar))"
         + " AND (cast(:mastery as smallint) IS NULL OR w.mastery = cast(:mastery as smallint))"
         + " AND (cast(:status as smallint) IS NULL OR w.status = cast(:status as smallint))",
         countQuery = "SELECT count(*) FROM wrong_item w WHERE w.deleted_at IS NULL"
         + " AND w.student_id = :studentId"
         + " AND (cast(:subject as varchar) IS NULL OR w.subject = cast(:subject as varchar))"
         + " AND (cast(:mastery as smallint) IS NULL OR w.mastery = cast(:mastery as smallint))"
         + " AND (cast(:status as smallint) IS NULL OR w.status = cast(:status as smallint))",
         nativeQuery = true)
    Page<WrongItem> findByFilters(
            @Param("studentId") Long studentId,
            @Param("subject") String subject,
            @Param("mastery") Short mastery,
            @Param("status") Short status,
            Pageable pageable);

    List<WrongItem> findByStudentIdAndSubject(Long studentId, String subject);

    /**
     * P-HOME hero "掌握 N 题" chip · 累计已掌握题数.
     *
     * <p>语义对齐 master biz "学生的'已掌握题数'" (L1203):
     * <ul>
     *   <li>{@code mastery = 2} (学生自评已掌握 · 最终态)
     *   <li>{@code status = 8} (ARCHIVED · 主动归档视为掌握)
     * </ul>
     * 两者 OR 取并集 · 软删 ({@code deleted_at IS NOT NULL}) 不计.
     *
     * <p>调用方: review-plan-service HomeAggregatorController via internal endpoint
     * {@code GET /internal/students/{id}/mastered-count}.
     */
    @Query(value = "SELECT COUNT(*) FROM wrong_item w "
                 + "WHERE w.deleted_at IS NULL "
                 + "AND w.student_id = :studentId "
                 + "AND (w.mastery = 2 OR w.status = 8)",
           nativeQuery = true)
    long countMasteredByStudent(@Param("studentId") Long studentId);

    /**
     * P08-RENDER · 单库迁移后 (2026-05-17 用户拍板) analysis_task + analysis_result 同库.
     * AI OCR 输出 stem 落 analysis_result.stem · 从来没回写 wrong_item.stem_text ·
     * 导致 wrongbook GET 返空. 这里 LEFT JOIN 拿最新 analysis_result.stem 兜底.
     *
     * <p>多条 analysis_result 对同一 task_id 时取 created_at DESC 第 1 条
     * (一次重新分析会写入新行 · 我们要最新). task_id = wrong_item.id::text.
     * 返 String[] {ai_stem, error_reason, steps_json} · null 表示没有 AI 数据.
     */
    // PostgreSQL ::text 跟 JPA :param 占位符冲突 · 用 cast(... as text).
    // 不要求 analysis_task.status='DONE' · 因为 OCR 步成功但后续诊断/解答失败时
    // task 整体 FAILED 但 analysis_result.stem 已有真题干 · 该用就用.
    // 直接 JOIN analysis_result · 用 task_id = wrong_item.id (varchar 比较).
    @Query(
        value = "SELECT ar.stem "
              + "FROM analysis_result ar "
              + "WHERE ar.task_id = cast(:wrongItemId as varchar) "
              + "AND ar.deleted_at IS NULL "
              + "AND ar.stem IS NOT NULL AND length(ar.stem) > 0 "
              + "ORDER BY ar.created_at DESC LIMIT 1",
        nativeQuery = true)
    String findLatestAnalysisStemByWrongItemId(@Param("wrongItemId") Long wrongItemId);

    /**
     * P08/P09-RENDER · 拿 analysis_result 的完整 AI 输出 ·
     * 返 [stem, steps_jsonb_str, error_reason, knowledge_points_jsonb_str].
     * P09-FOLLOWUP-#2 加 knowledge_points 字段 (AI 提示词 V1.0.083 起输出).
     */
    @Query(
        value = "SELECT ar.stem, cast(ar.steps as text) AS steps_json, ar.error_reason, "
              + "cast(ar.knowledge_points as text) AS kp_json "
              + "FROM analysis_result ar "
              + "WHERE ar.task_id = cast(:wrongItemId as varchar) "
              + "AND ar.deleted_at IS NULL "
              + "AND ar.stem IS NOT NULL AND length(ar.stem) > 0 "
              + "ORDER BY ar.created_at DESC LIMIT 1",
        nativeQuery = true)
    List<Object[]> findLatestAnalysisFullByWrongItemId(@Param("wrongItemId") Long wrongItemId);

    /**
     * P05-LIST (2026-05-18) · 批量拿一组 wrong_item 的 latest AI stem · 避免 N+1.
     * 返 [wrong_item_id (Long), stem (String)] · 缺值的 item 不在结果集 (调用方 null fallback).
     * DISTINCT ON 取每 task 最新 (created_at DESC).
     */
    @Query(
        value = "SELECT DISTINCT ON (cast(ar.task_id as bigint)) "
              + "       cast(ar.task_id as bigint) AS wrong_item_id, ar.stem "
              + "FROM analysis_result ar "
              + "WHERE ar.task_id ~ '^[0-9]+$' "
              + "  AND cast(ar.task_id as bigint) IN (:wrongItemIds) "
              + "  AND ar.deleted_at IS NULL "
              + "  AND ar.stem IS NOT NULL AND length(ar.stem) > 0 "
              + "ORDER BY cast(ar.task_id as bigint), ar.created_at DESC",
        nativeQuery = true)
    List<Object[]> findLatestStemByWrongItemIds(@Param("wrongItemIds") List<Long> wrongItemIds);
}
