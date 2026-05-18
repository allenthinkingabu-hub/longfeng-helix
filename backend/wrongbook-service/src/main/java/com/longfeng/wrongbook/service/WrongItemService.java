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
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

@Service
public class WrongItemService {

    private static final Logger LOG = LoggerFactory.getLogger(WrongItemService.class);

    private final WrongItemRepository repo;
    private final WrongItemOutboxRepository outboxRepo;
    private final SnowflakeIdGenerator idGen;
    private final RestTemplate http = new RestTemplate();

    /**
     * Direct HTTP target for review-plan-service in local dev / multi-team sandbox.
     * Production uses RocketMQ (question.created.topic → QuestionCreatedConsumer);
     * locally the topic isn't running so we synchronously POST to this URL after
     * the outbox is written so the user actually gets a 7-node plan after clicking
     * "保存并开启复习". Blank value disables the sync call (production behavior).
     */
    @Value("${review.plan.sync-url:http://localhost:8085/internal/plans/from-question}")
    private String reviewPlanSyncUrl;

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
        boolean firstConfirm = item.getStatus() < 3;
        if (firstConfirm) {
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
        // Local-dev fallback: when RocketMQ relay isn't running the
        // QuestionCreatedConsumer never fires, so the user gets confirmed status
        // but no 7-node review plan → "保存并开启复习" is half-broken. Synchronously
        // POST to review-plan-service so the plan rows land regardless of MQ. The
        // BE side is idempotent via planRepo.existsByWrongItemId, so this call is
        // safe even when MQ also delivers the event later.
        if (firstConfirm && reviewPlanSyncUrl != null && !reviewPlanSyncUrl.isBlank()) {
            try {
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                String body = String.format(
                        "{\"wrongItemId\":%d,\"studentId\":%d,\"occurredAt\":\"%s\"}",
                        item.getId(),
                        item.getStudentId(),
                        item.getUpdatedAt().toInstant().toString());
                http.postForEntity(reviewPlanSyncUrl, new HttpEntity<>(body, headers), Map.class);
            } catch (RuntimeException e) {
                // MQ path is still in play · don't fail the save TX on network blip.
                LOG.warn("review-plan sync call failed (MQ path will retry · wrongItemId={}): {}",
                        item.getId(), e.getMessage());
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

    /**
     * P08-RENDER 兜底 · 从单库 analysis_result 拿 AI OCR 的真题干 ·
     * 调用方 (QuestionAggregateService) 在 wrong_item.stem_text 为空时 fallback.
     * 返 null 表示这道题没有 DONE 状态的 AI 分析结果.
     */
    public String findLatestAnalysisStem(Long wrongItemId) {
        try {
            return repo.findLatestAnalysisStemByWrongItemId(wrongItemId);
        } catch (Exception e) {
            // analysis_result 表查询失败不让 wrongbook GET 整体崩 · 退到 null
            return null;
        }
    }

    /**
     * P08-RENDER · 拿 AI 完整输出 (stem + steps + error_reason).
     * 返 [stem, stepsJsonStr, errorReason] · 全 String · 任一字段可 null.
     * 失败 / 没数据时返 null.
     */
    public Object[] findLatestAnalysisFull(Long wrongItemId) {
        try {
            java.util.List<Object[]> rows = repo.findLatestAnalysisFullByWrongItemId(wrongItemId);
            return rows == null || rows.isEmpty() ? null : rows.get(0);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * P05-LIST (2026-05-18) · 批量拿 wrong_item 的 latest AI stem · 避免 N+1.
     * 返 List<Object[]> [wrong_item_id, stem] · 异常时回空 list.
     */
    public java.util.List<Object[]> findLatestStemByWrongItemIds(java.util.List<Long> wrongItemIds) {
        if (wrongItemIds == null || wrongItemIds.isEmpty()) return java.util.List.of();
        try {
            return repo.findLatestStemByWrongItemIds(wrongItemIds);
        } catch (Exception e) {
            return java.util.List.of();
        }
    }
}
