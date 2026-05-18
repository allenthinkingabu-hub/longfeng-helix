package com.longfeng.anonymousservice.controller;

import com.longfeng.anonymousservice.dto.AnonErrorResponse;
import com.longfeng.anonymousservice.dto.AnonPresignRequest;
import com.longfeng.anonymousservice.dto.AnonPresignResponse;
import com.longfeng.anonymousservice.filter.AnonFilter;
import com.longfeng.anonymousservice.service.AnonPresignService;
import com.longfeng.anonymousservice.service.AnonPresignService.FileTooLargeException;
import com.longfeng.anonymousservice.service.AnonPresignService.PresignResult;
import com.longfeng.anonymousservice.service.AnonPresignService.UnsupportedMimeException;
import jakarta.servlet.http.HttpServletRequest;
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
 * SC-12-T04 · {@code POST /api/anon/file/presign} — biz §2B.13 SC-12 F03.
 *
 * <p>Path is under {@code /api/anon/**} so {@link AnonFilter} runs before this
 * controller: it verifies {@code X-Anon-Token}, rejects missing/garbage tokens
 * with 401 {@code ANON_TOKEN_INVALID}, and on success stashes the verified
 * guest session id under request attribute
 * {@link AnonFilter#ATTR_GUEST_SESSION_ID}. The controller reads that attribute
 * to wire the session id into the object key prefix (see
 * {@link AnonPresignService#mintPresignedPut}).
 *
 * <p>Error mapping:
 * <ul>
 *   <li>{@code 400 VALIDATION_FAILED} — {@code @Valid} fails (mime regex,
 *       size {@code @Max}, blank fields, wrong purpose).</li>
 *   <li>{@code 401 ANON_TOKEN_INVALID} — filter rejected (never reaches here
 *       in practice); the defensive sanity branch surfaces it as 401 too.</li>
 *   <li>{@code 413 FILE_TOO_LARGE} — service-level secondary size guard.</li>
 *   <li>{@code 415 UNSUPPORTED_MIME} — service-level secondary mime guard.</li>
 * </ul>
 *
 * <p>The {@code @ExceptionHandler} is locally scoped (not
 * {@code @ControllerAdvice}) so it only governs this controller — mirrors the
 * pattern used by {@link AnonSessionConsentController} to avoid clashing with
 * the other anon controllers' bespoke handlers.
 */
@RestController
public class AnonPresignController {

    private static final Logger LOG = LoggerFactory.getLogger(AnonPresignController.class);

    /** Error code constants — wire-stable strings the frontend keys on. */
    static final String ERR_VALIDATION   = "VALIDATION_FAILED";
    static final String ERR_UNSUPPORTED  = "UNSUPPORTED_MIME";
    static final String ERR_TOO_LARGE    = "FILE_TOO_LARGE";

    private final AnonPresignService service;

    public AnonPresignController(AnonPresignService service) {
        this.service = service;
    }

    @PostMapping(value = "/api/anon/file/presign",
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> presign(
            @Valid @RequestBody AnonPresignRequest req,
            HttpServletRequest httpReq) {

        Object attr = httpReq.getAttribute(AnonFilter.ATTR_GUEST_SESSION_ID);
        if (!(attr instanceof Long anonSessionId)) {
            // Filter is registered to /api/anon/** so this branch should never
            // trigger; surface defensively if the WebMvc registration ever drifts.
            LOG.warn("anon_presign attribute_missing attr={}", attr);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new AnonErrorResponse(AnonFilter.ERR_TOKEN_INVALID,
                            "Filter did not set guest session id attribute"));
        }

        try {
            PresignResult r = service.mintPresignedPut(
                    anonSessionId, req.filename(), req.mime(), req.size());
            return ResponseEntity.ok(new AnonPresignResponse(
                    r.uploadUrl(), r.fileKey(), r.ttlSeconds(), r.bucket()));
        } catch (UnsupportedMimeException e) {
            // Service-level mime guard — defensive duplicate of the @Pattern
            // check, used if a future internal caller bypasses the controller.
            LOG.debug("anon_presign unsupported_mime: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
                    .body(new AnonErrorResponse(ERR_UNSUPPORTED, e.getMessage()));
        } catch (FileTooLargeException e) {
            LOG.debug("anon_presign file_too_large: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                    .body(new AnonErrorResponse(ERR_TOO_LARGE, e.getMessage()));
        }
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<AnonErrorResponse> handleValidation(MethodArgumentNotValidException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
                .orElse("请求参数无效");
        LOG.debug("anon_presign_validation_failed: {}", msg);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new AnonErrorResponse(ERR_VALIDATION, msg));
    }
}
