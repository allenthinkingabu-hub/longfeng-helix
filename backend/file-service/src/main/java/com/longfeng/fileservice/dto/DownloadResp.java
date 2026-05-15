package com.longfeng.fileservice.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record DownloadResp(
        @JsonProperty("download_url") String downloadUrl,
        String variant,
        @JsonProperty("ttl_seconds") long ttlSeconds) {
}
