package com.longfeng.authservice.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * P00 login success response (spec §5 row #2).
 * Wire shape: {jwt, refreshToken, expiresIn, student:{id, nickMasked}}
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class LoginResponse {

    private String jwt;
    private String refreshToken;
    private long   expiresIn;       // seconds
    private Student student;

    public LoginResponse() {}

    public LoginResponse(String jwt, String refreshToken, long expiresIn, Student student) {
        this.jwt = jwt;
        this.refreshToken = refreshToken;
        this.expiresIn = expiresIn;
        this.student = student;
    }

    public String getJwt() { return jwt; }
    public void setJwt(String jwt) { this.jwt = jwt; }
    public String getRefreshToken() { return refreshToken; }
    public void setRefreshToken(String refreshToken) { this.refreshToken = refreshToken; }
    public long getExpiresIn() { return expiresIn; }
    public void setExpiresIn(long expiresIn) { this.expiresIn = expiresIn; }
    public Student getStudent() { return student; }
    public void setStudent(Student student) { this.student = student; }

    public static class Student {
        private long id;
        private String nickMasked;

        public Student() {}

        public Student(long id, String nickMasked) {
            this.id = id;
            this.nickMasked = nickMasked;
        }

        public long getId() { return id; }
        public void setId(long id) { this.id = id; }
        public String getNickMasked() { return nickMasked; }
        public void setNickMasked(String nickMasked) { this.nickMasked = nickMasked; }
    }
}
