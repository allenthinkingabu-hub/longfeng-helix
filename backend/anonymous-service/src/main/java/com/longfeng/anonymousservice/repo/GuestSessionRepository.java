package com.longfeng.anonymousservice.repo;

import com.longfeng.anonymousservice.entity.GuestSession;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * SC-12 · {@code guest_session} JPA repository.
 *
 * <p>T01 only uses the default {@code save} + {@code findById} CRUD methods.
 * Future slices will likely add status-scoped finders (e.g.
 * {@code findByIdAndStatusNot}) when the state machine grows.
 */
public interface GuestSessionRepository extends JpaRepository<GuestSession, Long> {
}
