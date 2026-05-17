package com.longfeng.anonymousservice.repo;

import com.longfeng.anonymousservice.entity.GuestRateBucket;
import java.time.LocalDate;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * SC-12 · {@code guest_rate_bucket} JPA repository.
 *
 * <p>T01 wires this interface so SC-12-T06 (rate-limit slice) can plug in its
 * quota check without re-shipping repo scaffolding. The {@code findByDeviceFpAndBucketDate}
 * derived query is named to match the {@code bucket_date} DDL column (not
 * {@code date}, which is a SQL keyword).
 */
public interface GuestRateBucketRepository extends JpaRepository<GuestRateBucket, Long> {

    Optional<GuestRateBucket> findByDeviceFpAndBucketDate(String deviceFp, LocalDate bucketDate);
}
