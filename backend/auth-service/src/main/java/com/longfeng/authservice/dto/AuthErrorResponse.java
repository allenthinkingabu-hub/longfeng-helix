package com.longfeng.authservice.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Standard P00 error wire format — {code, message, lockedUntil?}.
 *
 * <p>code values:
 * <ul>
 *   <li>{@code INVALID_CREDENTIALS} — 401 · email/password mismatch (unified for both wrong_email + wrong_password to prevent account enumeration)
 *   <li>{@code ACCOUNT_LOCKED}      — 423 · failed_attempts ≥ 5 lockout · {@code lockedUntil} ISO-8601 carried
 *   <li>{@code VALIDATION_FAILED}   — 400 · malformed body (@Valid hit)
 * </ul>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AuthErrorResponse {

    private String code;
    private String message;
    private String lockedUntil;

    public AuthErrorResponse() {}

    public AuthErrorResponse(String code, String message) {
        this.code = code;
        this.message = message;
    }

    public AuthErrorResponse(String code, String message, String lockedUntil) {
        this.code = code;
        this.message = message;
        this.lockedUntil = lockedUntil;
    }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public String getLockedUntil() { return lockedUntil; }
    public void setLockedUntil(String lockedUntil) { this.lockedUntil = lockedUntil; }
}
