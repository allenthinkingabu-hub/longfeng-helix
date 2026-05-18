package com.longfeng.anonymousservice.controller;

import com.longfeng.anonymousservice.dto.AnonClaimRequest;
import com.longfeng.anonymousservice.dto.AnonClaimResponse;
import com.longfeng.anonymousservice.dto.AnonErrorResponse;
import com.longfeng.anonymousservice.filter.AnonFilter;
import com.longfeng.anonymousservice.service.AnonClaimService;
import com.longfeng.anonymousservice.service.AnonClaimService.ClaimOutcome;
import com.longfeng.anonymousservice.service.JwtVerifier;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.Optional;
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
 * SC-12-T08 · {@code POST /api/anon/claim} — biz §2B.13 F08.
 *
 * <p>Closes the Try-Before-Signup funnel: after T07 (result polling sees DONE)
 * the guest registers via auth-service and the FE calls
 * {@code POST /api/anon/claim} with the freshly-minted student JWT. This
 * endpoint:
 *
 * <ol>
 *   <li>Re-verifies the original guest token (AnonFilter writes
 *       {@code anonGuestSessionId} attribute · same pattern T05/T06 use).</li>
 *   <li>Verifies the {@code Authorization: Bearer <studentJwt>} via
 *       {@link JwtVerifier} (same key/iss/aud as auth-service) — empty
 *       Optional → 401 {@code STUDENT_AUTH_REQUIRED}.</li>
 *   <li>Delegates to {@link AnonClaimService#claim}.</li>
 *   <li>Maps the outcome enum → HTTP status (see {@code switch} below).</li>
 * </ol>
 *
 * <p>Path choice {@code /api/anon/claim} (NOT the
 * {@code /api/auth/anonymous-claim} that spec §5 #6 originally pinned): the
 * mint/consent/questions/analyze/result endpoints all live under
 * {@code /api/anon/*} on the anonymous-service, and AnonFilter is registered
 * to that path prefix. Putting claim under the same namespace lets the filter
 * naturally take care of X-Anon-Token verification without bouncing through
 * auth-service. This is a documented spec drift (inflight scope_out item) —
 * the spec wasn't updated because the namespace choice is purely an
 * implementation detail; the FE owns both client-side path constants and can
 * keep them in sync trivially.
 *
 * <p>Error mapping (HTTP / code):
 * <ul>
 *   <li>{@code 400 VALIDATION_FAILED} — body fails {@code @Valid} (subject
 *       null / non-whitelisted).</li>
 *   <li>{@code 401 ANON_TOKEN_INVALID} — AnonFilter rejected (defensive; the
 *       filter normally writes its own 401 before the controller is reached).</li>
 *   <li>{@code 401 STUDENT_AUTH_REQUIRED} — missing/invalid
 *       {@code Authorization: Bearer <jwt>}.</li>
 *   <li>{@code 404 ANON_SESSION_NOT_FOUND} — anon row swept since token mint.</li>
 *   <li>{@code 409 ALREADY_CLAIMED_BY_OTHER} — session was already claimed
 *       by a different student.</li>
 *   <li>{@code 412 NOT_READY_TO_CLAIM} — status != 2 RESULT_READY OR
 *       image_tmp_url blank.</li>
 *   <li>{@code 502 WRONGBOOK_SERVICE_FAILURE} — upstream wrongbook-service
 *       unreachable / non-201 / bad envelope.</li>
 *   <li>{@code 200} — claim succeeded (first time OR idempotent same-student).
 *       Body: {@code {claimed_question_id, claimed_at, anon_session_id,
 *       student_id}}.</li>
 * </ul>
 *
 * <p>The {@code @ExceptionHandler} is locally scoped to mirror sibling
 * controllers ({@link AnonAnalyzeController}, {@link AnonQuestionController}).
 */
@RestController
public class AnonClaimController {

    private static final Logger LOG = LoggerFactory.getLogger(AnonClaimController.class);

    /** Error code constants — wire-stable strings the frontend keys on. */
    static final String ERR_VALIDATION       = "VALIDATION_FAILED";
    static final String ERR_STUDENT_AUTH     = "STUDENT_AUTH_REQUIRED";
    static final String ERR_NOT_FOUND        = "ANON_SESSION_NOT_FOUND";
    static final String ERR_NOT_READY        = "NOT_READY_TO_CLAIM";
    static final String ERR_ALREADY_CLAIMED  = "ALREADY_CLAIMED_BY_OTHER";
    static final String ERR_WB_FAILURE       = "WRONGBOOK_SERVICE_FAILURE";

    private final AnonClaimService service;
    private final JwtVerifier jwtVerifier;

    public AnonClaimController(AnonClaimService service, JwtVerifier jwtVerifier) {
        this.service = service;
        this.jwtVerifier = jwtVerifier;
    }

    @PostMapping(value = "/api/anon/claim",
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> claim(
            @Valid @RequestBody AnonClaimRequest req,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            HttpServletRequest httpReq) {

        // (1) Read filter-injected anon session id · never from body. Defensive
        //     401 if the attribute is missing — the filter normally
        //     short-circuits before the controller is reached, so this branch
        //     is cold but kept for belt-and-braces.
        Object attr = httpReq.getAttribute(AnonFilter.ATTR_GUEST_SESSION_ID);
        if (!(attr instanceof Long anonSessionId)) {
            LOG.warn("anon_claim attribute_missing attr={}", attr);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new AnonErrorResponse(AnonFilter.ERR_TOKEN_INVALID,
                            "Filter did not set guest session id attribute"));
        }

        // (2) Verify the registered-user JWT. Empty Optional covers: missing
        //     header, missing Bearer prefix, expired, wrong iss/aud, bad sig,
        //     non-numeric sub. All collapse to a single 401 STUDENT_AUTH_REQUIRED
        //     because the FE can't usefully discriminate — it simply re-routes
        //     to the login page.
        Optional<Long> studentIdOpt = jwtVerifier.verifyAndGetStudentId(authHeader);
        if (studentIdOpt.isEmpty()) {
            LOG.info("anon_claim student_auth_required session_id={} has_header={}",
                    anonSessionId, authHeader != null && !authHeader.isBlank());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new AnonErrorResponse(ERR_STUDENT_AUTH,
                            "Bearer student JWT required"));
        }
        long studentId = studentIdOpt.get();

        LOG.info("anon_claim_start session_id={} student_id={} subject={}",
                anonSessionId, studentId, req.subject());

        ClaimOutcome outcome = service.claim(anonSessionId, studentId, req.subject());

        return switch (outcome.getKind()) {
            case SESSION_NOT_FOUND -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new AnonErrorResponse(ERR_NOT_FOUND,
                            "Guest session not found: " + anonSessionId));
            case NOT_READY_TO_CLAIM -> ResponseEntity.status(HttpStatus.PRECONDITION_FAILED)
                    .body(new AnonErrorResponse(ERR_NOT_READY,
                            "Session is not RESULT_READY or image_tmp_url is blank"));
            case ALREADY_CLAIMED_BY_OTHER -> ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(new AnonErrorResponse(ERR_ALREADY_CLAIMED,
                            "Session already claimed by another student"));
            case WRONGBOOK_SERVICE_FAILURE -> ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(new AnonErrorResponse(ERR_WB_FAILURE,
                            "wrongbook-service upstream unreachable or bad envelope"));
            case IDEMPOTENT, SUCCESS -> ResponseEntity.ok(new AnonClaimResponse(
                    outcome.getClaimedQuestionId(),
                    outcome.getClaimedAt(),
                    outcome.getAnonSessionId(),
                    outcome.getStudentId()));
        };
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<AnonErrorResponse> handleValidation(MethodArgumentNotValidException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
                .orElse("请求参数无效");
        LOG.debug("anon_claim_validation_failed: {}", msg);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new AnonErrorResponse(ERR_VALIDATION, msg));
    }
}
