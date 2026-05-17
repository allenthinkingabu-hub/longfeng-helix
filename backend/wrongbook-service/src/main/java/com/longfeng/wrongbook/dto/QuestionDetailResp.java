package com.longfeng.wrongbook.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * P04 聚合详情 · plain JSON 不裹 ApiResult（FE destructures top-level question + plannedNodes）
 */
public record QuestionDetailResp(
        QuestionVO question,
        @JsonProperty("planned_nodes") List<Object> plannedNodes
) {

    public record QuestionVO(
            String qid,
            @JsonProperty("student_id") Long studentId,
            String subject,
            @JsonProperty("grade_code") String gradeCode,
            @JsonProperty("source_type") Short sourceType,
            @JsonProperty("origin_image_key") String originImageKey,
            @JsonProperty("processed_image_key") String processedImageKey,
            @JsonProperty("ocr_text") String ocrText,
            @JsonProperty("stem_text") String stemText,
            short status,
            short mastery,
            Short difficulty,
            @JsonProperty("created_at") OffsetDateTime createdAt,
            @JsonProperty("updated_at") OffsetDateTime updatedAt,
            // P08-RENDER · 来自 analysis_result 兜底 (单库 LEFT JOIN) · 揭示答案区 + 解答步骤区:
            //   steps: [{stepNo, text}, ...] · jsonb 解出 · spec §4.1 question.steps
            //   correct_answer: 末步 text 兜底 (AI 流水线没单独存 "正确答案" 字段)
            //   error_reason: 错因分析 · spec §3 reasonMarkdown
            @JsonProperty("steps") List<Object> steps,
            @JsonProperty("correct_answer") String correctAnswer,
            @JsonProperty("error_reason") String errorReason,
            // P09-FOLLOWUP-#2 · AI 提示词加 knowledgePoints 输出 · jsonb 列
            //   shape: [{name:string}, ...] · 老题 null · 新分析才有
            @JsonProperty("knowledge_points") List<Object> knowledgePoints
    ) {}
}
