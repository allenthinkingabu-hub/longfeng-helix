package com.longfeng.common.exception;

import com.longfeng.common.dto.ApiResult;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

@ControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResult<?>> handle(BusinessException e) {
        int code = e.errCode() != null ? e.errCode().code() : ErrCode.INTERNAL_ERROR.code();
        int httpStatus = e.errCode() != null ? e.errCode().httpStatus() : 500;
        return ResponseEntity.status(httpStatus)
                .body(ApiResult.fail(code, e.getMessage()));
    }

    /**
     * 兜底 · 未被业务异常 catch 的 RuntimeException → 500 + INTERNAL_ERROR code · ApiResult 信封.
     *
     * <p>防止 NullPointerException / SQLException / generic RuntimeException 退化成 Spring
     * 默认 HTML 错误页 · 保证客户端拿到 ApiResult JSON (含 code).
     */
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ApiResult<?>> handleRuntime(RuntimeException e) {
        return ResponseEntity.status(ErrCode.INTERNAL_ERROR.httpStatus())
                .body(ApiResult.fail(ErrCode.INTERNAL_ERROR.code(), e.getMessage() != null ? e.getMessage() : "internal_error"));
    }
}
