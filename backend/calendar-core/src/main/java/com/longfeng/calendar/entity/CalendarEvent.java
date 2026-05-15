package com.longfeng.calendar.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/**
 * S5 calendar_event · biz §2A.4 + P09 spec §5 #3.
 *
 * <p>Soft-delete via deleted_at (BACKEND_GUIDANCE §5.2).
 * Optimistic locking via @Version (§5.1).
 * ID = Snowflake (§5.3).
 */
@Entity
@Table(name = "calendar_event")
@SQLDelete(sql = "UPDATE calendar_event SET deleted_at = now() WHERE id = ? AND version = ?")
@SQLRestriction("deleted_at IS NULL")
@EntityListeners(AuditingEntityListener.class)
public class CalendarEvent {

    public static final String STATE_SCHEDULED = "SCHEDULED";
    public static final String STATE_COMPLETED = "COMPLETED";
    public static final String STATE_CANCELLED = "CANCELLED";

    @Id
    private Long id;

    @Column(name = "relation_type", nullable = false, length = 32)
    private String relationType;

    @Column(name = "relation_id", nullable = false, length = 128)
    private String relationId;

    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    @Column(name = "title", nullable = false, length = 256)
    private String title;

    @Column(name = "start_at", nullable = false)
    private Instant startAt;

    @Column(name = "end_at", nullable = false)
    private Instant endAt;

    @Column(name = "state", nullable = false, length = 32)
    private String state = STATE_SCHEDULED;

    @Column(name = "color_tag", length = 16)
    private String colorTag;

    @Column(name = "source", length = 64)
    private String source;

    @Column(name = "idempotency_key", length = 256)
    private String idempotencyKey;

    @Column(name = "subscribed", nullable = false)
    private boolean subscribed = false;

    @Column(name = "subscribed_at")
    private Instant subscribedAt;

    @Version
    @Column(name = "version", nullable = false)
    private Long version;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    // === Getters / Setters ===

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getRelationType() { return relationType; }
    public void setRelationType(String relationType) { this.relationType = relationType; }

    public String getRelationId() { return relationId; }
    public void setRelationId(String relationId) { this.relationId = relationId; }

    public Long getOwnerId() { return ownerId; }
    public void setOwnerId(Long ownerId) { this.ownerId = ownerId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public Instant getStartAt() { return startAt; }
    public void setStartAt(Instant startAt) { this.startAt = startAt; }

    public Instant getEndAt() { return endAt; }
    public void setEndAt(Instant endAt) { this.endAt = endAt; }

    public String getState() { return state; }
    public void setState(String state) { this.state = state; }

    public String getColorTag() { return colorTag; }
    public void setColorTag(String colorTag) { this.colorTag = colorTag; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public String getIdempotencyKey() { return idempotencyKey; }
    public void setIdempotencyKey(String idempotencyKey) { this.idempotencyKey = idempotencyKey; }

    public boolean isSubscribed() { return subscribed; }
    public void setSubscribed(boolean subscribed) { this.subscribed = subscribed; }

    public Instant getSubscribedAt() { return subscribedAt; }
    public void setSubscribedAt(Instant subscribedAt) { this.subscribedAt = subscribedAt; }

    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public Instant getDeletedAt() { return deletedAt; }
    public void setDeletedAt(Instant deletedAt) { this.deletedAt = deletedAt; }
}
