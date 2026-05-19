package com.longfeng.reviewplan.repo;

import com.longfeng.reviewplan.entity.WbReviewNode;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * SC20-T02 wb_review_node 表查询 · 用于 AnswerJudgeService 落 6 satellite 列.
 */
public interface WbReviewNodeRepository extends JpaRepository<WbReviewNode, Long> {
}
