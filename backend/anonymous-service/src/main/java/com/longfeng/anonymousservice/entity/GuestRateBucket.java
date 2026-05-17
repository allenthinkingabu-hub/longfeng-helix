package com.longfeng.anonymousservice.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * SC-12 · biz §4.10 末尾 · {@code guest_rate_bucket} JPA entity — Redis-fail
 * fallback for the 1-per-day guest quota counter.
 *
 * <p>Schema source of truth: {@code V20260421_02__init_anonymous.sql} §2.
 * Unique index on {@code (device_fp, ip_hash, bucket_date)} guarantees the
 * three-tuple is the natural key; PK {@code id} is a synthetic BIGINT.
 *
 * <p><b>This entity is intentionally NOT used by T01.</b> It is laid down now
 * so SC-12-T06 (rate-limit slice) can wire its repo + service without another
 * round of entity scaffolding. T01's only endpoint ({@code POST /api/anon/session})
 * does not consume quota.
 */
@Entity
@Table(name = "guest_rate_bucket")
public class GuestRateBucket {

    @Id
    @Column(name = "id")
    private Long id;

    @Column(name = "device_fp", nullable = false, length = 128)
    private String deviceFp;

    @Column(name = "ip_hash", nullable = false, length = 64)
    private String ipHash;

    /** DDL column name is {@code bucket_date} (DATE) — map to {@link LocalDate}. */
    @Column(name = "bucket_date", nullable = false)
    private LocalDate bucketDate;

    /** Capped at 1 by DDL CHECK constraint ({@code count <= 1}). */
    @Column(name = "count", nullable = false)
    private int count;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public GuestRateBucket() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getDeviceFp() { return deviceFp; }
    public void setDeviceFp(String deviceFp) { this.deviceFp = deviceFp; }
    public String getIpHash() { return ipHash; }
    public void setIpHash(String ipHash) { this.ipHash = ipHash; }
    public LocalDate getBucketDate() { return bucketDate; }
    public void setBucketDate(LocalDate bucketDate) { this.bucketDate = bucketDate; }
    public int getCount() { return count; }
    public void setCount(int count) { this.count = count; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
}
