package com.longfeng.anonymousservice.filter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.longfeng.anonymousservice.dto.AnonErrorResponse;
import com.longfeng.anonymousservice.service.AnonTokenService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * SC-12-T02 · {@code X-Anon-Token} gateway interceptor.
 *
 * <p>Registered to path pattern {@code /api/anon/**} via {@code WebMvcConfig}.
 * Responsibilities:
 *
 * <ol>
 *   <li><b>Whitelist mint entry</b>: {@code POST /api/anon/session} is the only
 *       way to obtain an anonToken in the first place — it must not require
 *       one. The path-method tuple short-circuits to {@code return true} before
 *       any token extraction.</li>
 *   <li><b>Verify token</b>: pull {@code X-Anon-Token} header, delegate to
 *       {@link AnonTokenService#verifyAnonToken(String)}. Failure (missing /
 *       garbage / wrong-prefix / expired) → write 401
 *       {@code AnonErrorResponse(code="ANON_TOKEN_INVALID")} as JSON and
 *       {@code return false} so the controller is never reached.</li>
 *   <li><b>Pass through</b>: on success, set request attribute
 *       {@code "anonGuestSessionId"} to the verified {@code guest_session.id}
 *       so downstream controllers can verify path-id ownership without
 *       re-decoding the JWT (mirrors Spring Security's
 *       {@code SecurityContextHolder} principal injection idiom).</li>
 * </ol>
 *
 * <p><b>Path matching note</b>: Spring's {@code AntPathMatcher} on the
 * registration ({@code "/api/anon/**"}) sends {@code POST /api/anon/session}
 * through this interceptor too — that's intentional and the whitelist branch
 * lets it through. Configuring the whitelist via
 * {@code excludePathPatterns("/api/anon/session")} alone would also pass GET
 * {@code /api/anon/session} unauthenticated, which is undesirable; doing it
 * in {@code preHandle} keeps the rule "POST-and-only-POST {@code session} is
 * the mint entry" tight.
 */
@Component
public class AnonFilter implements HandlerInterceptor {

    private static final Logger LOG = LoggerFactory.getLogger(AnonFilter.class);

    /** biz §2B.13 SC-12 F01 mint entry · pre-token whitelist. */
    private static final String MINT_PATH = "/api/anon/session";

    /** Header name pinned by P-GUEST-CAPTURE spec §5 (no {@code Bearer} prefix). */
    private static final String HEADER_NAME = "X-Anon-Token";

    /**
     * Request attribute name where the verified guest session id is stashed.
     * Downstream controllers cast to {@code Long} to read it. Constant so
     * controllers and tests reference the same string (typo-safety).
     */
    public static final String ATTR_GUEST_SESSION_ID = "anonGuestSessionId";

    /** Error code emitted on any token verification failure (uniform 401 response). */
    public static final String ERR_TOKEN_INVALID = "ANON_TOKEN_INVALID";

    private final AnonTokenService anonTokenService;
    private final ObjectMapper objectMapper;

    public AnonFilter(AnonTokenService anonTokenService, ObjectMapper objectMapper) {
        this.anonTokenService = anonTokenService;
        this.objectMapper = objectMapper;
    }

    @Override
    public boolean preHandle(HttpServletRequest req, HttpServletResponse resp, Object handler)
            throws Exception {
        String uri = req.getRequestURI();
        String method = req.getMethod();

        // Whitelist: POST /api/anon/session is the mint entry — cannot require a token it issues.
        if ("POST".equalsIgnoreCase(method) && MINT_PATH.equals(uri)) {
            return true;
        }

        String header = req.getHeader(HEADER_NAME);
        Optional<Long> opt = anonTokenService.verifyAnonToken(header);
        if (opt.isEmpty()) {
            writeUnauthorized(resp);
            // Surface for ops triage — no PII in log line (token contents never logged).
            LOG.debug("anon_filter_reject uri={} method={} header_present={}",
                    uri, method, header != null && !header.isBlank());
            return false;
        }
        req.setAttribute(ATTR_GUEST_SESSION_ID, opt.get());
        return true;
    }

    private void writeUnauthorized(HttpServletResponse resp) throws Exception {
        resp.setStatus(HttpStatus.UNAUTHORIZED.value());
        resp.setContentType(MediaType.APPLICATION_JSON_VALUE);
        resp.setCharacterEncoding("UTF-8");
        AnonErrorResponse body = new AnonErrorResponse(ERR_TOKEN_INVALID,
                "Invalid or missing X-Anon-Token");
        resp.getWriter().write(objectMapper.writeValueAsString(body));
    }
}
