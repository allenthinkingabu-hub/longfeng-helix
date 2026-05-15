package com.longfeng.wrongbook.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;

@Entity
@Table(name = "wrong_item_tag")
public class WrongItemTag {

    @Id
    private Long id;

    @Column(name = "wrong_item_id", nullable = false)
    private Long wrongItemId;

    @Column(name = "tag_code", nullable = false, length = 64)
    private String tagCode;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getWrongItemId() { return wrongItemId; }
    public void setWrongItemId(Long wrongItemId) { this.wrongItemId = wrongItemId; }
    public String getTagCode() { return tagCode; }
    public void setTagCode(String tagCode) { this.tagCode = tagCode; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
}
