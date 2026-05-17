package com.longfeng.aianalysis.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.time.OffsetDateTime;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.SQLDelete;
import org.hibernate.annotations.SQLRestriction;
import org.hibernate.type.SqlTypes;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

@Entity
@Table(name = "analysis_result")
@SQLDelete(sql = "UPDATE analysis_result SET deleted_at = now() WHERE id = ? AND version = ?")
@SQLRestriction("deleted_at IS NULL")
@EntityListeners(AuditingEntityListener.class)
public class AnalysisResult {

    @Id
    private Long id;

    @Column(name = "task_id", nullable = false)
    private String taskId;

    @Column(name = "stem")
    private String stem;

    @Column(name = "error_reason")
    private String errorReason;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "steps", columnDefinition = "jsonb")
    private String steps;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "explain_chunks", columnDefinition = "jsonb")
    private String explainChunks;

    // P09-FOLLOWUP-#2 · AI 提示词新加 knowledgePoints 输出 ·
    // shape: [{name:string}, ...] · 1-3 个 KP 名 (顶点式 / 配方法 / 对称轴 ...)
    // 老数据 null · 新分析才填.
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "knowledge_points", columnDefinition = "jsonb")
    private String knowledgePoints;

    @Column(name = "provider")
    private String provider;

    @Column(name = "model")
    private String model;

    @Column(name = "usage_tokens")
    private Integer usageTokens;

    @Version
    private Long version;

    @CreatedDate
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @LastModifiedDate
    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTaskId() { return taskId; }
    public void setTaskId(String taskId) { this.taskId = taskId; }
    public String getStem() { return stem; }
    public void setStem(String stem) { this.stem = stem; }
    public String getErrorReason() { return errorReason; }
    public void setErrorReason(String errorReason) { this.errorReason = errorReason; }
    public String getSteps() { return steps; }
    public void setSteps(String steps) { this.steps = steps; }
    public String getExplainChunks() { return explainChunks; }
    public void setExplainChunks(String explainChunks) { this.explainChunks = explainChunks; }
    public String getKnowledgePoints() { return knowledgePoints; }
    public void setKnowledgePoints(String knowledgePoints) { this.knowledgePoints = knowledgePoints; }
    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }
    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }
    public Integer getUsageTokens() { return usageTokens; }
    public void setUsageTokens(Integer usageTokens) { this.usageTokens = usageTokens; }
    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
    public OffsetDateTime getDeletedAt() { return deletedAt; }
    public void setDeletedAt(OffsetDateTime deletedAt) { this.deletedAt = deletedAt; }
}
