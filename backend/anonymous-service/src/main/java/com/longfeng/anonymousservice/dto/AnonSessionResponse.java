package com.longfeng.anonymousservice.dto;

import java.time.OffsetDateTime;

/**
 * SC-12 · {@code POST /api/anon/session} 200 response body (T01).
 *
 * <p>Field semantics (biz §2B.13 SC-12 F01 + P-GUEST-CAPTURE §5):
 * <ul>
 *   <li>{@code anonToken} — HS256 JWT; the frontend stores it (sessionStorage)
 *       and attaches as {@code X-Anon-Token} on subsequent anon-tier calls
 *       (T02+ presign / questions / analyze / result endpoints).
 *   <li>{@code anonSessionId} — server-assigned {@code guest_session.id}.
 *       T05 claim flow references this when {@code POST /api/auth/anonymous-claim}
 *       transfers the session to a registered student.
 *   <li>{@code expiresAt} — wall-clock UTC offset timestamp at which the
 *       JWT exp matures; frontend uses it to display the 24h countdown.
 * </ul>
 *
 * <p>Record (immutable) — no setters needed at the wire boundary.
 */
public record AnonSessionResponse(
        String anonToken,
        long anonSessionId,
        OffsetDateTime expiresAt) {}
