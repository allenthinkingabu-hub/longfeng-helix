package com.longfeng.anonymousservice.repo;

import com.longfeng.anonymousservice.entity.AccountDevice;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * SC-00-T02 · {@code account_device} repository — composite-key lookup by
 * (student_id, device_fp). The DB UNIQUE index {@code uq_account_device} guarantees
 * one row per pair so {@code findByStudentIdAndDeviceFp} returns at most one.
 */
public interface AccountDeviceRepository extends JpaRepository<AccountDevice, Long> {
    Optional<AccountDevice> findByStudentIdAndDeviceFp(Long studentId, String deviceFp);
}
