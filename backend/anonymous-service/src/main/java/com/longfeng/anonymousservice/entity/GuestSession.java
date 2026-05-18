package com.longfeng.anonymousservice.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * SC-12 · biz §4.10 · {@code guest_session} JPA entity.
 *
 * <p>Schema source of truth: {@code V20260421_02__init_anonymous.sql} §1.
 *
 * <p>Status enum (mirror DDL comment exactly):
 * <pre>
 *   0 CREATED       — anon session minted, no upload yet (T01)
 *   1 ANALYZING     — image uploaded, AI inference in flight (T02-T03)
 *   2 RESULT_READY  — analysis_result_json populated (T04)
 *   3 FAILED        — AI inference error (T04)
 *   4 CLAIMED       — registered user picked it up (T05)
 *   9 EXPIRED       — past expires_at, swept by scheduled job
 * </pre>
 *
 * <p>T01 only writes {@code status=0 CREATED} on mint; later slices flip the
 * status as the session traverses the state machine. The {@code analysis_result_json}
 * column is JSONB at the SQL level but we keep it as {@code String} here — T01
 * never reads or writes it, and T04 will upgrade to a typed JdbcType if needed.
 *
 * <p>Like {@link ShareToken}, the PK is client-assigned BIGINT (no PG sequence)
 * with collision-retry on insert in {@code AnonSessionService}. Getters/setters
 * are hand-written — Lombok is not used in this service.
 */
@Entity
@Table(name = "guest_session")
public class GuestSession {

    @Id
    @Column(name = "id")
    private Long id;

    @Column(name = "device_fp", nullable = false, length = 128)
    private String deviceFp;

    @Column(name = "ip_hash", length = 64)
    private String ipHash;

    @Column(name = "ua", length = 256)
    private String ua;

    @Column(name = "entry_source", length = 32)
    private String entrySource;

    @Column(name = "experiment_bucket", length = 32)
    private String experimentBucket;

    @Column(name = "image_tmp_url", length = 512)
    private String imageTmpUrl;

    /**
     * JSONB at DDL level · biz §4.10.
     *
     * <p>T07 (2026-05-18) closes the T01 punt: now that {@link
     * com.longfeng.anonymousservice.service.AnonResultService} polls
     * ai-analysis-service and on a {@code DONE} verdict needs to persist the
     * full result payload into this column, the {@code insertable=false,
     * updatable=false} guard is removed and the {@code @JdbcTypeCode(SqlTypes.JSON)}
     * mapping that {@code AnalysisResult.steps} already uses is applied here
     * too. That pair tells Hibernate to bind the {@link String} via the JSONB
     * setter rather than as {@code character varying}, sidestepping the
     * SQLState 42804 ({@code column "analysis_result_json" is of type jsonb
     * but expression is of type character varying}) that T01 was working
     * around.
     *
     * <p>Type stays {@link String} — keeping the parse boundary at the
     * service layer means T08 (anonymous-claim) can pick the persisted JSON
     * apart at its leisure without forcing every reader to materialize a
     * {@code Map<String,Object>}.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "analysis_result_json", columnDefinition = "jsonb")
    private String analysisResultJson;

    @Column(name = "consent_at")
    private OffsetDateTime consentAt;

    /** 1 ADULT / 2 MINOR_WITH_GUARDIAN / 3 MINOR_NO_GUARDIAN (biz §4.10). */
    @Column(name = "consent_type")
    private Short consentType;

    /** 0 CREATED / 1 ANALYZING / 2 RESULT_READY / 3 FAILED / 4 CLAIMED / 9 EXPIRED. */
    @Column(name = "status", nullable = false)
    private short status;

    @Column(name = "claimed_by_student_id")
    private Long claimedByStudentId;

    @Column(name = "claimed_question_id")
    private Long claimedQuestionId;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "expires_at", nullable = false)
    private OffsetDateTime expiresAt;

    @Column(name = "claimed_at")
    private OffsetDateTime claimedAt;

    public GuestSession() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getDeviceFp() { return deviceFp; }
    public void setDeviceFp(String deviceFp) { this.deviceFp = deviceFp; }
    public String getIpHash() { return ipHash; }
    public void setIpHash(String ipHash) { this.ipHash = ipHash; }
    public String getUa() { return ua; }
    public void setUa(String ua) { this.ua = ua; }
    public String getEntrySource() { return entrySource; }
    public void setEntrySource(String entrySource) { this.entrySource = entrySource; }
    public String getExperimentBucket() { return experimentBucket; }
    public void setExperimentBucket(String experimentBucket) { this.experimentBucket = experimentBucket; }
    public String getImageTmpUrl() { return imageTmpUrl; }
    public void setImageTmpUrl(String imageTmpUrl) { this.imageTmpUrl = imageTmpUrl; }
    public String getAnalysisResultJson() { return analysisResultJson; }
    public void setAnalysisResultJson(String analysisResultJson) { this.analysisResultJson = analysisResultJson; }
    public OffsetDateTime getConsentAt() { return consentAt; }
    public void setConsentAt(OffsetDateTime consentAt) { this.consentAt = consentAt; }
    public Short getConsentType() { return consentType; }
    public void setConsentType(Short consentType) { this.consentType = consentType; }
    public short getStatus() { return status; }
    public void setStatus(short status) { this.status = status; }
    public Long getClaimedByStudentId() { return claimedByStudentId; }
    public void setClaimedByStudentId(Long claimedByStudentId) { this.claimedByStudentId = claimedByStudentId; }
    public Long getClaimedQuestionId() { return claimedQuestionId; }
    public void setClaimedQuestionId(Long claimedQuestionId) { this.claimedQuestionId = claimedQuestionId; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
    public OffsetDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(OffsetDateTime expiresAt) { this.expiresAt = expiresAt; }
    public OffsetDateTime getClaimedAt() { return claimedAt; }
    public void setClaimedAt(OffsetDateTime claimedAt) { this.claimedAt = claimedAt; }
}
