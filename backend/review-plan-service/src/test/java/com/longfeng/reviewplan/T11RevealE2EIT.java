package com.longfeng.reviewplan;

import static org.assertj.core.api.Assertions.assertThat;

import com.longfeng.reviewplan.entity.ReviewPlan;
import com.longfeng.reviewplan.repo.ReviewPlanOutboxRepository;
import com.longfeng.reviewplan.repo.ReviewPlanRepository;
import com.longfeng.reviewplan.service.NodeLifecycleTracker;
import com.longfeng.reviewplan.support.SnowflakeIdGenerator;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * SC-01-T11 · POST /api/review/nodes/{nid}/reveal E2E IT.
 *
 * <p>Acceptance Criteria:
 *   AC2: POST /api/review/nodes/{nid}/reveal → 200 · NodeLifecycleTracker.markRevealed(nid)
 *   TI1: reveal 不改 plan (ease_factor / next_due_at unchanged)
 *   TI2: reveal 不发 MQ (no outbox row written)
 *
 * <p>Sandbox: PG 15436 · wrongbook DB · review_plan table (shared).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
class T11RevealE2EIT extends IntegrationTestBase {

    @Autowired private MockMvc mvc;
    @Autowired private ReviewPlanRepository planRepo;
    @Autowired private ReviewPlanOutboxRepository outboxRepo;
    @Autowired private NodeLifecycleTracker lifecycleTracker;
    @Autowired private SnowflakeIdGenerator idGen;

    private Long testPlanId;
    private BigDecimal initialEase;
    private Instant initialNextDueAt;

    @BeforeEach
    void seedTestPlan() {
        testPlanId = idGen.nextId();
        initialEase = new BigDecimal("2.5");
        initialNextDueAt = Instant.now().plusSeconds(86400);

        ReviewPlan plan = new ReviewPlan();
        plan.setId(testPlanId);
        plan.setWrongItemId(idGen.nextId());
        plan.setStudentId(7L);
        plan.setNodeIndex((short) 2);
        plan.setStrategyCode("EBBINGHAUS_SM2");
        plan.setStartAt(Instant.now().minusSeconds(3600));
        plan.setCurrentLevel((short) 2);
        plan.setIntervalIndex((short) 2);
        plan.setEaseFactor(initialEase);
        plan.setStatus(ReviewPlan.STATUS_ACTIVE);
        plan.setNextDueAt(initialNextDueAt);
        planRepo.save(plan);
    }

    @Test
    @DisplayName("AC2 · POST /reveal → 200 + {nid, revealedAt}")
    void reveal_returns200_withNidAndRevealedAt() throws Exception {
        MvcResult result = mvc.perform(post("/api/review/nodes/" + testPlanId + "/reveal"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.nid").value(testPlanId))
            .andExpect(jsonPath("$.data.revealedAt").isNotEmpty())
            .andReturn();

        // lifecycleTracker 已 markRevealed
        Instant revealed = lifecycleTracker.getRevealedAt(testPlanId);
        assertThat(revealed).isNotNull();
    }

    @Test
    @DisplayName("TI1 · reveal 不改 plan (ease_factor / next_due_at unchanged)")
    void reveal_doesNotModifyPlan() throws Exception {
        mvc.perform(post("/api/review/nodes/" + testPlanId + "/reveal"))
            .andExpect(status().isOk());

        ReviewPlan afterReveal = planRepo.findById(testPlanId).orElseThrow();
        assertThat(afterReveal.getEaseFactor()).isEqualByComparingTo(initialEase);
        assertThat(afterReveal.getNextDueAt()).isEqualTo(initialNextDueAt);
    }

    @Test
    @DisplayName("TI2 · reveal 不写 outbox (no MQ event)")
    void reveal_doesNotWriteOutbox() throws Exception {
        long outboxCountBefore = outboxRepo.count();

        mvc.perform(post("/api/review/nodes/" + testPlanId + "/reveal"))
            .andExpect(status().isOk());

        long outboxCountAfter = outboxRepo.count();
        assertThat(outboxCountAfter).isEqualTo(outboxCountBefore);
    }

    @Test
    @DisplayName("reveal 幂等 · 第二次 POST /reveal 不刷 revealedAt")
    void reveal_idempotent_doesNotRefreshTimestamp() throws Exception {
        // First reveal
        mvc.perform(post("/api/review/nodes/" + testPlanId + "/reveal"))
            .andExpect(status().isOk());
        Instant firstRevealedAt = lifecycleTracker.getRevealedAt(testPlanId);

        // Wait a bit
        Thread.sleep(50);

        // Second reveal
        mvc.perform(post("/api/review/nodes/" + testPlanId + "/reveal"))
            .andExpect(status().isOk());
        Instant secondRevealedAt = lifecycleTracker.getRevealedAt(testPlanId);

        // putIfAbsent semantics: timestamp should not change
        assertThat(secondRevealedAt).isEqualTo(firstRevealedAt);
    }

    @Test
    @DisplayName("reveal 404 · nonexistent nid → 404")
    void reveal_nonexistentNid_returns404() throws Exception {
        mvc.perform(post("/api/review/nodes/999999999/reveal"))
            .andExpect(status().isNotFound());
    }
}
