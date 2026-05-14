package com.longfeng.reviewplan.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

@Entity
@Table(name = "review_outcome")
@EntityListeners(AuditingEntityListener.class)
public class ReviewOutcome {

    @Id
    private Long id;

    @Column(name = "plan_id")
    private Long planId;

    @Column(name = "wrong_item_id")
    private Long wrongItemId;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "quality")
    private Short quality;

    @Column(name = "ease_factor_before")
    private BigDecimal easeFactorBefore;

    @Column(name = "ease_factor_after")
    private BigDecimal easeFactorAfter;

    @Column(name = "interval_days_before")
    private Integer intervalDaysBefore;

    @Column(name = "interval_days_after")
    private Integer intervalDaysAfter;

    @Column(name = "completed_at")
    private Instant completedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getPlanId() { return planId; }
    public void setPlanId(Long planId) { this.planId = planId; }
    public Long getWrongItemId() { return wrongItemId; }
    public void setWrongItemId(Long wrongItemId) { this.wrongItemId = wrongItemId; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public Short getQuality() { return quality; }
    public void setQuality(Short quality) { this.quality = quality; }
    public BigDecimal getEaseFactorBefore() { return easeFactorBefore; }
    public void setEaseFactorBefore(BigDecimal easeFactorBefore) { this.easeFactorBefore = easeFactorBefore; }
    public BigDecimal getEaseFactorAfter() { return easeFactorAfter; }
    public void setEaseFactorAfter(BigDecimal easeFactorAfter) { this.easeFactorAfter = easeFactorAfter; }
    public Integer getIntervalDaysBefore() { return intervalDaysBefore; }
    public void setIntervalDaysBefore(Integer intervalDaysBefore) { this.intervalDaysBefore = intervalDaysBefore; }
    public Integer getIntervalDaysAfter() { return intervalDaysAfter; }
    public void setIntervalDaysAfter(Integer intervalDaysAfter) { this.intervalDaysAfter = intervalDaysAfter; }
    public Instant getCompletedAt() { return completedAt; }
    public void setCompletedAt(Instant completedAt) { this.completedAt = completedAt; }
}
