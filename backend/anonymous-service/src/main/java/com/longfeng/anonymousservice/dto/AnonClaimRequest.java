package com.longfeng.anonymousservice.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * SC-12-T08 · request body for {@code POST /api/anon/claim} — biz §2B.13 F08.
 *
 * <p>Single field: {@code subject}. The anon session id is filter-injected
 * ({@code AnonFilter} writes attribute {@code anonGuestSessionId}); the student
 * id comes from the {@code Authorization: Bearer <jwt>} header. Both are
 * <b>never</b> trusted from the request body — that's how T06 already does it
 * for analyze-by-url and we follow the same defensive pattern here.
 *
 * <p>{@code @Pattern} mirrors the six-subject whitelist already pinned by T05
 * {@code AnonQuestionRequest} and T06 {@code AnonAnalyzeRequest}. Keeping the
 * regex literally identical (not a shared constant) is a deliberate Rule 3
 * Surgical choice — extracting a {@code SubjectPattern} constant now would
 * touch 3 sibling DTOs and is out of T08 scope.
 */
public record AnonClaimRequest(
        @NotBlank
        @Pattern(regexp = "math|physics|chemistry|english|biology|chinese",
                message = "subject must be one of math|physics|chemistry|english|biology|chinese")
        String subject) {
}
