package com.longfeng.anonymousservice.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * SC-00-T02 · POST /api/session/resolve request body.
 *
 * <p>Mirrors zod {@code ResolveRequestSchema} in
 * {@code frontend/packages/api-contracts/src/session-resolve.ts}.
 */
public class ResolveRequest {

    @NotBlank
    @Size(max = 128)
    private String deviceFp;

    @NotBlank
    @Size(max = 32)
    private String entrySource;

    @Size(max = 2048)
    private String shareToken;

    @Size(max = 16)
    private String observerCode;

    public String getDeviceFp() { return deviceFp; }
    public void setDeviceFp(String deviceFp) { this.deviceFp = deviceFp; }

    public String getEntrySource() { return entrySource; }
    public void setEntrySource(String entrySource) { this.entrySource = entrySource; }

    public String getShareToken() { return shareToken; }
    public void setShareToken(String shareToken) { this.shareToken = shareToken; }

    public String getObserverCode() { return observerCode; }
    public void setObserverCode(String observerCode) { this.observerCode = observerCode; }
}
