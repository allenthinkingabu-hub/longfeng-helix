package com.longfeng.anonymousservice.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/**
 * SC-12-T09 · biz §2B.13 / §2A.3.2 / §2A.7 — daily quota gate for guest analyze.
 *
 * <p>Two independent buckets keyed by (date, axis) in Redis:
 * <ul>
 *   <li>{@code rate:guest:device:{deviceFp}:{yyyy-MM-dd}} — 1/day per device,
 *       biz §2A.3.2 "单设备单日硬上限 1 次".</li>
 *   <li>{@code rate:guest:ip:{ipHash}:{yyyy-MM-dd}} — 10/day per IP, biz §2B.13
 *       "IP bucket" (defence against device_fp tampering — sealing the upper
 *       bound when a single network egress mints 11+ fingerprints).</li>
 * </ul>
 *
 * <p><b>Date partitioning is Asia/Shanghai</b> (biz §2A.7 calendar reset).
 * Using {@link ZoneId#of(String) "Asia/Shanghai"} rather than the JVM default
 * because the production JVM runs in UTC; without the explicit zone the bucket
 * would reset at 08:00 CST every morning and let device A re-fire 8 hours
 * early. The IT case {@code retry_after_header_value_matches_seconds_to_midnight_shanghai}
 * pins this.
 *
 * <p>Two-phase API by design:
 * <ul>
 *   <li>{@link #check(String, String)} returns {@link QuotaCheckResult.Kind}
 *       <b>before</b> we burn AI credits. If either bucket is full the caller
 *       short-circuits with HTTP 429 and never touches the upstream — saves
 *       Qianwen tokens.</li>
 *   <li>{@link #increment(String, String)} is called <b>only after</b> the
 *       upstream returns 202 ACCEPTED. biz §2A.7 L660 "AI failure does not
 *       consume the guest's quota" — incrementing pre-flight would punish a
 *       guest for an upstream outage. The order matches the T06 status flip
 *       (status=1 ANALYZING only after 202).</li>
 * </ul>
 *
 * <p><b>Fail-open on Redis errors</b>. If Redis is unreachable / errors out
 * we log + return OK rather than 500. P0 design decision (user 2026-05-18):
 * a broken Redis must not block the entire guest flow — biz §4.10's
 * {@code guest_rate_bucket} DB fallback is a P1 deliverable. Mirrors the
 * fail-open posture used by {@link ShareTokenService#lookup}'s revoked-set
 * check (swallow Redis ex → continue) so the codebase's Redis fragility story
 * is consistent across services.
 *
 * <p>Read-then-write (no atomic GET+INCR) is intentional: a Lua/MULTI guard
 * would close the TOCTOU window where 11 parallel requests can all see
 * {@code ipCount=9} and all pass {@code check}, then collectively bump the
 * counter to 20 in {@code increment}. P0 accepts this — the bucket is daily
 * (24h horizon), so under heavy concurrent abuse the effective ceiling
 * floats to {@code ~limit + concurrency-1}; the IT's 11th-call assertion
 * uses sequential calls and is deterministic. P1 will tighten to {@code
 * INCRBY 1} returning the new count and only then decide DEVICE/IP_EXHAUSTED.
 *
 * <p>IP hashing: SHA-256 truncated to 16 hex chars (first 8 bytes). The
 * field is privacy-relevant — storing raw {@code 203.0.113.42} in Redis +
 * application logs makes the bucket a de-facto PII store. 8-byte truncation
 * keeps the keyspace at {@code 2^64} (zero realistic collisions for our
 * traffic) while making the value un-deanonymizable without a brute-force
 * lookup over the full IPv4/IPv6 space.
 */
@Service
public class AnonQuotaService {

    private static final Logger LOG = LoggerFactory.getLogger(AnonQuotaService.class);

    /**
     * Daily reset zone — biz §2A.7 anchors quota on Beijing calendar day.
     * Package-visible so the IT can assert Retry-After arithmetic against the
     * same zone without re-deriving it from a magic string.
     */
    public static final ZoneId TZ = ZoneId.of("Asia/Shanghai");

    /** biz §2A.3.2 "单设备单日硬上限 1 次". */
    public static final long DEVICE_LIMIT_PER_DAY = 1L;

    /** biz §2B.13 "IP bucket 10/day". */
    public static final long IP_LIMIT_PER_DAY = 10L;

    /** Redis key prefixes — public for IT assertions (no magic strings in tests). */
    public static final String KEY_DEVICE_PREFIX = "rate:guest:device:";
    public static final String KEY_IP_PREFIX = "rate:guest:ip:";

    private final StringRedisTemplate redis;

    public AnonQuotaService(StringRedisTemplate redis) {
        this.redis = redis;
    }

    /**
     * Pre-flight quota check. Called <b>before</b> the upstream forward so a
     * 429 never costs AI credits.
     *
     * @param deviceFp the persisted {@code guest_session.device_fp} — server-side
     *                 only, not a client header (a client cannot launder a fresh
     *                 device_fp through a stolen anonToken)
     * @param ipHash   {@link #hashIp(String)} of the {@code HttpServletRequest#getRemoteAddr}
     * @return DEVICE_EXHAUSTED / IP_EXHAUSTED with retryAfterSec set, or OK
     */
    public QuotaCheckResult check(String deviceFp, String ipHash) {
        LocalDate today = LocalDate.now(TZ);
        String deviceKey = deviceKey(deviceFp, today);
        String ipKey = ipKey(ipHash, today);
        try {
            long deviceCount = parseLongOrZero(redis.opsForValue().get(deviceKey));
            long ipCount = parseLongOrZero(redis.opsForValue().get(ipKey));
            long retryAfterSec = secondsToMidnight(today);

            // Device bucket checked first — gives the FE a more actionable
            // 429 code (the user knows it's a per-device limit, not a network
            // limit) when both buckets are exhausted at once.
            if (deviceCount >= DEVICE_LIMIT_PER_DAY) {
                LOG.info("quota_exhausted_device deviceFp={} count={} retryAfter={}s",
                        deviceFp, deviceCount, retryAfterSec);
                return new QuotaCheckResult(QuotaCheckResult.Kind.DEVICE_EXHAUSTED, retryAfterSec);
            }
            if (ipCount >= IP_LIMIT_PER_DAY) {
                LOG.info("quota_exhausted_ip ipHash={} count={} retryAfter={}s",
                        ipHash, ipCount, retryAfterSec);
                return new QuotaCheckResult(QuotaCheckResult.Kind.IP_EXHAUSTED, retryAfterSec);
            }
            return new QuotaCheckResult(QuotaCheckResult.Kind.OK, 0L);
        } catch (RuntimeException e) {
            // Fail-open · see class javadoc. RuntimeException covers
            // RedisConnectionFailureException, RedisCommandTimeoutException,
            // and the generic DataAccessResourceFailureException Lettuce
            // emits on connection-refused.
            LOG.warn("quota_check_failed deviceFp={} ipHash={} reason={} · fail-open",
                    deviceFp, ipHash, e.getClass().getSimpleName());
            return new QuotaCheckResult(QuotaCheckResult.Kind.OK, 0L);
        }
    }

    /**
     * Bump both counters · called after the upstream forward returns 202.
     * EXPIRE is set to {@link #secondsToMidnight(LocalDate)} so the keys
     * naturally vanish at the next Beijing midnight (no scheduled cleaner
     * needed).
     *
     * <p>Atomic INCR is fine even when called from concurrent threads — the
     * Lettuce/Redis pair guarantees per-key INCR atomicity. {@link
     * StringRedisTemplate#expire} is called separately because Redis does
     * not have a single command for INCR-then-EXPIRE-if-new; we set it on
     * every call which is harmless (re-setting TTL on an existing key is
     * idempotent).
     */
    public void increment(String deviceFp, String ipHash) {
        LocalDate today = LocalDate.now(TZ);
        String deviceKey = deviceKey(deviceFp, today);
        String ipKey = ipKey(ipHash, today);
        long ttlSec = secondsToMidnight(today);
        try {
            redis.opsForValue().increment(deviceKey);
            redis.expire(deviceKey, Duration.ofSeconds(ttlSec));
            redis.opsForValue().increment(ipKey);
            redis.expire(ipKey, Duration.ofSeconds(ttlSec));
        } catch (RuntimeException e) {
            // Best-effort — if Redis blips between check() and increment(),
            // we'd rather let the guest's analysis proceed (it's already
            // started upstream) than 500 here. The bucket will heal on
            // subsequent successful INCRs.
            LOG.warn("quota_increment_failed deviceFp={} ipHash={} reason={}",
                    deviceFp, ipHash, e.getClass().getSimpleName());
        }
    }

    /**
     * Deanonymizing-resistant IP key. SHA-256 truncated to first 8 bytes
     * (16 hex chars) keeps the value space at 2^64 — collision probability
     * over our daily traffic is negligible, but the truncation forecloses
     * trivial rainbow-table reversal.
     *
     * <p>{@code null}/blank yields the sentinel {@code "_no_ip_"} — the
     * controller occasionally sees this when running behind a misconfigured
     * gateway. Treating those as a single shared bucket is intentional: it
     * still rate-limits the misconfig path without leaking nulls into the
     * key namespace.
     */
    public static String hashIp(String clientIp) {
        if (clientIp == null || clientIp.isBlank()) {
            return "_no_ip_";
        }
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(clientIp.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(16);
            for (int i = 0; i < 8; i++) {
                sb.append(String.format("%02x", hash[i]));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            // Effectively unreachable on a JRE — every JDK ships SHA-256.
            // Returning a stable sentinel rather than throwing keeps the
            // quota gate available even in this absurd scenario.
            LOG.warn("hashIp_no_sha256 · falling back to sentinel");
            return "_hash_failed_";
        }
    }

    private static String deviceKey(String deviceFp, LocalDate today) {
        return KEY_DEVICE_PREFIX + deviceFp + ":" + today;
    }

    private static String ipKey(String ipHash, LocalDate today) {
        return KEY_IP_PREFIX + ipHash + ":" + today;
    }

    private static long parseLongOrZero(String v) {
        if (v == null) {
            return 0L;
        }
        try {
            return Long.parseLong(v);
        } catch (NumberFormatException e) {
            // A corrupt key (manually edited via redis-cli, say) shouldn't
            // brick the gate. Treat as zero — the next INCR will overwrite
            // the value with a clean long.
            LOG.warn("quota_value_corrupt v={} · treating as 0", v);
            return 0L;
        }
    }

    /**
     * Seconds remaining until next Asia/Shanghai midnight — used both as the
     * Redis EXPIRE TTL and as the HTTP {@code Retry-After} header value.
     *
     * <p>Computed via {@link ChronoUnit#SECONDS} between {@code now(TZ)} and
     * {@code (today+1d).atStartOfDay(TZ)}. Daylight-saving safe by design —
     * Asia/Shanghai has no DST shifts so the arithmetic is a clean 86_400
     * delta; the {@link ZonedDateTime} math is included in case the zone is
     * ever swapped.
     */
    public static long secondsToMidnight(LocalDate today) {
        ZonedDateTime now = ZonedDateTime.now(TZ);
        ZonedDateTime tomorrowStart = today.plusDays(1).atStartOfDay(TZ);
        return ChronoUnit.SECONDS.between(now, tomorrowStart);
    }

    /** Result discriminator · controller maps to HTTP 429 / pass-through. */
    public static final class QuotaCheckResult {

        public enum Kind {
            /** Both buckets under limit · forward upstream. */
            OK,
            /** {@code rate:guest:device:*} bucket ≥ 1 · 429 QUOTA_EXHAUSTED_DEVICE. */
            DEVICE_EXHAUSTED,
            /** {@code rate:guest:ip:*} bucket ≥ 10 · 429 QUOTA_EXHAUSTED_IP. */
            IP_EXHAUSTED
        }

        private final Kind kind;
        private final long retryAfterSec;

        public QuotaCheckResult(Kind kind, long retryAfterSec) {
            this.kind = kind;
            this.retryAfterSec = retryAfterSec;
        }

        public Kind getKind() {
            return kind;
        }

        public long getRetryAfterSec() {
            return retryAfterSec;
        }
    }
}
