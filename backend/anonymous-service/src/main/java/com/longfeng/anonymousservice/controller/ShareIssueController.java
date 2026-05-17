package com.longfeng.anonymousservice.controller;

import com.longfeng.anonymousservice.dto.ShareIssueRequest;
import com.longfeng.anonymousservice.dto.ShareIssueResponse;
import com.longfeng.anonymousservice.service.JwtVerifier;
import com.longfeng.anonymousservice.service.ShareTokenService;
import com.longfeng.anonymousservice.service.ShareTokenService.IssueOutcome;
import jakarta.validation.Valid;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * SC-13-SHARER · POST /api/share/tokens — sharer issues a fresh share token.
 *
 * <p>biz §10.9 contract:
 * <ul>
 *   <li>HTTP 200 {@link ShareIssueResponse} on success (raw JWT + shareUrl + jti + expiresAt)
 *   <li>HTTP 401 {@code UNAUTHENTICATED} when Bearer JWT missing or invalid
 *   <li>HTTP 400 {@code VALIDATION_FAILED} when {@code shareType} ∉
 *       {EXAM_DAY|QUESTION|REVIEW_NODE} or {@code relationId} blank
 *       (delegated to {@link MethodArgumentNotValidException} handler)
 * </ul>
 *
 * <p>Note: this endpoint is sharer-only (writes to {@code share_token}).
 * Receiver-side {@link ShareController} remains read-only (GET /api/share/:token).
 *
 * <p>{@code share.public-base-url} is configurable so non-dev environments can
 * point the {@code /s/:token} CDN host (defaults to the vite dev server in
 * application.yml so IT can run without env overrides).
 */
@RestController
@RequestMapping("/api/share")
public class ShareIssueController {

    private static final Logger LOG = LoggerFactory.getLogger(ShareIssueController.class);

    private final ShareTokenService service;
    private final JwtVerifier jwtVerifier;
    private final String publicBaseUrl;

    public ShareIssueController(
            ShareTokenService service,
            JwtVerifier jwtVerifier,
            @Value("${share.public-base-url}") String publicBaseUrl) {
        this.service = service;
        this.jwtVerifier = jwtVerifier;
        this.publicBaseUrl = publicBaseUrl;
    }

    @PostMapping(value = "/tokens", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> issue(
            @RequestHeader(name = "Authorization", required = false) String authHeader,
            @Valid @RequestBody ShareIssueRequest req) {
        Optional<Long> sharerOpt = jwtVerifier.verifyAndGetStudentId(authHeader);
        if (sharerOpt.isEmpty()) {
            LOG.info("share_issue unauthenticated");
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(errorBody("UNAUTHENTICATED", "缺少有效的学生 JWT"));
        }
        long sharerStudentId = sharerOpt.get();
        IssueOutcome out = service.issue(sharerStudentId, req);
        // Strip trailing slash on baseUrl so /s/${token} produces clean URLs whether
        // the configured value is "https://host" or "https://host/".
        String base = publicBaseUrl.endsWith("/")
                ? publicBaseUrl.substring(0, publicBaseUrl.length() - 1)
                : publicBaseUrl;
        String shareUrl = base + "/s/" + out.shareToken();
        return ResponseEntity.ok(
                new ShareIssueResponse(out.shareToken(), shareUrl, out.jti(), out.expiresAt()));
    }

    /**
     * Same response shape as {@link SessionResolveController#handleValidation} so
     * the contract stays uniform: {@code {code, message}}. Scoped to this
     * controller (not @ControllerAdvice) to avoid colliding with the existing
     * handler on the resolve endpoint.
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
                .orElse("请求参数无效");
        Map<String, Object> body = new HashMap<>();
        body.put("code", "VALIDATION_FAILED");
        body.put("message", msg);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    private static Map<String, Object> errorBody(String code, String message) {
        Map<String, Object> body = new HashMap<>();
        body.put("code", code);
        body.put("message", message);
        return body;
    }
}
