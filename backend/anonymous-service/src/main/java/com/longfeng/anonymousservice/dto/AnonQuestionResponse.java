package com.longfeng.anonymousservice.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.OffsetDateTime;

/**
 * SC-12-T05 · {@code POST /api/anon/questions} 201 response.
 *
 * <p>Wire shape (snake_case via {@code @JsonProperty} so the TS frontend can
 * deserialise directly without an adapter — mirrors {@link AnonPresignResponse}
 * convention):
 * <pre>
 * {
 *   "anon_qid": 123456789,
 *   "claim_window": {
 *     "expires_at": "2026-05-25T03:15:00Z"
 *   }
 * }
 * </pre>
 *
 * <p>{@code anon_qid} reuses the {@code guest_session.id} (biz §2B.13 F04 — a
 * guest session IS the question for T05 purposes; T06+ may introduce a
 * separate {@code anonymous_question} row, but T05's wire contract pins
 * {@code anon_qid == anonSessionId} so the frontend doesn't need to refactor
 * later). {@code claim_window.expires_at} is the same column as
 * {@code guest_session.expires_at} (the T+7d soft delete deadline), exposed
 * so the frontend can render "claim before X" countdown without a separate
 * round-trip.
 */
public record AnonQuestionResponse(
        @JsonProperty("anon_qid") Long anonQid,
        @JsonProperty("claim_window") ClaimWindow claimWindow) {

    /**
     * Nested record for the {@code claim_window} JSON object. Carved out so
     * the JSON shape stays {@code {anon_qid, claim_window:{expires_at}}} and a
     * future T07 (claim) can extend with more fields (e.g. {@code remaining_seconds})
     * without breaking wire compatibility.
     */
    public record ClaimWindow(
            @JsonProperty("expires_at") OffsetDateTime expiresAt) {
    }
}
