package com.longfeng.anonymousservice.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * SC-13 · biz §10.9 · GET /api/share/:shareToken 成功响应 DTO.
 *
 * <p><b>第一红线 · 字段白名单 (脱敏铁律)</b>: ONLY 5 fields cross the wire.
 * 严禁出现 {@code relation_id} / {@code sharer_student_id} /
 * {@code student_email} / {@code original_image_url} — 这些 PII 字段 stay
 * server-side, never reach the receiver client.
 *
 * <p>Test {@code SC13ShareE2EIT.valid_share_token_returns_ShareDto_with_masked_fields}
 * pins the contract by reading the response JSON 并反向断言 forbidden field
 * names 不出现 (objectMapper.readTree).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ShareDto {

    /** EXAM_DAY / QUESTION / REVIEW_NODE. */
    private final String type;

    /** "Z***" — 单字符首 + 3 ★ · 不下发真姓名/student_id. */
    private final String sharerNickMasked;

    /** 剩余秒数 · 由 expires_at - now() 算出 · 不下发 expires_at 原值. */
    private final long ttlSec;

    /** HS256 验签结果 · true 表示令牌真实未篡改 (走到这里必为 true · 留 field 给 UI 渲审计行). */
    private final boolean signatureValid;

    /** 脱敏 payload (字段白名单 in MaskedPayloadDto). */
    private final MaskedPayloadDto maskedPayload;

    public ShareDto(
            String type,
            String sharerNickMasked,
            long ttlSec,
            boolean signatureValid,
            MaskedPayloadDto maskedPayload) {
        this.type = type;
        this.sharerNickMasked = sharerNickMasked;
        this.ttlSec = ttlSec;
        this.signatureValid = signatureValid;
        this.maskedPayload = maskedPayload;
    }

    public String getType() { return type; }
    public String getSharerNickMasked() { return sharerNickMasked; }
    public long getTtlSec() { return ttlSec; }
    public boolean isSignatureValid() { return signatureValid; }
    public MaskedPayloadDto getMaskedPayload() { return maskedPayload; }
}
