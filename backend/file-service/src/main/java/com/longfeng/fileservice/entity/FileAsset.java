package com.longfeng.fileservice.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Placeholder entity for file asset (used by FileUploadIT / BackendChainIT).
 */
@Entity
@Table(name = "file_asset")
public class FileAsset {

    public static final String STATUS_READY = "READY";

    @Id
    private Long id;

    @Column(name = "object_key")
    private String objectKey;

    @Column(name = "status")
    private String status;

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
    public String getVariantThumbKey() { return variantThumbKey; }
    public void setVariantThumbKey(String variantThumbKey) { this.variantThumbKey = variantThumbKey; }
    public String getVariantMediumKey() { return variantMediumKey; }
    public void setVariantMediumKey(String variantMediumKey) { this.variantMediumKey = variantMediumKey; }
}
