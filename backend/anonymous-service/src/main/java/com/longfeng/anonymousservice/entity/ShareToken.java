package com.longfeng.anonymousservice.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

/**
 * SC-13 · biz §4.11 · {@code share_token} JPA entity.
 *
 * <p>Schema source of truth: {@code V20260421_02__init_anonymous.sql} §3.
 * Status enum: 1 ACTIVE / 2 EXPIRED / 3 REVOKED / 4 EXHAUSTED.
 *
 * <p><b>脱敏铁律 (SC-13 第一红线)</b>: this entity holds PII (sharer_student_id,
 * relation_id) but ShareController MUST NOT serialize the entity directly to
 * the wire — only ShareDto + MaskedPayloadDto (字段白名单) ever leave the
 * server boundary. relation_id / sharer_student_id stay server-side.
 */
@Entity
@Table(name = "share_token")
public class ShareToken {

    @Id
    @Column(name = "id")
    private Long id;

    @Column(name = "jti", nullable = false, length = 64, unique = true)
    private String jti;

    @Column(name = "sharer_student_id", nullable = false)
    private Long sharerStudentId;

    @Column(name = "share_type", nullable = false, length = 16)
    private String shareType;

    @Column(name = "relation_id", nullable = false, length = 128)
    private String relationId;

    @Column(name = "allow_claim", nullable = false)
    private boolean allowClaim;

    @Column(name = "usage_limit", nullable = false)
    private int usageLimit;

    @Column(name = "usage_count", nullable = false)
    private int usageCount;

    /** 1 ACTIVE / 2 EXPIRED / 3 REVOKED / 4 EXHAUSTED */
    @Column(name = "status", nullable = false)
    private short status;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "expires_at", nullable = false)
    private OffsetDateTime expiresAt;

    public ShareToken() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getJti() { return jti; }
    public void setJti(String jti) { this.jti = jti; }
    public Long getSharerStudentId() { return sharerStudentId; }
    public void setSharerStudentId(Long sharerStudentId) { this.sharerStudentId = sharerStudentId; }
    public String getShareType() { return shareType; }
    public void setShareType(String shareType) { this.shareType = shareType; }
    public String getRelationId() { return relationId; }
    public void setRelationId(String relationId) { this.relationId = relationId; }
    public boolean isAllowClaim() { return allowClaim; }
    public void setAllowClaim(boolean allowClaim) { this.allowClaim = allowClaim; }
    public int getUsageLimit() { return usageLimit; }
    public void setUsageLimit(int usageLimit) { this.usageLimit = usageLimit; }
    public int getUsageCount() { return usageCount; }
    public void setUsageCount(int usageCount) { this.usageCount = usageCount; }
    public short getStatus() { return status; }
    public void setStatus(short status) { this.status = status; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
    public OffsetDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(OffsetDateTime expiresAt) { this.expiresAt = expiresAt; }
}
