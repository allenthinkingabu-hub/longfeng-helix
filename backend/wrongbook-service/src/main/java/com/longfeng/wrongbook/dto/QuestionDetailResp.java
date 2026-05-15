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
            @JsonProperty("updated_at") OffsetDateTime updatedAt
    ) {}
}
