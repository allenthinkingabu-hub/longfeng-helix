package com.longfeng.wrongbook.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record PatchQuestionReq(
        @JsonProperty("stem_text") String stemText,
        @JsonProperty("ocr_text") String ocrText,
        Short difficulty,
        Short mastery,
        @JsonProperty("processed_image_key") String processedImageKey
) {}
