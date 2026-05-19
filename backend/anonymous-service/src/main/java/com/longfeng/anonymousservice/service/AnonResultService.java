package com.longfeng.anonymousservice.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.longfeng.anonymousservice.config.AiAnalysisProperties;
import com.longfeng.anonymousservice.config.AnonRestTemplateConfig;
import com.longfeng.anonymousservice.entity.GuestSession;
import com.longfeng.anonymousservice.repo.GuestSessionRepository;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

/**
 * SC-12-T07 · biz §2B.13 F05 · real polling forward to
 * {@code ai-analysis-service:8083 GET /api/ai/result/{taskId}}.
 *
 * <p>Closes the SC-12 backend read loop. After T06 has fired the analyze and
 * advanced {@code guest_session.status} to 1 ANALYZING, the FE (T09) polls
 * {@code GET /api/anon/result/{anonQid}} at 1 Hz. This service:
 *
 * <ol>
 *   <li>Loads the {@link GuestSession} for the anonSessionId the filter
 *       verified; {@code empty Optional → SESSION_NOT_FOUND}.</li>
 *   <li>Builds the upstream task id deterministically — same {@code "anon-" +
 *       anonSessionId} convention as {@link AnonAnalyzeService}'s forward
 *       step, so the reverse lookup is a closed system with no extra mapping
 *       table.</li>
 *   <li>Calls {@code GET :8083/api/ai/result/{taskId}} with the shared
 *       {@code aiAnalysisRestTemplate}. Connection failures / non-200 codes
 *       short-circuit to {@code AI_SERVICE_FAILURE}.</li>
 *   <li>Reads the upstream wire envelope — verified live during T07 dev:
 *       upstream {@code AnalyzeController.result()} returns HTTP 200 with body
 *       <pre>
 *       {
 *         "status": "ANALYZING" | "DONE" | "FAILED" | "CANCELLED" | "NOT_FOUND",
 *         "subject": "math" | "" | …,
 *         "stem_length": 42,
 *         "chat_model": "qwen-plus" | "",
 *         "ocr_model":  "qwen-vl-max"
 *       }
 *       </pre>
 *       <b>Important deviation from the original TL brief</b>: the brief
 *       expected {@code "RESULT_READY"} but the upstream constant is
 *       {@code STATUS_DONE = "DONE"} ({@code AnalysisTask.java:25}, verified
 *       live by {@code curl :8083/api/ai/result/<unknown>} returning
 *       {@code "NOT_FOUND"}). The mapping uses the upstream truth — see
 *       {@code audits/runs/SC-12-T07/team-1/attempt-1/bugs-found.md} for the
 *       full surfacing.</li>
 *   <li>Status mapping → {@link ResultOutcome.Kind}:
 *       <ul>
 *         <li>{@code "ANALYZING"}  → {@link Kind#ANALYZING} (no state change)</li>
 *         <li>{@code "DONE"}       → {@link Kind#READY} + flip
 *             {@code guest_session.status} 1→2 + persist the full JSON body
 *             into {@code analysis_result_json} via the T07 JSONB fix</li>
 *         <li>{@code "FAILED"}     → {@link Kind#FAILED} + flip
 *             {@code guest_session.status} 1→3 (biz §2A.7 L660 · failure
 *             surfaced to FE)</li>
 *         <li>{@code "CANCELLED"}  → {@link Kind#FAILED} (treat as failure
 *             from the guest's perspective — there's no cancel UX in the
 *             anonymous flow)</li>
 *         <li>{@code "NOT_FOUND"}  → {@link Kind#NOT_FOUND_UPSTREAM} —
 *             upstream task row absent (race: FE polled before T06's analyze
 *             finished writing, or the row was swept). Controller maps to
 *             404 so the FE can either retry or bail.</li>
 *         <li>anything else / null → {@link Kind#AI_SERVICE_FAILURE} (safe
 *             default — we never silently downgrade an unknown status to
 *             READY)</li>
 *       </ul></li>
 *   <li>Persists only when the state machine moves (READY / FAILED). Idempotent
 *       polls in ANALYZING / NOT_FOUND_UPSTREAM never write the row — keeps
 *       the FE 1 Hz tick cheap and the PG WAL quiet.</li>
 * </ol>
 *
 * <p>NO MOCK iron rule (user · 2026-05-18 · same as T06): tests forward to the
 * real {@code ai-analysis-service:8083}; no WireMock, no MockWebServer, no
 * {@code @MockBean RestTemplate}. The 502 path IT
 * ({@code result_when_ai_service_down_returns_502}) lives in a sibling
 * IT class that overrides {@code anon.ai-analysis.base-url} at boot.
 */
@Service
public class AnonResultService {

    private static final Logger LOG = LoggerFactory.getLogger(AnonResultService.class);

    /**
     * Task id prefix · same convention as {@link AnonAnalyzeService#TASK_ID_PREFIX}.
     * Pinned in two places (here + the forward service) is acceptable: extracting
     * a constant into a shared util would force a circular import for a single
     * 5-character string. The convention is documented in biz §2B.13 F04/F05
     * comments as a contract between the forward and the result endpoints.
     */
    private static final String TASK_ID_PREFIX = "anon-";

    /** Upstream wire status constants — mirror {@code AnalysisTask.STATUS_*}. */
    private static final String UPSTREAM_ANALYZING = "ANALYZING";
    private static final String UPSTREAM_DONE      = "DONE";
    private static final String UPSTREAM_FAILED    = "FAILED";
    private static final String UPSTREAM_CANCELLED = "CANCELLED";
    private static final String UPSTREAM_NOT_FOUND = "NOT_FOUND";

    private final GuestSessionRepository repo;
    private final RestTemplate restTemplate;
    private final AiAnalysisProperties aiProps;
    private final ObjectMapper objectMapper;

    public AnonResultService(
            GuestSessionRepository repo,
            @Qualifier(AnonRestTemplateConfig.BEAN_NAME) RestTemplate restTemplate,
            AiAnalysisProperties aiProps,
            ObjectMapper objectMapper) {
        this.repo = repo;
        this.restTemplate = restTemplate;
        this.aiProps = aiProps;
        this.objectMapper = objectMapper;
    }

    /**
     * Poll the upstream for the analysis result of one guest session.
     *
     * @param anonSessionId filter-injected, NOT trusted from request path
     * @return outcome the controller maps to an HTTP response
     */
    public ResultOutcome getResult(long anonSessionId) {
        Optional<GuestSession> opt = repo.findById(anonSessionId);
        if (opt.isEmpty()) {
            // Defensive — filter verified the token but the row could have
            // been swept (expires_at past · biz §4.10 EXPIRED) between filter
            // and service. Surface as 404 SESSION_NOT_FOUND.
            LOG.info("anon_result session_not_found session_id={}", anonSessionId);
            return ResultOutcome.empty(ResultOutcome.Kind.SESSION_NOT_FOUND);
        }
        GuestSession g = opt.get();
        String taskId = TASK_ID_PREFIX + anonSessionId;
        String url = aiProps.getBaseUrl() + "/api/ai/result/" + taskId;

        @SuppressWarnings("rawtypes")
        ResponseEntity<Map> resp;
        try {
            resp = restTemplate.getForEntity(url, Map.class);
        } catch (RestClientException e) {
            // Real RestClientException covers connection refused / read
            // timeout / 4xx / 5xx — controller maps to 502, FE retries on
            // the next 1 Hz tick.
            LOG.warn("anon_result upstream_failed session_id={} url={} err={}",
                    anonSessionId, url, e.toString());
            return ResultOutcome.empty(ResultOutcome.Kind.AI_SERVICE_FAILURE);
        }

        HttpStatusCode statusCode = resp.getStatusCode();
        if (statusCode.value() != 200) {
            // Upstream protocol violation (non-200 success codes etc.) →
            // treat as service failure rather than synthesising a body.
            LOG.warn("anon_result upstream_unexpected_status session_id={} status={}",
                    anonSessionId, statusCode);
            return ResultOutcome.empty(ResultOutcome.Kind.AI_SERVICE_FAILURE);
        }
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) resp.getBody();
        if (body == null) {
            LOG.warn("anon_result upstream_empty_body session_id={}", anonSessionId);
            return ResultOutcome.empty(ResultOutcome.Kind.AI_SERVICE_FAILURE);
        }

        String upstreamStatus = body.get("status") instanceof String s ? s : "";
        String subject = body.get("subject") instanceof String sub ? sub : "";
        Integer stemLength = body.get("stem_length") instanceof Number n ? n.intValue() : null;
        String chatModel = body.get("chat_model") instanceof String cm ? cm : "";
        String ocrModel  = body.get("ocr_model")  instanceof String om ? om : "";

        ResultOutcome.Kind kind;
        boolean shouldPersistJson = false;
        switch (upstreamStatus) {
            case UPSTREAM_ANALYZING -> kind = ResultOutcome.Kind.ANALYZING;
            case UPSTREAM_DONE -> {
                kind = ResultOutcome.Kind.READY;
                // Advance state machine 1 ANALYZING → 2 RESULT_READY · biz §4.10.
                // Persist the entire upstream body as JSONB so T08 (claim) can
                // pick it apart later without re-polling upstream. The JSONB fix
                // applied to GuestSession.analysisResultJson in this same task
                // makes this assignment safe (no SQLState 42804).
                g.setStatus((short) 2);
                shouldPersistJson = true;
            }
            case UPSTREAM_FAILED, UPSTREAM_CANCELLED -> {
                // CANCELLED is folded into FAILED from the guest's POV — biz
                // doesn't define a cancel UX for the anonymous flow (no claim
                // button bound to it). Treating both as terminal failure keeps
                // the FE state machine simple.
                kind = ResultOutcome.Kind.FAILED;
                g.setStatus((short) 3);
            }
            case UPSTREAM_NOT_FOUND -> kind = ResultOutcome.Kind.NOT_FOUND_UPSTREAM;
            default -> {
                LOG.warn("anon_result unknown_upstream_status session_id={} status={}",
                        anonSessionId, upstreamStatus);
                kind = ResultOutcome.Kind.AI_SERVICE_FAILURE;
            }
        }

        if (shouldPersistJson) {
            try {
                g.setAnalysisResultJson(objectMapper.writeValueAsString(body));
            } catch (JsonProcessingException e) {
                // Extremely cold path · the upstream body is a LinkedHashMap of
                // primitives/Strings (Jackson can always serialize that). If we
                // ever get here it's a JVM bug. Log + skip the JSON write but
                // still flip status — the FE shouldn't get stuck in ANALYZING
                // forever just because we couldn't serialise our own state.
                LOG.warn("anon_result json_serialise_failed session_id={} err={}",
                        anonSessionId, e.toString());
            }
        }

        if (kind == ResultOutcome.Kind.READY || kind == ResultOutcome.Kind.FAILED) {
            // Only write when the state machine actually moves. Each guest
            // session is polled 1 Hz × 30 s by the FE; persisting on every
            // ANALYZING tick would burn 30 unnecessary UPDATEs per guest.
            repo.save(g);
        }

        LOG.info("anon_result session_id={} kind={} upstream_status={}",
                anonSessionId, kind, upstreamStatus);

        // P04 游客态 (spec line 216 + biz §F05) 需 stem/reasonMarkdown/steps/correction
        // 渲染结果详情. DONE 时多调一次 ai-service /api/ai/{taskId}/answer 拉完整 ·
        // 失败时降级返 5 字段版 (不卡 polling).
        if (kind == ResultOutcome.Kind.READY) {
            try {
                String answerUrl = aiProps.getBaseUrl() + "/api/ai/" + taskId + "/answer";
                @SuppressWarnings("rawtypes")
                ResponseEntity<Map> ansResp = restTemplate.getForEntity(answerUrl, Map.class);
                if (ansResp.getStatusCode().value() == 200 && ansResp.getBody() != null) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> ans = (Map<String, Object>) ansResp.getBody();
                    String stem = ans.get("stem") instanceof String s ? s : "";
                    String reason = ans.get("reasonMarkdown") instanceof String r ? r : "";
                    @SuppressWarnings("unchecked")
                    java.util.List<java.util.Map<String, Object>> steps =
                            ans.get("steps") instanceof java.util.List<?> l
                                    ? (java.util.List<java.util.Map<String, Object>>) (java.util.List<?>) l
                                    : java.util.Collections.emptyList();
                    // correction 取最后一步的 formula > text 兜底
                    String correction = "";
                    if (!steps.isEmpty()) {
                        java.util.Map<String, Object> last = steps.get(steps.size() - 1);
                        if (last != null) {
                            Object f = last.get("formula");
                            Object t = last.get("text");
                            if (f instanceof String fs && !fs.isBlank()) correction = fs;
                            else if (t instanceof String ts) correction = ts;
                        }
                    }
                    return new ResultOutcome(kind, subject, stemLength, chatModel, ocrModel,
                            stem, reason, steps, correction);
                }
                LOG.info("anon_result answer_fetch_non200 session_id={} status={}",
                        anonSessionId, ansResp.getStatusCode());
            } catch (RestClientException e) {
                // 降级 · /answer 拉失败不阻塞 status=READY · FE 收到 5 字段也能渲染基本信息
                LOG.warn("anon_result answer_fetch_failed session_id={} err={}",
                        anonSessionId, e.toString());
            }
        }

        return new ResultOutcome(kind, subject, stemLength, chatModel, ocrModel);
    }

    /** Discriminator + payload fields the controller maps to a JSON response. */
    public static final class ResultOutcome {

        /** Discriminator for the six legal outcomes of {@link #getResult(long)}. */
        public enum Kind {
            /** Filter verified token but {@code guest_session} row gone → 404. */
            SESSION_NOT_FOUND,
            /** Upstream still inferring · ANALYZING → 200 {@code {status:ANALYZING}}. */
            ANALYZING,
            /** Upstream DONE · row updated to status=2 · 200 {@code {status:READY, result:{…}}}. */
            READY,
            /** Upstream FAILED / CANCELLED · row updated to status=3 · 200 {@code {status:FAILED, error_code}}. */
            FAILED,
            /** Upstream task row absent (race) → 404 {@code {code:UPSTREAM_TASK_NOT_FOUND}}. */
            NOT_FOUND_UPSTREAM,
            /** RestTemplate error / non-200 / unknown status → 502. */
            AI_SERVICE_FAILURE,
        }

        private final Kind kind;
        private final String subject;
        private final Integer stemLength;
        private final String chatModel;
        private final String ocrModel;
        /** Full AI answer fields · DONE 时由 AnonResultService 额外拉 ai-service /answer 填充. */
        private final String stem;
        private final String reasonMarkdown;
        private final java.util.List<java.util.Map<String, Object>> steps;
        private final String correction;

        public ResultOutcome(Kind kind, String subject, Integer stemLength,
                             String chatModel, String ocrModel,
                             String stem, String reasonMarkdown,
                             java.util.List<java.util.Map<String, Object>> steps,
                             String correction) {
            this.kind = kind;
            this.subject = subject;
            this.stemLength = stemLength;
            this.chatModel = chatModel;
            this.ocrModel = ocrModel;
            this.stem = stem;
            this.reasonMarkdown = reasonMarkdown;
            this.steps = steps;
            this.correction = correction;
        }

        /** 兼容: 老 5 字段构造 · 仍可用 · 新字段全 null. */
        public ResultOutcome(Kind kind, String subject, Integer stemLength,
                             String chatModel, String ocrModel) {
            this(kind, subject, stemLength, chatModel, ocrModel, null, null, null, null);
        }

        static ResultOutcome empty(Kind kind) {
            return new ResultOutcome(kind, null, null, null, null);
        }

        public Kind getKind()              { return kind; }
        public String getSubject()         { return subject; }
        public Integer getStemLength()     { return stemLength; }
        public String getChatModel()       { return chatModel; }
        public String getOcrModel()        { return ocrModel; }
        public String getStem()            { return stem; }
        public String getReasonMarkdown()  { return reasonMarkdown; }
        public java.util.List<java.util.Map<String, Object>> getSteps() { return steps; }
        public String getCorrection()      { return correction; }
    }

}
