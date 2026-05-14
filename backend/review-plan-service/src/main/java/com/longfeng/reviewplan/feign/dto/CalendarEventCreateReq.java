package com.longfeng.reviewplan.feign.dto;

import java.time.Instant;

public class CalendarEventCreateReq {

    private String relationType;
    private String relationId;
    private Long ownerId;
    private String title;
    private Instant startAt;
    private Instant endAt;
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
