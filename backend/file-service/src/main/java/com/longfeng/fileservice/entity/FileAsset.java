package com.longfeng.fileservice.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Entity for file asset (used by UploadController presign/complete/download chain).
 */
@Entity
@Table(name = "file_asset")
public class FileAsset {

    public static final String STATUS_READY = "READY";

    @Id
    private Long id;

    @Column(name = "object_key", unique = true)
    private String objectKey;

    @Column(name = "status")
    private String status;

    @Column(name = "owner_id")
    private Long ownerId;

    @Column(name = "mime_type")
    private String mimeType;

    @Column(name = "file_size")
    private Long fileSize;

    @Column(name = "variant_thumb_key")
    private String variantThumbKey;

    @Column(name = "variant_medium_key")
    private String variantMediumKey;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getObjectKey() { return objectKey; }
    public void setObjectKey(String objectKey) { this.objectKey = objectKey; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Long getOwnerId() { return ownerId; }
    public void setOwnerId(Long ownerId) { this.ownerId = ownerId; }
    public String getMimeType() { return mimeType; }
    public void setMimeType(String mimeType) { this.mimeType = mimeType; }
    public Long getFileSize() { return fileSize; }
    public void setFileSize(Long fileSize) { this.fileSize = fileSize; }
    public String getVariantThumbKey() { return variantThumbKey; }
    public void setVariantThumbKey(String variantThumbKey) { this.variantThumbKey = variantThumbKey; }
    public String getVariantMediumKey() { return variantMediumKey; }
    public void setVariantMediumKey(String variantMediumKey) { this.variantMediumKey = variantMediumKey; }
}
