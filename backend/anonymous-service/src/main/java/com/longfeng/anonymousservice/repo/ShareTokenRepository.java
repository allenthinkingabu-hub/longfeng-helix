package com.longfeng.anonymousservice.repo;

import com.longfeng.anonymousservice.entity.ShareToken;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * SC-13 · {@code share_token} repository — unique lookup by jti.
 * DB unique index {@code uq_share_token_jti} guarantees at most one row.
 */
public interface ShareTokenRepository extends JpaRepository<ShareToken, Long> {
    Optional<ShareToken> findByJti(String jti);
}
