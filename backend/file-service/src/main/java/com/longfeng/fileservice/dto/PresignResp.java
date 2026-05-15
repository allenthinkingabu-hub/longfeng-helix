package com.longfeng.fileservice.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record PresignResp(
        @JsonProperty("upload_url") String uploadUrl,
        @JsonProperty("file_key") String fileKey,
        @JsonProperty("ttl_seconds") long ttlSeconds,
        String bucket) {
}
