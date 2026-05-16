package com.longfeng.authservice.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Stub response for POST /api/auth/refresh — proves endpoint reachable,
 * real signing logic deferred to a future SC.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class RefreshResponse {

    private String jwt;
    private long   expiresIn;

    public RefreshResponse() {}

    public RefreshResponse(String jwt, long expiresIn) {
        this.jwt = jwt;
        this.expiresIn = expiresIn;
    }

    public String getJwt() { return jwt; }
    public void setJwt(String jwt) { this.jwt = jwt; }
    public long getExpiresIn() { return expiresIn; }
    public void setExpiresIn(long expiresIn) { this.expiresIn = expiresIn; }
}
