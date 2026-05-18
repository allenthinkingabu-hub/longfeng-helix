package com.longfeng.anonymousservice.controller;

import com.longfeng.anonymousservice.dto.AnonErrorResponse;
import com.longfeng.anonymousservice.dto.AnonResultResponse;
import com.longfeng.anonymousservice.filter.AnonFilter;
import com.longfeng.anonymousservice.service.AnonResultService;
import com.longfeng.anonymousservice.service.AnonResultService.ResultOutcome;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/**
 * SC-12-T07 · {@code GET /api/anon/result/{anonQid}} — biz §2B.13 F05.
 *
 * <p>FE polling read-loop counterpart to {@link AnonAnalyzeController}. After
 * T06 has fired the analyze and the FE starts its 1 Hz polling tick (T09), this
 * endpoint forwards each tick to {@code ai-analysis-service:8083 GET
 * /api/ai/result/{taskId}} via {@link AnonResultService} and translates the
 * upstream wire status into the wire shape the FE keys on.
 *
 * <p>Pre-condition: request passed {@link AnonFilter}. The filter has verified
 * {@code X-Anon-Token} and stashed the session id in request attribute
 * {@link AnonFilter#ATTR_GUEST_SESSION_ID}. Cross-tenant defence: the path's
 * {@code anonQid} must equal the filter-verified session id — a leaked
 * anonToken cannot read another guest's result.
 *
 * <p>Status / HTTP mapping (the table here is the source of truth for the
 * spec §5 #5 contract; the service maps the upstream into
 * {@link ResultOutcome.Kind} and this controller maps {@link
 * ResultOutcome.Kind} to HTTP):
 * <ul>
 *   <li>{@code 200 ANALYZING}        — upstream still inferring. Body
 *       {@code {"status":"ANALYZING"}} (FE keeps polling).</li>
 *   <li>{@code 200 READY}            — upstream {@code DONE} + state flipped
 *       1→2 + JSON persisted. Body {@code {"status":"READY","result":{…}}}.</li>
 *   <li>{@code 200 FAILED}           — upstream {@code FAILED}/{@code CANCELLED}
 *       + state flipped 1→3. Body {@code {"status":"FAILED","error_code":"AI_INFERENCE_FAILED"}}.</li>
 *   <li>{@code 401 ANON_TOKEN_INVALID} — filter rejection (defensive; the
 *       filter normally writes its own 401 before the controller is reached).</li>
 *   <li>{@code 403 ANON_SESSION_MISMATCH} — path {@code anonQid} ≠ the
 *       filter-verified session id.</li>
 *   <li>{@code 404 ANON_SESSION_NOT_FOUND} — token verified but row gone.</li>
 *   <li>{@code 404 UPSTREAM_TASK_NOT_FOUND} — upstream returns {@code
 *       NOT_FOUND} (race: FE polled before T06's analyze finished writing
 *       upstream, or upstream row swept).</li>
 *   <li>{@code 502 AI_SERVICE_FAILURE} — upstream connection refused / read
 *       timeout / non-200 / unknown status.</li>
 * </ul>
 *
 * <p>The {@code NOT_FOUND_UPSTREAM} → 404 mapping (rather than 502) is
 * deliberate: 502 to a polling client triggers exponential backoff, but
 * {@code NOT_FOUND} usually means the task row just isn't visible yet (1-2s
 * race window). 404 lets the FE keep its 1 Hz cadence — if the race truly is
 * permanent the FE's 30s timeout still bails cleanly.
 */
@RestController
public class AnonResultController {

    private static final Logger LOG = LoggerFactory.getLogger(AnonResultController.class);

    /** Error code constants — wire-stable strings the FE keys on. */
    static final String ERR_SESSION_NOT_FOUND     = "ANON_SESSION_NOT_FOUND";
    static final String ERR_SESSION_MISMATCH      = "ANON_SESSION_MISMATCH";
    static final String ERR_UPSTREAM_TASK_NOT_FOUND = "UPSTREAM_TASK_NOT_FOUND";
    static final String ERR_AI_SERVICE_FAILURE    = "AI_SERVICE_FAILURE";

    /** Wire status constants — the FE switches on these strings. */
    private static final String STATUS_ANALYZING = "ANALYZING";
    private static final String STATUS_READY     = "READY";
    private static final String STATUS_FAILED    = "FAILED";

    /**
     * Pinned error code emitted when the upstream returned {@code FAILED} or
     * {@code CANCELLED}. Single code keeps the FE's state machine simple —
     * biz §2A.7 L660 ("AI failure does not consume quota") is the same
     * recovery action regardless of which sub-reason upstream gives.
     */
    private static final String AI_INFERENCE_FAILED_CODE = "AI_INFERENCE_FAILED";

    private final AnonResultService service;

    public AnonResultController(AnonResultService service) {
        this.service = service;
    }

    @GetMapping(value = "/api/anon/result/{anonQid}",
            produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> getResult(
            @PathVariable Long anonQid,
            HttpServletRequest httpReq) {

        // (1) Read filter-injected session id · never from path.
        Object attr = httpReq.getAttribute(AnonFilter.ATTR_GUEST_SESSION_ID);
        if (!(attr instanceof Long anonSessionId)) {
            // Defensive 401 · filter normally short-circuits before us.
            LOG.warn("anon_result attribute_missing attr={}", attr);
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new AnonErrorResponse(AnonFilter.ERR_TOKEN_INVALID,
                            "Filter did not set guest session id attribute"));
        }

        // (2) Cross-tenant defence · path anonQid must match the verified id.
        //     Same belt-and-braces pattern as AnonAnalyzeController.
        if (!Long.valueOf(anonSessionId).equals(anonQid)) {
            LOG.warn("anon_result session_mismatch verified_id={} path_qid={}",
                    anonSessionId, anonQid);
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(new AnonErrorResponse(ERR_SESSION_MISMATCH,
                            "anonQid in path does not match verified session"));
        }

        ResultOutcome outcome = service.getResult(anonSessionId);

        return switch (outcome.getKind()) {
            case SESSION_NOT_FOUND -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new AnonErrorResponse(ERR_SESSION_NOT_FOUND,
                            "Guest session not found: " + anonSessionId));
            case NOT_FOUND_UPSTREAM -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new AnonErrorResponse(ERR_UPSTREAM_TASK_NOT_FOUND,
                            "Upstream analysis task not found · race or expiry"));
            case AI_SERVICE_FAILURE -> ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(new AnonErrorResponse(ERR_AI_SERVICE_FAILURE,
                            "ai-analysis-service upstream unreachable / non-200"));
            case ANALYZING -> ResponseEntity.ok(
                    new AnonResultResponse(STATUS_ANALYZING, null, null));
            case READY -> ResponseEntity.ok(new AnonResultResponse(
                    STATUS_READY,
                    new AnonResultResponse.Result(
                            outcome.getSubject(),
                            outcome.getStemLength(),
                            outcome.getChatModel(),
                            outcome.getOcrModel()),
                    null));
            case FAILED -> ResponseEntity.ok(new AnonResultResponse(
                    STATUS_FAILED, null, AI_INFERENCE_FAILED_CODE));
        };
    }
}
