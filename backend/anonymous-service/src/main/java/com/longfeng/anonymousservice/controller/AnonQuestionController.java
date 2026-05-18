package com.longfeng.anonymousservice.controller;

import com.longfeng.anonymousservice.dto.AnonErrorResponse;
import com.longfeng.anonymousservice.dto.AnonQuestionRequest;
import com.longfeng.anonymousservice.dto.AnonQuestionResponse;
import com.longfeng.anonymousservice.filter.AnonFilter;
import com.longfeng.anonymousservice.service.AnonQuestionService;
import com.longfeng.anonymousservice.service.AnonQuestionService.QuestionOutcome;
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
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

/**
 * SC-12-T05 · {@code POST /api/anon/questions} — biz §2B.13 F04.
 *
 * <p>Closes the upload → backend hand-off loop. After the frontend uploads to
 * the T04-minted pre-signed URL, it calls this endpoint with the
 * {@code objectKey} so the backend can persist
 * {@code guest_session.image_tmp_url} and (in T06) kick off analysis.
 *
 * <p>Pre-condition: request passed {@link AnonFilter} (path is under
 * {@code /api/anon/**}). The filter has verified {@code X-Anon-Token} and
 * stashed the session id in request attribute
 * {@link AnonFilter#ATTR_GUEST_SESSION_ID}. The controller reads that
 * attribute — NEVER from the request body — so a forged body field cannot
 * impersonate another session.
 *
 * <p>Error mapping (HTTP / code):
 * <ul>
 *   <li>{@code 400 IDEMPOTENCY_KEY_REQUIRED} — header missing or blank.</li>
 *   <li>{@code 400 VALIDATION_FAILED} — body fails {@code @Valid} (blank
 *       objectKey, oversized objectKey, invalid subject, blank subject).</li>
 *   <li>{@code 401 ANON_TOKEN_INVALID} — filter rejected (never reaches this
 *       branch in practice; defensive sanity surfaces it too).</li>
 *   <li>{@code 403 OBJECT_KEY_PREFIX_MISMATCH} — {@code objectKey} doesn't
 *       start with {@code guest-tmp/{anonSessionId}/} (cross-tenant write
 *       attempt).</li>
 *   <li>{@code 404 ANON_SESSION_NOT_FOUND} — token verified but session row
 *       gone (concurrent sweep).</li>
 *   <li>{@code 412 CONSENT_REQUIRED} — {@code consent_at IS NULL} on the
 *       row; biz §13 forbids image persistence pre-consent.</li>
 * </ul>
 *
 * <p>The {@code @ExceptionHandler} is locally scoped (not
 * {@code @ControllerAdvice}) to mirror the pattern used by
 * {@link AnonPresignController} / {@link AnonSessionConsentController} — keeps
 * each controller's error-handling concerns disjoint.
 *
 * <p>X-Idempotency-Key handling: P0 validates non-blank and logs the masked
 * value (first 4 + last 4 chars) for audit. Real Redis-backed dedupe is
 * deferred to T06+; re-posting with the same key currently overwrites
 * {@code image_tmp_url} (last-writer-wins, acceptable since both calls carry
 * the same intent).
 */
@RestController
public class AnonQuestionController {

    private static final Logger LOG = LoggerFactory.getLogger(AnonQuestionController.class);

    /** Error code constants — wire-stable strings the frontend keys on. */
    static final String ERR_IDEMPOTENCY_REQUIRED = "IDEMPOTENCY_KEY_REQUIRED";
    static final String ERR_VALIDATION           = "VALIDATION_FAILED";
    static final String ERR_NOT_FOUND            = "ANON_SESSION_NOT_FOUND";
    static final String ERR_CONSENT_REQUIRED     = "CONSENT_REQUIRED";
    static final String ERR_PREFIX_MISMATCH      = "OBJECT_KEY_PREFIX_MISMATCH";

    private final AnonQuestionService service;

    public AnonQuestionController(AnonQuestionService service) {
        this.service = service;
    }

    @PostMapping(value = "/api/anon/questions",
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> create(
            @Valid @RequestBody AnonQuestionRequest req,
            @RequestHeader(value = "X-Idempotency-Key", required = false) String idempotencyKey,
            HttpServletRequest httpReq) {

        // (1) X-Idempotency-Key gate · biz §10 — every write-side anon
        //     endpoint must carry an idempotency key. P0 only checks
        //     non-blank; T06+ will Redis-lock by this key.
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            LOG.info("anon_question_create idempotency_key_required");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new AnonErrorResponse(ERR_IDEMPOTENCY_REQUIRED,
                            "X-Idempotency-Key header is required"));
        }

        // (2) Read session id from filter-injected attribute · never from body.
        Object attr = httpReq.getAttribute(AnonFilter.ATTR_GUEST_SESSION_ID);
        if (!(attr instanceof Long anonSessionId)) {
            // Filter is registered to /api/anon/** so this should never trigger
            // in practice. Defensive in case the WebMvc registration drifts.
            LOG.warn("anon_question attribute_missing attr={}", attr);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new AnonErrorResponse(AnonFilter.ERR_TOKEN_INVALID,
                            "Filter did not set guest session id attribute"));
        }

        // Audit log · masked idempotency key, full sessionId + objectKey
        // (objectKey is non-sensitive per biz §13 since it's a server-prefix
        // synthetic identifier — no PII).
        LOG.info("anon_question_create idempotency_key={} session_id={} object_key={} subject={}",
                maskKey(idempotencyKey), anonSessionId, req.objectKey(), req.subject());

        QuestionOutcome outcome = service.record(anonSessionId, req);
        return switch (outcome.getKind()) {
            case NOT_FOUND -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new AnonErrorResponse(ERR_NOT_FOUND,
                            "Guest session not found: " + anonSessionId));
            case CONSENT_REQUIRED -> ResponseEntity.status(HttpStatus.PRECONDITION_FAILED)
                    .body(new AnonErrorResponse(ERR_CONSENT_REQUIRED,
                            "Consent must be recorded before posting a question"));
            case PREFIX_MISMATCH -> ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(new AnonErrorResponse(ERR_PREFIX_MISMATCH,
                            "objectKey must start with guest-tmp/" + anonSessionId + "/"));
            case SUCCESS -> ResponseEntity.status(HttpStatus.CREATED)
                    .body(new AnonQuestionResponse(
                            outcome.getAnonQid(),
                            new AnonQuestionResponse.ClaimWindow(outcome.getExpiresAt())));
        };
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<AnonErrorResponse> handleValidation(MethodArgumentNotValidException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
                .orElse("请求参数无效");
        LOG.debug("anon_question_validation_failed: {}", msg);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new AnonErrorResponse(ERR_VALIDATION, msg));
    }

    /**
     * Mask the idempotency key for audit logs · keep first 4 + last 4 chars
     * with {@code ***} in between. Defensive — keys are usually opaque UUIDs
     * but a future client might embed user-traceable data; masking ensures
     * the log line is always safe to ship to centralised log aggregators.
     */
    private static String maskKey(String key) {
        if (key == null || key.length() < 8) return "***";
        return key.substring(0, 4) + "***" + key.substring(key.length() - 4);
    }
}
