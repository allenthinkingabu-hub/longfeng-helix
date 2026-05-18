package com.longfeng.anonymousservice.service;

import com.longfeng.anonymousservice.dto.AnonQuestionRequest;
import com.longfeng.anonymousservice.entity.GuestSession;
import com.longfeng.anonymousservice.repo.GuestSessionRepository;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * SC-12-T05 · biz §2B.13 F04 · upload→backend hand-off write path.
 *
 * <p>Closes the "frontend PUT to MinIO" → "backend knows the bytes are there"
 * loop. After T04 mints a pre-signed PUT URL and the frontend uploads the
 * captured image, the frontend immediately calls
 * {@code POST /api/anon/questions} with the {@code objectKey} that T04
 * returned. This service persists that {@code objectKey} into
 * {@code guest_session.image_tmp_url} so T06's analyze pipeline can fetch the
 * object from MinIO and start AI inference.
 *
 * <p><b>Status is NOT advanced</b> here. T01 surfaced a spec drift: biz §4.10
 * status enum ({@code 0 CREATED / 1 ANALYZING / 2 RESULT_READY / 3 FAILED /
 * 4 CLAIMED / 9 EXPIRED}) has no intermediate {@code UPLOADED} state.
 * P-GUEST-CAPTURE §6 mentions an UPLOADED→ANALYZING edge but that's a spec
 * drift relative to DDL. Decision: T05 keeps {@code status=0 CREATED} and T06
 * (analyze-by-url) is the canonical 0→1 transition. A future amendment may
 * add an explicit UPLOADED state; that's a separate task.
 *
 * <p>Cross-tenant write defence: {@code objectKey} must start with
 * {@code guest-tmp/{anonSessionId}/} (the same prefix T04 minted into). Even
 * if the frontend (or a malicious replay) sends an {@code objectKey} pointing
 * at a different session's prefix, the prefix mismatch returns 403 without
 * touching the DB. This belt-and-braces the cross-tenant defence T04 already
 * built into the pre-signed URL — same anonToken cannot write to another
 * tenant's prefix, AND cannot register another tenant's prefix as its own
 * {@code image_tmp_url}.
 *
 * <p>Consent gate: if {@code consent_at IS NULL} on the row, this service
 * rejects with {@code CONSENT_REQUIRED} (controller maps to 412
 * PRECONDITION_FAILED). The biz §13 minor-protection rule forbids any image
 * persistence before consent is recorded. The {@code consentAt} field in
 * {@code AnonQuestionRequest} is intentionally NOT trusted — we only look at
 * the DB column written server-side by T02 (biz §13 says the client clock is
 * never authoritative consent evidence).
 *
 * <p>X-Idempotency-Key handling: P0 only validates the header is non-blank
 * and logs the (masked) value for audit. True Redis-backed idempotency lock
 * is deferred to T06+ (biz §10 idempotency pattern). Re-posting the same
 * question with the same key currently overwrites {@code image_tmp_url}
 * (last-writer-wins) — acceptable for P0 because both calls carry the same
 * intent. A future regression test or replay attack would catch silent drift.
 */
@Service
public class AnonQuestionService {

    private static final Logger LOG = LoggerFactory.getLogger(AnonQuestionService.class);

    private final GuestSessionRepository repo;

    public AnonQuestionService(GuestSessionRepository repo) {
        this.repo = repo;
    }

    /**
     * Persist {@code objectKey} into {@code guest_session.image_tmp_url}
     * after verifying consent and prefix ownership.
     *
     * @param anonSessionId guest_session.id from the AnonFilter-verified token
     *                      (NOT trusted from the request body)
     * @param req           validated request body (jakarta-validation already
     *                      enforced size + pattern)
     * @return discriminator the controller maps to HTTP status
     */
    public QuestionOutcome record(long anonSessionId, AnonQuestionRequest req) {
        Optional<GuestSession> opt = repo.findById(anonSessionId);
        if (opt.isEmpty()) {
            // Filter verified the token's sub maps to a session id, but a
            // concurrent sweep job (T07+ EXPIRED cleanup) could have wiped
            // the row between filter and service. Defensive 404.
            LOG.info("anon_question not_found session_id={}", anonSessionId);
            return new QuestionOutcome(QuestionOutcome.Kind.NOT_FOUND, null, null);
        }
        GuestSession g = opt.get();

        // (1) Consent gate · biz §13 minor protection — server-side consent_at
        //     is the only authoritative evidence; never trust client clock.
        if (g.getConsentAt() == null) {
            LOG.info("anon_question consent_required session_id={}", anonSessionId);
            return new QuestionOutcome(QuestionOutcome.Kind.CONSENT_REQUIRED, null, null);
        }

        // (2) Prefix ownership · cross-tenant write defence. Mirrors T04's
        //     pre-signed URL prefix invariant so a leaked anonToken cannot
        //     register another session's object key as its own image_tmp_url.
        String expectedPrefix = "guest-tmp/" + anonSessionId + "/";
        if (req.objectKey() == null || !req.objectKey().startsWith(expectedPrefix)) {
            LOG.warn("anon_question prefix_mismatch session_id={} object_key={}",
                    anonSessionId, req.objectKey());
            return new QuestionOutcome(QuestionOutcome.Kind.PREFIX_MISMATCH, null, null);
        }

        // (3) Persist · status intentionally NOT advanced (see class javadoc).
        g.setImageTmpUrl(req.objectKey());
        repo.save(g);
        LOG.info("anon_question success session_id={} subject={} object_key={}",
                anonSessionId, req.subject(), req.objectKey());

        return new QuestionOutcome(QuestionOutcome.Kind.SUCCESS, g.getId(), g.getExpiresAt());
    }

    /** Result discriminator · controller maps {@link Kind} to HTTP status. */
    public static final class QuestionOutcome {

        /** Discriminator for the four legal outcomes of {@link #record}. */
        public enum Kind {
            /** Session id from token's sub no longer exists (concurrent sweep). */
            NOT_FOUND,
            /** {@code consent_at IS NULL} — biz §13 gate fails. */
            CONSENT_REQUIRED,
            /** {@code objectKey} does not start with {@code guest-tmp/{id}/}. */
            PREFIX_MISMATCH,
            /** {@code image_tmp_url} written; row otherwise untouched. */
            SUCCESS,
        }

        private final Kind kind;
        private final Long anonQid;
        private final OffsetDateTime expiresAt;

        public QuestionOutcome(Kind kind, Long anonQid, OffsetDateTime expiresAt) {
            this.kind = kind;
            this.anonQid = anonQid;
            this.expiresAt = expiresAt;
        }

        public Kind getKind() { return kind; }
        public Long getAnonQid() { return anonQid; }
        public OffsetDateTime getExpiresAt() { return expiresAt; }
    }
}
