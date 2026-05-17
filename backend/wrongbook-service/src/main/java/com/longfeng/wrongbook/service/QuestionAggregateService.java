package com.longfeng.wrongbook.service;

import com.longfeng.common.exception.BusinessException;
import com.longfeng.common.exception.ErrCode;
import com.longfeng.wrongbook.dto.*;
import com.longfeng.wrongbook.entity.WrongItem;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

/**
 * 聚合服务 · 组装 QuestionDetailResp / QuestionListResp
 * qid (String) ↔ id (Long) 双向转换 (BACKEND_GUIDANCE §5.3)
 */
@Service
public class QuestionAggregateService {

    private static final Logger LOG = LoggerFactory.getLogger(QuestionAggregateService.class);

    private final WrongItemService wrongItemService;
    private final IdempotencyService idempotencyService;
    private final RestTemplate http = new RestTemplate();

    /**
     * review-plan-service · 批量取 next-due 节点 · P05 列表渲染时间标签用.
     * 空值或 5xx 时整页降级 (item.nextDueAt = null), FE 显示 "T1 · 暂未安排" ·
     * 不让一条 review-plan-service 错杀整张列表.
     */
    @Value("${review.plan.next-due-url:http://localhost:8085/internal/plans/next-due-by-items}")
    private String reviewPlanNextDueUrl;

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

    /**
     * wrong_item.status 枚举 (entity 实测):
     *   0 = PENDING (P02 拍题占位 · OCR/AI 还没跑完 · 不算"已确认错题")
     *   3 = CONFIRMED (P04 "保存并开启复习" 后 · 此时 review-plan 建 7 节点)
     *   8 = ARCHIVED (P05 归档)
     * P05 列表 root cause: 之前不过滤 status · 把 PENDING 占位 一起列 ·
     * 用户看到 37 道"错题" 实际仅 ~1 道真错题 · P07 复习页空也是真相 (PENDING 不进 plan).
     */
    private static final short STATUS_CONFIRMED = 3;

    public QuestionListResp listQuestions(Long studentId, String subject, Short mastery,
                                          int page, int size, String sort) {
        Sort s = Sort.by(Sort.Direction.DESC, "created_at");
        if ("oldest".equals(sort)) {
            s = Sort.by(Sort.Direction.ASC, "created_at");
        }
        Pageable pageable = PageRequest.of(Math.max(0, page - 1), size, s);
        // 默认 status=CONFIRMED · 只列学生已"保存并开启复习"的题 ·
        // PENDING (0) 是 OCR 中途的占位 · 没建复习计划 · 列出来误导.
        // 后续如果要管理后台看 PENDING/ARCHIVED · 走另一个 admin 接口.
        Page<WrongItem> result = wrongItemService.list(studentId, subject, mastery, STATUS_CONFIRMED, pageable);

        // P05-LIST: 批量取每个 wrong_item 的 next-due active plan ·
        // 单条 HTTP POST · review-plan-service down 时降级 (空 map) 不 hang.
        Map<Long, NextDueInfo> nextDueMap = fetchNextDueByItems(
                result.getContent().stream().map(WrongItem::getId).toList());

        return new QuestionListResp(
                result.getContent().stream()
                        .map(it -> toListItem(it, nextDueMap.get(it.getId())))
                        .toList(),
                page, size, result.getTotalElements());
    }

    /** 内部 holder · 不暴露给外面 · review-plan response shape. */
    private record NextDueInfo(String nextDueAt, int nodeIndex) {}

    /**
     * HTTP POST review-plan /internal/plans/next-due-by-items · 整页失败兜底返空 map ·
     * FE 显示 "暂未安排" 比整张列表 ERROR 体验好.
     */
    @SuppressWarnings("unchecked")
    private Map<Long, NextDueInfo> fetchNextDueByItems(List<Long> wrongItemIds) {
        if (wrongItemIds == null || wrongItemIds.isEmpty() || reviewPlanNextDueUrl == null
                || reviewPlanNextDueUrl.isBlank()) {
            return Map.of();
        }
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            Map<String, Object> body = Map.of("wrongItemIds", wrongItemIds);
            ResponseEntity<Map> resp = http.postForEntity(
                    reviewPlanNextDueUrl, new HttpEntity<>(body, headers), Map.class);
            if (!resp.getStatusCode().is2xxSuccessful() || resp.getBody() == null) {
                return Map.of();
            }
            Object dataRaw = resp.getBody().get("data");
            if (!(dataRaw instanceof List<?> data)) {
                return Map.of();
            }
            Map<Long, NextDueInfo> out = new HashMap<>();
            for (Object row : data) {
                if (!(row instanceof Map<?, ?> m)) continue;
                Object wid = m.get("wrongItemId");
                Object nidx = m.get("nodeIndex");
                Object due = m.get("nextDueAt");
                if (wid == null || nidx == null) continue;
                out.put(Long.valueOf(wid.toString()),
                        new NextDueInfo(due == null ? null : due.toString(),
                                Integer.parseInt(nidx.toString())));
            }
            return out;
        } catch (Exception e) {
            LOG.warn("review-plan next-due-by-items fetch failed (列表降级 '暂未安排'): {}", e.toString());
            return Map.of();
        }
    }

    private static final com.fasterxml.jackson.databind.ObjectMapper STEPS_MAPPER =
            new com.fasterxml.jackson.databind.ObjectMapper();

    private QuestionDetailResp toDetailResp(WrongItem item) {
        // P08-RENDER: wrong_item.stem_text 为 null 时, fallback 单库 analysis_result
        // (AI OCR 输出长期只在 analysis_result 不回写 wrong_item · 2026-05-17 单库迁移后修).
        // 同时拿 steps[] (jsonb) + error_reason · 给 P08 揭示答案区 + 解答步骤区 + 错因.
        String stemText = item.getStemText();
        List<Object> steps = Collections.emptyList();
        String correctAnswer = null;
        String errorReason = null;

        Object[] aiRow = wrongItemService.findLatestAnalysisFull(item.getId());
        if (aiRow != null && aiRow.length >= 3) {
            String aiStem = aiRow[0] == null ? null : aiRow[0].toString();
            String stepsJson = aiRow[1] == null ? null : aiRow[1].toString();
            errorReason = aiRow[2] == null ? null : aiRow[2].toString();

            if ((stemText == null || stemText.isBlank()) && aiStem != null && !aiStem.isBlank()) {
                stemText = aiStem;
            }

            // Parse steps jsonb · shape: [{stepNo, text}, ...] · 解析失败回退 empty
            if (stepsJson != null && !stepsJson.isBlank()) {
                try {
                    steps = STEPS_MAPPER.readValue(stepsJson,
                            new com.fasterxml.jackson.core.type.TypeReference<List<Object>>() {});
                } catch (Exception ignore) {
                    steps = Collections.emptyList();
                }
                // correct_answer 兜底: AI 流水线没单独存"正确答案"字段, 取末步 text 作答案行 ·
                // spec §3 reveal 区 .ans 行 (标准解答) 跟 .steps 列表是两个层次 · 末步通常是
                // "得 3543600" 这种最终结果 · 切走 spec §4.1 answer 字段.
                if (!steps.isEmpty() && steps.get(steps.size() - 1) instanceof java.util.Map<?,?> last) {
                    Object lastText = last.get("text");
                    if (lastText != null) {
                        correctAnswer = lastText.toString();
                    }
                }
            }
        }

        QuestionDetailResp.QuestionVO vo = new QuestionDetailResp.QuestionVO(
                toQid(item.getId()), item.getStudentId(), item.getSubject(),
                item.getGradeCode(), item.getSourceType(), item.getOriginImageKey(),
                item.getProcessedImageKey(), item.getOcrText(), stemText,
                item.getStatus(), item.getMastery(), item.getDifficulty(),
                item.getCreatedAt(), item.getUpdatedAt(),
                steps, correctAnswer, errorReason);
        return new QuestionDetailResp(vo, Collections.emptyList());
    }

    private QuestionListItem toListItem(WrongItem item) {
        return toListItem(item, null);
    }

    /**
     * Overload: 注入 review-plan next-due 字段.
     * info=null (没 active plan / review-plan-service down) 走 null 字段 ·
     * FE WrongQuestionListItem.nextDueAt='' + helpers.formatDueLabel 输出 "暂未安排".
     */
    private QuestionListItem toListItem(WrongItem item, NextDueInfo info) {
        String nextDueAt = info == null ? null : info.nextDueAt();
        // nodeIndex 0-based (T0..T6) · FE 习惯 T1.. 标签 · +1 落到 nodeStage.
        // info=null 时 nodeStage=null (FE 落 default 1 = "T1 · 暂未安排" 不显怪).
        Integer nodeStage = info == null ? null : info.nodeIndex() + 1;
        return new QuestionListItem(
                toQid(item.getId()), item.getSubject(), item.getSourceType(),
                item.getStatus(), item.getMastery(), item.getDifficulty(),
                item.getStemText(), item.getOriginImageKey(), item.getCreatedAt(),
                nextDueAt, nodeStage);
    }
}
