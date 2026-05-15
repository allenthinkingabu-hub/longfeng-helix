package com.longfeng.fileservice.controller;

import com.longfeng.common.dto.ApiResult;
import com.longfeng.common.exception.BusinessException;
import com.longfeng.common.exception.ErrCode;
import com.longfeng.fileservice.entity.WbFile;
import com.longfeng.fileservice.provider.AttachmentStorage;
import com.longfeng.fileservice.provider.AttachmentStorage.PresignResult;
import com.longfeng.fileservice.repo.WbFileRepository;
import com.longfeng.fileservice.repo.WbFileLifecycleRepository;
import com.longfeng.fileservice.entity.WbFileLifecycle;
import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.longfeng.fileservice.support.ObjectKeyBuilder;
import com.longfeng.fileservice.support.SnowflakeIdGenerator;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Presign controller — TDD §12.5.1 POST /api/file/presign.
 *
 * <p>Generates a D-OSS-Key path via {@link ObjectKeyBuilder}, creates a presigned PUT URL
 * via {@link AttachmentStorage}, saves a {@link WbFile} PENDING record, and returns the URL
 * to the frontend for direct OSS upload.
 *
 * <p>Path is intentionally singular ({@code /api/file}) to align with the frontend
 * GuestCapture call site (frontend/apps/h5/src/pages/GuestCapture/index.tsx). The
 * request DTO uses snake_case ({@code content_type}) to match the FE JSON payload.
 *
 * <p>C7: no byte[] in this controller or its service dependencies.
 * C8: all BusinessException messages carry "msgkey:" prefix.
 * C9: OffsetDateTime for all time fields.
 */
@RestController
@RequestMapping("/api/file")
@Validated
public class PresignController {

    private static final Logger LOG = LoggerFactory.getLogger(PresignController.class);

    /** Allowed MIME types for upload. */
    private static final Set<String> ALLOWED_MIME =
            Set.of("image/jpeg", "image/png", "image/heic", "image/webp", "application/pdf");

    private final AttachmentStorage storage;
    private final ObjectKeyBuilder keyBuilder;
    private final SnowflakeIdGenerator idGen;
    private final WbFileRepository fileRepo;
    private final WbFileLifecycleRepository lifecycleRepo;

    /**
     * SC-01-T01 AC2 · Redis-backed presign idempotency cache.
     *
     * <p>Key {@code idem:file:presign:{tenantId}:{studentId}:{xIdempotencyKey}} → value
     * {@code objectKey} string · TTL 24h. Field-injected (not ctor-injected) so existing
     * unit tests that call {@code new PresignController(storage, keyBuilder, idGen,
     * fileRepo, lifecycleRepo)} keep compiling and the SC-01-A03 audit recommendation
     * lands without breaking the 5 existing PresignControllerTest + 4 WebMvcTest cases.
     *
     * <p>Falls back to no-op cache when Redis is unavailable (Q-compliance: only the
     * object_key — not PII — is cached; same model as {@code IdempotencyService} in
     * wrongbook-service).
     */
    @Autowired(required = false)
    private StringRedisTemplate redis;

    @Value("${app.storage.presign-ttl-min:15}")
    private long presignTtlMin;

    @Value("${app.storage.minio.bucket:wrongbook-dev}")
    private String defaultBucket;

    /** D-OSS-TTL: 30d→IA. */
    @Value("${app.storage.lifecycle.ia-after-days:30}")
    private long iaAfterDays;

    /** D-OSS-TTL: 180d→ARCHIVE. */
    @Value("${app.storage.lifecycle.archive-after-days:180}")
    private long archiveAfterDays;

    public PresignController(AttachmentStorage storage,
                             ObjectKeyBuilder keyBuilder,
                             SnowflakeIdGenerator idGen,
                             WbFileRepository fileRepo,
                             WbFileLifecycleRepository lifecycleRepo) {
        this.storage = storage;
        this.keyBuilder = keyBuilder;
        this.idGen = idGen;
        this.fileRepo = fileRepo;
        this.lifecycleRepo = lifecycleRepo;
    }

    /**
     * POST /api/file/presign
     *
     * <p>Request body (snake_case to match frontend GuestCapture payload):
     * <pre>
     * { "filename": "math.jpg", "content_type": "image/jpeg" }
     * </pre>
     *
     * <p>Optional fields {@code bytes} and {@code purpose} are accepted for forward
     * compatibility but are not currently sent by the frontend.
     *
     * <p>Response (snake_case for FE; only {@code url} + {@code image_url} are consumed today):
     * <pre>
     * {
     *   "url": "https://minio/.../put?sig=...",
     *   "image_url": "https://minio/.../get?sig=...",
     *   "method": "PUT",
     *   "object_key": "wrongbook/...",
     *   "expires_in_sec": 900
     * }
     * </pre>
     *
     * @param tenantId  injected from gateway header X-Tenant-Id (default 0 in dev)
     * @param studentId injected from gateway header X-User-Id
     */
    @PostMapping("/presign")
    @Transactional
    public ResponseEntity<ApiResult<PresignRespBody>> presign(
            @Valid @RequestBody PresignReqBody req,
            @RequestHeader(value = "X-Idempotency-Key", required = false) String idempotencyKey,
            @RequestHeader(value = "X-Tenant-Id", defaultValue = "0") long tenantId,
            @RequestHeader(value = "X-User-Id", defaultValue = "0") long studentId) {

        // ── SC-01-T01 AC6 · X-Idempotency-Key header is REQUIRED ───────────────
        // Missing header must surface as HTTP 400 ERR_IDEMPOTENCY_KEY_REQUIRED
        // (NOT 500). Without this guard, a duplicate POST during weak-network retry
        // (TC-01.02) would create a second wb_file row and break the
        // SC-01-T01 invariant "wb_file 仍 1 行 (X-Idempotency-Key 命中)".
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            throw new BusinessException(ErrCode.VALIDATION_FAILED,
                    "msgkey:file.error.idempotency_key_required");
        }

        // MIME validation
        if (!ALLOWED_MIME.contains(req.contentType())) {
            throw new BusinessException(ErrCode.VALIDATION_FAILED,
                    "msgkey:file.error.mime_not_allowed");
        }
        // Size validation (10 MB cap) - @Max annotation also enforces, but double-check
        // when bytes is provided. FE does not send bytes today, so null is allowed.
        if (req.bytes() != null && req.bytes() > 10_485_760L) {
            throw new BusinessException(ErrCode.VALIDATION_FAILED,
                    "msgkey:file.error.file_too_large");
        }

        // ── SC-01-T01 AC2 · idempotency cache HIT short-circuit ────────────────
        // Same (tenantId, studentId, X-Idempotency-Key) within 24h must return the
        // exact same object_key and presign a fresh upload URL for it (do NOT
        // INSERT a second wb_file row, do NOT mint a new Snowflake id). This is
        // the TC-01.02 weak-network resume invariant.
        Optional<String> cachedKey = peekIdempotencyCache(tenantId, studentId, idempotencyKey);
        if (cachedKey.isPresent()) {
            String objectKey = cachedKey.get();
            String bucket = defaultBucket;
            Duration ttl = Duration.ofMinutes(presignTtlMin);
            PresignResult pr = storage.presign(bucket, objectKey, req.contentType(), ttl);
            String imageUrl = storage.get(bucket, objectKey, Duration.ofHours(24));
            LOG.info("presign idempotent HIT · key={} bucket={} objectKey={}", idempotencyKey, bucket, objectKey);
            PresignRespBody hitBody = new PresignRespBody(
                    pr.uploadUrl(),
                    imageUrl,
                    "PUT",
                    objectKey,
                    pr.expiresInSec());
            return ResponseEntity.ok(ApiResult.ok(hitBody));
        }

        long snowflakeId = idGen.nextId();
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);

        // D-OSS-Key path: wrongbook/{tenantId}/{yyyyMM}/{studentId}/{snowflakeId}_{sanitizedFilename}
        // Use the FE-supplied filename so the object key preserves the real extension.
        String originalName = req.filename();
        String objectKey = keyBuilder.build(tenantId, studentId, snowflakeId, originalName, now);

        // Determine bucket (could vary by purpose, but for MVP use default)
        String bucket = defaultBucket;

        Duration ttl = Duration.ofMinutes(presignTtlMin);
        PresignResult pr = storage.presign(bucket, objectKey, req.contentType(), ttl);

        // Long-lived GET URL for the FE to hand to downstream OCR / display.
        // 24h is well within typical OCR + first-render windows.
        String imageUrl = storage.get(bucket, objectKey, Duration.ofHours(24));

        // Persist PENDING metadata record (C7: no bytes stored here, only size number).
        // saveAndFlush ensures the wb_file row is INSERT-ed before the lifecycle row
        // references it via @MapsId. Without flush, Hibernate observed an unsaved
        // associated entity while resolving the OneToOneType during merge and threw
        // AssertionFailure: null identifier (com.longfeng.fileservice.entity.WbFileLifecycle).
        WbFile file = new WbFile();
        file.setId(snowflakeId);
        file.setTenantId(tenantId);
        file.setStudentId(studentId);
        file.setObjectKey(objectKey);
        file.setMimeType(req.contentType());
        file.setBytes(req.bytes());
        // SC-01-T01 AC1 · persist sha256_hash when client supplies it. Column
        // (V1.0.080 sha256_hash CHAR(64)) already exists; we just stop dropping
        // the field on the floor. Optional today to avoid breaking GuestCapture
        // which does not yet compute the hash client-side.
        if (req.sha256() != null && !req.sha256().isBlank()) {
            file.setSha256Hash(req.sha256());
        }
        file.setStatus(WbFile.STATUS_PENDING);
        file.setStorageClass("STANDARD");
        file.setCreatedAt(now);
        file = fileRepo.saveAndFlush(file);

        // Persist lifecycle record (D-OSS-TTL).
        // Do NOT setFileId — @MapsId derives the PK from file.id. Setting both was the
        // double-set conflict that caused the original null-identifier failure.
        WbFileLifecycle lifecycle = new WbFileLifecycle();
        lifecycle.setFile(file);
        lifecycle.setTenantId(tenantId);
        lifecycle.setPromoteAt(now.plusDays(iaAfterDays));
        lifecycle.setArchiveAt(now.plusDays(archiveAfterDays));
        lifecycleRepo.save(lifecycle);

        // ── SC-01-T01 AC2 · claim cache so duplicate POST returns same objectKey ──
        claimIdempotencyCache(tenantId, studentId, idempotencyKey, objectKey);

        LOG.info("presign MISS · idemKey={} bucket={} key={} provider={} ttlMin={} sha256={}",
                idempotencyKey, bucket, objectKey, storage.name(), presignTtlMin,
                req.sha256() == null ? "-" : req.sha256().substring(0, Math.min(8, req.sha256().length())));

        PresignRespBody body = new PresignRespBody(
                pr.uploadUrl(),
                imageUrl,
                "PUT",
                objectKey,
                pr.expiresInSec());

        return ResponseEntity.ok(ApiResult.ok(body));
    }

    /**
     * POST /api/file/complete/{objectKey}
     *
     * <p>Marks the {@link WbFile} record as UPLOADED (status=1) after the client
     * finishes the direct PUT to the presigned URL. Idempotent: calling complete
     * on an already-UPLOADED file is a no-op.
     *
     * <p>SC-01-T01 upload chain step 3 (presign → PUT → complete → createPending).
     */
    @PostMapping(value = {"/complete/{objectKey}", "/complete"})
    @Transactional
    public ResponseEntity<ApiResult<CompleteRespBody>> complete(
            @PathVariable(required = false) String objectKey,
            @RequestParam(value = "key", required = false) String queryKey) {
        if ((objectKey == null || objectKey.isBlank()) && queryKey != null) {
            objectKey = queryKey;
        }
        if (objectKey == null || objectKey.isBlank()) {
            throw new BusinessException(ErrCode.VALIDATION_FAILED,
                    "msgkey:file.error.object_key_required");
        }
        WbFile file = fileRepo.findByObjectKey(objectKey)
                .orElseThrow(() -> new BusinessException(ErrCode.RESOURCE_NOT_FOUND,
                        "msgkey:file.error.not_found"));
        if (file.getStatus() != WbFile.STATUS_UPLOADED) {
            file.setStatus(WbFile.STATUS_UPLOADED);
            fileRepo.save(file);
        }
        LOG.info("file complete · objectKey={} status=UPLOADED", objectKey);
        return ResponseEntity.ok(ApiResult.ok(
                new CompleteRespBody(objectKey, "READY")));
    }

    public record CompleteRespBody(
            @JsonProperty("file_key") String fileKey,
            String status) {}

    // ── SC-01-T01 AC2 · Redis idempotency cache helpers ───────────────────────

    /** Key shape: {@code idem:file:presign:{tenantId}:{studentId}:{xIdempotencyKey}}. */
    private static String buildIdemKey(long tenantId, long studentId, String idempotencyKey) {
        return "idem:file:presign:" + tenantId + ":" + studentId + ":" + idempotencyKey;
    }

    /** Returns the cached objectKey for a previous presign with the same idempotency key, or empty. */
    private Optional<String> peekIdempotencyCache(long tenantId, long studentId, String idempotencyKey) {
        if (redis == null) {
            return Optional.empty();
        }
        try {
            String v = redis.opsForValue().get(buildIdemKey(tenantId, studentId, idempotencyKey));
            return (v == null || v.isBlank()) ? Optional.empty() : Optional.of(v);
        } catch (Exception ignored) {
            return Optional.empty();
        }
    }

    /** Atomic SET-NX-EX 24h so duplicate POST in window returns the same objectKey. */
    private void claimIdempotencyCache(long tenantId, long studentId, String idempotencyKey, String objectKey) {
        if (redis == null) {
            return;
        }
        try {
            redis.opsForValue().setIfAbsent(
                    buildIdemKey(tenantId, studentId, idempotencyKey),
                    objectKey,
                    Duration.ofHours(24));
        } catch (Exception ignored) {
            // No-op: idempotency is best-effort when Redis is offline (Q-compliance allows it).
        }
    }

    // ── Inner DTOs ──────────────────────────────────────────────────────────

    /**
     * Request body. Uses {@link JsonProperty} to map FE snake_case ({@code content_type})
     * to Java camelCase ({@code contentType}) without forcing the rest of the codebase
     * onto a snake_case naming strategy.
     *
     * <p>{@code filename} + {@code contentType} are required (FE always sends both).
     * {@code bytes} + {@code purpose} + {@code sha256} are optional forward-compat slots.
     *
     * <p>SC-01-T01 AC1 wire fields:
     * <ul>
     *   <li>{@code mime} — accepted as alias for {@code content_type} (spec uses
     *       {@code mime}; FE/legacy still send {@code content_type}). {@link JsonAlias}
     *       lets the controller accept either.
     *   <li>{@code size} — accepted as alias for {@code bytes} (spec uses {@code size};
     *       FE sends {@code size} on the new path). Alias kept rather than rename to
     *       preserve backward compat with existing PresignControllerTest and the
     *       in-tree GuestCapture page.
     *   <li>{@code sha256_hash} — optional SHA-256 hex content fingerprint; persisted
     *       into {@code wb_file.sha256_hash} (V1.0.080) so future presigns can dedupe
     *       on content. Validated against the 64-char hex pattern when present.
     * </ul>
     */
    public record PresignReqBody(
            @NotBlank String filename,
            @JsonProperty("content_type") @JsonAlias({"mime"}) @NotBlank String contentType,
            @JsonProperty("bytes") @JsonAlias({"size"}) @Min(0) @Max(10_485_760) Long bytes,
            String purpose,
            @JsonProperty("sha256_hash") @JsonAlias({"sha256"})
                    @Pattern(regexp = "^[a-fA-F0-9]{64}$",
                            message = "msgkey:file.error.sha256_hex_required")
                    String sha256) {

        // Backward-compat ctor so the 5 existing PresignControllerTest cases that
        // call `new PresignReqBody(filename, contentType, bytes, purpose)` still compile
        // (sha256 is optional — defaults to null).
        public PresignReqBody(String filename, String contentType, Long bytes, String purpose) {
            this(filename, contentType, bytes, purpose, null);
        }
    }

    /**
     * Response body. {@link JsonProperty} keeps the wire format snake_case for FE
     * while record components stay camelCase. FE consumes only {@code url} +
     * {@code image_url} today; the other fields are kept for callback / debug use.
     */
    public record PresignRespBody(
            String url,
            @JsonProperty("image_url") String imageUrl,
            String method,
            @JsonProperty("object_key") String objectKey,
            @JsonProperty("expires_in_sec") long expiresInSec) {}
}
