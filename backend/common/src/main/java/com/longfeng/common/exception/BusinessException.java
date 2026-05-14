package com.longfeng.common.exception;

public class BusinessException extends RuntimeException {

    private final ErrCode errCode;

    public BusinessException(ErrCode errCode, String message) {
        super(message);
        this.errCode = errCode;
    }

    public BusinessException(ErrCode errCode, String message, Throwable cause) {
        super(message, cause);
        this.errCode = errCode;
    }

    public ErrCode errCode() { return errCode; }
}
