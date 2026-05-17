package com.longfeng.anonymousservice.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.longfeng.anonymousservice.dto.LandingKpiDto;
import com.longfeng.anonymousservice.dto.LandingSampleDto;
import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.fasterxml.jackson.core.type.TypeReference;

/**
 * SC-11-T01 · P-LANDING (anonymous hero page) read-only endpoints.
 *
 * <ul>
 *   <li>{@code GET /api/landing/samples?bucket=<key>} — 3 canned wrongbook
 *       analysis examples per A/B bucket. Static JSON loaded once at startup,
 *       not from DB. Bucket whitelist: {@code default}, {@code variant_b}.
 *       Unknown buckets fall back to {@code default}.
 *   <li>{@code GET /api/landing/kpi} — three vanity counters (cumulative
 *       analyses / daily / happy users). In-memory constants in P0; P1 may
 *       swap to a Doris projection without changing wire shape.
 * </ul>
 *
 * <p><b>biz §2B.12 key invariant</b>: anonymous access (no JWT required, no
 * /api/auth/* coupling); responses MUST advertise {@code Cache-Control:
 * public, max-age=3600} + {@code Vary: bucket} so the CDN can shoulder the
 * traffic. P95 ≤ 50ms (memory read + Jackson serialise).
 *
 * <p>Does NOT touch the SC-00-T01-T02 {@code SessionResolveController} —
 * a separate {@code @RestController} bean in the same package, mounted on
 * {@code POST /api/session/resolve}.
 */
@RestController
@RequestMapping("/api/landing")
public class LandingController {

    private static final Logger LOG = LoggerFactory.getLogger(LandingController.class);

    /** Whitelisted A/B buckets — anything else falls back to "default". */
    private static final Set<String> KNOWN_BUCKETS = Set.of("default", "variant_b");

    private static final String DEFAULT_BUCKET = "default";

    /**
     * biz §10.7 — in-memory P0 constants. Wire shape locked by
     * {@code LandingKpiResponseSchema} (api-contracts).
     */
    private static final LandingKpiDto KPI_SNAPSHOT =
            new LandingKpiDto(12_500_000L, 84_000L, 320_000L);

    private final ObjectMapper objectMapper;

    /**
     * bucket -> 3 samples; loaded once at startup. Map is effectively immutable
     * after {@link #loadSamples()} — exposed values are immutable {@code List}s.
     */
    private Map<String, List<LandingSampleDto>> samplesByBucket;

    public LandingController(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    void loadSamples() throws IOException {
        this.samplesByBucket = Map.of(
                "default", readBucket("landing/default.json"),
                "variant_b", readBucket("landing/variant_b.json"));
        LOG.info("landing_samples_loaded buckets={} default_count={} variant_b_count={}",
                samplesByBucket.keySet(),
                samplesByBucket.get("default").size(),
                samplesByBucket.get("variant_b").size());
    }

    private List<LandingSampleDto> readBucket(String classpath) throws IOException {
        try (InputStream in = new ClassPathResource(classpath).getInputStream()) {
            List<LandingSampleDto> parsed = objectMapper.readValue(
                    in, new TypeReference<List<LandingSampleDto>>() {});
            return List.copyOf(parsed);
        }
    }

    /**
     * GET /api/landing/samples?bucket=<key> — 3 LandingSample JSON objects.
     *
     * <p>biz §10.7 contract: array-of-objects (NOT an envelope). Cache-Control
     * + Vary headers allow CDN public caching while keeping bucket variants
     * separate.
     */
    @GetMapping(value = "/samples", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<LandingSampleDto>> samples(
            @RequestParam(value = "bucket", required = false, defaultValue = DEFAULT_BUCKET)
                    String bucket) {
        String resolved = KNOWN_BUCKETS.contains(bucket) ? bucket : DEFAULT_BUCKET;
        List<LandingSampleDto> body = samplesByBucket.get(resolved);
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "public, max-age=3600")
                .header(HttpHeaders.VARY, "bucket")
                .body(body);
    }

    /**
     * GET /api/landing/kpi — three vanity counters. Static for P0; same
     * Cache-Control header.
     */
    @GetMapping(value = "/kpi", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<LandingKpiDto> kpi() {
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "public, max-age=3600")
                .body(KPI_SNAPSHOT);
    }
}
