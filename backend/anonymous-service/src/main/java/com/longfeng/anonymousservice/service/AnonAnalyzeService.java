package com.longfeng.anonymousservice.service;

import com.longfeng.anonymousservice.config.AiAnalysisProperties;
import com.longfeng.anonymousservice.config.AnonRestTemplateConfig;
import com.longfeng.anonymousservice.entity.GuestSession;
import com.longfeng.anonymousservice.repo.GuestSessionRepository;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

/**
 * SC-12-T06 · biz §2B.13 F04 · real forward of the captured image to
 * {@code ai-analysis-service:8083 POST /api/ai/analyze-by-url}.
 *
 * <p>Why this exists: when the guest finishes T04 (presign PUT) + T05 (record
 * objectKey on {@code guest_session.image_tmp_url}) the frontend triggers
 * {@code POST /api/anon/analyze-by-url}. This service:
 * <ol>
 *   <li>Reads {@code guest_session} for the verified anon session id.</li>
 *   <li>Refuses with {@code IMAGE_NOT_UPLOADED} (controller maps to 412) when
 *       {@code image_tmp_url} is still null — the frontend must complete T05
 *       first, otherwise there's no object key to hand to Qianwen.</li>
 *   <li>Mints a MinIO pre-signed GET URL (10 min TTL) from
 *       {@code image_tmp_url} — Qianwen VL is an external vendor and cannot
 *       reach the MinIO instance directly, so we expose a short-lived signed
 *       URL it can curl.</li>
 *   <li>Calls {@code ai-analysis-service POST /api/ai/analyze-by-url} with a
 *       <b>real</b> {@link RestTemplate} (NO MOCK — user iron rule
 *       2026-05-18). The forward body uses camelCase
 *       ({@code taskId, subject, imageUrl}) because the upstream Jackson
 *       defaults reject snake_case (verified live during T06 implementation —
 *       {@code curl} with snake_case keys returns 400, with camelCase returns
 *       202).</li>
 *   <li>On 202 from upstream: advances {@code guest_session.status} from 0
 *       CREATED to 1 ANALYZING and returns {@link AnalyzeOutcome.Kind#SUCCESS}.</li>
 *   <li>On <b>any</b> failure (connection refused, timeout, non-202): returns
 *       {@link AnalyzeOutcome.Kind#AI_SERVICE_FAILURE} (controller maps to
 *       502). The status is <b>NOT</b> advanced — biz §2A.7 L660 mandates "AI
 *       failure does not consume the guest's quota" so a retry against the
 *       same session can still flip 0→1 cleanly.</li>
 * </ol>
 *
 * <p>Task id convention: {@code anon-{anonSessionId}}. Pinned so T07's
 * {@code GET /api/anon/result/{anonQid}} polling endpoint can derive the
 * upstream task id deterministically from the qid path-segment without
 * maintaining an extra mapping table. The upstream
 * {@code AnalyzeController.AnalyzeByUrlReq} treats the task id as opaque, so
 * the {@code "anon-"} prefix is safe (no collision with the registered-user
 * flow which uses UUIDs).
 *
 * <p>Outcome discriminator (rather than thrown exceptions) mirrors
 * {@link AnonQuestionService}'s pattern — the controller does a single
 * {@code switch} on {@link AnalyzeOutcome.Kind} to map HTTP status, keeping
 * exception handling local to the service layer.
 */
@Service
public class AnonAnalyzeService {

    private static final Logger LOG = LoggerFactory.getLogger(AnonAnalyzeService.class);

    /**
     * MinIO presigned GET URL TTL handed to Qianwen. 10 minutes is plenty for
     * the upstream to fetch the image and short enough that a leaked URL
     * expires before a meaningful replay window opens. Aligned with the upper
     * bound of the analyze-by-url SLA (≤ 300ms enqueue + a few seconds for
     * Qianwen to dequeue and fetch).
     */
    private static final long PRESIGNED_GET_TTL_SECONDS = 600L;

    /**
     * Task id prefix that ties the upstream {@code ai-analysis-service} task
     * row back to its originating guest session. Documented as part of the
     * inflight contract so T07 (result polling) can reverse the mapping.
     */
    private static final String TASK_ID_PREFIX = "anon-";

    private final GuestSessionRepository repo;
    private final AnonPresignService presignService;
    private final RestTemplate restTemplate;
    private final AiAnalysisProperties aiProps;

    public AnonAnalyzeService(
            GuestSessionRepository repo,
            AnonPresignService presignService,
            @Qualifier(AnonRestTemplateConfig.BEAN_NAME) RestTemplate restTemplate,
            AiAnalysisProperties aiProps) {
        this.repo = repo;
        this.presignService = presignService;
        this.restTemplate = restTemplate;
        this.aiProps = aiProps;
    }

    /**
     * Kick off analysis for a guest session.
     *
     * @param anonSessionId      filter-injected, NOT trusted from request body
     * @param subject            already pattern-validated upstream (six-subject whitelist)
     * @param requestedImageUrl  optional client-supplied GET URL; service mints
     *                           one from {@code image_tmp_url} when this is null/blank
     * @return outcome the controller maps to an HTTP status
     */
    public AnalyzeOutcome startAnalysis(
            long anonSessionId, String subject, String requestedImageUrl) {

        Optional<GuestSession> opt = repo.findById(anonSessionId);
        if (opt.isEmpty()) {
            // Same defensive 404 path as AnonQuestionService — the filter
            // verified the token but a concurrent sweep could have wiped the row.
            LOG.info("anon_analyze not_found session_id={}", anonSessionId);
            return new AnalyzeOutcome(AnalyzeOutcome.Kind.NOT_FOUND, null);
        }
        GuestSession g = opt.get();

        // (1) image_tmp_url gate · client must have completed T05 first.
        //     Empty string treated as null because PG TIMESTAMPTZ + JPA can
        //     return '' for never-written columns under some drivers; defensive.
        if (g.getImageTmpUrl() == null || g.getImageTmpUrl().isBlank()) {
            LOG.info("anon_analyze image_not_uploaded session_id={}", anonSessionId);
            return new AnalyzeOutcome(AnalyzeOutcome.Kind.IMAGE_NOT_UPLOADED, null);
        }

        // (2) Mint or accept image URL. Frontend MAY pre-mint one for advanced
        //     flows (e.g. cross-CDN), but the common path is server-side mint
        //     from the persisted objectKey.
        String imageUrl = (requestedImageUrl != null && !requestedImageUrl.isBlank())
                ? requestedImageUrl
                : presignService.mintPresignedGet(g.getImageTmpUrl(), PRESIGNED_GET_TTL_SECONDS);

        // (3) Build the upstream task id deterministically · biz §2B.13 F04.
        String taskId = TASK_ID_PREFIX + anonSessionId;

        // (4) Real forward · NO MOCK. The body intentionally uses camelCase
        //     keys (taskId / subject / imageUrl) because the upstream
        //     ai-analysis-service AnalyzeByUrlReq record uses Jackson default
        //     camelCase — verified live: snake_case body returns 400, camelCase
        //     returns 202. Using LinkedHashMap so JSON ordering is stable for
        //     debug logs.
        Map<String, String> body = new LinkedHashMap<>();
        body.put("taskId", taskId);
        body.put("subject", subject);
        body.put("imageUrl", imageUrl);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, String>> entity = new HttpEntity<>(body, headers);

        String url = aiProps.getBaseUrl() + "/api/ai/analyze-by-url";
        try {
            ResponseEntity<Map> resp = restTemplate.exchange(
                    url, HttpMethod.POST, entity, Map.class);
            HttpStatusCode status = resp.getStatusCode();
            if (status.value() != 202) {
                // Non-202 success codes (e.g. upstream silently returned 200
                // OK with a different schema) are treated as failures so the
                // frontend never gets a misleading happy path. Status field is
                // not advanced; the FE polling loop will pick up nothing and
                // surface AI_SERVICE_FAILURE.
                LOG.warn("anon_analyze upstream_unexpected_status session_id={} status={} body={}",
                        anonSessionId, status, resp.getBody());
                return new AnalyzeOutcome(AnalyzeOutcome.Kind.AI_SERVICE_FAILURE, null);
            }
        } catch (RestClientException e) {
            // Catches: connection refused, read timeout, 4xx, 5xx
            // (RestTemplate.exchange wraps HttpClientErrorException +
            // HttpServerErrorException + ResourceAccessException under this
            // umbrella). All map to 502 — the FE retries the analyze call
            // rather than the upstream directly.
            LOG.warn("anon_analyze upstream_failed session_id={} url={} err={}",
                    anonSessionId, url, e.toString());
            return new AnalyzeOutcome(AnalyzeOutcome.Kind.AI_SERVICE_FAILURE, null);
        }

        // (5) Forward succeeded · advance state machine 0 CREATED → 1 ANALYZING.
        //     This is the canonical 0→1 transition (T01 decided T05 does NOT
        //     advance status; T06 is the only writer of state=1).
        g.setStatus((short) 1);
        repo.save(g);
        LOG.info("anon_analyze success session_id={} task_id={} subject={}",
                anonSessionId, taskId, subject);

        return new AnalyzeOutcome(AnalyzeOutcome.Kind.SUCCESS, taskId);
    }

    /** Result discriminator · controller maps {@link Kind} to HTTP status. */
    public static final class AnalyzeOutcome {

        /** Discriminator for the four legal outcomes of {@link #startAnalysis}. */
        public enum Kind {
            /** Session id from token's sub no longer exists (concurrent sweep). */
            NOT_FOUND,
            /** {@code image_tmp_url IS NULL} · client skipped T05. */
            IMAGE_NOT_UPLOADED,
            /** Upstream ai-analysis-service connection refused / timeout / non-202. */
            AI_SERVICE_FAILURE,
            /** Forward succeeded; status advanced 0→1; task id ready for FE polling. */
            SUCCESS,
        }

        private final Kind kind;
        private final String taskId;

        public AnalyzeOutcome(Kind kind, String taskId) {
            this.kind = kind;
            this.taskId = taskId;
        }

        public Kind getKind() { return kind; }
        public String getTaskId() { return taskId; }
    }
}
