package com.longfeng.anonymousservice.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

/**
 * SC-13 · biz §10.9 · 脱敏 payload — 严格字段白名单, 反向断言 SC13ShareE2EIT.
 *
 * <p><b>第一红线 · 字段白名单</b>: ONLY these four fields ever cross the wire.
 * The backing entity {@code share_token} contains {@code relation_id},
 * {@code sharer_student_id} 等 PII — they MUST NOT leak via this DTO.
 *
 * <p>Test {@code SC13ShareE2EIT.response_no_pii_fields} pins the contract by
 * reading the response JSON and asserting <i>none</i> of the forbidden field
 * names appear.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class MaskedPayloadDto {

    /** 题干前 12 字明文 · 后面 'XXXX' mask · 永不下发完整原文. */
    private final String stemSnippet;

    /** 前 2 个知识点名 · 余下被锁. */
    private final List<String> kpVisible;

    /** 剩余知识点数 · 用户登录后才能解锁. */
    private final int kpLockedCount;

    /** 原图是否磨砂 · true=显示 lock 遮罩, false=无原图. */
    private final boolean imgThumbBlurred;

    public MaskedPayloadDto(
            String stemSnippet, List<String> kpVisible, int kpLockedCount, boolean imgThumbBlurred) {
        this.stemSnippet = stemSnippet;
        this.kpVisible = kpVisible == null ? List.of() : List.copyOf(kpVisible);
        this.kpLockedCount = kpLockedCount;
        this.imgThumbBlurred = imgThumbBlurred;
    }

    public String getStemSnippet() { return stemSnippet; }
    public List<String> getKpVisible() { return kpVisible; }
    public int getKpLockedCount() { return kpLockedCount; }
    public boolean isImgThumbBlurred() { return imgThumbBlurred; }
}
