package com.longfeng.wrongbook.service;

import com.longfeng.common.exception.BusinessException;
import com.longfeng.common.exception.ErrCode;
import com.longfeng.wrongbook.entity.WrongItem;
import com.longfeng.wrongbook.entity.WrongItemOutbox;
import com.longfeng.wrongbook.repo.WrongItemOutboxRepository;
import com.longfeng.wrongbook.repo.WrongItemRepository;
import com.longfeng.wrongbook.support.SnowflakeIdGenerator;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WrongItemService {

    private final WrongItemRepository repo;
    private final WrongItemOutboxRepository outboxRepo;
    private final SnowflakeIdGenerator idGen;

    public WrongItemService(WrongItemRepository repo,
                            WrongItemOutboxRepository outboxRepo,
                            SnowflakeIdGenerator idGen) {
        this.repo = repo;
        this.outboxRepo = outboxRepo;
        this.idGen = idGen;
    }

    @Transactional
    public WrongItem createPending(Long studentId, String subject, Short sourceType,
                                   String originImageKey, String gradeCode) {
        WrongItem item = new WrongItem();
        item.setId(idGen.nextId());
        item.setStudentId(studentId);
        item.setSubject(subject);
        item.setSourceType(sourceType != null ? sourceType : (short) 1);
        item.setOriginImageKey(originImageKey);
        item.setGradeCode(gradeCode);
        item.setStatus((short) 0); // PENDING
        item.setMastery((short) 0);
        item.setCreatedAt(OffsetDateTime.now(ZoneOffset.UTC));
        item.setUpdatedAt(OffsetDateTime.now(ZoneOffset.UTC));
        return repo.save(item);
    }

    public WrongItem getById(Long id) {
        return repo.findById(id)
                .orElseThrow(() -> new BusinessException(ErrCode.RESOURCE_NOT_FOUND,
                        "msgkey:wb.error.question_not_found"));
    }

    @Transactional
    public WrongItem patch(Long id, String stemText, String ocrText,
                           Short difficulty, Short mastery, String processedImageKey) {
        WrongItem item = getById(id);
        if (stemText != null) item.setStemText(stemText);
        if (ocrText != null) item.setOcrText(ocrText);
        if (difficulty != null) item.setDifficulty(difficulty);
        if (mastery != null) item.setMastery(mastery);
        if (processedImageKey != null) item.setProcessedImageKey(processedImageKey);
        item.setUpdatedAt(OffsetDateTime.now(ZoneOffset.UTC));
        return repo.save(item);
    }

    /**
     * Confirm (save) a question: status → CONFIRMED(3) + write outbox event
     * in same TX (AC3 transactional consistency). Idempotent: if already ≥ 3,
     * returns current snapshot without duplicate outbox (AC4 / TI2).
     */
    @Transactional
    public WrongItem save(Long id) {
        WrongItem item = getById(id);
        if (item.getStatus() < 3) {
            item.setStatus((short) 3); // CONFIRMED
            item.setUpdatedAt(OffsetDateTime.now(ZoneOffset.UTC));
            item = repo.save(item);

            // AC3: write question.created.topic outbox event in same TX
            // TI1: payload {itemId, userId, subject, occurredAt}
            if (!outboxRepo.existsByWrongItemIdAndEventType(item.getId(), "question.created.topic")) {
                WrongItemOutbox outbox = new WrongItemOutbox();
                outbox.setId(idGen.nextId());
                outbox.setWrongItemId(item.getId());
                outbox.setEventType("question.created.topic");
                outbox.setPayload(String.format(
                        "{\"itemId\":%d,\"userId\":%d,\"subject\":\"%s\",\"occurredAt\":\"%s\"}",
                        item.getId(),
                        item.getStudentId(),
                        item.getSubject(),
                        item.getUpdatedAt().toString()));
                outbox.setSent(false);
                outbox.setCreatedAt(OffsetDateTime.now(ZoneOffset.UTC));
                outboxRepo.save(outbox);
            }
        }
        return item;
    }

    @Transactional
    public WrongItem archive(Long id) {
        WrongItem item = getById(id);
        if (item.getStatus() != (short) 8) {
            item.setStatus((short) 8); // ARCHIVED
            item.setUpdatedAt(OffsetDateTime.now(ZoneOffset.UTC));
            return repo.save(item);
        }
        return item; // idempotent
    }

    public Page<WrongItem> list(Long studentId, String subject, Short mastery,
                                Short status, Pageable pageable) {
        return repo.findByFilters(studentId, subject, mastery, status, pageable);
    }
}
