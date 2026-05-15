package com.longfeng.fileservice.provider;

import java.time.Duration;

public interface AttachmentStorage {

    PresignResult presign(String bucket, String objectKey, String contentType, Duration ttl);

    String get(String bucket, String objectKey, Duration ttl);

    java.io.InputStream readObject(String bucket, String objectKey);

    void putObject(String bucket, String objectKey, java.io.InputStream data, long size, String contentType);

    String name();

    record PresignResult(String uploadUrl, String objectKey, long expiresInSec) {}
}
