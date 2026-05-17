package com.longfeng.authservice.facade;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

/**
 * SC-00-T02 · auth-service → anonymous-service hook.
 *
 * <p>After a successful login, auth-service performs a SILENT upsert into
 * {@code account_device} via anonymous-service's internal endpoint. Failures
 * (anonymous-service down, network error, 5xx) are LOGGED ONLY — the login
 * response is NOT blocked. P0 has no internal-token; P1 adds one.
 */
@Service
public class AccountDeviceFacade {

    private static final Logger LOG = LoggerFactory.getLogger(AccountDeviceFacade.class);

    private final RestClient http;

    public AccountDeviceFacade(
            @Value("${anonymous-service.base-url:http://localhost:8090}") String baseUrl) {
        this.http = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(buildFactory())
                .build();
    }

    private static org.springframework.http.client.ClientHttpRequestFactory buildFactory() {
        org.springframework.http.client.SimpleClientHttpRequestFactory f =
                new org.springframework.http.client.SimpleClientHttpRequestFactory();
        f.setConnectTimeout((int) Duration.ofMillis(800).toMillis());
        f.setReadTimeout((int) Duration.ofMillis(1500).toMillis());
        return f;
    }

    /**
     * Silently upsert. Returns true if the call succeeded (HTTP 2xx); false otherwise.
     * The caller (AuthController) typically ignores the return value — this is a
     * fire-and-forget hook.
     */
    public boolean silentUpsert(long studentId, String deviceFp, String platform, String ua) {
        if (deviceFp == null || deviceFp.isBlank()) {
            LOG.debug("account_device_skip deviceFp_blank sid={}", studentId);
            return false;
        }
        Map<String, Object> body = new HashMap<>();
        body.put("studentId", studentId);
        body.put("deviceFp", deviceFp);
        if (platform != null) body.put("platform", platform);
        if (ua != null) body.put("lastSeenUa", ua);
        try {
            ResponseEntity<Void> resp = http.post()
                    .uri("/internal/account-device/upsert")
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
            HttpStatusCode code = resp.getStatusCode();
            if (code.is2xxSuccessful()) return true;
            LOG.warn("account_device_upsert_non_2xx code={} sid={}", code.value(), studentId);
            return false;
        } catch (Exception e) {
            LOG.warn("account_device_upsert_failed sid={} reason={}", studentId, e.toString());
            return false;
        }
    }
}
