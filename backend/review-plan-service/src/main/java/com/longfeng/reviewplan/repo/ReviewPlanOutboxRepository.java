package com.longfeng.reviewplan.repo;

import com.longfeng.reviewplan.entity.ReviewPlanOutbox;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ReviewPlanOutboxRepository extends JpaRepository<ReviewPlanOutbox, Long> {

  /**
   * SC-01-C07 · A06 §3 D9 · {@code CalendarOutboxRelayJob} 扫表语义：
   * status=pending AND event_type=? AND retry_count &lt; ? · 按 created_at 升序，命中
   * {@code idx_review_plan_outbox_status_created} 部分索引。
   */
  @Query("SELECT o FROM ReviewPlanOutbox o "
      + "WHERE o.status = :status "
      + "AND o.eventType = :eventType "
      + "AND o.retryCount < :maxRetry "
      + "ORDER BY o.createdAt ASC")
  List<ReviewPlanOutbox> findPendingByEventType(
      @Param("status") String status,
      @Param("eventType") String eventType,
      @Param("maxRetry") short maxRetry,
      Pageable pageable);
}
