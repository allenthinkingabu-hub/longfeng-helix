package com.longfeng.anonymousservice.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * SC-12-T06 · {@code POST /api/anon/analyze-by-url} 202 ACCEPTED body.
 *
 * <p>Wire shape uses snake_case so the FE polling loop can reuse the existing
 * serializer used elsewhere in the SC-12 guest flow (mirrors
 * {@link AnonQuestionResponse}). The fields:
 * <ul>
 *   <li>{@code task_id} — taskId opaque to FE; same value the FE will pass to
 *       T07's {@code GET /api/anon/result/{anonQid}} polling endpoint. T06
 *       pins the format {@code anon-{anonSessionId}} so T07 can map back
 *       deterministically without an extra lookup table. (Upstream
 *       ai-analysis-service treats this as an opaque string · documented in
 *       its AnalyzeController.AnalyzeByUrlReq#taskId.)</li>
 *   <li>{@code poll_every} — milliseconds the FE should wait between polls.
 *       1000 (1s) is biz §2B.13 F04's prescribed cadence.</li>
 *   <li>{@code status} — initial state always {@code "ANALYZING"} (T06
 *       advanced {@code guest_session.status} from 0 CREATED to 1 ANALYZING
 *       on a successful forward).</li>
 * </ul>
 */
public record AnonAnalyzeResponse(
        @JsonProperty("task_id") String taskId,
        @JsonProperty("poll_every") int pollEvery,
        String status) {
}
