package com.longfeng.calendar.repo;

import com.longfeng.calendar.entity.CalendarEvent;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * CalendarEvent repository · BACKEND_GUIDANCE §3.2 pattern.
 */
public interface CalendarEventRepository extends JpaRepository<CalendarEvent, Long> {

    Optional<CalendarEvent> findByIdempotencyKey(String idempotencyKey);

    boolean existsByIdempotencyKey(String idempotencyKey);

    @Query("SELECT e FROM CalendarEvent e "
            + "WHERE e.ownerId = :ownerId "
            + "AND e.startAt >= :from AND e.startAt < :to "
            + "ORDER BY e.startAt ASC")
    List<CalendarEvent> findByOwnerAndDateRange(
            @Param("ownerId") Long ownerId,
            @Param("from") Instant from,
            @Param("to") Instant to);

    /**
     * P10 month query · same shape as {@link #findByOwnerAndDateRange} but
     * intent-named so call sites read clearer. JPA picks no semantic difference;
     * we keep one impl and let the service layer choose semantically right name.
     */
    default List<CalendarEvent> findByOwnerAndMonthRange(
            Long ownerId, Instant from, Instant to) {
        return findByOwnerAndDateRange(ownerId, from, to);
    }

    List<CalendarEvent> findByRelationTypeAndRelationIdStartingWith(
            String relationType, String relationIdPrefix);

    @Modifying
    @Query("UPDATE CalendarEvent e SET e.deletedAt = CURRENT_TIMESTAMP "
            + "WHERE e.relationType = :relationType "
            + "AND e.relationId LIKE :relationIdPrefix "
            + "AND e.deletedAt IS NULL")
    int softDeleteByRelation(
            @Param("relationType") String relationType,
            @Param("relationIdPrefix") String relationIdPrefix);
}
