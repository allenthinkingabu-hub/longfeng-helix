package com.longfeng.fileservice.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record CompleteResp(
        String status,
        @JsonProperty("variant_thumb_key") String variantThumbKey,
        @JsonProperty("variant_medium_key") String variantMediumKey) {
}
