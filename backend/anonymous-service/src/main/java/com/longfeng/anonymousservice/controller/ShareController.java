package com.longfeng.anonymousservice.controller;

import com.longfeng.anonymousservice.dto.ShareDto;
import com.longfeng.anonymousservice.dto.ShareErrorResponse;
import com.longfeng.anonymousservice.service.ShareTokenService;
import com.longfeng.anonymousservice.service.ShareTokenService.ShareLookupOutcome;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * SC-13 · GET /api/share/:shareToken — 匿名只读 · 脱敏预览端点.
 *
 * <p>biz §10.9 + §2B.14 contract:
 * <ul>
 *   <li>HTTP 200 {@link ShareDto} · 字段白名单严格 (不含 relation_id 等 PII)
 *   <li>HTTP 410 {@code TOKEN_EXPIRED} · HS256 exp 过 / DB status=2 / expires_at<now
 *   <li>HTTP 404 {@code TOKEN_INVALID} · 签名错 / jti 不存在 / 其它解码失败
 *   <li>HTTP 403 {@code TOKEN_REVOKED} · Redis SET share:revoked 命中 / DB status=3
 * </ul>
 *
 * <p><b>Cache-Control: no-store</b> · CDN 严禁缓存 (含敏感访问审计 + Redis 撤销秒级生效).
 *
 * <p><b>脱敏铁律</b>: response body 严禁含 {@code relation_id} / {@code sharer_student_id}
 * / {@code student_email} / {@code original_image_url}. 由 {@link ShareDto} +
 * {@link com.longfeng.anonymousservice.dto.MaskedPayloadDto} 字段白名单守护 ·
 * SC13ShareE2EIT 反向断言验真.
 */
@RestController
@RequestMapping("/api/share")
public class ShareController {

    private static final Logger LOG = LoggerFactory.getLogger(ShareController.class);

    private final ShareTokenService service;

    public ShareController(ShareTokenService service) {
        this.service = service;
    }

    @GetMapping(value = "/{shareToken}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> getShare(@PathVariable("shareToken") String shareToken) {
        ShareLookupOutcome outcome = service.lookup(shareToken);
        LOG.info("share_lookup outcome={}", outcome.getKind());

        // 所有响应统一加 Cache-Control: no-store (含挡板态)
        return switch (outcome.getKind()) {
            case SUCCESS -> ResponseEntity.ok()
                    .header(HttpHeaders.CACHE_CONTROL, "no-store")
                    .body(outcome.getDto());
            case EXPIRED -> ResponseEntity.status(HttpStatus.GONE)
                    .header(HttpHeaders.CACHE_CONTROL, "no-store")
                    .body(new ShareErrorResponse("TOKEN_EXPIRED", "这个分享已过期"));
            case REVOKED -> ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .header(HttpHeaders.CACHE_CONTROL, "no-store")
                    .body(new ShareErrorResponse("TOKEN_REVOKED", "分享者已撤销此分享"));
            case INVALID -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .header(HttpHeaders.CACHE_CONTROL, "no-store")
                    .body(new ShareErrorResponse("TOKEN_INVALID", "分享链接无效"));
        };
    }
}
