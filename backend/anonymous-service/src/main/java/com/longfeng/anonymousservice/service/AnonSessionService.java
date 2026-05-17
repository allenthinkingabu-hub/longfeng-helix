package com.longfeng.anonymousservice.service;

import com.longfeng.anonymousservice.dto.AnonSessionRequest;
import com.longfeng.anonymousservice.entity.GuestSession;
import com.longfeng.anonymousservice.repo.GuestSessionRepository;
import java.time.OffsetDateTime;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

/**
 * SC-12 · Mint a new {@code guest_session} row + anon JWT (T01 entry point
 * behind {@code POST /api/anon/session}).
 *
 * <p>Pipeline (mirrors {@code ShareTokenService.issue} structure for parity):
 * <ol>
 *   <li>Sanitize {@code entrySource} against the whitelist (XSS-safe; non-whitelist
 *       inputs collapse to {@code "unknown"}). Whitelist source: biz §4.10
 *       comment {@code 'ad/qr/share/direct'} plus the three operational extras
 *       documented in P-GUEST-CAPTURE spec §5 ({@code push}, {@code icon},
 *       {@code deeplink}). Caller-supplied {@code null} → null (column nullable).
 *   <li>Generate client-assigned BIGINT id (no PG sequence; mirrors ShareToken).
 *       Up to 3 collision retries on UNIQUE PK violation.
 *   <li>INSERT row with {@code status=0 CREATED}, {@code created_at=now},
 *       {@code expires_at=now + ttl}.
 *   <li>Mint anon JWT via {@link AnonTokenService#mintAnonToken(long)}.
 *   <li>Return {@link AnonSessionMintResult} (anonToken + id + expiresAt).
 * </ol>
 *
 * <p>T01 does NOT touch {@code guest_rate_bucket}. T06 will add the
 * 1-per-day quota check in front of this {@code mint} call.
 */
@Service
public class AnonSessionService {

    private static final Logger LOG = LoggerFactory.getLogger(AnonSessionService.class);

    /**
     * Allowed {@code entry_source} values. Anything outside this set sanitizes
     * to {@code "unknown"} (defense-in-depth — DB column has no CHECK constraint).
     * Source: biz §4.10 ({@code 'ad/qr/share/direct'}) + P-GUEST-CAPTURE §5
     * operational extras ({@code push/icon/deeplink}). {@code direct} is biz
     * spelling; legacy callers may still send {@code unknown}, which is also
     * allowed (self-identifying fallback).
     */
    private static final Set<String> ENTRY_SOURCE_WHITELIST =
            Set.of("ad", "qr", "share", "direct", "push", "icon", "deeplink", "unknown");

    private final GuestSessionRepository repo;
    private final AnonTokenService anonTokenService;

    public AnonSessionService(GuestSessionRepository repo, AnonTokenService anonTokenService) {
        this.repo = repo;
        this.anonTokenService = anonTokenService;
    }

    public AnonSessionMintResult mint(AnonSessionRequest req) {
        long ttlSec = anonTokenService.getGuestSessionTtlSeconds();
        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime expiresAt = now.plusSeconds(ttlSec);

        // Allocate id with collision retry — mirrors ShareTokenService.issue.
        long id = 0L;
        boolean saved = false;
        for (int attempt = 0; attempt < 3 && !saved; attempt++) {
            id = generateRowId();
            GuestSession g = new GuestSession();
            g.setId(id);
            g.setDeviceFp(req.getDeviceFp());
            g.setIpHash(req.getIpHash());
            g.setUa(req.getUa());
            g.setEntrySource(sanitizeEntrySource(req.getEntrySource()));
            g.setExperimentBucket(req.getExperimentBucket());
            g.setStatus((short) 0);  // CREATED
            g.setCreatedAt(now);
            g.setExpiresAt(expiresAt);
            try {
                repo.save(g);
                saved = true;
            } catch (DataIntegrityViolationException dup) {
                LOG.warn("anon_session_mint id_collision attempt={} id={} retrying", attempt + 1, id);
            }
        }
        if (!saved) {
            throw new IllegalStateException("anon_session_mint failed after 3 id collision retries");
        }

        String anonToken = anonTokenService.mintAnonToken(id);
        LOG.info("anon_session_mint id={} ttlSec={} entrySource={}",
                id, ttlSec, sanitizeEntrySource(req.getEntrySource()));
        return new AnonSessionMintResult(anonToken, id, expiresAt);
    }

    /**
     * Whitelist-or-{@code "unknown"} sanitization. Public-static so future task
     * services can reuse it without DI.
     *
     * @param raw caller-supplied value (may be {@code null} / blank / arbitrary)
     * @return {@code null} if input is null/blank; whitelisted value verbatim
     *     otherwise; {@code "unknown"} for any non-whitelisted non-blank input.
     */
    public static String sanitizeEntrySource(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return ENTRY_SOURCE_WHITELIST.contains(raw) ? raw : "unknown";
    }

    /**
     * Generate a {@code guest_session.id} candidate. Same shape as
     * {@code ShareTokenService.generateRowId} — {@code nanoTime} jittered by
     * a random low-order word, sign bit stripped.
     */
    private static long generateRowId() {
        long base = System.nanoTime() & 0x7fff_ffff_ffff_ffffL;
        long jitter = ThreadLocalRandom.current().nextLong(0, 1_000_000L);
        return base ^ jitter;
    }

    /** Mint result — anonToken + persisted guest_session.id + expiresAt. */
    public record AnonSessionMintResult(String anonToken, long anonSessionId, OffsetDateTime expiresAt) {}
}
