package com.longfeng.anonymousservice.controller;

import com.longfeng.anonymousservice.dto.AnonConsentRequest;
import com.longfeng.anonymousservice.dto.AnonConsentResponse;
import com.longfeng.anonymousservice.dto.AnonErrorResponse;
import com.longfeng.anonymousservice.filter.AnonFilter;
import com.longfeng.anonymousservice.service.AnonSessionConsentService;
import com.longfeng.anonymousservice.service.AnonSessionConsentService.ConsentOutcome;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * SC-12-T02 · {@code PATCH /api/anon/session/{id}/consent} — biz §2B.13 F02.
 *
 * <p>Pre-condition: request passed {@link AnonFilter} (path is under
 * {@code /api/anon/**}). The filter populates request attribute
 * {@link AnonFilter#ATTR_GUEST_SESSION_ID} with the verified guest session id.
 *
 * <p>Controller responsibilities:
 * <ol>
 *   <li>Verify {@code attribute.anonGuestSessionId == pathVariable id} — the
 *       token's session id must match the session being acted on. Otherwise
 *       403 {@code ANON_SESSION_MISMATCH} (token leak / wrong owner).</li>
 *   <li>Delegate to {@link AnonSessionConsentService#applyConsent} and map
 *       outcome to HTTP:
 *       <ul>
 *         <li>{@code NOT_FOUND} → 404 {@code ANON_SESSION_NOT_FOUND}</li>
 *         <li>{@code SUCCESS}   → 200 {@link AnonConsentResponse}</li>
 *       </ul></li>
 * </ol>
 *
 * <p>{@code @ExceptionHandler} is locally scoped (not {@code @ControllerAdvice})
 * to avoid clashing with the existing handlers on {@code AnonSessionController}
 * / {@code ShareIssueController} / {@code SessionResolveController}.
 */
@RestController
public class AnonSessionConsentController {

    private static final Logger LOG = LoggerFactory.getLogger(AnonSessionConsentController.class);

    /** Error codes — wire-stable strings the frontend keys off (biz §2B.13). */
    static final String ERR_NOT_FOUND = "ANON_SESSION_NOT_FOUND";
    static final String ERR_MISMATCH  = "ANON_SESSION_MISMATCH";
    static final String ERR_VALIDATION = "VALIDATION_FAILED";

    private final AnonSessionConsentService service;

    public AnonSessionConsentController(AnonSessionConsentService service) {
        this.service = service;
    }

    @PatchMapping(value = "/api/anon/session/{id}/consent",
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> consent(
            @PathVariable("id") Long id,
            @Valid @RequestBody AnonConsentRequest req,
            HttpServletRequest httpReq) {

        Object attr = httpReq.getAttribute(AnonFilter.ATTR_GUEST_SESSION_ID);
        if (!(attr instanceof Long attrId)) {
            // Filter is registered to /api/anon/** so this path should never trigger;
            // surface defensively (programmer error) rather than NPE-cast.
            LOG.warn("anon_consent attribute_missing path_id={} attr={}", id, attr);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new AnonErrorResponse(AnonFilter.ERR_TOKEN_INVALID,
                            "Filter did not set guest session id attribute"));
        }
        if (!attrId.equals(id)) {
            LOG.info("anon_consent session_mismatch token_id={} path_id={}", attrId, id);
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(new AnonErrorResponse(ERR_MISMATCH,
                            "X-Anon-Token session id does not match path session id"));
        }

        ConsentOutcome outcome = service.applyConsent(id, req.getConsentType());
        return switch (outcome.getKind()) {
            case NOT_FOUND -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new AnonErrorResponse(ERR_NOT_FOUND,
                            "Guest session not found: " + id));
            case SUCCESS -> ResponseEntity.ok(
                    new AnonConsentResponse(outcome.getConsentAt(), req.getConsentType()));
        };
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<AnonErrorResponse> handleValidation(MethodArgumentNotValidException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
                .orElse("请求参数无效");
        LOG.debug("anon_consent_validation_failed: {}", msg);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new AnonErrorResponse(ERR_VALIDATION, msg));
    }
}
