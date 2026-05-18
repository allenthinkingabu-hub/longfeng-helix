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
        // 2026-05-18 加 · origin_image_key 经 MinIO public endpoint 拼完整 URL ·
        // 前端 image src 直接消费 (前端不应知 MinIO 拓扑细节).
        @JsonProperty("thumbnail_url") String thumbnailUrl,
        @JsonProperty("created_at") OffsetDateTime createdAt,
        // P05-LIST: 复习节点字段 · 由 aggregator 调 review-plan-service 注入 ·
        // 空 (item 没 active plan / review-plan-service down) 时 FE 降级 "暂未安排".
        @JsonProperty("next_due_at") String nextDueAt,
        @JsonProperty("node_stage") Integer nodeStage
) {}
