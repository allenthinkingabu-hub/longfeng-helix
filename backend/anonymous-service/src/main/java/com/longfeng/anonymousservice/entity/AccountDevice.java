package com.longfeng.anonymousservice.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.SequenceGenerator;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

/**
 * SC-00-T02 · biz §4.13 · {@code account_device} — device fingerprint soft-bind row.
 *
 * <p>Schema source of truth: V20260421_02__init_anonymous.sql §7. P0 the row is only
 * written by the auth-service login hook (silent upsert) — never read. P1 (SC-14)
 * will read it for P-WELCOMEBACK account chooser.
 */
@Entity
@Table(name = "account_device")
public class AccountDevice {

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "account_device_seq")
    @SequenceGenerator(name = "account_device_seq", sequenceName = "account_device_id_seq", allocationSize = 1)
    private Long id;

    @Column(name = "student_id", nullable = false)
    private Long studentId;

    @Column(name = "device_fp", nullable = false, length = 128)
    private String deviceFp;

    @Column(name = "platform", length = 16)
    private String platform;

    @Column(name = "first_seen_at", nullable = false)
    private OffsetDateTime firstSeenAt;

    @Column(name = "last_seen_at", nullable = false)
    private OffsetDateTime lastSeenAt;

    @Column(name = "login_count", nullable = false)
    private int loginCount;

    public AccountDevice() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getStudentId() { return studentId; }
    public void setStudentId(Long studentId) { this.studentId = studentId; }
    public String getDeviceFp() { return deviceFp; }
    public void setDeviceFp(String deviceFp) { this.deviceFp = deviceFp; }
    public String getPlatform() { return platform; }
    public void setPlatform(String platform) { this.platform = platform; }
    public OffsetDateTime getFirstSeenAt() { return firstSeenAt; }
    public void setFirstSeenAt(OffsetDateTime firstSeenAt) { this.firstSeenAt = firstSeenAt; }
    public OffsetDateTime getLastSeenAt() { return lastSeenAt; }
    public void setLastSeenAt(OffsetDateTime lastSeenAt) { this.lastSeenAt = lastSeenAt; }
    public int getLoginCount() { return loginCount; }
    public void setLoginCount(int loginCount) { this.loginCount = loginCount; }
}
