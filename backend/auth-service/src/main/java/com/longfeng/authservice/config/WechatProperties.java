package com.longfeng.authservice.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * SC-12 / P00 spec §5 #3 · 微信 OAuth 一键登录配置.
 *
 * <p>Wire to Tencent <code>GET https://api.weixin.qq.com/sns/jscode2session</code>
 * with <code>appid + secret + js_code</code>, exchange for <code>openid</code>.
 *
 * <p><strong>Secret 来源</strong>: env var <code>WECHAT_SECRET</code> 必走 ·
 * application.yml 默认值故意留空. 生产 CI/CD 注入 · 永不入仓.
 *
 * <p>secret 空时 · WechatOpenIdService 直接 throw NotConfiguredException →
 * Controller 转 503 {code:"WECHAT_NOT_CONFIGURED"} · 不打 Tencent (节流).
 */
@Component
@ConfigurationProperties(prefix = "wechat")
public class WechatProperties {

    /** WX 小程序 AppId · project.config.json 同款 · prod 走 env override. */
    private String appid = "wxf1ebf7730c8df0fa";

    /**
     * WX 小程序 AppSecret · MUST 从 env var WECHAT_SECRET 注入 · 默认空字串.
     * 空时 WechatOpenIdService 拒绝调用 · 防止 Tencent 返 ParamError 浪费 QPS.
     */
    private String secret = "";

    /** Tencent jscode2session API endpoint · 默认正式生产 host. */
    private String jscodeSessionUrl = "https://api.weixin.qq.com/sns/jscode2session";

    /** HTTP timeout (RestTemplate connect + read) · ms · 默认 3s. */
    private int timeoutMs = 3000;

    public String getAppid() { return appid; }
    public void setAppid(String appid) { this.appid = appid; }
    public String getSecret() { return secret; }
    public void setSecret(String secret) { this.secret = secret; }
    public String getJscodeSessionUrl() { return jscodeSessionUrl; }
    public void setJscodeSessionUrl(String jscodeSessionUrl) { this.jscodeSessionUrl = jscodeSessionUrl; }
    public int getTimeoutMs() { return timeoutMs; }
    public void setTimeoutMs(int timeoutMs) { this.timeoutMs = timeoutMs; }

    /** 配置就绪 · secret 非空才视为可用. */
    public boolean isConfigured() {
        return secret != null && !secret.isBlank();
    }
}
