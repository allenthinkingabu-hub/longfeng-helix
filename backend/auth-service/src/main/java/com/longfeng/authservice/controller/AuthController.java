package com.longfeng.authservice.controller;

import com.longfeng.authservice.dto.AuthErrorResponse;
import com.longfeng.authservice.dto.LoginRequest;
import com.longfeng.authservice.dto.LoginResponse;
import com.longfeng.authservice.dto.RefreshResponse;
import com.longfeng.authservice.dto.WechatLoginRequest;
import com.longfeng.authservice.dto.WechatLoginResponse;
import com.longfeng.authservice.entity.AuthUser;
import com.longfeng.authservice.facade.AccountDeviceFacade;
import com.longfeng.authservice.service.JwtService;
import com.longfeng.authservice.service.LoginService;
import com.longfeng.authservice.service.LoginService.AccountLockedException;
import com.longfeng.authservice.service.LoginService.InvalidCredentialsException;
import com.longfeng.authservice.service.RefreshTokenService;
import com.longfeng.authservice.service.WechatLoginService;
import com.longfeng.authservice.service.WechatLoginService.WechatLoginResult;
import com.longfeng.authservice.service.WechatOpenIdService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
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
    private final AccountDeviceFacade accountDeviceFacade;
    private final WechatLoginService wechatLoginService;

    public AuthController(LoginService loginService,
                          JwtService jwtService,
                          RefreshTokenService refreshTokenService,
                          AccountDeviceFacade accountDeviceFacade,
                          WechatLoginService wechatLoginService) {
        this.loginService = loginService;
        this.jwtService = jwtService;
        this.refreshTokenService = refreshTokenService;
        this.accountDeviceFacade = accountDeviceFacade;
        this.wechatLoginService = wechatLoginService;
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest req,
                                               HttpServletRequest httpReq) {
        // provider 接 EMAIL 或 PHONE · WECHAT 走单独 /wechat-login endpoint
        String provider = req.getProvider() == null ? "EMAIL" : req.getProvider();
        if (!"EMAIL".equalsIgnoreCase(provider) && !"PHONE".equalsIgnoreCase(provider)) {
            LOG.warn("login_unsupported_provider provider={}", provider);
            throw new InvalidCredentialsException();
        }
        // 必须给 email 或 phone (至少一个非空) · @Valid 不能跨字段校验 · 这里硬校
        if ((req.getEmail() == null || req.getEmail().isBlank())
                && (req.getPhone() == null || req.getPhone().isBlank())) {
            throw new InvalidCredentialsException();
        }

        AuthUser user = loginService.verifyCredentials(
                req.getEmail(), req.getPhone(), req.getPassword());

        String jwt = jwtService.signAccessToken(user.getId());
        String refresh = refreshTokenService.issue(user.getId());
        long expiresIn = jwtService.getAccessTokenTtlSeconds();

        // SC-00-T02 silent hook · upsert account_device for SC-14 future welcomeback.
        // Never blocks login response — facade swallows all exceptions internally.
        String deviceFp = req.getDeviceFp();
        if (deviceFp != null && !deviceFp.isBlank()) {
            String platform = req.getPlatform() == null ? "H5" : req.getPlatform();
            String ua = httpReq.getHeader("User-Agent");
            accountDeviceFacade.silentUpsert(user.getId(), deviceFp, platform, ua);
        } else {
            LOG.debug("account_device_hook_skip deviceFp_blank sid={}", user.getId());
        }

        LoginResponse.Student student = new LoginResponse.Student(
                user.getId(),
                maskNick(user.getEmail()));
        return ResponseEntity.ok(new LoginResponse(jwt, refresh, expiresIn, student));
    }

    /**
     * P00 §5 #3 · POST /api/auth/wechat-login · MP wx.login() code → JWT.
     * 真实接 Tencent jscode2session · 不走 mock.
     *
     * Wire (SR):
     *   200 {jwt, refreshToken, expiresIn, isNew, student:{id, nickMasked}}
     *   401 {code:"INVALID_WECHAT_CODE"}   · code 过期 / 重复 / 假
     *   502 {code:"WECHAT_UPSTREAM"}        · Tencent 网络 / 5xx
     *   503 {code:"WECHAT_NOT_CONFIGURED"}  · backend 没配 WECHAT_SECRET env
     */
    @PostMapping("/wechat-login")
    public ResponseEntity<WechatLoginResponse> wechatLogin(
            @Valid @RequestBody WechatLoginRequest req,
            HttpServletRequest httpReq) {
        WechatLoginResult result = wechatLoginService.login(req.getCode());
        AuthUser user = result.user();

        String jwt = jwtService.signAccessToken(user.getId());
        String refresh = refreshTokenService.issue(user.getId());
        long expiresIn = jwtService.getAccessTokenTtlSeconds();

        // 微信用户没 email · maskNick 已兜底 "用户"
        LoginResponse.Student student = new LoginResponse.Student(
                user.getId(),
                maskNick(user.getEmail()));

        // device_fp upsert (同 /login)
        String deviceFp = req.getDeviceFp();
        if (deviceFp != null && !deviceFp.isBlank()) {
            String platform = req.getPlatform() == null ? "MINIP" : req.getPlatform();
            String ua = httpReq.getHeader("User-Agent");
            accountDeviceFacade.silentUpsert(user.getId(), deviceFp, platform, ua);
        }

        return ResponseEntity.ok(new WechatLoginResponse(
                jwt, refresh, expiresIn, result.isNew(), student));
    }

    @ExceptionHandler(WechatOpenIdService.NotConfiguredException.class)
    public ResponseEntity<AuthErrorResponse> handleWechatNotConfigured(
            WechatOpenIdService.NotConfiguredException e) {
        LOG.warn("wechat_login_not_configured · set env WECHAT_SECRET");
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                .body(new AuthErrorResponse("WECHAT_NOT_CONFIGURED",
                        "微信登录暂未配置, 请联系管理员"));
    }

    @ExceptionHandler(WechatOpenIdService.InvalidCodeException.class)
    public ResponseEntity<AuthErrorResponse> handleWechatInvalidCode(
            WechatOpenIdService.InvalidCodeException e) {
        LOG.info("wechat_login_invalid_code msg={}", e.getMessage());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new AuthErrorResponse("INVALID_WECHAT_CODE",
                        "微信授权失败, 请重新尝试"));
    }

    @ExceptionHandler(WechatOpenIdService.UpstreamException.class)
    public ResponseEntity<AuthErrorResponse> handleWechatUpstream(
            WechatOpenIdService.UpstreamException e) {
        LOG.warn("wechat_login_upstream_failed msg={}", e.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body(new AuthErrorResponse("WECHAT_UPSTREAM",
                        "微信服务暂不可达, 请稍后重试"));
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

    /**
     * P1 drift fix (2026-05-17): @Valid failures (e.g. short password via
     * {@code @Size(min=6)}, missing email, malformed email) previously fell through
     * to Spring's default {@code DefaultErrorAttributes} envelope (timestamp/status/
     * error/path). Frontend code that parses {@code body.code} broke. Unify the wire
     * shape — always 400 + {@link AuthErrorResponse} with {@code code=VALIDATION_FAILED}.
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<AuthErrorResponse> handleValidation(MethodArgumentNotValidException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
                .orElse("请求参数无效");
        LOG.debug("login_validation_failed msg={}", msg);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new AuthErrorResponse("VALIDATION_FAILED", msg));
    }

    /** Malformed JSON body — also surfaces as VALIDATION_FAILED, not Spring's default. */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<AuthErrorResponse> handleNotReadable(HttpMessageNotReadableException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new AuthErrorResponse("VALIDATION_FAILED", "请求体格式无效"));
    }

    /** "Mask" the local-part of the email — first char + *** + @domain. */
    private static String maskNick(String email) {
        if (email == null || email.indexOf('@') <= 0) return "用户";
        int at = email.indexOf('@');
        return email.charAt(0) + "***" + email.substring(at);
    }
}
