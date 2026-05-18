package com.longfeng.anonymousservice.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * SC-12-T04 · {@code POST /api/anon/file/presign} request body.
 *
 * <p>Mirrors {@code file-service}' {@code PresignReq} wire shape but is a
 * separate type to keep the two services' Jackson model namespaces disjoint.
 * The {@code purpose} field is locked to {@code GUEST_CAPTURE} (biz §2B.13 F03)
 * — any other value short-circuits to 400 via {@code @Pattern}.
 *
 * <p>Validation strategy ({@code @Valid} fires on controller entry):
 * <ul>
 *   <li>{@code mime} — regex {@code image/(jpeg|png)} (whitelisted MIME).</li>
 *   <li>{@code size} — {@code [1, 10485760]} byte range, inclusive (10 MiB).</li>
 *   <li>{@code filename} — non-blank with a 256-char ceiling to defend the
 *       object-key composition from absurd input.</li>
 *   <li>{@code sha256Hash} — optional (no annotation); P0 doesn't verify.</li>
 * </ul>
 */
public record AnonPresignRequest(
        @NotBlank @Size(max = 256) String filename,
        @NotBlank @Pattern(regexp = "image/(jpeg|png)") String mime,
        @NotNull @Min(1) @Max(10_485_760) Long size,
        String sha256Hash,
        @NotBlank @Pattern(regexp = "GUEST_CAPTURE") String purpose) {
}
