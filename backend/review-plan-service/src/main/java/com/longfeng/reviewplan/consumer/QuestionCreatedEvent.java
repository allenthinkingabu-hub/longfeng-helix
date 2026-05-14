package com.longfeng.reviewplan.consumer;

import com.fasterxml.jackson.annotation.JsonAlias;

/**
 * question.created.topic payload · SC-01 步 10.
 * snake_case JsonAlias 容错.
 */
public class QuestionCreatedEvent {

    @JsonAlias("item_id")
    private Long itemId;

    @JsonAlias("user_id")
    private Long userId;

    private String subject;
    private String topic;
    private String action;

    @JsonAlias("occurred_at")
    private String occurredAt;

    public Long getItemId() { return itemId; }
    public void setItemId(Long itemId) { this.itemId = itemId; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }
    public String getTopic() { return topic; }
    public void setTopic(String topic) { this.topic = topic; }
    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }
    public String getOccurredAt() { return occurredAt; }
    public void setOccurredAt(String occurredAt) { this.occurredAt = occurredAt; }
}
