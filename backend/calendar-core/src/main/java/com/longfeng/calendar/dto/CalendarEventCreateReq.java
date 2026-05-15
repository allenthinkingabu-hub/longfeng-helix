package com.longfeng.calendar.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;

/**
 * Feign inbound DTO · mirrors review-plan-service CalendarEventCreateReq shape.
 * POST /internal/events/batch request body element.
 */
public class CalendarEventCreateReq {

    @NotBlank private String relationType;
    @NotBlank private String relationId;
    @NotNull  private Long ownerId;
    @NotBlank private String title;
    @NotNull  private Instant startAt;
    @NotNull  private Instant endAt;
    private String state;
    private String colorTag;
    private String source;
    private String idempotencyKey;

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
}
