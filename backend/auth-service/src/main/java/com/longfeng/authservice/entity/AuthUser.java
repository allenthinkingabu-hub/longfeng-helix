package com.longfeng.authservice.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

/**
 * auth_user — single source of truth for email/password authentication.
 *
 * <p>Status state machine:
 * <ul>
 *   <li>{@code ACTIVE} — normal, login attempts allowed (subject to lockout counter)
 *   <li>{@code LOCKED} — 5 consecutive failures hit; {@code locked_until} > now() rejects all attempts
 *   <li>{@code DELETED} — soft delete; login always rejected (out of scope for this task)
 * </ul>
 */
@Entity
@Table(name = "auth_user")
public class AuthUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // email 改 nullable · V20260519_01 加微信 OAuth · 纯微信用户没 email
    @Column(name = "email", unique = true, length = 255)
    private String email;

    // phone 新加 · V20260519_01 · 11 位 PRC 手机号字符串 (BE 不做格式校验 · FE 已做)
    @Column(name = "phone", unique = true, length = 20)
    private String phone;

    // password_hash 改 nullable · 微信 OAuth 用户没 password
    @Column(name = "password_hash", length = 72)
    private String passwordHash;

    // SC-12 P00 §5 #3 · 微信 OAuth 登录凭证
    @Column(name = "wx_openid", unique = true, length = 64)
    private String wxOpenid;
    @Column(name = "wx_unionid", length = 64)
    private String wxUnionid;

    @Column(name = "status", nullable = false, length = 16)
    private String status = "ACTIVE";

    @Column(name = "failed_attempts", nullable = false)
    private int failedAttempts = 0;

    @Column(name = "locked_until")
    private OffsetDateTime lockedUntil;

    @Column(name = "last_login_at")
    private OffsetDateTime lastLoginAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public String getWxOpenid() { return wxOpenid; }
    public void setWxOpenid(String wxOpenid) { this.wxOpenid = wxOpenid; }
    public String getWxUnionid() { return wxUnionid; }
    public void setWxUnionid(String wxUnionid) { this.wxUnionid = wxUnionid; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public int getFailedAttempts() { return failedAttempts; }
    public void setFailedAttempts(int failedAttempts) { this.failedAttempts = failedAttempts; }
    public OffsetDateTime getLockedUntil() { return lockedUntil; }
    public void setLockedUntil(OffsetDateTime lockedUntil) { this.lockedUntil = lockedUntil; }
    public OffsetDateTime getLastLoginAt() { return lastLoginAt; }
    public void setLastLoginAt(OffsetDateTime lastLoginAt) { this.lastLoginAt = lastLoginAt; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
}
