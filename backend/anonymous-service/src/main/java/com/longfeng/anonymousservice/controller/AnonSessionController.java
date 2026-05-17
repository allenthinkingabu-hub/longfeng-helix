package com.longfeng.anonymousservice.controller;

import com.longfeng.anonymousservice.dto.AnonErrorResponse;
import com.longfeng.anonymousservice.dto.AnonSessionRequest;
import com.longfeng.anonymousservice.dto.AnonSessionResponse;
import com.longfeng.anonymousservice.service.AnonSessionService;
import com.longfeng.anonymousservice.service.AnonSessionService.AnonSessionMintResult;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * SC-12 · {@code POST /api/anon/session} — T01 single endpoint.
 *
 * <p>biz §2B.13 SC-12 F01 contract:
 * <ul>
 *   <li>HTTP 200 {@link AnonSessionResponse} on success — fresh anonToken +
 *       guest_session.id + expiresAt.
 *   <li>HTTP 400 {@code VALIDATION_FAILED} when {@code deviceFp} is blank or
 *       oversized (jakarta-validation MethodArgumentNotValidException).
 * </ul>
 *
 * <p>No authentication required — this is the anonymous tier's entry point
 * (the receiver creates an anon identity here; subsequent {@code /api/anon/*}
 * calls then bear {@code X-Anon-Token: <anonToken>} starting in T02).
 *
 * <p>{@code @ExceptionHandler} is scoped to this controller (not
 * {@code @ControllerAdvice}) so it doesn't collide with the existing handlers
 * on {@code ShareIssueController} / {@code SessionResolveController}.
 */
@RestController
public class AnonSessionController {

    private static final Logger LOG = LoggerFactory.getLogger(AnonSessionController.class);

    private final AnonSessionService service;

    public AnonSessionController(AnonSessionService service) {
        this.service = service;
    }

    @PostMapping(value = "/api/anon/session", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<AnonSessionResponse> mint(@Valid @RequestBody AnonSessionRequest req) {
        AnonSessionMintResult out = service.mint(req);
        return ResponseEntity.ok(
                new AnonSessionResponse(out.anonToken(), out.anonSessionId(), out.expiresAt()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<AnonErrorResponse> handleValidation(MethodArgumentNotValidException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
                .orElse("请求参数无效");
        LOG.debug("anon_session_validation_failed: {}", msg);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new AnonErrorResponse("VALIDATION_FAILED", msg));
    }
}
