package com.longfeng.reviewplan.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * SC20-T02 · POST /api/review/nodes/{nid}/judge 错误响应 body envelope.
 *
 * <p>biz §10.17 字面 (test-cases.md Round 2 用例 #5 (n3) + #3 (a)):
 * {@code {"error_code": "...", "message": "..."}}.
 *
 * <p>字面 error_code 5 值 (test-cases.md AC6):
 * <ul>
 *   <li>{@code UNAUTHENTICATED} - 401 · Authorization header 缺/无效</li>
 *   <li>{@code NODE_NOT_FOUND} - 404 · nid 不存在</li>
 *   <li>{@code NODE_ALREADY_GRADED} - 409 · status IN (3 REVIEWED, 4 FORGOTTEN)</li>
 *   <li>{@code IMAGE_KEY_INVALID} - 422 · key path 第 4 段 studentId 与 X-User-Id 不匹配</li>
 *   <li>{@code AI_SERVICE_UNAVAILABLE} - 503 · 双 provider 都不可用 / 18s 上限</li>
 * </ul>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record JudgeErrorResp(String error_code, String message) {
}
