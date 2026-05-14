package com.longfeng.fileservice.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record PresignResp(
        String url,
        @JsonProperty("image_url") String imageUrl,
        String method,
        @JsonProperty("object_key") String objectKey,
        @JsonProperty("expires_in_sec") long expiresInSec) {

    /** Alias for objectKey (used by BackendChainIT). */
    public String fileKey() { return objectKey; }

    /** Alias for url (used by BackendChainIT for HTTP PUT). */
    public String uploadUrl() { return url; }
}
