package com.longfeng.anonymousservice.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * SC-13 · biz §10.9 · 3 挡板态错误响应载体.
 *
 * <p>Codes: {@code TOKEN_EXPIRED} (HTTP 410) / {@code TOKEN_REVOKED} (HTTP 403)
 * / {@code TOKEN_INVALID} (HTTP 404). 前端 SharedView 拿 status code 决定挡板,
 * code 字段冗余作日志/埋点上报 key.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ShareErrorResponse {
    private final String code;
    private final String message;

    public ShareErrorResponse(String code, String message) {
        this.code = code;
        this.message = message;
    }

    public String getCode() { return code; }
    public String getMessage() { return message; }
}
