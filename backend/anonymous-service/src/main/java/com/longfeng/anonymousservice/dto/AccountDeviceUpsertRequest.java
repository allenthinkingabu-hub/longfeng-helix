package com.longfeng.anonymousservice.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * SC-00-T02 · POST /internal/account-device/upsert body.
 *
 * <p>Called by auth-service after successful login (silent · failures swallowed).
 * P0 has no internal-token guard; P1 will add one.
 */
public class AccountDeviceUpsertRequest {

    @NotNull
    private Long studentId;

    @NotBlank
    @Size(max = 128)
    private String deviceFp;

    @Size(max = 16)
    private String platform;

    @Size(max = 256)
    private String lastSeenUa;

    public Long getStudentId() { return studentId; }
    public void setStudentId(Long studentId) { this.studentId = studentId; }
    public String getDeviceFp() { return deviceFp; }
    public void setDeviceFp(String deviceFp) { this.deviceFp = deviceFp; }
    public String getPlatform() { return platform; }
    public void setPlatform(String platform) { this.platform = platform; }
    public String getLastSeenUa() { return lastSeenUa; }
    public void setLastSeenUa(String lastSeenUa) { this.lastSeenUa = lastSeenUa; }
}
