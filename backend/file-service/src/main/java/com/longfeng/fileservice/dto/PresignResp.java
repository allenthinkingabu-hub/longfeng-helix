package com.longfeng.fileservice.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record PresignResp(
        String url,
        @JsonProperty("image_url") String imageUrl,
        String method,
        @JsonProperty("object_key") String objectKey,
        @JsonProperty("expires_in_sec") long expiresInSec) {}
