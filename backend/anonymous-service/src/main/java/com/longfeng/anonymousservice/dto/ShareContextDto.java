package com.longfeng.anonymousservice.dto;

/** SC-00-T02 · biz §10.6 shareContext — masked so unauth viewer cannot enumerate sharer. */
public class ShareContextDto {
    private String shareType;          // EXAM_DAY / QUESTION / REVIEW_NODE
    private String maskedSharerName;   // e.g. "X***"
    private boolean allowClaim;
    private String expiresAt;          // ISO 8601

    public ShareContextDto() {}
    public ShareContextDto(String shareType, String maskedSharerName, boolean allowClaim, String expiresAt) {
        this.shareType = shareType;
        this.maskedSharerName = maskedSharerName;
        this.allowClaim = allowClaim;
        this.expiresAt = expiresAt;
    }
    public String getShareType() { return shareType; }
    public void setShareType(String shareType) { this.shareType = shareType; }
    public String getMaskedSharerName() { return maskedSharerName; }
    public void setMaskedSharerName(String maskedSharerName) { this.maskedSharerName = maskedSharerName; }
    public boolean isAllowClaim() { return allowClaim; }
    public void setAllowClaim(boolean allowClaim) { this.allowClaim = allowClaim; }
    public String getExpiresAt() { return expiresAt; }
    public void setExpiresAt(String expiresAt) { this.expiresAt = expiresAt; }
}
