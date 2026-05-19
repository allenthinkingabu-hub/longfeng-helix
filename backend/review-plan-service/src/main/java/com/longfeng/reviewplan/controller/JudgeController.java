package com.longfeng.reviewplan.controller;

import com.longfeng.reviewplan.dto.JudgeErrorResp;
import com.longfeng.reviewplan.dto.JudgeReq;
import com.longfeng.reviewplan.dto.JudgeResp;
import com.longfeng.reviewplan.exception.JudgeExceptions;
import com.longfeng.reviewplan.service.AnswerJudgeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

/**
 * SC20-T02 · POST /api/review/nodes/{nid}/judge controller · 落 review-plan-service ·
 * 与 /api/review/nodes/* family (open / reveal / grade · ReviewPlanController 现役) 同模块.
 *
 * <p>Headers: Authorization · X-User-Id · X-Idempotency-Key (biz §10.17 字面).
 * 401 UNAUTHORIZED 在 Authorization 缺/无效时由本 controller fail-fast (Spring Security 在本 IT 不引入 ·
 * 沿现役 review-plan-service 无 Security 链 · 本 task 在 controller 层模拟拦截 · biz §10.17 字面 1 错误码).
 *
 * <p>Body: { user_answer_image_key } · 调 AnswerJudgeService.judge · 200 + JudgeResp / 5 错误码.
 *
 * <p>**A.1 学生主体性铁律**: 本 endpoint **不直接调** /api/review/nodes/{nid}/grade · 仅 advisory.
 * grade 落库唯一触发点是 master §10.5 POST :grade.
 */
@RestController
@Tag(name = "ai-judge", description = "SC20-T02 · AI 辅助判作答")
public class JudgeController {

    private static final Logger log = LoggerFactory.getLogger(JudgeController.class);

    private static final String USER_ID_HEADER = "X-User-Id";
    private static final String AUTH_HEADER = "Authorization";
    private static final String IDEMPOTENCY_HEADER = "X-Idempotency-Key";

    private final AnswerJudgeService judgeService;

    public JudgeController(AnswerJudgeService judgeService) {
        this.judgeService = judgeService;
    }

    @Operation(summary = "SC20-T02 · AI 辅助判作答")
    @PostMapping("/api/review/nodes/{nid}/judge")
    public ResponseEntity<JudgeResp> judge(
            @PathVariable Long nid,
            @RequestHeader(value = AUTH_HEADER, required = false) String authorization,
            @RequestHeader(value = USER_ID_HEADER, required = false) Long userId,
            @RequestHeader(value = IDEMPOTENCY_HEADER, required = false) String idempotencyKey,
            @RequestBody(required = false) JudgeReq body) {
        // 401 fail-fast: 无 Authorization header 或 无 X-User-Id → 401 UNAUTHENTICATED
        if (authorization == null || authorization.isBlank()) {
            throw new JudgeExceptions.Unauthenticated("Authorization header missing");
        }
        if (userId == null) {
            throw new JudgeExceptions.Unauthenticated("X-User-Id header missing");
        }
        if (body == null || body.user_answer_image_key() == null || body.user_answer_image_key().isBlank()) {
            throw new JudgeExceptions.ImageKeyInvalid("user_answer_image_key missing");
        }
        JudgeResp resp = judgeService.judge(nid, userId, idempotencyKey, body.user_answer_image_key());
        return ResponseEntity.ok(resp);
    }

    // ==========================================================================
    // Local exception handlers (沿 ReviewPlanController 局部 ExceptionHandler 模式)
    // Round 2 用例 #5 字面: body `{error_code, message}` plain JSON · 不走 ApiResult envelope.
    // ==========================================================================

    @ExceptionHandler(JudgeExceptions.Unauthenticated.class)
    public ResponseEntity<JudgeErrorResp> handle401(JudgeExceptions.Unauthenticated e) {
        log.warn("AI judge 401 UNAUTHENTICATED: {}", e.getMessage());
        return ResponseEntity.status(401).body(new JudgeErrorResp("UNAUTHENTICATED", e.getMessage()));
    }

    @ExceptionHandler(JudgeExceptions.NodeNotFound.class)
    public ResponseEntity<JudgeErrorResp> handle404(JudgeExceptions.NodeNotFound e) {
        log.warn("AI judge 404 NODE_NOT_FOUND: {}", e.getMessage());
        return ResponseEntity.status(404).body(new JudgeErrorResp("NODE_NOT_FOUND", e.getMessage()));
    }

    @ExceptionHandler(JudgeExceptions.NodeAlreadyGraded.class)
    public ResponseEntity<JudgeErrorResp> handle409(JudgeExceptions.NodeAlreadyGraded e) {
        log.warn("AI judge 409 NODE_ALREADY_GRADED: {}", e.getMessage());
        return ResponseEntity.status(409).body(new JudgeErrorResp("NODE_ALREADY_GRADED", e.getMessage()));
    }

    @ExceptionHandler(JudgeExceptions.ImageKeyInvalid.class)
    public ResponseEntity<JudgeErrorResp> handle422(JudgeExceptions.ImageKeyInvalid e) {
        log.warn("AI judge 422 IMAGE_KEY_INVALID: {}", e.getMessage());
        return ResponseEntity.status(422).body(new JudgeErrorResp("IMAGE_KEY_INVALID", e.getMessage()));
    }

    @ExceptionHandler(JudgeExceptions.AiServiceUnavailable.class)
    public ResponseEntity<JudgeErrorResp> handle503(JudgeExceptions.AiServiceUnavailable e) {
        log.warn("AI judge 503 AI_SERVICE_UNAVAILABLE: {}", e.getMessage());
        return ResponseEntity.status(503).body(new JudgeErrorResp("AI_SERVICE_UNAVAILABLE", e.getMessage()));
    }
}
