package com.longfeng.reviewplan.feign;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@FeignClient(
    name = "notification-service",
    url = "${notification.service.url:http://localhost:18090}")
public interface NotificationFeignClient {

    @PostMapping("/internal/notify/wx-mp")
    SendResp sendWxMp(@RequestBody SendReq req);

    @PostMapping("/internal/notify/app")
    SendResp sendApp(@RequestBody SendReq req);

    @PostMapping("/internal/notify/email")
    SendResp sendEmail(@RequestBody SendReq req);

    @PostMapping("/internal/notify/sms")
    SendResp sendSms(@RequestBody SendReq req);

    record SendReq(String userId, String templateId, String channel, java.util.Map<String, Object> params) {}
    record SendResp(boolean success, String requestId, String errorCode, String errorMessage) {}
}
