package com.longfeng.anonymousservice.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * SC-12-T07 · response envelope for {@code GET /api/anon/result/{anonQid}} —
 * biz §2B.13 F05.
 *
 * <p>Snake-case keys (via {@link JsonProperty}) match the FE polling contract
 * documented in {@code P-GUEST-CAPTURE-guest-capture.spec.md §5 #5}: the FE
 * (T09) destructures {@code result.stem_length / result.chat_model /
 * result.ocr_model} directly into the P03 STEP_DESCS strings. Keeping the
 * snake_case wire form here means the upstream's snake_case keys can be
 * forwarded verbatim without a Jackson rename layer per hop.
 *
 * <p>{@link JsonInclude#NON_NULL} so the {@code ANALYZING} response is just
 * {@code {"status":"ANALYZING"}} (no null {@code result} field, no null
 * {@code error_code} field) — that keeps the 1 Hz polling payload small
 * (about 25 bytes vs. 90 bytes with explicit nulls).
 *
 * <p>Wire shape examples:
 * <pre>
 *   ANALYZING:  {"status":"ANALYZING"}
 *   READY:      {"status":"READY","result":{"subject":"math","stem_length":42,
 *                "chat_model":"qwen-plus","ocr_model":"qwen-vl-max"}}
 *   FAILED:     {"status":"FAILED","error_code":"AI_INFERENCE_FAILED"}
 * </pre>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AnonResultResponse(
        @JsonProperty("status") String status,
        @JsonProperty("result") Result result,
        @JsonProperty("error_code") String errorCode) {

    /**
     * Nested record carrying the result payload — only populated when the
     * upstream returned {@code DONE} (mapped to {@code READY} on this hop).
     *
     * <p>Extended 2026-05-19: P04 游客态 (spec P-GUEST-CAPTURE.spec.md line 216 +
     * biz §F05) 需要题干/错因/纠正字段渲染同样的结果详情卡. anon-service 在
     * DONE 时额外调 ai-service GET /api/ai/{taskId}/answer 拿完整数据合并.
     * KP (知识点) 暂留 null · ai-service /answer 当前未暴露 · 后续 task 补.
     */
    public record Result(
            @JsonProperty("subject") String subject,
            @JsonProperty("stem_length") Integer stemLength,
            @JsonProperty("chat_model") String chatModel,
            @JsonProperty("ocr_model") String ocrModel,
            @JsonProperty("stem") String stem,
            @JsonProperty("reason_markdown") String reasonMarkdown,
            @JsonProperty("steps") java.util.List<Step> steps,
            @JsonProperty("correction") String correction) {

        /** AI 解答步骤 · 与 ai-service AiAnswer.steps 同结构. */
        public record Step(
                @JsonProperty("step_no") Integer stepNo,
                @JsonProperty("text") String text,
                @JsonProperty("title") String title,
                @JsonProperty("formula") String formula) {}
    }
}
