package com.longfeng.reviewplan.repo;

import com.longfeng.reviewplan.entity.ReviewPlan;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReviewPlanRepository extends JpaRepository<ReviewPlan, Long> {

  /** Consumer 幂等前置检查 · SC-07.AC-1 boundary.0. */
  boolean existsByWrongItemId(Long wrongItemId);

  /** 查 wrong_item 全 7 行（mastered 触发时聚合用）· 按 node_index asc 返. */
  List<ReviewPlan> findByWrongItemIdOrderByNodeIndexAsc(Long wrongItemId);

  /** complete 单节点 · 加行锁读当前 ease/interval. */
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("SELECT p FROM ReviewPlan p WHERE p.id = :id")
  Optional<ReviewPlan> findByIdForUpdate(@Param("id") Long id);

  /** XXL-Job 扫 due · 批量 · limit · 走 nativeQuery 规避 JPQL short 字面量的 type-infer 问题. */
  @Query(
      value =
          "SELECT * FROM review_plan WHERE status = 0 AND deleted_at IS NULL "
              + "AND next_due_at <= :now ORDER BY next_due_at ASC LIMIT :limit",
      nativeQuery = true)
  List<ReviewPlan> findDueBatch(@Param("now") Instant now, @Param("limit") int limit);

  /** 触发 mastered · 一次性 UPDATE 全 7 行 · Q-G 聚合根原子性. */
  @Modifying
  @Query(
      "UPDATE ReviewPlan p SET p.status = 1, p.deletedAt = :now "
          + "WHERE p.wrongItemId = :wrongItemId AND p.status = 0")
  int markAllMasteredByWrongItemId(
      @Param("wrongItemId") Long wrongItemId, @Param("now") Instant now);

  /** 学期初清空 · 软删该学生所有 active plan · POST /review-plans/batch-reset (admin). */
  @Modifying
  @Query(
      value =
          "UPDATE review_plan SET deleted_at = now() WHERE student_id = :studentId "
              + "AND status = 0 AND deleted_at IS NULL",
      nativeQuery = true)
  int softDeleteAllActiveByStudentId(@Param("studentId") Long studentId);

  /** GET /review-plans?date= 日视图 · 按学生 ID + next_due_at UTC 时间窗口过滤. */
  @Query(
      value =
          "SELECT * FROM review_plan WHERE student_id = :studentId AND deleted_at IS NULL "
              + "AND next_due_at >= :start AND next_due_at < :end ORDER BY next_due_at ASC",
      nativeQuery = true)
  List<ReviewPlan> findDueOnDate(
      @Param("studentId") Long studentId,
      @Param("start") Instant start,
      @Param("end") Instant end);

  /**
   * P07-TODAY-RENDER · 拿 wrong_item subject+stem · 供 today 卡渲染.
   * 单库迁移后 (2026-05-17 用户拍板 C+B 方案) wrong_item + analysis_result 同库.
   * wrong_item.stem_text 可能为 null (AI 写到 analysis_result 不回写) ·
   * LEFT JOIN analysis_result + COALESCE 兜底 AI OCR 真题干.
   *
   * <p>取 analysis_result 时按 created_at DESC 拿最新 · 子查询展开 · 同 wrongbook
   * GET 那侧 (commit 9dbaf45) 的逻辑对齐.
   *
   * <p>返 [wrong_item.id, subject, effective_stem] · 数量 <= 50.
   */
  @Query(
      value =
          "SELECT wi.id, wi.subject, COALESCE(NULLIF(wi.stem_text, ''), ar_latest.stem) "
              + "FROM wrong_item wi "
              + "LEFT JOIN LATERAL ("
              + "  SELECT stem FROM analysis_result "
              + "  WHERE task_id = cast(wi.id as varchar) "
              + "    AND deleted_at IS NULL "
              + "    AND stem IS NOT NULL AND length(stem) > 0 "
              + "  ORDER BY created_at DESC LIMIT 1"
              + ") ar_latest ON true "
              + "WHERE wi.id IN (:ids) AND wi.deleted_at IS NULL",
      nativeQuery = true)
  List<Object[]> findSubjectStemByIds(@Param("ids") List<Long> ids);

  /**
   * SC-01-D01 · GET /api/home/today 聚合：统计今日已完成节点数.
   *
   * <p>语义：completed_at ∈ [start, end)（按用户 tz 切日）；不限制 status，allow 单次完成 (status=0) 与
   * mastered (status=1) 都计入。
   */
  @Query(
      value =
          "SELECT COUNT(*) FROM review_plan WHERE student_id = :studentId "
              + "AND deleted_at IS NULL AND completed_at IS NOT NULL "
              + "AND completed_at >= :start AND completed_at < :end",
      nativeQuery = true)
  long countCompletedOnDate(
      @Param("studentId") Long studentId,
      @Param("start") Instant start,
      @Param("end") Instant end);

  /** XXL-Job CAS 派发 · UPDATE dispatch_version WHERE id AND expected · rowsAffected=1 成功. */
  @Modifying
  @Query(
      value =
          "UPDATE review_plan SET dispatch_version = dispatch_version + 1, "
              + "updated_at = now() WHERE id = :id AND dispatch_version = :expected "
              + "AND deleted_at IS NULL",
      nativeQuery = true)
  int compareAndUpdateDispatch(
      @Param("id") Long id, @Param("expected") Long expectedVersion);

  /**
   * BE-13 · GET /review-plans/list cursor 翻页 · 按 created_at DESC + id DESC 排序 · cursor stable.
   *
   * <p>{@code statusOpt < 0} 表示不过滤 status. {@code cursorId = Long.MAX_VALUE} 等价首页.
   */
  @Query(
      value =
          "SELECT * FROM review_plan WHERE student_id = :studentId AND deleted_at IS NULL "
              + "AND (:statusOpt < 0 OR status = :statusOpt) "
              + "AND id < :cursorId "
              + "ORDER BY created_at DESC, id DESC LIMIT :limit",
      nativeQuery = true)
  List<ReviewPlan> findListByStudentCursor(
      @Param("studentId") Long studentId,
      @Param("statusOpt") int statusOpt,
      @Param("cursorId") Long cursorId,
      @Param("limit") int limit);

  /**
   * P05-LIST · 批量拿 wrongItemId 列表中每个 item 的"下一个未完成节点"
   * (status=0 active · 按 next_due_at ASC 取首条) · 单条 SQL · O(N log N).
   *
   * <p>PostgreSQL DISTINCT ON 语法: 每个 wrong_item_id 只保留第 1 行
   * (按 ORDER BY 排序后的). 比子查询 + JOIN 简单且快.
   *
   * <p>返回 Object[] tuple: [wrong_item_id Long, node_index Short, next_due_at Instant].
   * Caller 自行 map 成 DTO · 此处不引入 DTO 依赖到 repo 层.
   */
  @Query(
      value =
          "SELECT DISTINCT ON (wrong_item_id) wrong_item_id, node_index, next_due_at "
              + "FROM review_plan "
              + "WHERE wrong_item_id IN (:ids) AND status = 0 AND deleted_at IS NULL "
              + "ORDER BY wrong_item_id, next_due_at ASC",
      nativeQuery = true)
  List<Object[]> findNextDueByWrongItemIds(@Param("ids") List<Long> ids);

  /**
   * BE-13 · POST /review-plans/batch-reset-by-ids · 按 plan_ids 批量软删 active plan.
   *
   * <p>只重置 status=0 (ACTIVE) · 已 mastered (status=1) 不动 · returns rowsAffected.
   */
  @Modifying
  @Query(
      value =
          "UPDATE review_plan SET deleted_at = now() WHERE id IN (:planIds) "
              + "AND status = 0 AND deleted_at IS NULL",
      nativeQuery = true)
  int softDeleteByIds(@Param("planIds") List<Long> planIds);

  /**
   * P-HOME week-dots · 本周 [weekStart, weekEnd) 所有 active plan ·
   * 单次 SQL 拉所有 · Java 侧按日分桶 + node_index → 颜色映射 · 比 7 次查询省.
   *
   * <p>返 [next_due_at Instant, node_index Short].
   */
  @Query(
      value =
          "SELECT next_due_at, node_index FROM review_plan "
              + "WHERE student_id = :studentId AND status = 0 AND deleted_at IS NULL "
              + "AND next_due_at >= :weekStart AND next_due_at < :weekEnd "
              + "ORDER BY next_due_at ASC",
      nativeQuery = true)
  List<Object[]> findWeekDueRaw(
      @Param("studentId") Long studentId,
      @Param("weekStart") Instant weekStart,
      @Param("weekEnd") Instant weekEnd);

  /**
   * P-HOME messages · 拿下一个 due 节点 (status=0, next_due_at ≥ now) · 派生消息 #1.
   * 单 DB join wrong_item 拿 subject. 返 [next_due_at, plan_id, node_index, wrong_item_id, subject].
   */
  @Query(
      value =
          "SELECT rp.next_due_at, rp.id, rp.node_index, rp.wrong_item_id, wi.subject "
              + "FROM review_plan rp "
              + "LEFT JOIN wrong_item wi ON wi.id = rp.wrong_item_id AND wi.deleted_at IS NULL "
              + "WHERE rp.student_id = :studentId AND rp.status = 0 AND rp.deleted_at IS NULL "
              + "AND rp.next_due_at >= :now "
              + "ORDER BY rp.next_due_at ASC LIMIT 1",
      nativeQuery = true)
  List<Object[]> findNextDueWithSubject(
      @Param("studentId") Long studentId,
      @Param("now") Instant now);
}
