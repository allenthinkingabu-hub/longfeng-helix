package com.longfeng.fileservice.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
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
