package com.longfeng.fileservice.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

@Entity
@Table(name = "wb_file")
@EntityListeners(AuditingEntityListener.class)
public class WbFile {

    public static final short STATUS_PENDING = 0;
    public static final short STATUS_UPLOADED = 1;

    @Id
    private Long id;

    @Column(name = "tenant_id")
    private Long tenantId;

    @Column(name = "student_id")
    private Long studentId;

    @Column(name = "object_key")
    private String objectKey;

    @Column(name = "mime_type")
    private String mimeType;

    @Column(name = "bytes")
    private Long bytes;

    @Column(name = "sha256_hash")
    private String sha256Hash;

    @Column(name = "status")
    private Short status;

    @Column(name = "storage_class")
    private String storageClass;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getTenantId() { return tenantId; }
    public void setTenantId(Long tenantId) { this.tenantId = tenantId; }
    public Long getStudentId() { return studentId; }
    public void setStudentId(Long studentId) { this.studentId = studentId; }
    public String getObjectKey() { return objectKey; }
    public void setObjectKey(String objectKey) { this.objectKey = objectKey; }
    public String getMimeType() { return mimeType; }
    public void setMimeType(String mimeType) { this.mimeType = mimeType; }
    public Long getBytes() { return bytes; }
    public void setBytes(Long bytes) { this.bytes = bytes; }
    public String getSha256Hash() { return sha256Hash; }
    public void setSha256Hash(String sha256Hash) { this.sha256Hash = sha256Hash; }
    public Short getStatus() { return status; }
    public void setStatus(Short status) { this.status = status; }
    public String getStorageClass() { return storageClass; }
    public void setStorageClass(String storageClass) { this.storageClass = storageClass; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
}
