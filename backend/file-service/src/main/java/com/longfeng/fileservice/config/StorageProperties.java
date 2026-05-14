package com.longfeng.fileservice.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "file-service.storage")
public class StorageProperties {

    private String provider = "minio";
    private String endpoint;
    private String bucket;
    private String accessKey;
    private String secretKey;
    private long presignTtlSeconds = 900;
    private long maxUploadSize = 10_485_760;

    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }
    public String getEndpoint() { return endpoint; }
    public void setEndpoint(String endpoint) { this.endpoint = endpoint; }
    public String getBucket() { return bucket; }
    public void setBucket(String bucket) { this.bucket = bucket; }
    public String getAccessKey() { return accessKey; }
    public void setAccessKey(String accessKey) { this.accessKey = accessKey; }
    public String getSecretKey() { return secretKey; }
    public void setSecretKey(String secretKey) { this.secretKey = secretKey; }
    public long getPresignTtlSeconds() { return presignTtlSeconds; }
    public void setPresignTtlSeconds(long presignTtlSeconds) { this.presignTtlSeconds = presignTtlSeconds; }
    public long getMaxUploadSize() { return maxUploadSize; }
    public void setMaxUploadSize(long maxUploadSize) { this.maxUploadSize = maxUploadSize; }
}
