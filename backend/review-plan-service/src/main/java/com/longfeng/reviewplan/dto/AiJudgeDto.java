package com.longfeng.reviewplan.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.math.BigDecimal;
import java.util.List;

/**
 * SC20-T03 (M-AI-ANSWER-JUDGE §10.19) · GET /api/review/nodes/{nid}/result resp 内嵌 aiJudge object.
 *
 * <p>由 wb_review_node 6 satellite 列拼装:
 * <ul>
 *   <li>verdict ← ai_judge_verdict (VARCHAR(16): MASTERED / PARTIAL / FORGOT)</li>
 *   <li>confidence ← ai_judge_confidence (DECIMAL(3,2): 0.00-1.00)</li>
 *   <li>reason ← ai_judge_reason (TEXT)</li>
 *   <li>status ← ai_judge_metadata.status JSONB 字段 (整列 NULL / parse fail / 缺 key 三态降级 null)</li>
 *   <li>matchedSteps / missedSteps · §10.19 字面 `?` 标记可选 · 本实装选 "不返 key" (态 A · {@code @JsonInclude(NON_NULL)})</li>
 *   <li>finalGradeSource ← final_grade_source 列 (self / ai_accepted / ai_overridden)</li>
 * </ul>
 *
 * <p>本 DTO 整体若 wb_review_node 5 列任一为 NULL (verdict/confidence/reason/status/final_grade_source) ·
 * NodeResultResp.aiJudge 字段返 null (而非 AiJudgeDto with null 字段) · 符合 AC4 字面.
 *
 * <p>{@code @JsonInclude(JsonInclude.Include.NON_NULL)} 让 matched_steps / missed_steps 为 null 时不序列化 ·
 * Round 2 用例 #5 字面 "态 A 不返 key" 严匹配 (态 B 返 [] 需用 NON_EMPTY 但本实装走态 A).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AiJudgeDto(
    String verdict,
    BigDecimal confidence,
    String reason,
    String status,
    @com.fasterxml.jackson.annotation.JsonProperty("matched_steps") List<String> matchedSteps,
    @com.fasterxml.jackson.annotation.JsonProperty("missed_steps") List<String> missedSteps,
    @com.fasterxml.jackson.annotation.JsonProperty("final_grade_source") String finalGradeSource
) {}
