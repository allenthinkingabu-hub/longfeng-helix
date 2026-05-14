package com.longfeng.fileservice.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record PresignReq(
        @NotBlank String filename,
        @NotBlank String mime,
        @NotNull @Min(0) @Max(10_485_760) Long size) {
}
