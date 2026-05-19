package com.longfeng.wrongbook.controller;

import com.longfeng.common.dto.ApiResult;
import com.longfeng.wrongbook.dto.MasteredCountResp;
import com.longfeng.wrongbook.repo.WrongItemRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Internal stats endpoint · 供 review-plan-service HomeAggregatorController 聚合 P-HOME hero
 * "掌握 N 题" chip 真值用. 不暴露给 FE 直接调用 (路径 prefix {@code /internal/} 标记).
 *
 * <p>Owner: wrongbook-service (持有 wrong_item 表). 跨服务调用走 RestTemplate (与 QuestionAggregateService
 * 调 review-plan-service 同模式).
 */
@RestController
@RequestMapping("/internal/students")
public class InternalStatsController {

    private final WrongItemRepository wrongItemRepo;

    public InternalStatsController(WrongItemRepository wrongItemRepo) {
        this.wrongItemRepo = wrongItemRepo;
    }

    /**
     * GET /internal/students/{studentId}/mastered-count · 累计已掌握题数
     * (mastery=2 OR status=ARCHIVED, deleted_at IS NULL).
     */
    @GetMapping("/{studentId}/mastered-count")
    public ApiResult<MasteredCountResp> masteredCount(@PathVariable("studentId") Long studentId) {
        long count = wrongItemRepo.countMasteredByStudent(studentId);
        return ApiResult.ok(new MasteredCountResp(count));
    }
}
