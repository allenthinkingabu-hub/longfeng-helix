package com.longfeng.wrongbook.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.OffsetDateTime;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;

/**
 * wrong_item 主错题表 · 6 态状态机 (PENDING/ANALYZING/ANALYZED/CONFIRMED/ARCHIVED/FAILED)
 * 对齐 A01-wrongbook-schema.md §1.1
 */
@Entity
@Table(name = "wrong_item")
@SQLDelete(sql = "UPDATE wrong_item SET deleted_at = now() WHERE id = ? AND version = ?")
@SQLRestriction("deleted_at IS NULL")
public class WrongItem {

    @Id
    private Long id;

    @Column(name = "student_id", nullable = false)
    private Long studentId;

    @Column(name = "subject", nullable = false, length = 16)
    private String subject;

    @Column(name = "grade_code", length = 16)
    private String gradeCode;

    @Column(name = "source_type", nullable = false)
    private Short sourceType;

    @Column(name = "origin_image_key", length = 512)
    private String originImageKey;

    @Column(name = "processed_image_key", length = 512)
    private String processedImageKey;

    @Column(name = "ocr_text", columnDefinition = "TEXT")
    private String ocrText;

    @Column(name = "stem_text", columnDefinition = "TEXT")
    private String stemText;

    @Column(name = "status", nullable = false)
    private Short status;

    @Column(name = "mastery", nullable = false)
    private Short mastery;

    @Column(name = "difficulty")
    private Short difficulty;

    @Column(name = "mastered_at")
    private OffsetDateTime masteredAt;

    @Version
    @Column(name = "version", nullable = false)
    private Long version;

    @Column(name = "created_at", updatable = false, nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    // ── getters / setters ──

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getStudentId() { return studentId; }
    public void setStudentId(Long studentId) { this.studentId = studentId; }
    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }
    public String getGradeCode() { return gradeCode; }
    public void setGradeCode(String gradeCode) { this.gradeCode = gradeCode; }
    public Short getSourceType() { return sourceType; }
    public void setSourceType(Short sourceType) { this.sourceType = sourceType; }
    public String getOriginImageKey() { return originImageKey; }
    public void setOriginImageKey(String originImageKey) { this.originImageKey = originImageKey; }
    public String getProcessedImageKey() { return processedImageKey; }
    public void setProcessedImageKey(String processedImageKey) { this.processedImageKey = processedImageKey; }
    public String getOcrText() { return ocrText; }
    public void setOcrText(String ocrText) { this.ocrText = ocrText; }
    public String getStemText() { return stemText; }
    public void setStemText(String stemText) { this.stemText = stemText; }
    public Short getStatus() { return status; }
    public void setStatus(Short status) { this.status = status; }
    public Short getMastery() { return mastery; }
    public void setMastery(Short mastery) { this.mastery = mastery; }
    public Short getDifficulty() { return difficulty; }
    public void setDifficulty(Short difficulty) { this.difficulty = difficulty; }
    public OffsetDateTime getMasteredAt() { return masteredAt; }
    public void setMasteredAt(OffsetDateTime masteredAt) { this.masteredAt = masteredAt; }
    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(OffsetDateTime updatedAt) { this.updatedAt = updatedAt; }
    public OffsetDateTime getDeletedAt() { return deletedAt; }
    public void setDeletedAt(OffsetDateTime deletedAt) { this.deletedAt = deletedAt; }
}
