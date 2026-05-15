package com.longfeng.wrongbook.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.OffsetDateTime;

public record QuestionListItem(
        String qid,
        String subject,
        @JsonProperty("source_type") short sourceType,
        short status,
        short mastery,
        Short difficulty,
        @JsonProperty("stem_text") String stemText,
        @JsonProperty("origin_image_key") String originImageKey,
        @JsonProperty("created_at") OffsetDateTime createdAt
) {}
