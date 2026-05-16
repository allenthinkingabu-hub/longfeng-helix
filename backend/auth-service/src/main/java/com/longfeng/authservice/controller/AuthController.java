package com.longfeng.authservice.controller;

import com.longfeng.authservice.dto.AuthErrorResponse;
import com.longfeng.authservice.dto.LoginRequest;
import com.longfeng.authservice.dto.LoginResponse;
import com.longfeng.authservice.dto.RefreshResponse;
import com.longfeng.authservice.entity.AuthUser;
import com.longfeng.authservice.service.JwtService;
import com.longfeng.authservice.service.LoginService;
import com.longfeng.authservice.service.LoginService.AccountLockedException;
import com.longfeng.authservice.service.LoginService.InvalidCredentialsException;
import com.longfeng.authservice.service.RefreshTokenService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * POST /api/auth/login  · email + password → JWT + refresh token
 * POST /api/auth/refresh · stub (proves endpoint reachable, real impl future)
 *
 * <p>Spec ref: design/system/pages/P00-login.spec.md §5 rows #2 and #7.
 *
 * <p>Local @ExceptionHandler intentionally — we want fine-grained control over
 * the wire shape ({code, message, lockedUntil?}) instead of the generic
 * {@code ApiResult.fail} envelope used by other services.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Logger LOG = LoggerFactory.getLogger(AuthController.class);

    private final LoginService loginService;
    private final JwtService jwtService;
    private final RefreshTokenService refreshTokenService;

    public AuthController(LoginService loginService,
                          JwtService jwtService,
                          RefreshTokenService refreshTokenService) {
        this.loginService = loginService;
        this.jwtService = jwtService;
        this.refreshTokenService = refreshTokenService;
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest req) {
        // provider currently only supports EMAIL — others SC-12 / iOS scope_out.
        String provider = req.getProvider() == null ? "EMAIL" : req.getProvider();
        if (!"EMAIL".equalsIgnoreCase(provider)) {
            LOG.warn("login_unsupported_provider provider={}", provider);
            throw new InvalidCredentialsException();
        }

        AuthUser user = loginService.verifyCredentials(req.getEmail(), req.getPassword());

        String jwt = jwtService.signAccessToken(user.getId());
        String refresh = refreshTokenService.issue(user.getId());
        long expiresIn = jwtService.getAccessTokenTtlSeconds();

        LoginResponse.Student student = new LoginResponse.Student(
                user.getId(),
                maskNick(user.getEmail()));
        return ResponseEntity.ok(new LoginResponse(jwt, refresh, expiresIn, student));
    }

    @PostMapping("/refresh")
    public ResponseEntity<RefreshResponse> refresh(
            @RequestHeader(name = "Authorization", required = false) String authHeader) {
        // Stub: accept any Bearer refreshToken and return a dummy access token.
        // Real implementation (token rotation + revoke-on-reuse) deferred to a future SC.
        if (authHeader == null || !authHeader.toLowerCase().startsWith("bearer ")) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        long ttl = jwtService.getAccessTokenTtlSeconds();
        // Stub jwt signed with id=0 — never trust this in production; clients must call /login.
        String stubJwt = jwtService.signAccessToken(0L);
        return ResponseEntity.ok(new RefreshResponse(stubJwt, ttl));
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<AuthErrorResponse> handleInvalid(InvalidCredentialsException e) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new AuthErrorResponse("INVALID_CREDENTIALS", "邮箱或密码错误"));
    }

    @ExceptionHandler(AccountLockedException.class)
    public ResponseEntity<AuthErrorResponse> handleLocked(AccountLockedException e) {
        return ResponseEntity.status(HttpStatus.LOCKED) // 423
                .body(new AuthErrorResponse(
                        "ACCOUNT_LOCKED",
                        "账号已锁定 · 5 分钟后重试",
                        e.getLockedUntil().toString()));
    }

    /** "Mask" the local-part of the email — first char + *** + @domain. */
    private static String maskNick(String email) {
        if (email == null || email.indexOf('@') <= 0) return "用户";
        int at = email.indexOf('@');
        return email.charAt(0) + "***" + email.substring(at);
    }
}
