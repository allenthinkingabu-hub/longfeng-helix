package com.longfeng.reviewplan.consumer;

import com.longfeng.reviewplan.service.ReviewPlanService;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.Instant;
import org.apache.rocketmq.spring.annotation.RocketMQMessageListener;
import org.apache.rocketmq.spring.core.RocketMQListener;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * SC-01 步 10 · question.created.topic → review-plan 生成 plan + 7 nodes.
 *
 * <p>消费 payload {@link QuestionCreatedEvent}. 调 {@link ReviewPlanService#createSevenNodes}.
 * 三个 micrometer counter: success / duplicate / orphan, tag source=question.created.
 */
@Component
@ConditionalOnProperty(value = "review.mq.enabled", havingValue = "true")
@RocketMQMessageListener(
    topic = "question.created.topic",
    consumerGroup = "review-plan-question-created-cg")
public class QuestionCreatedConsumer implements RocketMQListener<QuestionCreatedEvent> {

    private static final Logger LOG = LoggerFactory.getLogger(QuestionCreatedConsumer.class);

    private final ReviewPlanService planService;
    private final Counter successCounter;
    private final Counter duplicateCounter;
    private final Counter orphanCounter;

    public QuestionCreatedConsumer(ReviewPlanService planService, MeterRegistry registry) {
        this.planService = planService;
        this.successCounter = Counter.builder("review.plan.consumer")
            .tag("source", "question.created").tag("result", "success").register(registry);
        this.duplicateCounter = Counter.builder("review.plan.consumer")
            .tag("source", "question.created").tag("result", "duplicate").register(registry);
        this.orphanCounter = Counter.builder("review.plan.consumer")
            .tag("source", "question.created").tag("result", "orphan").register(registry);
    }

    @Override
    public void onMessage(QuestionCreatedEvent event) {
        if (event == null || event.getItemId() == null || event.getUserId() == null) {
            orphanCounter.increment();
            LOG.warn("question.created orphan payload: {}", event);
            return;
        }
        Instant base = parseInstant(event.getOccurredAt());
        var created = planService.createSevenNodes(event.getItemId(), event.getUserId(), base);
        if (created.isEmpty()) {
            duplicateCounter.increment();
            LOG.info("question.created duplicate · itemId={}", event.getItemId());
        } else {
            successCounter.increment();
            LOG.info("question.created success · itemId={} · 7 nodes created", event.getItemId());
        }
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
