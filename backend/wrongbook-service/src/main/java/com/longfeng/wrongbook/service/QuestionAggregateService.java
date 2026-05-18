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
                                          String q,
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
        List<Long> itemIds = result.getContent().stream().map(WrongItem::getId).toList();
        Map<Long, NextDueInfo> nextDueMap = fetchNextDueByItems(itemIds);
        // 2026-05-18 P05 fix: wrong_item.stem_text 长期 null (AI OCR 写到 analysis_result 没回写) ·
        // 批量 JOIN analysis_result 拿 latest stem · 让列表显示真题干 (P08 detail 已做 · list 没做).
        Map<Long, String> stemMap = fetchLatestStemByItems(itemIds);

        // 2026-05-18 加 search filter: q 关键词模糊匹配 stem_text + AI stem ·
        // 应用层 filter (避 SQL 复杂 JOIN · stem 来源两表 + AI fallback 逻辑已在 toListItem) ·
        // 数据集 ≤ 50 条 · 应用层效率 OK.
        java.util.List<QuestionListItem> rawItems = result.getContent().stream()
                .map(it -> toListItem(it, nextDueMap.get(it.getId()), stemMap.get(it.getId())))
                .toList();
        java.util.List<QuestionListItem> filtered;
        long total;
        if (q != null && !q.isBlank()) {
            String needle = q.trim().toLowerCase();
            filtered = rawItems.stream()
                    .filter(it -> matchesSearch(it, needle))
                    .toList();
            total = filtered.size();
        } else {
            filtered = rawItems;
            total = result.getTotalElements();
        }
        return new QuestionListResp(filtered, page, size, total);
    }

    /**
     * 2026-05-18 search 匹配: stem_text + subject 子串模糊匹配 (lowercase).
     * 后续可扩 KP / 错因 (analysis_result).
     */
    private boolean matchesSearch(QuestionListItem item, String needle) {
        String stem = item.stemText() == null ? "" : item.stemText().toLowerCase();
        String subject = item.subject() == null ? "" : item.subject().toLowerCase();
        return stem.contains(needle) || subject.contains(needle);
    }

    /** 2026-05-18 · 批量拿 wrong_item 的 latest AI stem · 单 SQL (DISTINCT ON) · 不 N+1. */
    private Map<Long, String> fetchLatestStemByItems(List<Long> itemIds) {
        if (itemIds == null || itemIds.isEmpty()) return Map.of();
        try {
            List<Object[]> rows = wrongItemService.findLatestStemByWrongItemIds(itemIds);
            Map<Long, String> out = new java.util.HashMap<>();
            for (Object[] row : rows) {
                if (row.length < 2 || row[0] == null) continue;
                Long itemId = ((Number) row[0]).longValue();
                String stem = row[1] == null ? null : row[1].toString();
                if (stem != null && !stem.isBlank()) {
                    out.put(itemId, stem);
                }
            }
            return out;
        } catch (Exception e) {
            LOG.warn("findLatestStemByWrongItemIds failed (列表降级空 stem): {}", e.toString());
            return Map.of();
        }
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
        List<Object> knowledgePoints = Collections.emptyList();

        Object[] aiRow = wrongItemService.findLatestAnalysisFull(item.getId());
        if (aiRow != null && aiRow.length >= 3) {
            String aiStem = aiRow[0] == null ? null : aiRow[0].toString();
            String stepsJson = aiRow[1] == null ? null : aiRow[1].toString();
            errorReason = aiRow[2] == null ? null : aiRow[2].toString();
            String kpJson = aiRow.length >= 4 && aiRow[3] != null ? aiRow[3].toString() : null;

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
                if (!steps.isEmpty() && steps.get(steps.size() - 1) instanceof java.util.Map<?,?> last) {
                    Object lastText = last.get("text");
                    if (lastText != null) {
                        correctAnswer = lastText.toString();
                    }
                }
            }

            // P09-FOLLOWUP-#2 · 解析 KP jsonb · 老数据 null (column 新加 · prompt 也新加) ·
            // 失败回退 empty · FE 显 "—" / 整块 hide.
            if (kpJson != null && !kpJson.isBlank() && !"null".equals(kpJson)) {
                try {
                    knowledgePoints = STEPS_MAPPER.readValue(kpJson,
                            new com.fasterxml.jackson.core.type.TypeReference<List<Object>>() {});
                } catch (Exception ignore) {
                    knowledgePoints = Collections.emptyList();
                }
            }
        }

        QuestionDetailResp.QuestionVO vo = new QuestionDetailResp.QuestionVO(
                toQid(item.getId()), item.getStudentId(), item.getSubject(),
                item.getGradeCode(), item.getSourceType(), item.getOriginImageKey(),
                item.getProcessedImageKey(), item.getOcrText(), stemText,
                item.getStatus(), item.getMastery(), item.getDifficulty(),
                item.getCreatedAt(), item.getUpdatedAt(),
                steps, correctAnswer, errorReason, knowledgePoints);
        return new QuestionDetailResp(vo, Collections.emptyList());
    }

    private QuestionListItem toListItem(WrongItem item) {
        return toListItem(item, null, null);
    }

    /**
     * Overload: 注入 review-plan next-due + AI 回填 stem.
     * info=null (没 active plan / review-plan-service down) 走 null 字段 ·
     * FE WrongQuestionListItem.nextDueAt='' + helpers.formatDueLabel 输出 "暂未安排".
     * aiStem=null 时 fallback wrong_item.stem_text (旧老数据通路 · 多数为 null).
     */
    private QuestionListItem toListItem(WrongItem item, NextDueInfo info, String aiStem) {
        String nextDueAt = info == null ? null : info.nextDueAt();
        // nodeIndex 0-based (T0..T6) · FE 习惯 T1.. 标签 · +1 落到 nodeStage.
        // info=null 时 nodeStage=null (FE 落 default 1 = "T1 · 暂未安排" 不显怪).
        Integer nodeStage = info == null ? null : info.nodeIndex() + 1;
        // 2026-05-18 P05 fix: stem 真值优先级 wrong_item.stem_text > AI analysis_result.stem ·
        // 因数据现实是 stem_text 多 null · 实际靠 aiStem.
        String stem = item.getStemText();
        if ((stem == null || stem.isBlank()) && aiStem != null && !aiStem.isBlank()) {
            stem = aiStem;
        }
        // 2026-05-18 thumbnail wire: origin_image_key → MinIO public URL · 同 SC-16 failedTop 一致.
        // MVP dev 用 localhost:9000 · production 应改 file-service presign + CDN.
        String thumbnailUrl = (item.getOriginImageKey() == null || item.getOriginImageKey().isBlank())
                ? null
                : "http://localhost:9000/wrongbook-dev/" + item.getOriginImageKey();
        return new QuestionListItem(
                toQid(item.getId()), item.getSubject(), item.getSourceType(),
                item.getStatus(), item.getMastery(), item.getDifficulty(),
                stem, item.getOriginImageKey(), thumbnailUrl, item.getCreatedAt(),
                nextDueAt, nodeStage);
    }
}
