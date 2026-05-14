package com.longfeng.wrongbook.service;

import com.longfeng.common.exception.BusinessException;
import com.longfeng.common.exception.ErrCode;
import com.longfeng.wrongbook.dto.*;
import com.longfeng.wrongbook.entity.WrongItem;
import java.util.Collections;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

/**
 * 聚合服务 · 组装 QuestionDetailResp / QuestionListResp
 * qid (String) ↔ id (Long) 双向转换 (BACKEND_GUIDANCE §5.3)
 */
@Service
public class QuestionAggregateService {

    private final WrongItemService wrongItemService;
    private final IdempotencyService idempotencyService;

    public QuestionAggregateService(WrongItemService wrongItemService,
                                    IdempotencyService idempotencyService) {
        this.wrongItemService = wrongItemService;
        this.idempotencyService = idempotencyService;
    }

    public static Long parseId(String qid) {
        try {
            return Long.parseLong(qid);
        } catch (NumberFormatException e) {
            throw new BusinessException(ErrCode.VALIDATION_FAILED,
                    "msgkey:wb.error.invalid_qid");
        }
    }

    public static String toQid(Long id) {
        return String.valueOf(id);
    }

    public CreateQuestionResp createPending(CreateQuestionReq req, String idemKey) {
        // idempotency check
        Optional<com.longfeng.wrongbook.entity.IdemKey> existing =
                idempotencyService.peek("wb:create", idemKey);
        if (existing.isPresent()) {
            String payload = existing.get().getPayload();
            return new CreateQuestionResp(payload);
        }

        WrongItem item = wrongItemService.createPending(
                req.studentId(), req.subject(), req.sourceType(),
                req.originImageKey(), req.gradeCode());

        String qid = toQid(item.getId());
        idempotencyService.tryClaim("wb:create", idemKey, qid);
        return new CreateQuestionResp(qid);
    }

    public QuestionDetailResp getDetail(String qid) {
        Long id = parseId(qid);
        WrongItem item = wrongItemService.getById(id);
        return toDetailResp(item);
    }

    public QuestionDetailResp patchAndGet(String qid, PatchQuestionReq req) {
        Long id = parseId(qid);
        WrongItem item = wrongItemService.patch(id, req.stemText(), req.ocrText(),
                req.difficulty(), req.mastery(), req.processedImageKey());
        return toDetailResp(item);
    }

    public SaveQuestionResp saveQuestion(String qid) {
        Long id = parseId(qid);
        WrongItem item = wrongItemService.save(id);
        return new SaveQuestionResp(toQid(item.getId()), item.getStatus(),
                "msgkey:wb.save.success");
    }

    public QuestionListItem archiveQuestion(String qid) {
        Long id = parseId(qid);
        WrongItem item = wrongItemService.archive(id);
        return toListItem(item);
    }

    public QuestionListResp listQuestions(Long studentId, String subject, Short mastery,
                                          int page, int size, String sort) {
        Sort s = Sort.by(Sort.Direction.DESC, "created_at");
        if ("oldest".equals(sort)) {
            s = Sort.by(Sort.Direction.ASC, "created_at");
        }
        Pageable pageable = PageRequest.of(Math.max(0, page - 1), size, s);
        Page<WrongItem> result = wrongItemService.list(studentId, subject, mastery, null, pageable);
        return new QuestionListResp(
                result.getContent().stream().map(this::toListItem).toList(),
                page, size, result.getTotalElements());
    }

    private QuestionDetailResp toDetailResp(WrongItem item) {
        QuestionDetailResp.QuestionVO vo = new QuestionDetailResp.QuestionVO(
                toQid(item.getId()), item.getStudentId(), item.getSubject(),
                item.getGradeCode(), item.getSourceType(), item.getOriginImageKey(),
                item.getProcessedImageKey(), item.getOcrText(), item.getStemText(),
                item.getStatus(), item.getMastery(), item.getDifficulty(),
                item.getCreatedAt(), item.getUpdatedAt());
        return new QuestionDetailResp(vo, Collections.emptyList());
    }

    private QuestionListItem toListItem(WrongItem item) {
        return new QuestionListItem(
                toQid(item.getId()), item.getSubject(), item.getSourceType(),
                item.getStatus(), item.getMastery(), item.getDifficulty(),
                item.getStemText(), item.getOriginImageKey(), item.getCreatedAt());
    }
}
