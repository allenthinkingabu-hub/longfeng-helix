package com.longfeng.anonymousservice.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.OffsetDateTime;

/**
 * SC-13-SHARER · POST /api/share/tokens 200 response — issued share token bundle.
 *
 * <p>Fields cross the wire to the sharer (NOT the public receiver). Unlike the
 * receiver-side {@link ShareDto} this DTO intentionally <b>does</b> ship
 * {@code shareToken} (the raw HS256 JWT) and {@code jti} (so the sharer client
 * can later call {@code DELETE /api/share/tokens/{jti}}). It does NOT leak
 * {@code relationId} / {@code sharerStudentId} (those come from the caller's
 * own JWT and request body — already client-known).
 *
 * <p>{@code shareUrl} is constructed by the controller as
 * {@code ${share.public-base-url}/s/${shareToken}}.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ShareIssueResponse {

    /** HS256 JWT — the bearer of this string can call GET /api/share/{token}. */
    private final String shareToken;

    /** Convenience URL the sharer can copy/paste (front-end {@code /s/:token} route). */
    private final String shareUrl;

    /** Lookup key for revocation — sharer keeps this to call DELETE later. */
    private final String jti;

    /** Effective expiry (clamped server-side to ≤ now+7d per biz §4.11). */
    private final OffsetDateTime expiresAt;

    public ShareIssueResponse(String shareToken, String shareUrl, String jti, OffsetDateTime expiresAt) {
        this.shareToken = shareToken;
        this.shareUrl = shareUrl;
        this.jti = jti;
        this.expiresAt = expiresAt;
    }

    public String getShareToken() { return shareToken; }
    public String getShareUrl() { return shareUrl; }
    public String getJti() { return jti; }
    public OffsetDateTime getExpiresAt() { return expiresAt; }
}
