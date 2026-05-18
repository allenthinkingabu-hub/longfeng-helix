package com.longfeng.anonymousservice.service;

import com.longfeng.anonymousservice.config.AnonClaimProperties;
import com.longfeng.anonymousservice.config.AnonRestTemplateConfig;
import com.longfeng.anonymousservice.entity.GuestSession;
import com.longfeng.anonymousservice.repo.GuestSessionRepository;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

/**
 * SC-12-T08 · biz §2B.13 F08 · real forward to {@code wrongbook-service:8082
 * POST /api/wb/questions} to materialize a freshly-claimed guest session as a
 * persistent {@code wb_question} row owned by the new student.
 *
 * <p>Why this exists: when a guest finishes T07 (result polling sees DONE) and
 * registers (auth-service mints a student JWT), the FE calls
 * {@code POST /api/anon/claim} with both:
 * <ul>
 *   <li>{@code X-Anon-Token} (the original guest-session token; AnonFilter
 *       verifies + stashes {@code anonGuestSessionId})</li>
 *   <li>{@code Authorization: Bearer <studentJwt>} (the freshly-minted
 *       registered-user JWT; {@link JwtVerifier} verifies and extracts
 *       {@code sub} as the student id)</li>
 * </ul>
 * This service:
 * <ol>
 *   <li>Looks up the guest_session row by the filter-injected anon id.</li>
 *   <li>Refuses with {@code SESSION_NOT_FOUND} (controller 404) when the row
 *       has been swept since the token was minted.</li>
 *   <li>Implements idempotency / conflict — if {@code claimed_by_student_id}
 *       is already set:
 *       <ul>
 *         <li>Same student → return {@code IDEMPOTENT} with the existing qid
 *             (controller maps to 200 — biz §2B.13 SC-12 TC-12.02: 24h
 *             re-open returns same qid, no upstream re-create).</li>
 *         <li>Different student → return {@code ALREADY_CLAIMED_BY_OTHER}
 *             (controller maps to 409 — biz §2B.13 SC-12 TC-12.04
 *             cross-tenant defence).</li>
 *       </ul>
 *   </li>
 *   <li>Refuses with {@code NOT_READY_TO_CLAIM} (controller 412) unless
 *       {@code status == 2 RESULT_READY} AND {@code image_tmp_url} is
 *       non-null. Two pre-conditions because either gap breaks the FE
 *       contract: status&lt;2 means the analyze hasn't finished, blank image
 *       means there's nothing to claim.</li>
 *   <li>Forwards to {@code POST /api/wb/questions} via a real RestTemplate
 *       (NO MOCK — user iron rule 2026-05-18). Body keys are
 *       <b>snake_case</b> ({@code student_id, subject, source_type,
 *       origin_image_key, idempotency_key}) — verified live: snake_case body
 *       returns 201, mismatched keys return 400. {@code idempotency_key}
 *       follows the convention {@code anon-claim-{anonSessionId}} so the
 *       upstream natural dedup never double-creates the wb_question.</li>
 *   <li>On 201: parses {@code data.qid} from the {@code ApiResult.ok}
 *       envelope ({@code {code:0, message:"ok", data:{qid:"..."}}}), writes
 *       back to guest_session: {@code claimed_by_student_id},
 *       {@code claimed_at = now}, {@code claimed_question_id = parseLong(qid)},
 *       {@code status = 4 CLAIMED}.</li>
 *   <li>On any failure (connection refused, timeout, non-201, missing
 *       data.qid): returns {@code WRONGBOOK_SERVICE_FAILURE} (controller 502).
 *       The session is <b>NOT</b> mutated — a retry against the same anon
 *       session can still claim cleanly (idempotency-key on the upstream side
 *       guarantees we won't accidentally create two wb_question rows even
 *       across retries).</li>
 * </ol>
 *
 * <p>Reuse of {@code aiAnalysisRestTemplate}: a single shared RestTemplate
 * bean (already wired for T06's analyze-by-url path) handles both the
 * ai-analysis-service and wrongbook-service forwards. Both upstreams sit on
 * the same sandbox host with similar latency profiles; introducing a second
 * RestTemplate bean would force a duplicate {@code @Bean} definition for zero
 * correctness gain. The timeouts (2s connect, 5s read) are reasonable for
 * both calls.
 */
@Service
public class AnonClaimService {

    private static final Logger LOG = LoggerFactory.getLogger(AnonClaimService.class);

    /**
     * Idempotency-key prefix that ties the upstream {@code wb_question} row
     * back to its originating guest session. Documented in the inflight
     * contract so a future audit can reverse-lookup which guest a question
     * came from. The upstream side dedupes on idempotency-key alone so the
     * key naming choice is wire-load-bearing — never refactor without
     * checking wrongbook-service's QuestionAggregateService.createPending.
     */
    private static final String IDEMPOTENCY_KEY_PREFIX = "anon-claim-";

    /** RESULT_READY: only state from which a claim may transition to CLAIMED. */
    private static final short STATUS_RESULT_READY = (short) 2;

    /** CLAIMED: terminal status reached after a successful upstream 201. */
    private static final short STATUS_CLAIMED = (short) 4;

    /** Upstream source_type for the wrongbook row · 0 = USER_UPLOAD (biz §4.2). */
    private static final short SOURCE_TYPE_USER_UPLOAD = (short) 0;

    private final GuestSessionRepository repo;
    private final RestTemplate restTemplate;
    private final AnonClaimProperties claimProps;

    public AnonClaimService(
            GuestSessionRepository repo,
            @Qualifier(AnonRestTemplateConfig.BEAN_NAME) RestTemplate restTemplate,
            AnonClaimProperties claimProps) {
        this.repo = repo;
        this.restTemplate = restTemplate;
        this.claimProps = claimProps;
    }

    /**
     * Claim a guest session for a freshly-registered student.
     *
     * @param anonSessionId filter-injected by {@link
     *         com.longfeng.anonymousservice.filter.AnonFilter} — NOT trusted from request body
     * @param studentId     extracted from {@code Authorization: Bearer <jwt>} by {@link JwtVerifier}
     * @param subject       already pattern-validated upstream (six-subject whitelist)
     * @return outcome the controller maps to an HTTP status
     */
    public ClaimOutcome claim(long anonSessionId, long studentId, String subject) {

        Optional<GuestSession> opt = repo.findById(anonSessionId);
        if (opt.isEmpty()) {
            // Token verified by the filter but the row has been swept since
            // (24h TTL OR explicit DELETE). Defensive 404 — mirrors
            // AnonAnalyzeService.startAnalysis NOT_FOUND branch.
            LOG.info("anon_claim not_found session_id={}", anonSessionId);
            return ClaimOutcome.sessionNotFound();
        }
        GuestSession g = opt.get();

        // (1) Idempotency / conflict check FIRST · biz §2B.13 SC-12 TC-12.02 /
        //     TC-12.04. A session that is already claimed never re-enters the
        //     upstream RPC — same student gets the existing qid back as 200,
        //     different student gets 409.
        if (g.getClaimedByStudentId() != null) {
            if (g.getClaimedByStudentId().equals(studentId)) {
                LOG.info("anon_claim idempotent session_id={} student_id={} qid={}",
                        anonSessionId, studentId, g.getClaimedQuestionId());
                return ClaimOutcome.idempotent(
                        String.valueOf(g.getClaimedQuestionId()),
                        g.getClaimedAt(),
                        anonSessionId,
                        studentId);
            }
            LOG.warn("anon_claim already_claimed_by_other session_id={} owner_student_id={} caller_student_id={}",
                    anonSessionId, g.getClaimedByStudentId(), studentId);
            return ClaimOutcome.alreadyClaimedByOther();
        }

        // (2) Pre-condition · must be RESULT_READY with an image to claim.
        //     status != 2 covers CREATED / ANALYZING / FAILED / EXPIRED; the
        //     additional image_tmp_url null check is belt-and-braces for a
        //     race where status was forced to 2 via direct SQL without ever
        //     uploading an image.
        if (g.getStatus() != STATUS_RESULT_READY
                || g.getImageTmpUrl() == null
                || g.getImageTmpUrl().isBlank()) {
            LOG.info("anon_claim not_ready session_id={} status={} has_image={}",
                    anonSessionId, g.getStatus(),
                    g.getImageTmpUrl() != null && !g.getImageTmpUrl().isBlank());
            return ClaimOutcome.notReadyToClaim();
        }

        // (3) Build wrongbook RPC body · keys are snake_case per upstream
        //     CreateQuestionReq (verified live: snake_case body → 201,
        //     camelCase → 400 because the upstream record uses Jackson default
        //     snake_case via JsonNaming SnakeCaseStrategy globally). Using
        //     LinkedHashMap to keep the JSON ordering stable for debug logs.
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("student_id", studentId);
        body.put("subject", subject);
        body.put("source_type", (int) SOURCE_TYPE_USER_UPLOAD);
        body.put("origin_image_key", g.getImageTmpUrl());
        body.put("idempotency_key", IDEMPOTENCY_KEY_PREFIX + anonSessionId);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

        String url = claimProps.getBaseUrl() + "/api/wb/questions";

        ResponseEntity<Map> resp;
        try {
            resp = restTemplate.exchange(url, HttpMethod.POST, entity, Map.class);
        } catch (RestClientException e) {
            // Catches: connection refused, read timeout, 4xx, 5xx. All map to
            // 502 — the FE can retry the claim cleanly because we have NOT
            // mutated guest_session yet (status still 2, claimed_by* still null).
            LOG.warn("anon_claim wrongbook_rpc_failed session_id={} url={} err={}",
                    anonSessionId, url, e.toString());
            return ClaimOutcome.wrongbookServiceFailure();
        }

        // (4) Validate upstream response · 201 + non-null data.qid is the only
        //     happy path. Anything else (200, 204, 5xx wrapped in success,
        //     missing data field, missing qid sub-field, blank qid) → 502.
        HttpStatusCode status = resp.getStatusCode();
        if (status.value() != 201 || resp.getBody() == null) {
            LOG.warn("anon_claim wrongbook_unexpected_status session_id={} status={} body={}",
                    anonSessionId, status, resp.getBody());
            return ClaimOutcome.wrongbookServiceFailure();
        }
        Object dataObj = resp.getBody().get("data");
        if (!(dataObj instanceof Map<?, ?> data)) {
            LOG.warn("anon_claim wrongbook_missing_data session_id={} body={}",
                    anonSessionId, resp.getBody());
            return ClaimOutcome.wrongbookServiceFailure();
        }
        Object qidObj = data.get("qid");
        if (qidObj == null) {
            LOG.warn("anon_claim wrongbook_missing_qid session_id={} body={}",
                    anonSessionId, resp.getBody());
            return ClaimOutcome.wrongbookServiceFailure();
        }
        String qid = String.valueOf(qidObj);
        if (qid.isBlank() || "null".equals(qid)) {
            LOG.warn("anon_claim wrongbook_blank_qid session_id={} qid_obj={}",
                    anonSessionId, qidObj);
            return ClaimOutcome.wrongbookServiceFailure();
        }

        // qid is a numeric string at the wire level even though it's typed as
        // String in the response DTO (upstream snowflake-generated BIGINT
        // serialized as JSON string to avoid JS Number precision loss).
        // GuestSession.claimedQuestionId is typed as Long, so parse here.
        // A non-numeric qid surfaces as NumberFormatException — that's a
        // wire-contract violation we want loud, NOT a silent swallow.
        long qidLong;
        try {
            qidLong = Long.parseLong(qid);
        } catch (NumberFormatException nfe) {
            LOG.error("anon_claim wrongbook_qid_not_numeric session_id={} qid={}",
                    anonSessionId, qid, nfe);
            return ClaimOutcome.wrongbookServiceFailure();
        }

        // (5) Write back. Status flips 2 RESULT_READY → 4 CLAIMED. This is
        //     the canonical 2→4 transition (T01 designed for it, T08 is the
        //     only writer of state=4).
        OffsetDateTime now = OffsetDateTime.now();
        g.setClaimedByStudentId(studentId);
        g.setClaimedAt(now);
        g.setClaimedQuestionId(qidLong);
        g.setStatus(STATUS_CLAIMED);
        repo.save(g);
        LOG.info("anon_claim success session_id={} student_id={} qid={}",
                anonSessionId, studentId, qid);

        return ClaimOutcome.success(qid, now, anonSessionId, studentId);
    }

    /** Result discriminator · controller maps {@link Kind} to HTTP status. */
    public static final class ClaimOutcome {

        /** Discriminator for the six legal outcomes of {@link #claim}. */
        public enum Kind {
            /** Anon session row no longer exists (concurrent sweep / expired). */
            SESSION_NOT_FOUND,
            /** status != 2 OR image_tmp_url blank. */
            NOT_READY_TO_CLAIM,
            /** {@code claimed_by_student_id} is set to a different student. */
            ALREADY_CLAIMED_BY_OTHER,
            /** Upstream wrongbook-service unreachable / non-201 / bad envelope. */
            WRONGBOOK_SERVICE_FAILURE,
            /** Same student re-claims · returns existing qid · 200. */
            IDEMPOTENT,
            /** First-time claim · upstream row created · 200. */
            SUCCESS,
        }

        private final Kind kind;
        private final String claimedQuestionId;
        private final OffsetDateTime claimedAt;
        private final Long anonSessionId;
        private final Long studentId;

        private ClaimOutcome(Kind kind,
                             String claimedQuestionId,
                             OffsetDateTime claimedAt,
                             Long anonSessionId,
                             Long studentId) {
            this.kind = kind;
            this.claimedQuestionId = claimedQuestionId;
            this.claimedAt = claimedAt;
            this.anonSessionId = anonSessionId;
            this.studentId = studentId;
        }

        public Kind getKind() { return kind; }
        public String getClaimedQuestionId() { return claimedQuestionId; }
        public OffsetDateTime getClaimedAt() { return claimedAt; }
        public Long getAnonSessionId() { return anonSessionId; }
        public Long getStudentId() { return studentId; }

        // ── Factories · enum discriminator + payload kept consistent ─────────
        static ClaimOutcome sessionNotFound() {
            return new ClaimOutcome(Kind.SESSION_NOT_FOUND, null, null, null, null);
        }

        static ClaimOutcome notReadyToClaim() {
            return new ClaimOutcome(Kind.NOT_READY_TO_CLAIM, null, null, null, null);
        }

        static ClaimOutcome alreadyClaimedByOther() {
            return new ClaimOutcome(Kind.ALREADY_CLAIMED_BY_OTHER, null, null, null, null);
        }

        static ClaimOutcome wrongbookServiceFailure() {
            return new ClaimOutcome(Kind.WRONGBOOK_SERVICE_FAILURE, null, null, null, null);
        }

        static ClaimOutcome idempotent(String qid, OffsetDateTime at, long sessionId, long studentId) {
            return new ClaimOutcome(Kind.IDEMPOTENT, qid, at, sessionId, studentId);
        }

        static ClaimOutcome success(String qid, OffsetDateTime at, long sessionId, long studentId) {
            return new ClaimOutcome(Kind.SUCCESS, qid, at, sessionId, studentId);
        }
    }
}
