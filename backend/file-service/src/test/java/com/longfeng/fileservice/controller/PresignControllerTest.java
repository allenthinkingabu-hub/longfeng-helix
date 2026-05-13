package com.longfeng.fileservice.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.longfeng.fileservice.controller.PresignController.PresignReqBody;
import com.longfeng.fileservice.entity.WbFile;
import com.longfeng.fileservice.entity.WbFileLifecycle;
import com.longfeng.fileservice.provider.AttachmentStorage;
import com.longfeng.fileservice.provider.AttachmentStorage.PresignResult;
import com.longfeng.fileservice.repo.WbFileLifecycleRepository;
import com.longfeng.fileservice.repo.WbFileRepository;
import com.longfeng.fileservice.support.ObjectKeyBuilder;
import com.longfeng.fileservice.support.SnowflakeIdGenerator;
import java.time.Duration;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

/**
 * Unit tests for {@link PresignController}.
 *
 * <p>Uses inline Mockito stubs (no @SpringBootTest) per F-02 guideline.
 * LENIENT strictness because some setUp stubs are only used by a subset of tests.
 * Covers: happy path, MIME not allowed, file too large scenarios.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PresignControllerTest {

    @Mock AttachmentStorage storage;
    @Mock WbFileRepository fileRepo;
    @Mock WbFileLifecycleRepository lifecycleRepo;

    // Use real ObjectKeyBuilder and SnowflakeIdGenerator (pure logic, no dependencies)
    private ObjectKeyBuilder keyBuilder;
    private SnowflakeIdGenerator idGen;
    private PresignController controller;

    @BeforeEach
    void setUp() {
        keyBuilder = new ObjectKeyBuilder();
        idGen = new SnowflakeIdGenerator(6L);
        controller = new PresignController(storage, keyBuilder, idGen, fileRepo, lifecycleRepo);
        // Inject @Value fields via reflection (simpler than SpringBootTest for unit test)
        setField(controller, "presignTtlMin", 15L);
        setField(controller, "defaultBucket", "wrongbook-dev");
        setField(controller, "iaAfterDays", 30L);
        setField(controller, "archiveAfterDays", 180L);

        // Default stub: fileRepo.saveAndFlush returns the file (controller uses saveAndFlush
        // so the wb_file row is INSERT-ed before WbFileLifecycle's @MapsId resolves the PK).
        when(fileRepo.saveAndFlush(any(WbFile.class))).thenAnswer(inv -> inv.getArgument(0));
        when(lifecycleRepo.save(any(WbFileLifecycle.class))).thenAnswer(inv -> inv.getArgument(0));
        when(storage.name()).thenReturn("minio");
        // Default stub: storage.get returns a deterministic GET URL (image_url)
        when(storage.get(anyString(), anyString(), any())).thenReturn("https://minio/get-url?sig=xyz");
    }

    // ── Happy path ────────────────────────────────────────────────────────

    @Test
    @DisplayName("presign happy path · image/jpeg · returns url + image_url + objectKey + expiresInSec")
    void presign_happyPath_returnsPresignResult() {
        // Given
        PresignResult mockResult = new PresignResult("https://minio/put-url?sig=abc", "wrongbook/0/202601/0/123_upload.bin", 900L);
        when(storage.presign(anyString(), anyString(), eq("image/jpeg"), any())).thenReturn(mockResult);

        PresignReqBody req = new PresignReqBody("math.jpg", "image/jpeg", 2_000_000L, "wrongbook");

        // When
        var response = controller.presign(req, "test-idem-key-" + java.util.UUID.randomUUID(), 0L, 0L);

        // Then
        assertThat(response).isNotNull();
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo(0);
        var data = response.getBody().data();
        assertThat(data).isNotNull();
        assertThat(data.url()).isEqualTo("https://minio/put-url?sig=abc");
        assertThat(data.imageUrl()).isEqualTo("https://minio/get-url?sig=xyz");
        assertThat(data.method()).isEqualTo("PUT");
        assertThat(data.objectKey()).startsWith("wrongbook/");
        assertThat(data.objectKey()).endsWith(".jpg");
        assertThat(data.expiresInSec()).isEqualTo(900L);
    }

    @Test
    @DisplayName("presign happy path · FE payload missing bytes/purpose · still succeeds")
    void presign_minimalFePayload_succeeds() {
        PresignResult mockResult = new PresignResult("https://minio/put", "key", 900L);
        when(storage.presign(anyString(), anyString(), anyString(), any())).thenReturn(mockResult);

        // Mirrors the actual GuestCapture call: only filename + content_type
        PresignReqBody req = new PresignReqBody("photo.png", "image/png", null, null);

        var response = controller.presign(req, "test-idem-key-" + java.util.UUID.randomUUID(), 0L, 0L);

        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo(0);
        assertThat(response.getBody().data().imageUrl()).isEqualTo("https://minio/get-url?sig=xyz");
    }

    @Test
    @DisplayName("presign happy path · WbFile PENDING record saved to repo")
    void presign_savesWbFilePendingRecord() {
        PresignResult mockResult = new PresignResult("https://minio/put", "wrongbook/0/202601/1/111_upload.bin", 900L);
        when(storage.presign(anyString(), anyString(), anyString(), any())).thenReturn(mockResult);

        controller.presign(
                new PresignReqBody("note.png", "image/png", 500_000L, "wrongbook"),
                "test-idem-key-" + java.util.UUID.randomUUID(),
                1L, 42L);

        ArgumentCaptor<WbFile> captor = ArgumentCaptor.forClass(WbFile.class);
        verify(fileRepo).saveAndFlush(captor.capture());
        WbFile saved = captor.getValue();
        assertThat(saved.getStatus()).isEqualTo(WbFile.STATUS_PENDING);
        assertThat(saved.getStudentId()).isEqualTo(42L);
        assertThat(saved.getTenantId()).isEqualTo(1L);
        assertThat(saved.getMimeType()).isEqualTo("image/png");
        assertThat(saved.getBytes()).isEqualTo(500_000L);
    }

    @Test
    @DisplayName("presign happy path · WbFile bytes can be null when FE omits the field")
    void presign_nullBytes_persistedAsNull() {
        PresignResult mockResult = new PresignResult("https://minio/put", "key", 900L);
        when(storage.presign(anyString(), anyString(), anyString(), any())).thenReturn(mockResult);

        controller.presign(
                new PresignReqBody("a.jpg", "image/jpeg", null, null),
                "test-idem-key-" + java.util.UUID.randomUUID(),
                0L, 7L);

        ArgumentCaptor<WbFile> captor = ArgumentCaptor.forClass(WbFile.class);
        verify(fileRepo).saveAndFlush(captor.capture());
        assertThat(captor.getValue().getBytes()).isNull();
    }

    @Test
    @DisplayName("presign happy path · WbFileLifecycle record saved with promoteAt + archiveAt")
    void presign_savesLifecycleRecord() {
        PresignResult mockResult = new PresignResult("https://minio/put", "key", 900L);
        when(storage.presign(anyString(), anyString(), anyString(), any())).thenReturn(mockResult);

        controller.presign(
                new PresignReqBody("a.jpg", "image/jpeg", 100L, null),
                "test-idem-key-" + java.util.UUID.randomUUID(),
                0L, 99L);

        ArgumentCaptor<WbFileLifecycle> captor = ArgumentCaptor.forClass(WbFileLifecycle.class);
        verify(lifecycleRepo).save(captor.capture());
        WbFileLifecycle lc = captor.getValue();
        assertThat(lc.getPromoteAt()).isNotNull();
        assertThat(lc.getArchiveAt()).isNotNull();
        // promoteAt should be ~30 days from now
        OffsetDateTime now = OffsetDateTime.now();
        assertThat(lc.getPromoteAt()).isAfter(now.plusDays(29));
        assertThat(lc.getArchiveAt()).isAfter(now.plusDays(179));
    }

    // ── Error: MIME not allowed ───────────────────────────────────────────

    @Test
    @DisplayName("presign · content_type=application/exe → BusinessException VALIDATION_FAILED")
    void presign_mimeNotAllowed_throwsBusinessException() {
        PresignReqBody req = new PresignReqBody("a.exe", "application/exe", 1000L, "wrongbook");

        org.junit.jupiter.api.Assertions.assertThrows(
                com.longfeng.common.exception.BusinessException.class,
                () -> controller.presign(req, "test-idem-key-" + java.util.UUID.randomUUID(), 0L, 0L));

        verify(storage, never()).presign(any(), any(), any(), any());
        verify(fileRepo, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("presign · content_type=text/html → BusinessException VALIDATION_FAILED")
    void presign_htmlMimeNotAllowed_throwsBusinessException() {
        PresignReqBody req = new PresignReqBody("a.html", "text/html", 100L, null);

        org.junit.jupiter.api.Assertions.assertThrows(
                com.longfeng.common.exception.BusinessException.class,
                () -> controller.presign(req, "test-idem-key-" + java.util.UUID.randomUUID(), 0L, 0L));
    }

    // ── SC-01-T01 AC6 · X-Idempotency-Key required (unit-level guard) ────

    @Test
    @DisplayName("SC-01-T01 AC6 · null idempotencyKey → BusinessException (storage/repo never called)")
    void presign_nullIdempotencyKey_throwsBusinessException() {
        PresignReqBody req = new PresignReqBody("math.jpg", "image/jpeg", 1_000L, null);

        org.junit.jupiter.api.Assertions.assertThrows(
                com.longfeng.common.exception.BusinessException.class,
                () -> controller.presign(req, null, 0L, 0L));

        verify(storage, never()).presign(any(), any(), any(), any());
        verify(fileRepo, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("SC-01-T01 AC6 · blank idempotencyKey → BusinessException")
    void presign_blankIdempotencyKey_throwsBusinessException() {
        PresignReqBody req = new PresignReqBody("math.jpg", "image/jpeg", 1_000L, null);

        org.junit.jupiter.api.Assertions.assertThrows(
                com.longfeng.common.exception.BusinessException.class,
                () -> controller.presign(req, "   ", 0L, 0L));

        verify(storage, never()).presign(any(), any(), any(), any());
    }

    // ── SC-01-T01 AC1 · sha256_hash forwarded onto WbFile when supplied ──

    @Test
    @DisplayName("SC-01-T01 AC1 · sha256 field on PresignReqBody → forwarded to WbFile.sha256Hash")
    void presign_sha256Field_persistedOnWbFile() {
        PresignResult mockResult = new PresignResult("https://minio/put", "key", 900L);
        when(storage.presign(anyString(), anyString(), anyString(), any())).thenReturn(mockResult);
        String synthSha256 = "b".repeat(64);

        // PresignReqBody full-arg ctor (filename, contentType, bytes, purpose, sha256)
        PresignReqBody req = new PresignReqBody("a.jpg", "image/jpeg", 2_000L, "wrongbook", synthSha256);
        controller.presign(req, "test-idem-key-" + java.util.UUID.randomUUID(), 0L, 7L);

        ArgumentCaptor<WbFile> captor = ArgumentCaptor.forClass(WbFile.class);
        verify(fileRepo).saveAndFlush(captor.capture());
        assertThat(captor.getValue().getSha256Hash()).isEqualTo(synthSha256);
    }

    // ── SC-01-T01 AC2 / TI1 · Redis idempotency HIT short-circuit + MISS claim ──
    //
    // attempt-2 (retries=1): adversarial.md REJECT 轮 1 second branch — Coder attempt-1
    // 加了 ~50 行 peekIdempotencyCache / claimIdempotencyCache HIT 短路 + SETNX EX 24h
    // 但 51 个单测 0 行覆盖 (redis=null → 永远走 Optional.empty 分支)。本两条用例直接
    // 注入 mock StringRedisTemplate 击穿 HIT + MISS 两条路径，防止后续 regression
    // (key shape 漂移 / TTL 改小 / 忘 setIfAbsent) 静默逃出。

    @Test
    @DisplayName("SC-01-T01 AC2/TI1 · 同 X-Idempotency-Key 24h HIT → 复用 objectKey · fileRepo never saveAndFlush · lifecycle never save · snowflake 不消耗")
    void presign_idempotencyHit_reusesObjectKey_noSecondRow() {
        // Given: 注入 stub StringRedisTemplate 子类 (Java 25 + 默认 Mockito 无法直接
        // mock StringRedisTemplate 的多层 Spring final / package-private hierarchy,
        // 但我们只需 opsForValue() 行为, 子类 override 即可)。同 key 第一次已 claim
        // 了 objectKey "wrongbook/0/202601/7/100_q.jpg"。
        @SuppressWarnings("unchecked")
        ValueOperations<String, String> ops = mock(ValueOperations.class);
        String cachedObjectKey = "wrongbook/0/202601/7/100_q.jpg";
        when(ops.get("idem:file:presign:0:7:test-key-hit")).thenReturn(cachedObjectKey);
        StringRedisTemplate stubRedis = new StringRedisTemplate() {
            @Override public ValueOperations<String, String> opsForValue() { return ops; }
        };
        setField(controller, "redis", stubRedis);

        // HIT 路径会用 cached objectKey 重新签 PUT URL（注意：tester 报告里把这个签名
        // 描述为 "不重新调 MinIO 签名 SDK"，实际 controller 代码 line 179 在 HIT 分支
        // 仍调 storage.presign(...) 重新签发新 PUT URL — 这是合理的 (presigned URL
        // 有 TTL，必须为续传场景生成新 URL)。关键不变量是: objectKey 复用 + 不写库 +
        // 不消耗新 Snowflake id。
        when(storage.presign(anyString(), eq(cachedObjectKey), eq("image/jpeg"), any()))
                .thenReturn(new PresignResult("https://minio/put-hit?sig=hit", cachedObjectKey, 900L));

        // When: 同 idemKey 第二次 presign
        PresignReqBody req = new PresignReqBody("q.jpg", "image/jpeg", 1_000L, null);
        var resp = controller.presign(req, "test-key-hit", 0L, 7L);

        // Then 1: objectKey 必须复用 cached 值，不是新 Snowflake-derived path
        assertThat(resp.getBody()).isNotNull();
        assertThat(resp.getBody().data().objectKey()).isEqualTo(cachedObjectKey);
        // Then 2: HIT 分支不调 fileRepo.saveAndFlush · wb_file 仍 1 行 (TI1 核心)
        verify(fileRepo, never()).saveAndFlush(any(WbFile.class));
        // Then 3: HIT 分支不写 lifecycle
        verify(lifecycleRepo, never()).save(any(WbFileLifecycle.class));
        // Then 4: HIT 分支不再 claim cache (setIfAbsent 不被二次调用)
        verify(ops, never()).setIfAbsent(anyString(), anyString(), any(Duration.class));
    }

    @Test
    @DisplayName("SC-01-T01 AC2 · MISS 路径 success 末尾 claim SETNX · TTL 必须 = Duration.ofHours(24)")
    void presign_idempotencyMiss_claimsCacheWith24hTtl() {
        // Given: stub Redis · peek 返 null (MISS)
        @SuppressWarnings("unchecked")
        ValueOperations<String, String> ops = mock(ValueOperations.class);
        when(ops.get(anyString())).thenReturn(null);  // MISS
        when(ops.setIfAbsent(anyString(), anyString(), any(Duration.class))).thenReturn(true);
        StringRedisTemplate stubRedis = new StringRedisTemplate() {
            @Override public ValueOperations<String, String> opsForValue() { return ops; }
        };
        setField(controller, "redis", stubRedis);

        when(storage.presign(anyString(), anyString(), anyString(), any()))
                .thenReturn(new PresignResult("https://minio/put", "obj-k", 900L));

        // When
        PresignReqBody req = new PresignReqBody("q.jpg", "image/jpeg", 1_000L, null);
        controller.presign(req, "test-key-miss", 0L, 7L);

        // Then: MISS 走完整路径 → 写 wb_file + lifecycle + 末尾 claim SETNX EX 24h
        verify(fileRepo).saveAndFlush(any(WbFile.class));
        verify(lifecycleRepo).save(any(WbFileLifecycle.class));

        ArgumentCaptor<String> keyCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> valCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Duration> ttlCaptor = ArgumentCaptor.forClass(Duration.class);
        verify(ops).setIfAbsent(keyCaptor.capture(), valCaptor.capture(), ttlCaptor.capture());
        // key shape: idem:file:presign:{tenantId}:{studentId}:{idempotencyKey}
        assertThat(keyCaptor.getValue()).isEqualTo("idem:file:presign:0:7:test-key-miss");
        // value: real (snowflake-derived) objectKey written this MISS
        assertThat(valCaptor.getValue()).isNotBlank();
        // TTL 必须正好 24h — 防 regression 改成 24min / 1h / 7d
        assertThat(ttlCaptor.getValue()).isEqualTo(Duration.ofHours(24));
    }

    // ── Error: file too large ─────────────────────────────────────────────

    @Test
    @DisplayName("presign · bytes=11MB → BusinessException VALIDATION_FAILED")
    void presign_fileTooLarge_throwsBusinessException() {
        // 11 MB exceeds 10 MB cap
        long oversizeBytes = 11_000_000L;
        PresignReqBody req = new PresignReqBody("a.jpg", "image/jpeg", oversizeBytes, "wrongbook");

        org.junit.jupiter.api.Assertions.assertThrows(
                com.longfeng.common.exception.BusinessException.class,
                () -> controller.presign(req, "test-idem-key-" + java.util.UUID.randomUUID(), 0L, 0L));

        verify(storage, never()).presign(any(), any(), any(), any());
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private static void setField(Object target, String fieldName, Object value) {
        try {
            var field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (Exception e) {
            throw new RuntimeException("Failed to set field " + fieldName, e);
        }
    }
}
