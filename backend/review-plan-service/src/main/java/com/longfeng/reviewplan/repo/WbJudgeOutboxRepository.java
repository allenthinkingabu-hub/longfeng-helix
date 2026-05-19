package com.longfeng.reviewplan.repo;

import com.longfeng.reviewplan.entity.WbJudgeOutbox;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** SC21-T01 · wb_judge_outbox CRUD + relay 扫表查询. */
public interface WbJudgeOutboxRepository extends JpaRepository<WbJudgeOutbox, Long> {

  /**
   * AC3 relay 扫表语义 · 沿 ReviewPlanOutboxRepository#findPendingByEventType pattern:
   * status='PENDING' AND retry_count &lt; ? · 按 created_at ASC (TI3 FIFO 串行).
   */
  @Query("SELECT o FROM WbJudgeOutbox o "
      + "WHERE o.status = :status "
      + "AND o.retryCount < :maxRetry "
      + "ORDER BY o.createdAt ASC")
  List<WbJudgeOutbox> findPendingForRelay(
      @Param("status") String status,
      @Param("maxRetry") short maxRetry,
      Pageable pageable);

  /** AC4 监控埋点: pending gauge count. */
  long countByStatus(String status);
}
