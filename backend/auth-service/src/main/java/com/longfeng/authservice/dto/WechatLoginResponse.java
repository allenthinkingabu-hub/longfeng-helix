package com.longfeng.authservice.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * P00 §5 #3 · POST /api/auth/wechat-login success body.
 * Wire shape: {@code {jwt, refreshToken, expiresIn, isNew, student:{id, nickMasked}}}.
 *
 * <p>{@code isNew=true} 时 FE 可选地引导新用户填昵称/绑手机 (P1).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class WechatLoginResponse {

    private String jwt;
    private String refreshToken;
    private long expiresIn;
    private boolean isNew;
    private LoginResponse.Student student;

    public WechatLoginResponse() {}

    public WechatLoginResponse(String jwt, String refreshToken, long expiresIn,
                               boolean isNew, LoginResponse.Student student) {
        this.jwt = jwt;
        this.refreshToken = refreshToken;
        this.expiresIn = expiresIn;
        this.isNew = isNew;
        this.student = student;
    }

    public String getJwt() { return jwt; }
    public void setJwt(String jwt) { this.jwt = jwt; }
    public String getRefreshToken() { return refreshToken; }
    public void setRefreshToken(String refreshToken) { this.refreshToken = refreshToken; }
    public long getExpiresIn() { return expiresIn; }
    public void setExpiresIn(long expiresIn) { this.expiresIn = expiresIn; }
    public boolean isNew() { return isNew; }
    public void setNew(boolean aNew) { isNew = aNew; }
    public LoginResponse.Student getStudent() { return student; }
    public void setStudent(LoginResponse.Student student) { this.student = student; }
}
