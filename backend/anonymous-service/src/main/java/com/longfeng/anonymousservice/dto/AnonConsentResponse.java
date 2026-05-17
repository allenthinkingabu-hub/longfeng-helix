package com.longfeng.anonymousservice.dto;

import java.time.OffsetDateTime;

/**
 * SC-12-T02 · {@code PATCH /api/anon/session/{id}/consent} 200 response body.
 *
 * <p>Echoes back the persisted {@code consent_at} (server wall clock at write)
 * and {@code consent_type} so the frontend can update its local state in one
 * round trip (P-GUEST-CAPTURE §6 state machine transitions
 * CONSENT_PENDING → UPLOADING off this response).
 *
 * <p>Record for immutability — the wire payload has no setter use case.
 */
public record AnonConsentResponse(
        OffsetDateTime consentAt,
        Short consentType) {}
