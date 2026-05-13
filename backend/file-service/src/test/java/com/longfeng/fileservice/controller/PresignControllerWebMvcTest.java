package com.longfeng.fileservice.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.longfeng.common.exception.BusinessException;
import com.longfeng.common.exception.ErrCode;
import com.longfeng.fileservice.entity.WbFile;
import com.longfeng.fileservice.entity.WbFileLifecycle;
import com.longfeng.fileservice.provider.AttachmentStorage;
import com.longfeng.fileservice.provider.AttachmentStorage.PresignResult;
import com.longfeng.fileservice.repo.WbFileLifecycleRepository;
import com.longfeng.fileservice.repo.WbFileRepository;
import com.longfeng.fileservice.support.ObjectKeyBuilder;
import com.longfeng.fileservice.support.SnowflakeIdGenerator;
import java.lang.reflect.Field;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * MockMvc IT for {@link PresignController} — verifies the wire contract that the H5
 * GuestCapture page depends on:
 *
 * <ul>
 *   <li>Path = {@code POST /api/file/presign} (singular, no trailing s)
 *   <li>Request DTO accepts FE snake_case ({@code filename} + {@code content_type})
 *       and tolerates missing optional {@code bytes} / {@code purpose}
 *   <li>Response wire format ships snake_case ({@code image_url}, {@code object_key},
 *       {@code expires_in_sec}) so FE destructure works as written
 * </ul>
 *
 * <p>Uses MockMvc {@code standaloneSetup} — no Spring context, no DB, no MinIO. All
 * collaborators are wired by hand, so the test boots in milliseconds and provides a
 * tight contract gate independent of the rest of the file-service. Pairs with the
 * pure-unit {@link PresignControllerTest} which exercises business behaviour.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PresignControllerWebMvcTest {

    @Mock private AttachmentStorage storage;
    @Mock private WbFileRepository fileRepo;
    @Mock private WbFileLifecycleRepository lifecycleRepo;

    private MockMvc mvc;
    private ObjectMapper json;

    @BeforeEach
    void setUp() {
        ObjectKeyBuilder keyBuilder = new ObjectKeyBuilder();
        SnowflakeIdGenerator idGen = new SnowflakeIdGenerator(8L);
        PresignController controller =
                new PresignController(storage, keyBuilder, idGen, fileRepo, lifecycleRepo);
        setField(controller, "presignTtlMin", 15L);
        setField(controller, "defaultBucket", "wrongbook-dev");
        setField(controller, "iaAfterDays", 30L);
        setField(controller, "archiveAfterDays", 180L);

        mvc = standaloneSetup(controller)
                .setControllerAdvice(new BusinessExceptionAdvice())
                .build();
        json = new ObjectMapper();

        when(storage.name()).thenReturn("minio");
        when(storage.get(anyString(), anyString(), any())).thenReturn("https://minio/get?sig=xyz");
        when(fileRepo.saveAndFlush(any(WbFile.class))).thenAnswer(inv -> inv.getArgument(0));
        when(lifecycleRepo.save(any(WbFileLifecycle.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    @DisplayName("POST /api/file/presign · FE payload (filename + content_type) → 200 + snake_case body")
    void presign_feContract_returnsSnakeCaseJson() throws Exception {
        when(storage.presign(anyString(), anyString(), anyString(), any()))
                .thenReturn(new PresignResult("https://minio/put?sig=abc", "wrongbook/0/202601/0/1_math.jpg", 900L));

        // exact payload shape FE sends from GuestCapture/index.tsx
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("filename", "math.jpg");
        body.put("content_type", "image/jpeg");

        mvc.perform(post("/api/file/presign")
                        .header("X-Idempotency-Key", java.util.UUID.randomUUID().toString())
                        .contentType("application/json")
                        .content(json.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(0))
                // FE destructures these two — they MUST be present at exact paths
                .andExpect(jsonPath("$.data.url").value("https://minio/put?sig=abc"))
                .andExpect(jsonPath("$.data.image_url").value("https://minio/get?sig=xyz"))
                // forward-compat fields — wire format is snake_case
                .andExpect(jsonPath("$.data.method").value("PUT"))
                .andExpect(jsonPath("$.data.object_key").value(org.hamcrest.Matchers.startsWith("wrongbook/")))
                .andExpect(jsonPath("$.data.expires_in_sec").value(900));
    }

    @Test
    @DisplayName("POST /api/file/presign · accepts optional bytes + purpose · still 200")
    void presign_withOptionalBytesAndPurpose_succeeds() throws Exception {
        when(storage.presign(anyString(), anyString(), anyString(), any()))
                .thenReturn(new PresignResult("https://minio/put", "k", 900L));

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("filename", "note.png");
        body.put("content_type", "image/png");
        body.put("bytes", 4_500_000);
        body.put("purpose", "wrongbook");

        mvc.perform(post("/api/file/presign")
                        .header("X-Idempotency-Key", java.util.UUID.randomUUID().toString())
                        .contentType("application/json")
                        .content(json.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.image_url").value("https://minio/get?sig=xyz"));
    }

    @Test
    @DisplayName("POST /api/file/presign · disallowed MIME → BusinessException mapped to 400")
    void presign_mimeNotAllowed_returns400() throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("filename", "a.exe");
        body.put("content_type", "application/exe");

        mvc.perform(post("/api/file/presign")
                        .header("X-Idempotency-Key", java.util.UUID.randomUUID().toString())
                        .contentType("application/json")
                        .content(json.writeValueAsString(body)))
                .andExpect(status().isBadRequest());

        verify(storage, never()).presign(any(), any(), any(), any());
    }

    @Test
    @DisplayName("POST /api/files/presign (legacy plural path) → 404 (path migration enforced)")
    void presign_legacyPluralPath_isNotFound() throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("filename", "math.jpg");
        body.put("content_type", "image/jpeg");

        mvc.perform(post("/api/files/presign")
                        .contentType("application/json")
                        .content(json.writeValueAsString(body)))
                .andExpect(status().isNotFound());
    }

    // ─── SC-01-T01 AC6 · X-Idempotency-Key required ───────────────────────────

    @Test
    @DisplayName("SC-01-T01 AC6 · missing X-Idempotency-Key header → 400 (not 500) + storage never called")
    void presign_missingIdempotencyKeyHeader_returns400() throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("filename", "math.jpg");
        body.put("content_type", "image/jpeg");

        mvc.perform(post("/api/file/presign")
                        // NO X-Idempotency-Key header on purpose
                        .contentType("application/json")
                        .content(json.writeValueAsString(body)))
                .andExpect(status().isBadRequest());

        // AC6 invariant: storage / fileRepo MUST NOT be called when validation fails.
        // This proves no NPE / no 500 leaked from any downstream layer.
        verify(storage, never()).presign(any(), any(), any(), any());
        verify(fileRepo, never()).saveAndFlush(any(WbFile.class));
    }

    @Test
    @DisplayName("SC-01-T01 AC6 · blank X-Idempotency-Key header → 400 (string-blank guard)")
    void presign_blankIdempotencyKeyHeader_returns400() throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("filename", "math.jpg");
        body.put("content_type", "image/jpeg");

        mvc.perform(post("/api/file/presign")
                        .header("X-Idempotency-Key", "   ")
                        .contentType("application/json")
                        .content(json.writeValueAsString(body)))
                .andExpect(status().isBadRequest());

        verify(storage, never()).presign(any(), any(), any(), any());
    }

    // ─── SC-01-T01 AC1 · sha256_hash field is persisted when supplied ────────

    @Test
    @DisplayName("SC-01-T01 AC1 · sha256_hash body field → propagated into saved WbFile")
    void presign_sha256Hash_persistedOnWbFile() throws Exception {
        when(storage.presign(anyString(), anyString(), anyString(), any()))
                .thenReturn(new PresignResult("https://minio/put", "k", 900L));

        // 64-char hex SHA-256 of synthetic content
        String synthSha256 = "a".repeat(64);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("filename", "math.jpg");
        body.put("content_type", "image/jpeg");
        body.put("size", 4_096);          // alias for `bytes`
        body.put("sha256_hash", synthSha256);

        mvc.perform(post("/api/file/presign")
                        .header("X-Idempotency-Key", java.util.UUID.randomUUID().toString())
                        .contentType("application/json")
                        .content(json.writeValueAsString(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.url").value("https://minio/put"));

        org.mockito.ArgumentCaptor<WbFile> captor = org.mockito.ArgumentCaptor.forClass(WbFile.class);
        verify(fileRepo).saveAndFlush(captor.capture());
        WbFile saved = captor.getValue();
        org.assertj.core.api.Assertions.assertThat(saved.getSha256Hash()).isEqualTo(synthSha256);
        // alias `size` ≡ `bytes` proved
        org.assertj.core.api.Assertions.assertThat(saved.getBytes()).isEqualTo(4_096L);
    }

    @Test
    @DisplayName("SC-01-T01 AC1 · sha256 (not 64-char hex) → 400 (Bean Validation @Pattern)")
    void presign_sha256Invalid_returns400() throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("filename", "math.jpg");
        body.put("content_type", "image/jpeg");
        body.put("sha256_hash", "not-hex");

        mvc.perform(post("/api/file/presign")
                        .header("X-Idempotency-Key", java.util.UUID.randomUUID().toString())
                        .contentType("application/json")
                        .content(json.writeValueAsString(body)))
                .andExpect(status().isBadRequest());
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private static void setField(Object target, String fieldName, Object value) {
        try {
            Field f = target.getClass().getDeclaredField(fieldName);
            f.setAccessible(true);
            f.set(target, value);
        } catch (Exception e) {
            throw new RuntimeException("Failed to set field " + fieldName, e);
        }
    }

    /**
     * Minimal advice that turns {@link BusinessException} into HTTP 400, mirroring the
     * production {@code GlobalExceptionHandler} from the common module. Replicated here
     * so {@code standaloneSetup} (which wires no auto-config) still surfaces 400 on
     * validation failures.
     */
    @RestControllerAdvice
    static class BusinessExceptionAdvice {
        @ExceptionHandler(BusinessException.class)
        ResponseEntity<Map<String, Object>> handle(BusinessException ex) {
            int code = ex.errCode() != null ? ex.errCode().code() : ErrCode.VALIDATION_FAILED.code();
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("code", code);
            body.put("message", ex.getMessage());
            return new ResponseEntity<>(body, HttpStatus.BAD_REQUEST);
        }
    }
}
