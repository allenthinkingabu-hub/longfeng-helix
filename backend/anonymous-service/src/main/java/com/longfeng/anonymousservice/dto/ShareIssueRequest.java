package com.longfeng.anonymousservice.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/**
 * SC-13-SHARER · POST /api/share/tokens request body — sharer-side issue contract.
 *
 * <p>biz §10.9 / §4.11 fields:
 * <ul>
 *   <li>{@code shareType} — enum {@code EXAM_DAY|QUESTION|REVIEW_NODE} (jakarta @Pattern enforces)
 *   <li>{@code relationId} — server-side reference (e.g. {@code wb_question:42}); never leaks
 *       through {@link ShareDto} (stays in {@code share_token.relation_id})
 *   <li>{@code expiresInSec} — optional; default 86400 (24h); hard clamp 604800 (7d) by service
 *   <li>{@code allowClaim} — optional; default false; controls one-tap claim after receiver registers
 * </ul>
 *
 * <p>Boundary: any unknown {@code shareType} or {@code @NotBlank relationId} blank →
 * 400 VALIDATION_FAILED via the controller's
 * {@link org.springframework.web.bind.MethodArgumentNotValidException} handler
 * (mirrors {@code SessionResolveController.handleValidation}).
 */
public class ShareIssueRequest {

    @NotBlank
    @Pattern(regexp = "EXAM_DAY|QUESTION|REVIEW_NODE",
            message = "shareType must be EXAM_DAY, QUESTION or REVIEW_NODE")
    private String shareType;

    @NotBlank
    @Size(max = 128)
    private String relationId;

    /** Optional; null → service falls back to 86400 (24h). Clamped to 604800 (7d) max. */
    @Positive
    private Long expiresInSec;

    /** Optional; null → service falls back to false. */
    private Boolean allowClaim;

    public String getShareType() { return shareType; }
    public void setShareType(String shareType) { this.shareType = shareType; }

    public String getRelationId() { return relationId; }
    public void setRelationId(String relationId) { this.relationId = relationId; }

    public Long getExpiresInSec() { return expiresInSec; }
    public void setExpiresInSec(Long expiresInSec) { this.expiresInSec = expiresInSec; }

    public Boolean getAllowClaim() { return allowClaim; }
    public void setAllowClaim(Boolean allowClaim) { this.allowClaim = allowClaim; }
}
