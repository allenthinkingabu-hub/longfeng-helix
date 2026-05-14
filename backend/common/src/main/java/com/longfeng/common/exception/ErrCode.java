package com.longfeng.common.exception;

public enum ErrCode {
    VALIDATION_FAILED(40001, 400),
    IDEMPOTENCY_CONFLICT(40901, 409),
    RESOURCE_NOT_FOUND(40401, 404),
    INTERNAL_ERROR(50001, 500);

    private final int code;
    private final int httpStatus;

    ErrCode(int code, int httpStatus) {
        this.code = code;
        this.httpStatus = httpStatus;
    }

    public int code() { return code; }
    public int httpStatus() { return httpStatus; }
}
