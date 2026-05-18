package com.longfeng.anonymousservice.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * SC-12-T04 · {@code POST /api/anon/file/presign} 200 response.
 *
 * <p>Wire field names (snake_case via {@code @JsonProperty}) match
 * {@code file-service}' {@code PresignResp} so the frontend can deserialise both
 * with one shared TypeScript interface. Java-side camelCase via the record
 * accessor + Jackson alias for JSON keeps the boundary clean.
 */
public record AnonPresignResponse(
        @JsonProperty("upload_url") String uploadUrl,
        @JsonProperty("file_key") String fileKey,
        @JsonProperty("ttl_seconds") long ttlSeconds,
        String bucket) {
}
