package com.longfeng.fileservice.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

@Entity
@Table(name = "wb_file_lifecycle")
public class WbFileLifecycle {

    @Id
    private Long id;

    @OneToOne
    @MapsId
    @JoinColumn(name = "id")
    private WbFile file;

    @Column(name = "tenant_id")
    private Long tenantId;

    @Column(name = "promote_at")
    private OffsetDateTime promoteAt;

    @Column(name = "archive_at")
    private OffsetDateTime archiveAt;

    public Long getId() { return id; }
    public WbFile getFile() { return file; }
    public void setFile(WbFile file) { this.file = file; }
    public Long getTenantId() { return tenantId; }
    public void setTenantId(Long tenantId) { this.tenantId = tenantId; }
    public OffsetDateTime getPromoteAt() { return promoteAt; }
    public void setPromoteAt(OffsetDateTime promoteAt) { this.promoteAt = promoteAt; }
    public OffsetDateTime getArchiveAt() { return archiveAt; }
    public void setArchiveAt(OffsetDateTime archiveAt) { this.archiveAt = archiveAt; }
}
