package com.longfeng.wrongbook.controller;

import com.longfeng.common.dto.ApiResult;
import com.longfeng.common.exception.BusinessException;
import com.longfeng.common.exception.ErrCode;
import com.longfeng.wrongbook.dto.*;
import com.longfeng.wrongbook.service.QuestionAggregateService;
import jakarta.validation.Valid;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

/**
 * SC-01 主控制器 · /api/wb/questions · 6 endpoints 对齐 A02-wrongbook-api.md §2
 *
 * <p>FE destructures top-level data.question + data.plannedNodes,
 * so GET/PATCH return plain JSON (not wrapped in ApiResult).
 */
@RestController
@RequestMapping("/api/wb/questions")
@Validated
public class QuestionDetailController {

    private final QuestionAggregateService aggregateService;

    public QuestionDetailController(QuestionAggregateService aggregateService) {
        this.aggregateService = aggregateService;
    }

    /**
     * #1 POST /api/wb/questions · P02 创 PENDING 占位 · 返回 qid · HTTP 201
     */
    @PostMapping
    public ResponseEntity<ApiResult<CreateQuestionResp>> create(
            @Valid @RequestBody CreateQuestionReq req,
            @RequestHeader(value = "X-Idempotency-Key", required = false) String headerIdemKey,
            @RequestHeader(value = "X-Request-Id", required = false) String requestId) {

        String idemKey = Optional.ofNullable(headerIdemKey)
                .orElse(Optional.ofNullable(requestId).orElse(req.idempotencyKey()));
        if (idemKey == null || idemKey.isBlank()) {
            throw new BusinessException(ErrCode.VALIDATION_FAILED,
                    "msgkey:wb.error.idempotency_key_required");
        }

        CreateQuestionResp resp = aggregateService.createPending(req, idemKey);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResult.ok(resp));
    }

    /**
     * #2 GET /api/wb/questions/{qid} · P04 聚合详情 · plain JSON 不裹 ApiResult
     */
    @GetMapping("/{qid}")
    public ResponseEntity<QuestionDetailResp> get(@PathVariable String qid) {
        QuestionDetailResp resp = aggregateService.getDetail(qid);
        return ResponseEntity.ok(resp);
    }

    /**
     * #3 PATCH /api/wb/questions/{qid} · P04 学生编辑
     */
    @PatchMapping("/{qid}")
    public ResponseEntity<QuestionDetailResp> patch(
            @PathVariable String qid,
            @RequestBody PatchQuestionReq req,
            @RequestHeader(value = "X-Request-Id", required = false) String requestId) {
        QuestionDetailResp resp = aggregateService.patchAndGet(qid, req);
        return ResponseEntity.ok(resp);
    }

    /**
     * #4 POST /api/wb/questions/{qid}/save · P04 触发 SM-2 plan
     */
    @PostMapping("/{qid}/save")
    public ResponseEntity<ApiResult<SaveQuestionResp>> save(
            @PathVariable String qid,
            @RequestBody(required = false) SaveQuestionReq req,
            @RequestHeader(value = "X-Request-Id", required = false) String requestId) {
        SaveQuestionResp resp = aggregateService.saveQuestion(qid);
        return ResponseEntity.ok(ApiResult.ok(resp));
    }

    /**
     * #5 GET /api/wb/questions · P05 错题列表
     */
    @GetMapping
    public ResponseEntity<ApiResult<QuestionListResp>> list(
            @RequestHeader(value = "X-Student-Id", required = false) Long studentId,
            @RequestParam(required = false) String subject,
            @RequestParam(required = false) Short mastery,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String sort,
            // 2026-05-18 加 search q · stem_text + AI stem 模糊匹配 (ILIKE %q%)
            @RequestParam(required = false) String q) {
        if (studentId == null) {
            studentId = 0L; // dev fallback
        }
        QuestionListResp resp = aggregateService.listQuestions(studentId, subject, mastery, q, page, size, sort);
        return ResponseEntity.ok(ApiResult.ok(resp));
    }

    /**
     * #6 POST /api/wb/questions/{qid}/archive · P05 归档 · 幂等
     */
    @PostMapping("/{qid}/archive")
    public ResponseEntity<ApiResult<QuestionListItem>> archive(
            @PathVariable String qid,
            @RequestHeader(value = "X-Request-Id", required = false) String requestId) {
        QuestionListItem resp = aggregateService.archiveQuestion(qid);
        return ResponseEntity.ok(ApiResult.ok(resp));
    }
}
