package com.longfeng.reviewplan.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.math.BigDecimal;
import java.util.List;

/**
 * SC20-T02 · POST /api/review/nodes/{nid}/judge response body.
 *
 * <p>biz §10.17 字面 (test-cases.md Round 2 用例 #1 (a)):
 * {@code {verdict, confidence, reason, status, matched_steps?, missed_steps?}}.
 *
 * <p>字段语义:
 * <ul>
 *   <li>{@code verdict} - 'MASTERED' | 'PARTIAL' | 'FORGOT' · null = schema-violation / timeout 路径</li>
 *   <li>{@code confidence} - DECIMAL(3,2) 0.00-1.00 · null = AI 未返</li>
 *   <li>{@code reason} - AI 解释 (≤ 100 字简体中文) · null = AI 未返</li>
 *   <li>{@code status} - 'DONE' | 'LOW_CONFIDENCE' · 上层走 SC-22 降级时为 LOW_CONFIDENCE</li>
 *   <li>{@code matched_steps} - 匹配步骤 list · 可空 list (test-cases.md 用例 #2 [])</li>
 *   <li>{@code missed_steps} - 缺失步骤 list · 可空 list</li>
 * </ul>
 *
 * <p>503 路径不返本 DTO · 走 GlobalExceptionHandler 返 {@code {error_code, message}} envelope.
 */
@JsonInclude(JsonInclude.Include.ALWAYS) // 让 null 字段也输出 verdict=null · 用例 #6 字面要求
public record JudgeResp(
        String verdict,
        BigDecimal confidence,
        String reason,
        String status,
        List<String> matched_steps,
        List<String> missed_steps
) {
}
