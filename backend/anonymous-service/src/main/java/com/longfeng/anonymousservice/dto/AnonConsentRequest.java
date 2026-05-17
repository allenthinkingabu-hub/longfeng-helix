package com.longfeng.anonymousservice.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/**
 * SC-12-T02 · {@code PATCH /api/anon/session/{id}/consent} request body.
 *
 * <p>biz §4.10: {@code consent_type} is a {@code SMALLINT} with three
 * legal values:
 * <ul>
 *   <li>{@code 1} — ADULT (self-consenting adult)</li>
 *   <li>{@code 2} — MINOR_WITH_GUARDIAN (minor; guardian consented)</li>
 *   <li>{@code 3} — MINOR_NO_GUARDIAN (minor; no guardian — biz §13 special flow)</li>
 * </ul>
 *
 * <p>{@code 0} / {@code 4+} / {@code null} are rejected with 400
 * {@code VALIDATION_FAILED} by jakarta-validation in the controller's
 * {@code @ExceptionHandler(MethodArgumentNotValidException.class)}.
 *
 * <p>Plain mutable class (not a record) mirroring {@link AnonSessionRequest}
 * conventions in this service — jakarta-validation works on either, but the
 * existing codebase prefers class + getters/setters for request bodies.
 */
public class AnonConsentRequest {

    @NotNull
    @Min(1)
    @Max(3)
    private Short consentType;

    public Short getConsentType() {
        return consentType;
    }

    public void setConsentType(Short consentType) {
        this.consentType = consentType;
    }
}
