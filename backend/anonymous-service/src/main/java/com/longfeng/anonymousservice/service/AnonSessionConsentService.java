package com.longfeng.anonymousservice.service;

import com.longfeng.anonymousservice.entity.GuestSession;
import com.longfeng.anonymousservice.repo.GuestSessionRepository;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * SC-12-T02 · biz §2B.13 F02 · consent step write path.
 *
 * <p>The frontend Consent Card (biz §2A.3.2 P-GUEST-CAPTURE) gates the Shutter
 * button — until the receiver ticks "I am an adult" / "minor with guardian" /
 * "minor without guardian", the camera cannot fire. This service writes the
 * acknowledgement to the {@code guest_session} row:
 *
 * <ul>
 *   <li>{@code consent_at} — server wall clock at write (biz §13 minor
 *       protection compliance evidence — never trust client clock).</li>
 *   <li>{@code consent_type} — 1/2/3 per request, jakarta-validation has
 *       already pinned the range before we touch the row.</li>
 * </ul>
 *
 * <p><b>Intentionally NOT modifying</b> {@code guest_session.status} —
 * SC-12-T01 surfaced a spec drift: the biz §4.10 status enum
 * ({@code 0 CREATED / 1 ANALYZING / 2 RESULT_READY / 3 FAILED / 4 CLAIMED /
 * 9 EXPIRED}) has no {@code CONSENTED} state. T02's task note pins the
 * decision: consent_at + consent_type are sufficient evidence of consent;
 * status advances to {@code 1 ANALYZING} later when T03 presigns the upload.
 * A future spec amendment may add a {@code CONSENTED} intermediate state —
 * that's a separate task, not this one.
 *
 * <p>No optimistic-locking version column on {@code guest_session} (biz §4.10
 * does not declare one), so concurrent consent writes for the same session
 * are "last writer wins" — acceptable since they all carry the same business
 * meaning. If a future regulatory requirement demands strict idempotency, a
 * row-level lock or version column should be added here.
 */
@Service
public class AnonSessionConsentService {

    private static final Logger LOG = LoggerFactory.getLogger(AnonSessionConsentService.class);

    private final GuestSessionRepository repo;

    public AnonSessionConsentService(GuestSessionRepository repo) {
        this.repo = repo;
    }

    /**
     * Apply consent to the given session.
     *
     * @param id session id (already verified against the token by the
     *     controller — {@code AnonFilter} attribute equals path variable)
     * @param consentType 1 / 2 / 3 (jakarta-validation already enforced)
     * @return {@link ConsentOutcome} discriminator the controller maps to HTTP
     */
    public ConsentOutcome applyConsent(long id, short consentType) {
        Optional<GuestSession> opt = repo.findById(id);
        if (opt.isEmpty()) {
            LOG.info("anon_consent not_found id={}", id);
            return new ConsentOutcome(ConsentOutcome.Kind.NOT_FOUND, null);
        }
        GuestSession g = opt.get();
        OffsetDateTime now = OffsetDateTime.now();
        g.setConsentAt(now);
        g.setConsentType(consentType);
        // Intentionally NOT touching g.status — see class javadoc.
        repo.save(g);
        LOG.info("anon_consent success id={} type={}", id, consentType);
        return new ConsentOutcome(ConsentOutcome.Kind.SUCCESS, now);
    }

    /** Result discriminator · controller maps {@link Kind} to HTTP status. */
    public static final class ConsentOutcome {
        public enum Kind { NOT_FOUND, SUCCESS }

        private final Kind kind;
        private final OffsetDateTime consentAt;

        public ConsentOutcome(Kind kind, OffsetDateTime consentAt) {
            this.kind = kind;
            this.consentAt = consentAt;
        }

        public Kind getKind() { return kind; }
        public OffsetDateTime getConsentAt() { return consentAt; }
    }
}
