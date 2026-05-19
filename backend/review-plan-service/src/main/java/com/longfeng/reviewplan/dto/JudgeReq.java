package com.longfeng.reviewplan.dto;

/**
 * SC20-T02 · POST /api/review/nodes/{nid}/judge request body.
 *
 * <p>biz §10.17 字面: {@code {"user_answer_image_key": "wrongbook/.../student-N/.../filename.jpg"}}.
 * image_key 是 OSS object key (沿现役 ObjectKeyBuilder pattern
 * {@code wrongbook/{tenantId}/{yyyyMM}/{studentId}/{snowflakeId}_{filename}}) ·
 * 校验逻辑: key.split("/")[3] 与 X-User-Id 比对 (test-cases.md 用例 #5 (n3)).
 */
public record JudgeReq(String user_answer_image_key) {
}
