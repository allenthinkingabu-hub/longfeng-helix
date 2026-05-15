package com.longfeng.reviewplan.consumer;

import com.longfeng.reviewplan.service.ReviewPlanService;
import java.time.Instant;
import org.apache.rocketmq.spring.annotation.RocketMQMessageListener;
import org.apache.rocketmq.spring.core.RocketMQListener;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * 双源订阅 · wrongbook.item.analyzed · 保留以兼容 SC-02 异步通路.
 *
 * <p>同一 wrong_item_id 两源任意一条先到都能走 createSevenNodes,
 * 幂等闸门保证不重复落 7 行.
 */
@Component
@ConditionalOnProperty(value = "review.mq.enabled", havingValue = "true")
@RocketMQMessageListener(
    topic = "wrongbook.item.analyzed",
    consumerGroup = "review-plan-cg")
public class WrongItemAnalyzedConsumer implements RocketMQListener<WrongItemAnalyzedEvent> {

    private static final Logger LOG = LoggerFactory.getLogger(WrongItemAnalyzedConsumer.class);
    private final ReviewPlanService planService;

    public WrongItemAnalyzedConsumer(ReviewPlanService planService) {
        this.planService = planService;
    }

    @Override
    public void onMessage(WrongItemAnalyzedEvent event) {
        if (event == null || event.getItemId() == null || event.getUserId() == null) {
            LOG.warn("wrongbook.item.analyzed orphan payload: {}", event);
            return;
        }
        Instant base = parseInstant(event.getAnalyzedAt());
        planService.createSevenNodes(event.getItemId(), event.getUserId(), base);
    }

    private static Instant parseInstant(String s) {
        if (s == null || s.isBlank()) return Instant.now();
        try {
            return Instant.parse(s);
        } catch (Exception e) {
            return Instant.now();
        }
    }
}
