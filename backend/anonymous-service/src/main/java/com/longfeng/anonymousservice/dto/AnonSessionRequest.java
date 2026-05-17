package com.longfeng.anonymousservice.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * SC-12 · {@code POST /api/anon/session} request body (T01).
 *
 * <p>biz §4.10 / P-GUEST-CAPTURE spec §5 field mapping:
 * <ul>
 *   <li>{@code deviceFp} — REQUIRED · {@code @NotBlank @Size(max=128)} ·
 *       indexed in DDL ({@code idx_guest_session_fp_day}); blank/oversized
 *       inputs are rejected at the boundary with 400 VALIDATION_FAILED.
 *   <li>{@code ipHash} — optional · pre-hashed by the caller (server never
 *       sees raw IP under biz §4.10 PII rule).
 *   <li>{@code ua} — optional · browser/device User-Agent string.
 *   <li>{@code entrySource} — optional · sanitized by service to whitelist
 *       (ad/qr/share/direct/push/icon/deeplink/unknown).
 *   <li>{@code experimentBucket} — optional · A/B test bucket label.
 * </ul>
 *
 * <p>Mirrors {@link ShareIssueRequest} shape (class with getters/setters).
 */
public class AnonSessionRequest {

    @NotBlank
    @Size(max = 128)
    private String deviceFp;

    @Size(max = 64)
    private String ipHash;

    @Size(max = 256)
    private String ua;

    @Size(max = 32)
    private String entrySource;

    @Size(max = 32)
    private String experimentBucket;

    public String getDeviceFp() { return deviceFp; }
    public void setDeviceFp(String deviceFp) { this.deviceFp = deviceFp; }
    public String getIpHash() { return ipHash; }
    public void setIpHash(String ipHash) { this.ipHash = ipHash; }
    public String getUa() { return ua; }
    public void setUa(String ua) { this.ua = ua; }
    public String getEntrySource() { return entrySource; }
    public void setEntrySource(String entrySource) { this.entrySource = entrySource; }
    public String getExperimentBucket() { return experimentBucket; }
    public void setExperimentBucket(String experimentBucket) { this.experimentBucket = experimentBucket; }
}
