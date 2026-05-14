package com.longfeng.calendar.service;

import com.longfeng.calendar.dto.CalendarEventCreateReq;
import com.longfeng.calendar.dto.CalendarEventResp;
import com.longfeng.calendar.dto.CalendarSubscribeResp;
import com.longfeng.calendar.entity.CalendarEvent;
import com.longfeng.calendar.repo.CalendarEventRepository;
import com.longfeng.calendar.support.SnowflakeIdGenerator;
import com.longfeng.common.exception.BusinessException;
import com.longfeng.common.exception.ErrCode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * S5 calendar-core business service.
 *
 * <p>Batch create (Feign target from review-plan-service) + subscribe (P09 §5 #3)
 * + query by date (GET /calendar/nodes) + soft delete by relation (FORGOT cascade).
 */
@Service
public class CalendarEventService {

    private static final Logger LOG = LoggerFactory.getLogger(CalendarEventService.class);

    private final CalendarEventRepository repo;
    private final SnowflakeIdGenerator idGen;

    public CalendarEventService(CalendarEventRepository repo, SnowflakeIdGenerator idGen) {
        this.repo = repo;
        this.idGen = idGen;
    }

    /**
     * Batch create calendar events · Feign target POST /internal/events/batch.
     * Idempotent per idempotency_key (unique index).
     */
    @Transactional
    public List<CalendarEventResp> batchCreate(List<CalendarEventCreateReq> reqs) {
        List<CalendarEventResp> results = new ArrayList<>(reqs.size());
        for (CalendarEventCreateReq req : reqs) {
            CalendarEvent event = createOneIdempotent(req);
            results.add(toResp(event));
        }
        LOG.info("calendar batchCreate ok · size={}", results.size());
        return results;
    }

    /**
     * Subscribe event · POST /api/calendar/events/{eid}/subscribe + internal variant.
     * Idempotent: if already subscribed, returns current snapshot.
     */
    @Transactional
    public CalendarSubscribeResp subscribe(Long eventId) {
        CalendarEvent event = repo.findById(eventId)
                .orElseThrow(() -> new BusinessException(
                        ErrCode.RESOURCE_NOT_FOUND,
                        "msgkey:calendar.error.event_not_found"));
        if (!event.isSubscribed()) {
            event.setSubscribed(true);
            event.setSubscribedAt(Instant.now());
            repo.save(event);
        }
        return new CalendarSubscribeResp(
                event.getId(),
                true,
                event.getSubscribedAt() != null ? event.getSubscribedAt().toString() : null,
                null);
    }

    /**
     * Query events by owner + date range · GET /calendar/nodes?date=...
     * Returns events whose start_at falls within the given date (in the specified timezone).
     */
    @Transactional(readOnly = true)
    public List<CalendarEventResp> findByOwnerAndDate(Long ownerId, LocalDate date, ZoneId tz) {
        ZonedDateTime startOfDay = date.atStartOfDay(tz);
        Instant from = startOfDay.toInstant();
        Instant to = startOfDay.plusDays(1).toInstant();
        List<CalendarEvent> events = repo.findByOwnerAndDateRange(ownerId, from, to);
        return events.stream().map(this::toResp).toList();
    }

    /**
     * Soft delete events by relation prefix · FORGOT cascade.
     * DELETE /internal/events?relationType=STUDY&relationIdPrefix=question:123:%
     */
    @Transactional
    public int softDeleteByRelation(String relationType, String relationIdPrefix) {
        int deleted = repo.softDeleteByRelation(relationType, relationIdPrefix + "%");
        LOG.info("calendar softDelete · type={} · prefix={} · count={}",
                relationType, relationIdPrefix, deleted);
        return deleted;
    }

    private CalendarEvent createOneIdempotent(CalendarEventCreateReq req) {
        if (req.getIdempotencyKey() != null && !req.getIdempotencyKey().isBlank()) {
            Optional<CalendarEvent> existing = repo.findByIdempotencyKey(req.getIdempotencyKey());
            if (existing.isPresent()) {
                return existing.get();
            }
        }

        CalendarEvent e = new CalendarEvent();
        e.setId(idGen.nextId());
        e.setRelationType(req.getRelationType());
        e.setRelationId(req.getRelationId());
        e.setOwnerId(req.getOwnerId());
        e.setTitle(req.getTitle());
        e.setStartAt(req.getStartAt());
        e.setEndAt(req.getEndAt());
        e.setState(req.getState() != null ? req.getState() : CalendarEvent.STATE_SCHEDULED);
        e.setColorTag(req.getColorTag());
        e.setSource(req.getSource());
        e.setIdempotencyKey(req.getIdempotencyKey());

        try {
            return repo.saveAndFlush(e);
        } catch (DataIntegrityViolationException ex) {
            // Concurrent insert with same idempotency_key
            if (req.getIdempotencyKey() != null) {
                return repo.findByIdempotencyKey(req.getIdempotencyKey()).orElse(e);
            }
            throw ex;
        }
    }

    private CalendarEventResp toResp(CalendarEvent e) {
        return new CalendarEventResp(
                e.getId(),
                e.getRelationType(),
                e.getRelationId(),
                e.getOwnerId(),
                e.getTitle(),
                e.getStartAt(),
                e.getEndAt(),
                e.getState(),
                e.getColorTag(),
                e.isSubscribed());
    }
}
