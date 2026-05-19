package com.longfeng.reviewplan.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * 全局幂等键表 · scope + idem_key 唯一约束 · 对齐 BACKEND_GUIDANCE §6.2 持久幂等.
 *
 * <p>本类是 review-plan-service 本地副本 · 对齐 wrongbook-service.entity.IdemKey ·
 * 共享同一 PG 表 (team-5-pg.wrongbook.idem_key) · scope 区分用途 (e.g. 'ai-judge:judge').
 *
 * <p>SC20-T02: AnswerJudgeService 用此表实现 X-Idempotency-Key + nid 双键幂等
 * (payload 字段存 nid · scope='ai-judge:judge') · 5 min TTL window 由查询时 created_at 过滤.
 */
@Entity
@Table(name = "idem_key")
public class IdemKey {

    @Id
    private Long id;

    @Column(name = "scope", nullable = false, length = 64)
    private String scope;

    @Column(name = "idem_key", nullable = false, length = 256)
    private String idemKey;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "payload", columnDefinition = "JSONB")
    private String payload;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getScope() { return scope; }
    public void setScope(String scope) { this.scope = scope; }
    public String getIdemKey() { return idemKey; }
    public void setIdemKey(String idemKey) { this.idemKey = idemKey; }
    public String getPayload() { return payload; }
    public void setPayload(String payload) { this.payload = payload; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
}
