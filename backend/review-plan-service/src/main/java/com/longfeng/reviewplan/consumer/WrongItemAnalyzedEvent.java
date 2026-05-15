package com.longfeng.reviewplan.consumer;

import com.fasterxml.jackson.annotation.JsonAlias;

/**
 * wrongbook.item.analyzed topic payload · SC-02 异步路径兼容.
 */
public class WrongItemAnalyzedEvent {

    @JsonAlias("item_id")
    private Long itemId;

    @JsonAlias("user_id")
    private Long userId;

    @JsonAlias("analyzed_at")
    private String analyzedAt;

    public Long getItemId() { return itemId; }
    public void setItemId(Long itemId) { this.itemId = itemId; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getAnalyzedAt() { return analyzedAt; }
    public void setAnalyzedAt(String analyzedAt) { this.analyzedAt = analyzedAt; }
}
