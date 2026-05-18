package com.longfeng.anonymousservice.service;

import com.longfeng.anonymousservice.config.AnonStorageProperties;
import io.minio.BucketExistsArgs;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.http.Method;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

/**
 * SC-12-T04 · Mint pre-signed PUT URLs for the guest-capture flow (biz §2B.13 F03).
 *
 * <p>Object key layout: {@code guest-tmp/{anonSessionId}/{uuid}.{ext}}.
 * Pinning the {@code anonSessionId} into the prefix is the cross-tenant write
 * defence — even if a leaked anonToken is replayed against the presign endpoint,
 * the resulting URL is scoped to that session's prefix and cannot overwrite
 * another guest's artefact.
 *
 * <p>Validation layering (defence in depth):
 * <ol>
 *   <li>Controller-level {@code @Valid} on the request DTO (mime regex,
 *       {@code @Max} size, {@code @NotBlank} fields).</li>
 *   <li>Service-level explicit {@link UnsupportedMimeException} +
 *       {@link FileTooLargeException} for tests that exercise the service
 *       directly OR for the case the controller bypasses validation (e.g.
 *       direct service call from a future internal job).</li>
 * </ol>
 *
 * <p>File extension extraction sanitises the trailing segment to
 * {@code [a-z0-9]{1,4}}; anything that doesn't match falls back to
 * {@code bin}. This stops path-traversal artefacts like
 * {@code ../../etc/passwd} from leaking into the object key.
 *
 * <p>Sets {@code ensureBucket} on every call so a fresh sandbox without the
 * {@code guest-tmp} bucket auto-bootstraps. Best-effort: a concurrent
 * {@code makeBucket} race is swallowed (bucket exists) — same pattern as
 * {@code file-service}' {@code MinioStorageProvider}.
 */
@Service
public class AnonPresignService {

    private static final Logger LOG = LoggerFactory.getLogger(AnonPresignService.class);

    /** Allowed MIME types for guest capture — image only. Pinned by biz §2B.13 F03. */
    private static final String MIME_JPEG = "image/jpeg";
    private static final String MIME_PNG  = "image/png";

    /** Sanitised file extension fallback when filename has no usable ext. */
    private static final String DEFAULT_EXT = "bin";

    private final MinioClient client;
    private final AnonStorageProperties props;

    public AnonPresignService(
            @Qualifier("anonMinioClient") MinioClient client,
            AnonStorageProperties props) {
        this.client = client;
        this.props = props;
    }

    /**
     * Mint a pre-signed PUT URL scoped to {@code guest-tmp/{anonSessionId}/}.
     *
     * @param anonSessionId guest_session.id from the verified anonToken
     *                      (filter-injected via request attribute upstream)
     * @param filename      client-supplied filename (sanitised for ext only)
     * @param mime          client-supplied MIME ({@code image/jpeg|image/png})
     * @param size          declared byte size (≤ {@code maxUploadSize})
     * @return PUT URL + objectKey + ttlSeconds + bucket
     * @throws UnsupportedMimeException if mime not in whitelist
     * @throws FileTooLargeException    if size exceeds {@code maxUploadSize}
     */
    public PresignResult mintPresignedPut(
            long anonSessionId, String filename, String mime, long size) {
        if (mime == null || !(MIME_JPEG.equals(mime) || MIME_PNG.equals(mime))) {
            throw new UnsupportedMimeException(
                    "Mime must be " + MIME_JPEG + " or " + MIME_PNG + ", got: " + mime);
        }
        if (size > props.getMaxUploadSize()) {
            throw new FileTooLargeException(
                    "File size " + size + " exceeds max " + props.getMaxUploadSize());
        }

        String ext = sanitiseExt(filename);
        String uuid = UUID.randomUUID().toString().replace("-", "");
        String objectKey = "guest-tmp/" + anonSessionId + "/" + uuid + "." + ext;

        try {
            ensureBucket(props.getBucket());
            String url = client.getPresignedObjectUrl(
                    GetPresignedObjectUrlArgs.builder()
                            .method(Method.PUT)
                            .bucket(props.getBucket())
                            .object(objectKey)
                            .expiry((int) props.getPresignTtlSeconds(), TimeUnit.SECONDS)
                            .build());
            return new PresignResult(url, objectKey, props.getPresignTtlSeconds(), props.getBucket());
        } catch (UnsupportedMimeException | FileTooLargeException re) {
            throw re;
        } catch (Exception e) {
            LOG.warn("anon_presign_minio_failed anonSessionId={} bucket={} err={}",
                    anonSessionId, props.getBucket(), e.toString());
            throw new RuntimeException("MinIO presign failed", e);
        }
    }

    /**
     * Pull the last {@code [a-z0-9]{1,4}} segment from the filename or fall back
     * to {@code bin}. Any traversal artefacts ({@code ..}, {@code /}, mixed-case
     * weirdness) collapse to {@code bin} — the object key never contains user-
     * controlled path components beyond the sanitised ext.
     */
    private String sanitiseExt(String filename) {
        if (filename == null) return DEFAULT_EXT;
        int idx = filename.lastIndexOf('.');
        if (idx < 0 || idx == filename.length() - 1) return DEFAULT_EXT;
        String raw = filename.substring(idx + 1).toLowerCase();
        return raw.matches("[a-z0-9]{1,4}") ? raw : DEFAULT_EXT;
    }

    /** Bucket bootstrap — same best-effort approach as file-service MinioStorageProvider. */
    private void ensureBucket(String bucket) {
        try {
            boolean exists = client.bucketExists(
                    BucketExistsArgs.builder().bucket(bucket).build());
            if (!exists) {
                client.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
            }
        } catch (Exception e) {
            // Best-effort; bucket may already exist from another thread/process race.
            LOG.debug("ensureBucket non-fatal: bucket={} err={}", bucket, e.toString());
        }
    }

    /**
     * SC-12-T06 · Mint a pre-signed GET URL for an already-uploaded object
     * scoped to the {@code guest-tmp} bucket — used to hand the image to
     * {@code ai-analysis-service} (which forwards to Qianwen VL · external
     * vendor cannot reach MinIO directly).
     *
     * <p>Unlike {@link #mintPresignedPut}, this does <b>not</b> bootstrap the
     * bucket: the GET URL only makes sense for an object that was already
     * written through a prior PUT URL (T04 → T05 flow). Skipping
     * {@code ensureBucket} avoids a redundant network round-trip on every
     * analyze call.
     *
     * <p>TTL is caller-supplied (in seconds). The analyze flow uses 600 (10
     * minutes) — long enough for Qianwen to fetch the image but short enough
     * that a leaked URL expires before a meaningful replay window opens.
     *
     * @param objectKey   MinIO object key (e.g. {@code guest-tmp/123/abc.jpg};
     *                    must already exist in the bucket)
     * @param ttlSeconds  URL TTL in seconds (≤ 7 days · MinIO ceiling)
     * @return GET URL string suitable for an HTTP client to fetch the object
     * @throws RuntimeException if MinIO presign signing fails (wrapped IOException etc.)
     */
    public String mintPresignedGet(String objectKey, long ttlSeconds) {
        try {
            return client.getPresignedObjectUrl(
                    GetPresignedObjectUrlArgs.builder()
                            .method(Method.GET)
                            .bucket(props.getBucket())
                            .object(objectKey)
                            .expiry((int) ttlSeconds, TimeUnit.SECONDS)
                            .build());
        } catch (Exception e) {
            LOG.warn("anon_presign_get_failed object_key={} bucket={} err={}",
                    objectKey, props.getBucket(), e.toString());
            throw new RuntimeException("MinIO presigned GET failed for " + objectKey, e);
        }
    }

    /** Wire-friendly result record; controller maps to JSON response. */
    public record PresignResult(String uploadUrl, String fileKey, long ttlSeconds, String bucket) {}

    /** 415 marker: client supplied a MIME outside the whitelist. */
    public static class UnsupportedMimeException extends RuntimeException {
        public UnsupportedMimeException(String msg) { super(msg); }
    }

    /** 413 marker: declared size exceeds the bucket's configured ceiling. */
    public static class FileTooLargeException extends RuntimeException {
        public FileTooLargeException(String msg) { super(msg); }
    }
}
