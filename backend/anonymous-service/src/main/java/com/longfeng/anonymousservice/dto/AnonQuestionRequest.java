package com.longfeng.anonymousservice.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * SC-12-T05 · {@code POST /api/anon/questions} request body (biz §2B.13 F04).
 *
 * <p>Posted by the frontend right after a successful PUT to the pre-signed URL
 * minted by T04. Server persists {@code objectKey} into
 * {@code guest_session.image_tmp_url} and (later, in T06) kicks off the AI
 * analysis pipeline. T05 intentionally does NOT advance
 * {@code guest_session.status} — biz §4.10 status enum has no
 * {@code UPLOADED} state, so the row stays at {@code 0 CREATED} until T06's
 * analyze-by-url flip to {@code 1 ANALYZING}.
 *
 * <p>Validation strategy (mirrors {@link AnonPresignRequest} idiom):
 * <ul>
 *   <li>{@code objectKey} — {@code @NotBlank @Size(max=512)} mirrors DDL
 *       {@code guest_session.image_tmp_url VARCHAR(512)} so a row that would
 *       otherwise truncate at the DB layer is rejected up-front with 400.</li>
 *   <li>{@code sha256Hash} — optional {@code @Size(max=128)}; P0 does NOT
 *       verify the hash (it's frontend audit trail only · T06+ may verify by
 *       fetching the object back and computing SHA-256 server-side).</li>
 *   <li>{@code subject} — {@code @NotBlank @Pattern} locks to the six biz
 *       subjects (math/physics/chemistry/english/biology/chinese). DDL does
 *       NOT have a subject column on {@code guest_session}; T06 will fold the
 *       subject into {@code analysis_result_json}. T05 only validates and logs.</li>
 *   <li>{@code consentAt} — optional ISO-8601 string; the server does NOT
 *       trust this client-side timestamp (biz §13 minor compliance forbids
 *       client clock as evidence). The authoritative consent timestamp lives
 *       in {@code guest_session.consent_at} (written by T02). T05 verifies
 *       the DB column is non-null and ignores this body field for the actual
 *       gate decision — it's accepted for forward-compatibility only.</li>
 * </ul>
 */
public record AnonQuestionRequest(
        @NotBlank @Size(max = 512) String objectKey,
        @Size(max = 128) String sha256Hash,
        @NotBlank @Pattern(regexp = "math|physics|chemistry|english|biology|chinese")
        String subject,
        String consentAt) {
}
