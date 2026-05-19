package com.longfeng.authservice.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.longfeng.authservice.config.WechatProperties;
import com.longfeng.authservice.config.WechatRestTemplateConfig;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * SC-12 / P00 §5 #3 · 调 Tencent {@code jscode2session} 把 MP {@code wx.login()}
 * 拿到的临时 code 换成长效 {@code openid + session_key + unionid?}.
 *
 * <p>Tencent 响应 shape:
 * <pre>
 *   成功: {"openid":"oxxxx","session_key":"xxxx","unionid":"u..."}  // unionid 可能缺
 *   失败: {"errcode":40029,"errmsg":"invalid code"}                  // errcode != 0
 * </pre>
 *
 * <p>错误分类:
 * <ul>
 *   <li>{@link NotConfiguredException} · secret 空 → 上游 503 WECHAT_NOT_CONFIGURED</li>
 *   <li>{@link InvalidCodeException} · Tencent errcode != 0 → 上游 401 INVALID_WECHAT_CODE</li>
 *   <li>{@link UpstreamException} · 网络/timeout/非 200 → 上游 502 WECHAT_UPSTREAM</li>
 * </ul>
 */
@Service
public class WechatOpenIdService {

    private static final Logger LOG = LoggerFactory.getLogger(WechatOpenIdService.class);

    private final WechatProperties props;
    private final RestTemplate http;
    private final ObjectMapper jsonMapper;

    public WechatOpenIdService(
            WechatProperties props,
            @Qualifier(WechatRestTemplateConfig.BEAN_NAME) RestTemplate http,
            ObjectMapper jsonMapper) {
        this.props = props;
        this.http = http;
        this.jsonMapper = jsonMapper;
    }

    /**
     * Code → session 交换. 调用前若未配置 secret · 抛 NotConfigured (不发起 HTTP).
     *
     * @param jsCode wx.login() 返回的 5-min 临时 code
     * @return WechatSession (openid 必有 · unionid 可选)
     */
    public WechatSession exchangeCode(String jsCode) {
        if (!props.isConfigured()) {
            LOG.warn("wechat_oauth_skip secret_not_configured · set env WECHAT_SECRET");
            throw new NotConfiguredException();
        }
        if (jsCode == null || jsCode.isBlank()) {
            throw new InvalidCodeException("blank jsCode");
        }

        // URL 注意: appid/secret/js_code 都是 query string · Tencent 接受 GET.
        // 不日志 secret · 仅日志 appid + masked js_code.
        String url = UriComponentsBuilder.fromHttpUrl(props.getJscodeSessionUrl())
                .queryParam("appid", props.getAppid())
                .queryParam("secret", props.getSecret())
                .queryParam("js_code", jsCode)
                .queryParam("grant_type", "authorization_code")
                .build(true)
                .toUriString();

        // Tencent 返响应有时是 text/plain 内容是 JSON · 不依赖 content-type · 用 String 接 + 手动 parse
        ResponseEntity<String> resp;
        try {
            resp = http.getForEntity(url, String.class);
        } catch (RestClientException e) {
            LOG.warn("wechat_oauth_upstream_failed appid={} jsCode={} err={}",
                    props.getAppid(), maskCode(jsCode), e.toString());
            throw new UpstreamException("Tencent jscode2session unreachable", e);
        }
        if (resp.getStatusCode().value() != 200 || resp.getBody() == null) {
            LOG.warn("wechat_oauth_upstream_non200 status={}", resp.getStatusCode());
            throw new UpstreamException("Tencent jscode2session non-200: " + resp.getStatusCode());
        }
        Map<String, Object> body;
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> parsed = jsonMapper.readValue(resp.getBody(), Map.class);
            body = parsed;
        } catch (JsonProcessingException e) {
            LOG.warn("wechat_oauth_parse_failed body={} err={}", resp.getBody(), e.toString());
            throw new UpstreamException("Tencent response not JSON: " + e.getMessage(), e);
        }

        // errcode 0 (或不存在) 视为成功 · 非 0 视为失败 · Tencent 永远返 200 + JSON 体.
        Object errcodeObj = body.get("errcode");
        if (errcodeObj instanceof Number n && n.intValue() != 0) {
            String errmsg = body.get("errmsg") instanceof String s ? s : "";
            LOG.info("wechat_oauth_code_invalid errcode={} errmsg={} jsCode={}",
                    n.intValue(), errmsg, maskCode(jsCode));
            throw new InvalidCodeException("Tencent errcode=" + n.intValue() + " " + errmsg);
        }

        String openid = body.get("openid") instanceof String s ? s : null;
        if (openid == null || openid.isBlank()) {
            LOG.warn("wechat_oauth_no_openid body={}", body);
            throw new UpstreamException("Tencent response missing openid");
        }
        String unionid = body.get("unionid") instanceof String s ? s : null;
        LOG.info("wechat_oauth_ok openid={} hasUnionid={}",
                maskOpenid(openid), unionid != null);
        return new WechatSession(openid, unionid);
    }

    private static String maskCode(String code) {
        if (code == null) return "<null>";
        if (code.length() < 8) return "***";
        return code.substring(0, 4) + "****";
    }

    private static String maskOpenid(String oid) {
        if (oid == null || oid.length() < 6) return "***";
        return oid.substring(0, 3) + "***" + oid.substring(oid.length() - 3);
    }

    public record WechatSession(String openid, String unionid) {}

    /** 503 · backend 未配 secret. */
    public static class NotConfiguredException extends RuntimeException {
        public NotConfiguredException() { super("WECHAT_NOT_CONFIGURED"); }
    }

    /** 401 · Tencent 返 errcode != 0 (code 过期 / 重复用 / 假 code). */
    public static class InvalidCodeException extends RuntimeException {
        public InvalidCodeException(String msg) { super(msg); }
    }

    /** 502 · 网络 / Tencent 5xx / 响应体异常. */
    public static class UpstreamException extends RuntimeException {
        public UpstreamException(String msg) { super(msg); }
        public UpstreamException(String msg, Throwable cause) { super(msg, cause); }
    }
}
