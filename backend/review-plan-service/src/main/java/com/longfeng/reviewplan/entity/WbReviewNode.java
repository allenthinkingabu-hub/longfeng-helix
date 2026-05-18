package com.longfeng.reviewplan.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * SC20-T02 wb_review_node 表 JPA entity · 映射 SC20-T01 V1.0.084 落地的 14 base + 6 satellite = 20 列.
 *
 * <p>关系: 本表 id = review_plan.id (B02 决策 A · nid ≡ review_plan.id) ·
 * plan_id 同 id 取值 (字面冗余 · 用于 master 4.5 字段定义保留). 用例 1-6 测的就是此表的 6 satellite 列.
 *
 * <p>本 entity 仅声明 SC20-T02 需要操作的字段子集 (id / status / user_answer_image_key / ai_judge_ 5 列 +
 * final_grade_source) · 14 base 列其他字段不在本 entity 暴露 · IT seed 时直接 INSERT raw SQL.
 *
 * <p>关键铁律 A.1 学生主体性: judge API 不直接落 grade · 仅写 6 satellite 列 + 保持 status=0 SCHEDULED
 *  (不切换 status=3 REVIEWED · 那是 master 10.5 grade 的事).
 */
@Entity
@Table(name = "wb_review_node")
public class WbReviewNode {

    @Id
    private Long id;

    @Column(name = "status", nullable = false)
    private Short status;

    @Column(name = "plan_id", nullable = false)
    private Long planId;

    @Column(name = "student_id", nullable = false)
    private Long studentId;

    @Column(name = "user_answer_image_key", length = 512)
    private String userAnswerImageKey;

    @Column(name = "ai_judge_verdict", length = 16)
    private String aiJudgeVerdict;

    @Column(name = "ai_judge_confidence", precision = 3, scale = 2)
    private BigDecimal aiJudgeConfidence;

    @Column(name = "ai_judge_reason", columnDefinition = "TEXT")
    private String aiJudgeReason;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "ai_judge_metadata", columnDefinition = "JSONB")
    private String aiJudgeMetadata;

    @Column(name = "final_grade_source", nullable = false, length = 16)
    private String finalGradeSource;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Short getStatus() { return status; }
    public void setStatus(Short status) { this.status = status; }
    public Long getPlanId() { return planId; }
    public void setPlanId(Long planId) { this.planId = planId; }
    public Long getStudentId() { return studentId; }
    public void setStudentId(Long studentId) { this.studentId = studentId; }
    public String getUserAnswerImageKey() { return userAnswerImageKey; }
    public void setUserAnswerImageKey(String userAnswerImageKey) { this.userAnswerImageKey = userAnswerImageKey; }
    public String getAiJudgeVerdict() { return aiJudgeVerdict; }
    public void setAiJudgeVerdict(String aiJudgeVerdict) { this.aiJudgeVerdict = aiJudgeVerdict; }
    public BigDecimal getAiJudgeConfidence() { return aiJudgeConfidence; }
    public void setAiJudgeConfidence(BigDecimal aiJudgeConfidence) { this.aiJudgeConfidence = aiJudgeConfidence; }
    public String getAiJudgeReason() { return aiJudgeReason; }
    public void setAiJudgeReason(String aiJudgeReason) { this.aiJudgeReason = aiJudgeReason; }
    public String getAiJudgeMetadata() { return aiJudgeMetadata; }
    public void setAiJudgeMetadata(String aiJudgeMetadata) { this.aiJudgeMetadata = aiJudgeMetadata; }
    public String getFinalGradeSource() { return finalGradeSource; }
    public void setFinalGradeSource(String finalGradeSource) { this.finalGradeSource = finalGradeSource; }
}
