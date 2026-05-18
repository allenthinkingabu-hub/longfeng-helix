package com.longfeng.anonymousservice.controller;

import com.longfeng.anonymousservice.dto.AnonAnalyzeRequest;
import com.longfeng.anonymousservice.dto.AnonAnalyzeResponse;
import com.longfeng.anonymousservice.dto.AnonErrorResponse;
import com.longfeng.anonymousservice.filter.AnonFilter;
import com.longfeng.anonymousservice.service.AnonAnalyzeService;
import com.longfeng.anonymousservice.service.AnonAnalyzeService.AnalyzeOutcome;
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
 * SC-12-T06 · {@code POST /api/anon/analyze-by-url} — biz §2B.13 F04.
 *
 * <p>Last step of the guest-capture write loop: now that T05 has persisted
 * {@code image_tmp_url}, the FE asks the backend to forward the image to
 * {@code ai-analysis-service:8083} and start AI inference. The forward is a
 * real HTTP call (NO MOCK — user iron rule 2026-05-18); the heavy lifting
 * lives in {@link AnonAnalyzeService}.
 *
 * <p>Pre-condition: request passed {@link AnonFilter}. The filter has verified
 * {@code X-Anon-Token} and stashed the session id in request attribute
 * {@link AnonFilter#ATTR_GUEST_SESSION_ID}. The controller reads the
 * filter-injected id and cross-checks it against {@code req.anonQid()} as a
 * defence-in-depth layer (mirrors {@link AnonQuestionController}'s
 * cross-tenant write defence): a leaked anonToken cannot drive analyze for
 * another guest's session id.
 *
 * <p>Error mapping (HTTP / code):
 * <ul>
 *   <li>{@code 400 VALIDATION_FAILED} — body fails {@code @Valid}
 *       (null anonQid, null/non-whitelisted subject, oversized imageUrl).</li>
 *   <li>{@code 401 ANON_TOKEN_INVALID} — filter rejected (defensive; the
 *       filter normally writes its own 401 before the controller is reached).</li>
 *   <li>{@code 403 ANON_SESSION_MISMATCH} — {@code req.anonQid()} ≠ the
 *       filter-verified session id.</li>
 *   <li>{@code 404 ANON_SESSION_NOT_FOUND} — token verified but row gone.</li>
 *   <li>{@code 412 IMAGE_NOT_UPLOADED} — {@code image_tmp_url IS NULL}; FE
 *       must run T05 first.</li>
 *   <li>{@code 502 AI_SERVICE_FAILURE} — upstream ai-analysis-service is
 *       unreachable / timing out / not returning 202.</li>
 *   <li>{@code 202 ANALYZING} — happy path. Body: {@code {task_id, poll_every,
 *       status}}.</li>
 * </ul>
 *
 * <p>The {@code @ExceptionHandler} is locally scoped (not
 * {@code @ControllerAdvice}) to mirror the pattern used by
 * {@link AnonQuestionController} — keeps each controller's error-handling
 * concerns disjoint.
 *
 * <p>X-Idempotency-Key handling: deliberately <b>not required</b> for the
 * analyze step. Re-posting analyze for the same session is naturally
 * idempotent at the upstream side (same {@code taskId}, same row gets
 * upserted) and the FE polling loop will pick up whichever attempt landed
 * first. Adding the gate here would force the FE into extra plumbing for
 * zero correctness gain. Biz §10 idempotency pattern applies to
 * {@code questions} (where DB writes have a natural race window) — not here.
 */
@RestController
public class AnonAnalyzeController {

    private static final Logger LOG = LoggerFactory.getLogger(AnonAnalyzeController.class);

    /** Error code constants — wire-stable strings the frontend keys on. */
    static final String ERR_VALIDATION       = "VALIDATION_FAILED";
    static final String ERR_NOT_FOUND        = "ANON_SESSION_NOT_FOUND";
    static final String ERR_SESSION_MISMATCH = "ANON_SESSION_MISMATCH";
    static final String ERR_IMAGE_NOT_UPLOADED = "IMAGE_NOT_UPLOADED";
    static final String ERR_AI_SERVICE_FAILURE = "AI_SERVICE_FAILURE";
    /** T09 · biz §2A.3.2 device bucket exhausted (1/device/day). */
    static final String ERR_QUOTA_EXHAUSTED_DEVICE = "QUOTA_EXHAUSTED_DEVICE";
    /** T09 · biz §2B.13 IP bucket exhausted (10/IP/day). */
    static final String ERR_QUOTA_EXHAUSTED_IP     = "QUOTA_EXHAUSTED_IP";

    /** FE polling cadence, milliseconds. Pinned by biz §2B.13 F04. */
    private static final int POLL_EVERY_MS = 1000;

    /** Initial wire-status returned on a successful 202 forward. */
    private static final String STATUS_ANALYZING = "ANALYZING";

    private final AnonAnalyzeService service;

    public AnonAnalyzeController(AnonAnalyzeService service) {
        this.service = service;
    }

    @PostMapping(value = "/api/anon/analyze-by-url",
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> analyze(
            @Valid @RequestBody AnonAnalyzeRequest req,
            HttpServletRequest httpReq) {

        // (1) Read filter-injected session id · never from body.
        Object attr = httpReq.getAttribute(AnonFilter.ATTR_GUEST_SESSION_ID);
        if (!(attr instanceof Long anonSessionId)) {
            // Defensive 401 · the filter normally short-circuits with its own
            // 401 before the controller runs, so this branch should be cold.
            LOG.warn("anon_analyze attribute_missing attr={}", attr);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new AnonErrorResponse(AnonFilter.ERR_TOKEN_INVALID,
                            "Filter did not set guest session id attribute"));
        }

        // (2) Cross-check body anonQid against filter-verified id · belt-and-
        //     braces against a leaked token being replayed with another
        //     guest's qid in the body.
        if (!Long.valueOf(anonSessionId).equals(req.anonQid())) {
            LOG.warn("anon_analyze session_mismatch verified_id={} body_qid={}",
                    anonSessionId, req.anonQid());
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(new AnonErrorResponse(ERR_SESSION_MISMATCH,
                            "anonQid in body does not match verified session"));
        }

        // T09 · capture client IP from the servlet request. Using
        // getRemoteAddr() (not X-Forwarded-For) is intentional for P0 — the
        // gateway-aware path is P1; P0 trusts the direct connection peer.
        // Hashing happens inside AnonQuotaService so the raw IP never leaves
        // this method.
        String clientIp = httpReq.getRemoteAddr();

        LOG.info("anon_analyze_start session_id={} subject={} has_image_url={} clientIp_present={}",
                anonSessionId, req.subject(),
                req.imageUrl() != null && !req.imageUrl().isBlank(),
                clientIp != null);

        AnalyzeOutcome outcome = service.startAnalysis(
                anonSessionId, req.subject(), req.imageUrl(), clientIp);

        return switch (outcome.getKind()) {
            case NOT_FOUND -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new AnonErrorResponse(ERR_NOT_FOUND,
                            "Guest session not found: " + anonSessionId));
            case IMAGE_NOT_UPLOADED -> ResponseEntity.status(HttpStatus.PRECONDITION_FAILED)
                    .body(new AnonErrorResponse(ERR_IMAGE_NOT_UPLOADED,
                            "image_tmp_url is null; run POST /api/anon/questions first"));
            case AI_SERVICE_FAILURE -> ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(new AnonErrorResponse(ERR_AI_SERVICE_FAILURE,
                            "ai-analysis-service upstream unreachable or non-202"));
            // T09 · 429 + Retry-After. RFC 7231 §7.1.3 allows seconds-as-int
            // for Retry-After; we use the seconds-to-midnight value so the
            // FE has a deterministic countdown anchor (the bucket actually
            // resets at that moment).
            case QUOTA_EXHAUSTED_DEVICE -> ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .header("Retry-After", String.valueOf(outcome.getRetryAfterSec()))
                    .body(new AnonErrorResponse(ERR_QUOTA_EXHAUSTED_DEVICE,
                            "Daily limit 1/device exceeded; resets at next Asia/Shanghai midnight"));
            case QUOTA_EXHAUSTED_IP -> ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .header("Retry-After", String.valueOf(outcome.getRetryAfterSec()))
                    .body(new AnonErrorResponse(ERR_QUOTA_EXHAUSTED_IP,
                            "Daily limit 10/IP exceeded; resets at next Asia/Shanghai midnight"));
            case SUCCESS -> ResponseEntity.status(HttpStatus.ACCEPTED)
                    .body(new AnonAnalyzeResponse(
                            outcome.getTaskId(), POLL_EVERY_MS, STATUS_ANALYZING));
        };
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<AnonErrorResponse> handleValidation(MethodArgumentNotValidException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
                .orElse("请求参数无效");
        LOG.debug("anon_analyze_validation_failed: {}", msg);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new AnonErrorResponse(ERR_VALIDATION, msg));
    }
}
