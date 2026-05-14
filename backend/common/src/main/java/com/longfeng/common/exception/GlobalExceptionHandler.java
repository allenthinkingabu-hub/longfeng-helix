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
}
