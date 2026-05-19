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

    private String provider;       // 'EMAIL' / 'PHONE' (others reject with 400 in this task)

    // email 改 optional · 与 phone 二选一 · LoginService 校验
    @Email
    @Size(max = 255)
    private String email;

    // phone 新加 (V20260519_01 schema) · 11 位 PRC 手机号 · 与 email 二选一
    @Size(min = 11, max = 20)
    private String phone;

    @NotBlank
    @Size(min = 6, max = 128)
    private String password;

    private Boolean rememberMe = Boolean.TRUE;
    private String consentAt;      // ISO-8601 timestamp string · not validated server-side this task

    // SC-00-T02 · optional · forwarded to anonymous-service account_device upsert (P0 silent · P1 SC-14 reads).
    @Size(max = 128)
    private String deviceFp;

    @Size(max = 16)
    private String platform;       // H5 / MINIP / IOS / ANDROID

    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public Boolean getRememberMe() { return rememberMe; }
    public void setRememberMe(Boolean rememberMe) { this.rememberMe = rememberMe; }
    public String getConsentAt() { return consentAt; }
    public void setConsentAt(String consentAt) { this.consentAt = consentAt; }
    public String getDeviceFp() { return deviceFp; }
    public void setDeviceFp(String deviceFp) { this.deviceFp = deviceFp; }
    public String getPlatform() { return platform; }
    public void setPlatform(String platform) { this.platform = platform; }
}
