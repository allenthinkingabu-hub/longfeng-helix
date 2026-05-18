package com.longfeng.anonymousservice.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * SC-12-T04 · {@code anon.storage.*} configuration block — temporary OSS bucket
 * for the guest-capture flow (biz §2B.13 SC-12 F03).
 *
 * <p><b>Prefix isolation</b>: this class uses {@code anon.storage} (NOT
 * {@code file-service.storage}). Even though the two services don't share a
 * runtime JVM today, keeping the prefixes disjoint prevents an accidental
 * later monolith refactor from binding both {@code @ConfigurationProperties}
 * beans to the same YAML branch and silently overwriting the other.
 *
 * <p><b>Defaults</b> mirror P-GUEST-CAPTURE spec §5 #1 / biz §2A.3.2:
 * <ul>
 *   <li>{@code presignTtlSeconds=300} — 5-minute pre-signed URL window.</li>
 *   <li>{@code maxUploadSize=10485760} — 10 MiB ceiling (10*1024*1024).</li>
 *   <li>{@code bucket="guest-tmp"} — temporary bucket (NOT prod
 *       {@code wb-attachments}); a separate 24h lifecycle rule cleans it
 *       (deferred to T06).</li>
 * </ul>
 */
@Component
@ConfigurationProperties(prefix = "anon.storage")
public class AnonStorageProperties {

    private String provider = "minio";
    private String endpoint;
    private String bucket = "guest-tmp";
    private String accessKey;
    private String secretKey;
    private long presignTtlSeconds = 300;
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
    public void setPresignTtlSeconds(long presignTtlSeconds) {
        this.presignTtlSeconds = presignTtlSeconds;
    }
    public long getMaxUploadSize() { return maxUploadSize; }
    public void setMaxUploadSize(long maxUploadSize) { this.maxUploadSize = maxUploadSize; }
}
