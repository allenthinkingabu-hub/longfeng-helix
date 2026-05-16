package com.longfeng.authservice.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * P00 login request body (spec §5 row #2).
 *
 * <p>Field naming aligned with spec text — provider hard-coded EMAIL for this task
 * (wechat/apple OUT OF SCOPE per inflight scope_out).
 */
public class LoginRequest {

    private String provider;       // 'EMAIL' (other providers reject with 400 in this task)

    @NotBlank
    @Email
    @Size(max = 255)
    private String email;

    @NotBlank
    @Size(min = 6, max = 128)
    private String password;

    private Boolean rememberMe = Boolean.TRUE;
    private String consentAt;      // ISO-8601 timestamp string · not validated server-side this task

    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public Boolean getRememberMe() { return rememberMe; }
    public void setRememberMe(Boolean rememberMe) { this.rememberMe = rememberMe; }
    public String getConsentAt() { return consentAt; }
    public void setConsentAt(String consentAt) { this.consentAt = consentAt; }
}
