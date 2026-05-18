package com.longfeng.anonymousservice.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * SC-12-T06 · {@code POST /api/anon/analyze-by-url} request body (biz §2B.13 F04).
 *
 * <p>Posted after the frontend has uploaded the image (T04 presign + PUT)
 * and registered it server-side (T05 questions write {@code image_tmp_url}).
 * The backend then forwards to {@code ai-analysis-service:8083 POST
 * /api/ai/analyze-by-url} which kicks off the Qianwen-VL pipeline.
 *
 * <p>Validation:
 * <ul>
 *   <li>{@code anonQid} — {@code @NotNull}. The frontend echoes the
 *       {@code anon_qid} it received from the T05 201 response (which equals
 *       {@code guest_session.id}). The controller cross-checks this against
 *       the filter-injected session id and rejects with 403
 *       {@code ANON_SESSION_MISMATCH} on mismatch — defence in depth so a
 *       leaked anonToken cannot trigger analyze for another guest's row.</li>
 *   <li>{@code subject} — {@code @NotNull @Pattern} same six-subject whitelist
 *       as T05 ({@code math|physics|chemistry|english|biology|chinese}). Surfaced
 *       to the upstream {@code ai-analysis-service} so it can pick the right
 *       prompt template.</li>
 *   <li>{@code imageUrl} — optional. The contract allows the FE to either
 *       pass through a pre-minted GET URL (advanced flows) or omit it; on
 *       omission the service generates one with
 *       {@link com.longfeng.anonymousservice.service.AnonPresignService#mintPresignedGet}
 *       from {@code guest_session.image_tmp_url}. Kept lenient on length
 *       ({@code @Size(max=2048)}) since MinIO presigned URLs can be long with
 *       all the query parameters.</li>
 * </ul>
 *
 * <p>The wire shape uses Java/Jackson default camelCase — matches the upstream
 * {@code ai-analysis-service} request body (verified live: that service rejects
 * snake_case fields with 400). The IT pins the camelCase contract.
 */
public record AnonAnalyzeRequest(
        @NotNull Long anonQid,
        @NotNull @Pattern(regexp = "math|physics|chemistry|english|biology|chinese")
        String subject,
        @Size(max = 2048) String imageUrl) {
}
