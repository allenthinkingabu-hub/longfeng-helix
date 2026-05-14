package com.longfeng.reviewplan.repo;

import com.longfeng.reviewplan.entity.ReviewOutcome;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReviewOutcomeRepository extends JpaRepository<ReviewOutcome, Long> {

    List<ReviewOutcome> findByPlanIdOrderByCompletedAtDesc(Long planId, Pageable pageable);
}
