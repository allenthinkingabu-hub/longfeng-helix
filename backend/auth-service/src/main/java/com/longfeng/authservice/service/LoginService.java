package com.longfeng.authservice.service;

import com.longfeng.authservice.entity.AuthUser;
import com.longfeng.authservice.repo.AuthUserRepository;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Email/password login + 5-strike DB lockout state machine.
 *
 * <p>Flow:
 * <ol>
 *   <li>Find user by email. <strong>If not found → throw {@link InvalidCredentialsException}</strong>
 *       (unified with bad-password to defeat user enumeration).
 *   <li>If status=LOCKED and locked_until > now() → throw {@link AccountLockedException}.
 *   <li>If status=LOCKED but locked_until ≤ now() → auto-unlock (status=ACTIVE, reset failed_attempts).
 *   <li>bcrypt verify password. <strong>Mismatch:</strong> failed_attempts++; if hits threshold
 *       set status=LOCKED + locked_until=now()+5min; then throw InvalidCredentialsException
 *       (or AccountLockedException if it was the 5th strike that just triggered the lock).
 *   <li>Match: reset failed_attempts=0, set last_login_at=now(), return user.
 * </ol>
 */
@Service
public class LoginService {

    private static final Logger LOG = LoggerFactory.getLogger(LoginService.class);

    private final AuthUserRepository repo;
    private final BCryptPasswordEncoder encoder;
    private final int maxFailedAttempts;
    private final long lockDurationSeconds;

    public LoginService(
            AuthUserRepository repo,
            @Value("${auth.lockout.max-failed-attempts}") int maxFailedAttempts,
            @Value("${auth.lockout.lock-duration-seconds}") long lockDurationSeconds) {
        this.repo = repo;
        this.encoder = new BCryptPasswordEncoder();
        this.maxFailedAttempts = maxFailedAttempts;
        this.lockDurationSeconds = lockDurationSeconds;
    }

    /**
     * noRollbackFor — InvalidCredentialsException / AccountLockedException are *expected*
     * domain failures we want to surface; the counter increment + lockout save must
     * still commit. Without this, every wrong-password attempt would roll back the
     * failed_attempts++ and lockout would never trigger.
     */
    @Transactional(noRollbackFor = {
            InvalidCredentialsException.class,
            AccountLockedException.class
    })
    public AuthUser verifyCredentials(String email, String password) {
        Optional<AuthUser> opt = repo.findByEmail(email);
        if (opt.isEmpty()) {
            // Unified error to prevent enumeration · do NOT reveal that email is unknown.
            LOG.debug("login_fail email_not_found email={}", maskEmail(email));
            throw new InvalidCredentialsException();
        }
        AuthUser user = opt.get();

        // Soft-deleted account
        if ("DELETED".equals(user.getStatus())) {
            LOG.debug("login_fail deleted email={}", maskEmail(email));
            throw new InvalidCredentialsException();
        }

        OffsetDateTime now = OffsetDateTime.now();

        // Currently locked?
        if ("LOCKED".equals(user.getStatus())) {
            if (user.getLockedUntil() != null && user.getLockedUntil().isAfter(now)) {
                throw new AccountLockedException(user.getLockedUntil());
            }
            // Lockout expired — auto-unlock
            user.setStatus("ACTIVE");
            user.setFailedAttempts(0);
            user.setLockedUntil(null);
        }

        boolean ok = encoder.matches(password, user.getPasswordHash());
        if (!ok) {
            int attempts = user.getFailedAttempts() + 1;
            user.setFailedAttempts(attempts);
            if (attempts >= maxFailedAttempts) {
                user.setStatus("LOCKED");
                OffsetDateTime lockUntil = now.plus(Duration.ofSeconds(lockDurationSeconds));
                user.setLockedUntil(lockUntil);
                repo.save(user);
                LOG.info("login_lockout email={} attempts={} until={}",
                        maskEmail(email), attempts, lockUntil);
                // The 5th failure both increments AND locks — treat as ACCOUNT_LOCKED so
                // client sees the lockout banner immediately.
                throw new AccountLockedException(lockUntil);
            }
            repo.save(user);
            throw new InvalidCredentialsException();
        }

        // Success
        user.setFailedAttempts(0);
        user.setLockedUntil(null);
        user.setLastLoginAt(now);
        user.setStatus("ACTIVE");
        repo.save(user);
        return user;
    }

    private static String maskEmail(String email) {
        if (email == null) return "<null>";
        int at = email.indexOf('@');
        if (at <= 1) return "***" + email.substring(Math.max(0, at));
        return email.charAt(0) + "***" + email.substring(at);
    }

    /** 401 INVALID_CREDENTIALS — unified for wrong-email and wrong-password. */
    public static class InvalidCredentialsException extends RuntimeException {
        public InvalidCredentialsException() {
            super("Invalid email or password");
        }
    }

    /** 423 ACCOUNT_LOCKED — carries locked_until for UI countdown. */
    public static class AccountLockedException extends RuntimeException {
        private final OffsetDateTime lockedUntil;

        public AccountLockedException(OffsetDateTime lockedUntil) {
            super("Account locked until " + lockedUntil);
            this.lockedUntil = lockedUntil;
        }

        public OffsetDateTime getLockedUntil() {
            return lockedUntil;
        }
    }
}
