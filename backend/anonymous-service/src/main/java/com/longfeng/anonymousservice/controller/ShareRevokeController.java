package com.longfeng.anonymousservice.controller;

import com.longfeng.anonymousservice.service.JwtVerifier;
import com.longfeng.anonymousservice.service.ShareTokenService;
import com.longfeng.anonymousservice.service.ShareTokenService.RevokeOutcome;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * SC-13-SHARER · DELETE /api/share/tokens/{jti} — sharer revokes a token.
 *
 * <p>biz §10.9 contract:
 * <ul>
 *   <li>HTTP 204 — SUCCESS or ALREADY_REVOKED (idempotent; both end-states match
 *       "this jti is no longer usable")
 *   <li>HTTP 401 {@code UNAUTHENTICATED} when Bearer JWT missing
 *   <li>HTTP 403 {@code NOT_OWNER} when the caller's student_id does not match
 *       {@code share_token.sharer_student_id} (prevents A revoking B's token)
 *   <li>HTTP 404 {@code TOKEN_NOT_FOUND} when no DB row matches the jti
 * </ul>
 *
 * <p>Side effect: writes {@code SADD share:revoked <jti>} so
 * {@link com.longfeng.anonymousservice.controller.ShareController}'s receiver
 * GET sees the revocation within Redis-RTT (biz §10.9 "Redis Bloom 秒级").
 * Redis failure is WARN-logged but does not break revocation (DB row.status=3
 * is the durable source of truth).
 */
@RestController
@RequestMapping("/api/share")
public class ShareRevokeController {

    private static final Logger LOG = LoggerFactory.getLogger(ShareRevokeController.class);

    private final ShareTokenService service;
    private final JwtVerifier jwtVerifier;

    public ShareRevokeController(ShareTokenService service, JwtVerifier jwtVerifier) {
        this.service = service;
        this.jwtVerifier = jwtVerifier;
    }

    @DeleteMapping(value = "/tokens/{jti}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> revoke(
            @PathVariable("jti") String jti,
            @RequestHeader(name = "Authorization", required = false) String authHeader) {
        Optional<Long> callerOpt = jwtVerifier.verifyAndGetStudentId(authHeader);
        if (callerOpt.isEmpty()) {
            LOG.info("share_revoke unauthenticated jti_present={}", jti != null && !jti.isBlank());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(errorBody("UNAUTHENTICATED", "缺少有效的学生 JWT"));
        }
        long callerStudentId = callerOpt.get();
        RevokeOutcome.Kind outcome = service.revoke(jti, callerStudentId);
        return switch (outcome) {
            case SUCCESS, ALREADY_REVOKED -> ResponseEntity.noContent().build();
            case NOT_FOUND -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(errorBody("TOKEN_NOT_FOUND", "该分享令牌不存在"));
            case NOT_OWNER -> ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(errorBody("NOT_OWNER", "无权撤销他人创建的分享"));
        };
    }

    private static Map<String, Object> errorBody(String code, String message) {
        Map<String, Object> body = new HashMap<>();
        body.put("code", code);
        body.put("message", message);
        return body;
    }
}
