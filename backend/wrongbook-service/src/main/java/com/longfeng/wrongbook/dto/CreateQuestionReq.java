package com.longfeng.wrongbook.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateQuestionReq(
        @NotNull @JsonProperty("student_id") Long studentId,
        @NotBlank String subject,
        @JsonProperty("source_type") Short sourceType,
        @JsonProperty("origin_image_key") String originImageKey,
        @JsonProperty("grade_code") String gradeCode,
        @JsonProperty("idempotency_key") String idempotencyKey
) {}
