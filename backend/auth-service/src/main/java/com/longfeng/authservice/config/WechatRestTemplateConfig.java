package com.longfeng.authservice.config;

import java.time.Duration;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

/**
 * 专用 RestTemplate · 调 Tencent jscode2session · 强 connect+read timeout 防止
 * 慢响应拖垮 login 请求线程. 与未来其他 service 的 restTemplate 解耦 (qualified by name).
 */
@Configuration
public class WechatRestTemplateConfig {

    public static final String BEAN_NAME = "wechatRestTemplate";

    @Bean(BEAN_NAME)
    public RestTemplate wechatRestTemplate(@Autowired WechatProperties props,
                                           RestTemplateBuilder builder) {
        return builder
                .setConnectTimeout(Duration.ofMillis(props.getTimeoutMs()))
                .setReadTimeout(Duration.ofMillis(props.getTimeoutMs()))
                .build();
    }
}
