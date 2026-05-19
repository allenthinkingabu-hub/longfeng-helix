package com.longfeng.authservice.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * P00 §5 #3 · POST /api/auth/wechat-login request body.
 *
 * <p>Wire shape: {@code {code, encryptedData?, iv?, consentAt?}} (spec line 132).
 * P0 仅用 {@code code} · encryptedData/iv 是给 wx.getUserProfile 解密 nickname/avatar
 * 用的 · P1 SC 单独做.
 */
public class WechatLoginRequest {

    /** wx.login() 返回的 5-min 临时 code · 长度通常 32-48 字符. */
    @NotBlank
    @Size(max = 128)
    private String code;

    private String encryptedData;
    private String iv;
    private String consentAt;
    private String deviceFp;
    private String platform;

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getEncryptedData() { return encryptedData; }
    public void setEncryptedData(String encryptedData) { this.encryptedData = encryptedData; }
    public String getIv() { return iv; }
    public void setIv(String iv) { this.iv = iv; }
    public String getConsentAt() { return consentAt; }
    public void setConsentAt(String consentAt) { this.consentAt = consentAt; }
    public String getDeviceFp() { return deviceFp; }
    public void setDeviceFp(String deviceFp) { this.deviceFp = deviceFp; }
    public String getPlatform() { return platform; }
    public void setPlatform(String platform) { this.platform = platform; }
}
