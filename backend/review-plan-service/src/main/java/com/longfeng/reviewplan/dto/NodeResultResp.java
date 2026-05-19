package com.longfeng.reviewplan.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import java.math.BigDecimal;
import java.time.Instant;

/**
 * GET /api/review/nodes/{nid}/result response.
 * P09 hero/曲线渲染所需全字段.
 *
 * <p>Snowflake ID (19 位 > 2^53) 必须 ToStringSerializer · 否则 JS Number 截尾导致
 * FE 拿到错 wrongItemId · 再调 getQuestionById 404 退 mock (跟 ReviewPlanDto d4e21f2
 * 同类 bug · 这里补).
 *
 * <p>SC20-T03 (M-AI-ANSWER-JUDGE §10.19) · 加 aiJudge 字段 (null = AI 未判 · 向后兼容 P09 旧逻辑) ·
 * {@code @JsonInclude(NON_NULL)} 让 aiJudge=null 时仍序列化为 `"aiJudge":null` (Round 2 用例 #6 子断言 #b 字面严匹配).
 *
 * <p>**ALWAYS include aiJudge field**: 即使 null 也必须输出 key (不用 NON_NULL 否则 key 缺失) ·
 * 与 §10.19 字面 "aiJudge: null = AI 未判" 对齐.
 */
public record NodeResultResp(
    @JsonSerialize(using = ToStringSerializer.class) Long planId,
    @JsonSerialize(using = ToStringSerializer.class) Long wrongItemId,
    int nodeIndex,
    String nodeState,
    Integer quality,
    BigDecimal easeBefore,
    BigDecimal easeAfter,
    Integer intervalBefore,
    Integer intervalAfter,
    Instant nextDueAt,
    Long durationMs,
    boolean mastered,
    // P09-MASTERY · review_plan.mastery_score (0..100) · 替代 FE 派生公式 easeAfter*32.
    // SM-2 完成时由 ReviewPlanService.complete() 更新 · 没复习过保持 0 (诚实).
    Integer masteryScore,
    // SC20-T03 §10.19 · null = AI 未判 · 否则 5 satellite 列拼装的完整 object.
    // 故意不加 @JsonInclude(NON_NULL) · 让 null 也输出 `"aiJudge":null` (向后兼容旧客户端可忽略).
    @JsonInclude(JsonInclude.Include.ALWAYS) AiJudgeDto aiJudge
) {}
