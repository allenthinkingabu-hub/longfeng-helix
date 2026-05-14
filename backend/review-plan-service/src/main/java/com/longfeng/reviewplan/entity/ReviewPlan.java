package com.longfeng.reviewplan.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.time.Instant;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

@Entity
@Table(name = "review_plan")
@EntityListeners(AuditingEntityListener.class)
public class ReviewPlan {

    public static final short STATUS_ACTIVE = 0;
    public static final short STATUS_MASTERED = 1;

    @Id
    private Long id;

    @Column(name = "wrong_item_id")
    private Long wrongItemId;

    @Column(name = "student_id")
    private Long studentId;

    @Column(name = "node_index")
    private Short nodeIndex;

    @Column(name = "strategy_code")
    private String strategyCode;

    @Column(name = "start_at")
    private Instant startAt;

    @Column(name = "current_level")
    private Short currentLevel;

    @Column(name = "interval_index")
    private Short intervalIndex;

    @Column(name = "ease_factor")
    private BigDecimal easeFactor;

    @Column(name = "status")
    private Short status;

    @Column(name = "next_due_at")
    private Instant nextDueAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "total_review")
    private Integer totalReview = 0;

    @Column(name = "total_forget")
    private Integer totalForget = 0;

    @Column(name = "consecutive_good_count")
    private Short consecutiveGoodCount = 0;

    @Column(name = "mastery_score")
    private Integer masteryScore = 0;

    @Column(name = "dispatch_version")
    private Long dispatchVersion = 0L;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @Version
    @Column(name = "version")
    private Long version;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;

    public boolean isMastered() {
        return status != null && status == STATUS_MASTERED;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getWrongItemId() { return wrongItemId; }
    public void setWrongItemId(Long wrongItemId) { this.wrongItemId = wrongItemId; }
    public Long getStudentId() { return studentId; }
    public void setStudentId(Long studentId) { this.studentId = studentId; }
    public Short getNodeIndex() { return nodeIndex; }
    public void setNodeIndex(Short nodeIndex) { this.nodeIndex = nodeIndex; }
    public String getStrategyCode() { return strategyCode; }
    public void setStrategyCode(String strategyCode) { this.strategyCode = strategyCode; }
    public Instant getStartAt() { return startAt; }
    public void setStartAt(Instant startAt) { this.startAt = startAt; }
    public Short getCurrentLevel() { return currentLevel; }
    public void setCurrentLevel(Short currentLevel) { this.currentLevel = currentLevel; }
    public Short getIntervalIndex() { return intervalIndex; }
    public void setIntervalIndex(Short intervalIndex) { this.intervalIndex = intervalIndex; }
    public BigDecimal getEaseFactor() { return easeFactor; }
    public void setEaseFactor(BigDecimal easeFactor) { this.easeFactor = easeFactor; }
    public Short getStatus() { return status; }
    public void setStatus(Short status) { this.status = status; }
    public Instant getNextDueAt() { return nextDueAt; }
    public void setNextDueAt(Instant nextDueAt) { this.nextDueAt = nextDueAt; }
    public Instant getCompletedAt() { return completedAt; }
    public void setCompletedAt(Instant completedAt) { this.completedAt = completedAt; }
    public Integer getTotalReview() { return totalReview; }
    public void setTotalReview(Integer totalReview) { this.totalReview = totalReview; }
    public Integer getTotalForget() { return totalForget; }
    public void setTotalForget(Integer totalForget) { this.totalForget = totalForget; }
    public Short getConsecutiveGoodCount() { return consecutiveGoodCount; }
    public void setConsecutiveGoodCount(Short consecutiveGoodCount) { this.consecutiveGoodCount = consecutiveGoodCount; }
    public Instant getDeletedAt() { return deletedAt; }
    public void setDeletedAt(Instant deletedAt) { this.deletedAt = deletedAt; }
    public Long getDispatchVersion() { return dispatchVersion; }
    public void setDispatchVersion(Long dispatchVersion) { this.dispatchVersion = dispatchVersion; }
}
