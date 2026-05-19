package com.longfeng.reviewplan.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.Instant;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/**
 * SC21-T01 · RLHF override 数据 outbox · biz §2B.21 步 5 + §12 S5.6.5.
 *
 * <p>当 ReviewPlanController.gradeNode() 检测到 {@code final_grade_source='ai_overridden'} ·
 * 同事务 INSERT 1 行到本表 · 由 {@link com.longfeng.reviewplan.job.JudgeOutboxRelayJob}
 * 每 5min 扫表批量投递到 RocketMQ topic {@code ai-judge.overridden} ·
 * 成功置 {@code status=SENT} · 失败 {@code retry_count++} · 5 次后置 {@code status=FAILED}.
 *
 * <p>沿现役 {@link ReviewPlanOutbox} pattern · 但表结构按 SC-21 业务字段精剪.
 */
@Entity
@Table(name = "wb_judge_outbox")
@EntityListeners(AuditingEntityListener.class)
public class WbJudgeOutbox implements Serializable {

  public static final String STATUS_PENDING = "PENDING";
  public static final String STATUS_SENT = "SENT";
  public static final String STATUS_FAILED = "FAILED";

  /** RLHF override 单行最大重试次数 · 第 5 次失败 → FAILED + alert. */
  public static final short MAX_RETRY = 5;

  @Id
  @Column(name = "id", nullable = false)
  private Long id;

  @Column(name = "nid", nullable = false)
  private Long nid;

  @Column(name = "ai_verdict", length = 16, nullable = false)
  private String aiVerdict;

  @Column(name = "user_verdict", length = 16, nullable = false)
  private String userVerdict;

  @Column(name = "image_key", length = 512)
  private String imageKey;

  @Column(name = "reason", columnDefinition = "TEXT")
  private String reason;

  @Column(name = "retry_count", nullable = false)
  private Short retryCount = 0;

  @Column(name = "status", length = 16, nullable = false)
  private String status = STATUS_PENDING;

  @CreatedDate
  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "last_retry_at")
  private Instant lastRetryAt;

  public Long getId() { return id; }
  public void setId(Long id) { this.id = id; }
  public Long getNid() { return nid; }
  public void setNid(Long nid) { this.nid = nid; }
  public String getAiVerdict() { return aiVerdict; }
  public void setAiVerdict(String aiVerdict) { this.aiVerdict = aiVerdict; }
  public String getUserVerdict() { return userVerdict; }
  public void setUserVerdict(String userVerdict) { this.userVerdict = userVerdict; }
  public String getImageKey() { return imageKey; }
  public void setImageKey(String imageKey) { this.imageKey = imageKey; }
  public String getReason() { return reason; }
  public void setReason(String reason) { this.reason = reason; }
  public Short getRetryCount() { return retryCount; }
  public void setRetryCount(Short retryCount) { this.retryCount = retryCount; }
  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }
  public Instant getCreatedAt() { return createdAt; }
  public Instant getLastRetryAt() { return lastRetryAt; }
  public void setLastRetryAt(Instant lastRetryAt) { this.lastRetryAt = lastRetryAt; }
}
