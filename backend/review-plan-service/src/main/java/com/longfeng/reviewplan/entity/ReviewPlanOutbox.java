package com.longfeng.reviewplan.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.Instant;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/** Outbox 事件暂存 · V1.0.054 · ADR 0005 兜底 · Relay 扫表发 MQ · SC-08.AC-1。 */
@Entity
@Table(name = "review_plan_outbox")
@EntityListeners(AuditingEntityListener.class)
public class ReviewPlanOutbox implements Serializable {

  public static final String EVENT_COMPLETED = "completed";
  public static final String EVENT_MASTERED = "mastered";
  public static final String EVENT_DUE = "due";
  /** SC-01-C05 · P08 节点被打开 · 满足 SC-01 §key_invariants "review.node.opened ≥ 1 条". */
  public static final String EVENT_OPENED = "opened";
  /** SC-01-C05 · P08 节点已评分（grade triad） · "review.node.graded ≥ 1 条". */
  public static final String EVENT_GRADED = "graded";
  /**
   * SC-01-C07 · A06 §3 D5 · calendar-core 503 兜底：批量创建 7 条 calendar_event
   * (relation_type=STUDY) 失败时由 {@code CalendarBatchCreateService} 写入；payload 为 jsonb，
   * 字段 {@code planId} / {@code wrongItemId} / {@code userId} / {@code reqs}(数组共 7 条
   * {@link com.longfeng.reviewplan.feign.dto.CalendarEventCreateReq})；由
   * {@code CalendarOutboxRelayJob} 扫表重试。
   */
  public static final String EVENT_CALENDAR_BATCH_CREATE = "calendar_event_batch_create";

  public static final String STATUS_PENDING = "pending";
  public static final String STATUS_DISPATCHED = "dispatched";
  public static final String STATUS_FAILED = "failed";

  @Id
  @Column(name = "id", nullable = false)
  private Long id;

  @Column(name = "plan_id", nullable = false)
  private Long planId;

  @Column(name = "event_type", length = 32, nullable = false)
  private String eventType;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "payload", nullable = false, columnDefinition = "jsonb")
  private String payload;

  @Column(name = "status", length = 16, nullable = false)
  private String status = STATUS_PENDING;

  @Column(name = "retry_count", nullable = false)
  private Short retryCount = 0;

  @CreatedDate
  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @LastModifiedDate
  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  @Column(name = "dispatched_at")
  private Instant dispatchedAt;

  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }
  public Long getPlanId() { return planId; }
  public void setPlanId(Long planId) { this.planId = planId; }
  public String getEventType() { return eventType; }
  public void setEventType(String eventType) { this.eventType = eventType; }
  public String getPayload() { return payload; }
  public void setPayload(String payload) { this.payload = payload; }
  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }
  public Short getRetryCount() { return retryCount; }
  public void setRetryCount(Short retryCount) { this.retryCount = retryCount; }
  public Instant getCreatedAt() { return createdAt; }
  public Instant getUpdatedAt() { return updatedAt; }
  public Instant getDispatchedAt() { return dispatchedAt; }
  public void setDispatchedAt(Instant dispatchedAt) { this.dispatchedAt = dispatchedAt; }
}
