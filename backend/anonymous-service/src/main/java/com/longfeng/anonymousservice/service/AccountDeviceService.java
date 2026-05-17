package com.longfeng.anonymousservice.service;

import com.longfeng.anonymousservice.entity.AccountDevice;
import com.longfeng.anonymousservice.repo.AccountDeviceRepository;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * SC-00-T02 · biz §4.13 · silent upsert {@code account_device}.
 *
 * <p>Called by auth-service login hook (via {@code AccountDeviceFacade}) after a
 * student successfully logs in. P0 only writes; never reads. P1 (SC-14)
 * will read for the welcomeback chooser.
 *
 * <p>Composite-key behaviour ({@code uq_account_device on (student_id, device_fp)}):
 *   row exists → bump {@code last_seen_at} + {@code login_count++}
 *   row absent → INSERT with login_count=1
 */
@Service
public class AccountDeviceService {

    private static final Logger LOG = LoggerFactory.getLogger(AccountDeviceService.class);

    private final AccountDeviceRepository repo;

    public AccountDeviceService(AccountDeviceRepository repo) {
        this.repo = repo;
    }

    @Transactional
    public AccountDevice silentUpsert(long studentId, String deviceFp, String platform, String ua) {
        if (deviceFp == null || deviceFp.isBlank()) {
            throw new IllegalArgumentException("deviceFp must not be blank");
        }
        OffsetDateTime now = OffsetDateTime.now();
        Optional<AccountDevice> existing = repo.findByStudentIdAndDeviceFp(studentId, deviceFp);
        if (existing.isPresent()) {
            AccountDevice row = existing.get();
            row.setLastSeenAt(now);
            row.setLoginCount(row.getLoginCount() + 1);
            if (platform != null && !platform.isBlank() && row.getPlatform() == null) {
                row.setPlatform(platform);
            }
            return repo.save(row);
        }
        AccountDevice fresh = new AccountDevice();
        fresh.setStudentId(studentId);
        fresh.setDeviceFp(deviceFp);
        fresh.setPlatform(platform);
        fresh.setFirstSeenAt(now);
        fresh.setLastSeenAt(now);
        fresh.setLoginCount(1);
        try {
            return repo.save(fresh);
        } catch (DataIntegrityViolationException race) {
            // Two concurrent logins on the same (student, fp) raced to INSERT.
            // The second one finds the row this time — read-and-bump.
            LOG.debug("account_device_race resolved by re-read");
            return repo.findByStudentIdAndDeviceFp(studentId, deviceFp)
                    .map(r -> {
                        r.setLastSeenAt(OffsetDateTime.now());
                        r.setLoginCount(r.getLoginCount() + 1);
                        return repo.save(r);
                    })
                    .orElseThrow(() -> race); // give up — caller swallows it
        }
    }
}
