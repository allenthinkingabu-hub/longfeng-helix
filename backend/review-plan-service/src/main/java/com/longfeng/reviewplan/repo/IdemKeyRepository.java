package com.longfeng.reviewplan.repo;

import com.longfeng.reviewplan.entity.IdemKey;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * SC20-T02: idem_key 表查询 · 加 created_at >= cutoff 5 min TTL window 支持.
 *
 * <p>沿 wrongbook-service.IdemKeyRepository 模式 · 加 SC20-T02 专用 5 min TTL 查询.
 */
public interface IdemKeyRepository extends JpaRepository<IdemKey, Long> {

    Optional<IdemKey> findByScopeAndIdemKey(String scope, String idemKey);

    /**
     * 取 5 min TTL window 内的同 (scope, idemKey, payload(nid)) 记录 ·
     * payload 字段存 nid · 用 LIKE 比对 JSONB 字符串避免 cast.
     *
     * @param scope     'ai-judge:judge'
     * @param idemKey   X-Idempotency-Key header value
     * @param nidPattern e.g. '%"nid":500%' (payload JSON 含 nid 字段)
     * @param cutoff    now() - 5 min
     */
    @Query(value = "SELECT * FROM idem_key WHERE scope = :scope AND idem_key = :idemKey "
            + "AND (CAST(payload AS text) LIKE :nidPatternA OR CAST(payload AS text) LIKE :nidPatternB) "
            + "AND created_at >= :cutoff "
            + "ORDER BY created_at DESC", nativeQuery = true)
    List<IdemKey> findRecentByScopeKeyNidPatterns(
            @Param("scope") String scope,
            @Param("idemKey") String idemKey,
            @Param("nidPatternA") String nidPatternA,
            @Param("nidPatternB") String nidPatternB,
            @Param("cutoff") OffsetDateTime cutoff);
}
