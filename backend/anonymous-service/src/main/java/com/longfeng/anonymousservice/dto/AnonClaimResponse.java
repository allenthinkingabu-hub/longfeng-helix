package com.longfeng.anonymousservice.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.OffsetDateTime;

/**
 * SC-12-T08 · response body for {@code POST /api/anon/claim} — biz §2B.13 F08.
 *
 * <p>Field-name mapping is explicit so wire keys stay snake_case for the FE
 * (the H5 H5-side anon-claim client expects {@code claimed_question_id}, not
 * the Jackson default {@code claimedQuestionId}). The same {@code @JsonProperty}
 * pattern is used by {@link AnonAnalyzeResponse} ({@code task_id} / {@code
 * poll_every}), so the wire convention is consistent across SC-12.
 *
 * <p>{@code claimedQuestionId} is sent as a {@link String} — the upstream
 * wrongbook-service emits qid as a JSON string ({@code data.qid}), even though
 * the row's PK is BIGINT. Returning it as a String preserves whatever the
 * upstream encoded and avoids a needless parse round-trip; the FE never
 * arithmetics on the qid anyway.
 */
public record AnonClaimResponse(
        @JsonProperty("claimed_question_id") String claimedQuestionId,
        @JsonProperty("claimed_at") OffsetDateTime claimedAt,
        @JsonProperty("anon_session_id") Long anonSessionId,
        @JsonProperty("student_id") Long studentId) {
}
