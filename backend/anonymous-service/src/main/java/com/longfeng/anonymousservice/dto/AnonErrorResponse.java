package com.longfeng.anonymousservice.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * SC-12 · Error envelope for {@code /api/anon/*} endpoints.
 *
 * <p>Mirrors {@link ShareErrorResponse} pattern · {@code {code, message}} pair.
 * Codes used by T01:
 * <ul>
 *   <li>{@code VALIDATION_FAILED} (HTTP 400) — {@code @Valid} body rejected by
 *       jakarta-validation (e.g. {@code deviceFp} blank or oversized).
 * </ul>
 *
 * <p>Future T02-T06 will add more codes (TOKEN_INVALID, QUOTA_EXHAUSTED, etc).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AnonErrorResponse {
    private final String code;
    private final String message;

    public AnonErrorResponse(String code, String message) {
        this.code = code;
        this.message = message;
    }

    public String getCode() { return code; }
    public String getMessage() { return message; }
}
