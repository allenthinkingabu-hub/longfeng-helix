package com.longfeng.reviewplan.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.longfeng.reviewplan.IntegrationTestBase;
import com.longfeng.reviewplan.entity.ReviewPlan;
import com.longfeng.reviewplan.feign.CalendarBatchCreateFallback;
import com.longfeng.reviewplan.feign.CalendarFeignClient;
import com.longfeng.reviewplan.feign.dto.CalendarEventCreateReq;
import com.longfeng.reviewplan.feign.dto.CalendarSubscribeResp;
import com.longfeng.reviewplan.job.CalendarOutboxRelayJob;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import javax.sql.DataSource;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.transaction.PlatformTransactionManager;

/**
 * SC-01-C07 · A06 §3 D1/D5/D6/D9 · 验证 plan 落库后批量 Feign + outbox 兜底 + relay 重试.
 *
 * <p>三路验收：
 *
 * <ul>
 *   <li>① 正常：createSevenNodes → CalendarBatchCreateService.dispatch → Feign success → outbox 0 条
 *   <li>② Feign 503：dispatch 经 {@code @Retryable(maxAttempts=3)} 三次抛 fallback 后写 outbox 1 条
 *       {@code calendar_event_batch_create}
 *   <li>③ CalendarOutboxRelayJob 扫到 outbox · 调 Feign 成功置 status=dispatched + dispatched_at
 * </ul>
 *
 * <p>不依赖 RocketMQ broker · 走真 DB · 用 {@link TestConfiguration} 注入 toggleable
 * {@link CalendarFeignClient} stub 切换 503/OK.
 */
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = "spring.main.allow-bean-definition-overriding=true")
@Import(CalendarBatchCreateIT.C07TestConfig.class)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class CalendarBatchCreateIT extends IntegrationTestBase {

  private static final long C07_STUDENT = 9000700L;
  private static final long C07_ITEM_HAPPY = 9000070001L;
  private static final long C07_ITEM_503 = 9000070002L;
  private static final long C07_ITEM_RELAY = 9000070003L;

  @Autowired private ReviewPlanService planService;
  @Autowired private DataSource dataSource;
  @Autowired private TogglableCalendarStub calendarStub;
  @Autowired private com.longfeng.reviewplan.repo.ReviewPlanOutboxRepository outboxRepo;
  @Autowired private CalendarFeignClient calendarClient;
  @Autowired private PlatformTransactionManager txManager;
  @Autowired private com.fasterxml.jackson.databind.ObjectMapper jsonMapper;

  private JdbcTemplate jdbc;

  @BeforeEach
  void seed() {
    jdbc = new JdbcTemplate(dataSource);
    calendarStub.reset();

    long[] items = {C07_ITEM_HAPPY, C07_ITEM_503, C07_ITEM_RELAY};
    for (long itemId : items) {
      jdbc.update("DELETE FROM review_outcome WHERE wrong_item_id = ?", itemId);
      jdbc.update(
          "DELETE FROM review_plan_outbox WHERE plan_id IN "
              + "(SELECT id FROM review_plan WHERE wrong_item_id = ?)",
          itemId);
      jdbc.update("DELETE FROM review_plan WHERE wrong_item_id = ?", itemId);
      jdbc.update("DELETE FROM wrong_item WHERE id = ?", itemId);
    }

    jdbc.update(
        "INSERT INTO user_account (id, username, role, status, timezone) "
            + "VALUES (?, ?, 'STUDENT', 1, 'Asia/Shanghai') "
            + "ON CONFLICT (id) DO NOTHING",
        C07_STUDENT, "c07-student");

    for (long itemId : items) {
      jdbc.update(
          "INSERT INTO wrong_item (id, student_id, subject, source_type, status, mastery, version) "
              + "VALUES (?, ?, 'math', 1, 0, 0, 0)",
          itemId, C07_STUDENT);
    }
  }

  // ======================================================================
  // ① Happy path · Feign returns OK · outbox 0 calendar_event_batch_create rows
  // ======================================================================
  @Test
  @DisplayName("C07-① · createSevenNodes happy path · Feign success · outbox 0 calendar rows")
  void happyPath_noOutboxRow() {
    Instant base = Instant.parse("2026-05-11T08:00:00Z");
    calendarStub.setMode(StubMode.OK);

    List<ReviewPlan> created =
        planService.createSevenNodes(C07_ITEM_HAPPY, C07_STUDENT, base);

    assertThat(created).hasSize(7);
    assertThat(calendarStub.invocationCount()).isEqualTo(1);
    assertThat(calendarStub.lastBatchSize()).isEqualTo(7);

    int outboxCount = jdbc.queryForObject(
        "SELECT count(*) FROM review_plan_outbox "
            + "WHERE event_type='calendar_event_batch_create' "
            + "AND plan_id IN (SELECT id FROM review_plan WHERE wrong_item_id=?)",
        Integer.class,
        C07_ITEM_HAPPY);
    assertThat(outboxCount).as("happy path · no outbox calendar row").isZero();
  }

  // ======================================================================
  // ② Feign 503 · 3 attempts via @Retryable then outbox 1 row written
  // ======================================================================
  @Test
  @DisplayName("C07-② · Feign 503 · 3 次重试耗尽 · 写 outbox 1 条 calendar_event_batch_create")
  void feign503_retriesThreeTimesThenOutbox() {
    Instant base = Instant.parse("2026-05-11T08:30:00Z");
    calendarStub.setMode(StubMode.FAIL);

    List<ReviewPlan> created =
        planService.createSevenNodes(C07_ITEM_503, C07_STUDENT, base);

    assertThat(created).hasSize(7);
    // @Retryable maxAttempts=3 · stub 抛 fallback 3 次（含首次 + 2 次重试 = 3 invocations）
    assertThat(calendarStub.invocationCount())
        .as("Feign called exactly 3 times by @Retryable")
        .isEqualTo(3);

    int outboxCount = jdbc.queryForObject(
        "SELECT count(*) FROM review_plan_outbox "
            + "WHERE event_type='calendar_event_batch_create' "
            + "AND status='pending' "
            + "AND plan_id IN (SELECT id FROM review_plan WHERE wrong_item_id=?)",
        Integer.class,
        C07_ITEM_503);
    assertThat(outboxCount).as("outbox row written after retries").isEqualTo(1);
  }

  // ======================================================================
  // ③ Relay job picks up outbox · Feign success · status=dispatched
  // ======================================================================
  @Test
  @DisplayName("C07-③ · RelayJob 扫 outbox · 重试成功 · status=DISPATCHED")
  void relayJob_picksUpOutboxAndDispatches() {
    Instant base = Instant.parse("2026-05-11T09:00:00Z");

    // Step A · 先用 503 把 outbox 行写出
    calendarStub.setMode(StubMode.FAIL);
    planService.createSevenNodes(C07_ITEM_RELAY, C07_STUDENT, base);

    int outboxPending = jdbc.queryForObject(
        "SELECT count(*) FROM review_plan_outbox "
            + "WHERE event_type='calendar_event_batch_create' "
            + "AND status='pending' "
            + "AND plan_id IN (SELECT id FROM review_plan WHERE wrong_item_id=?)",
        Integer.class,
        C07_ITEM_RELAY);
    assertThat(outboxPending).as("pre-condition: 1 pending row").isEqualTo(1);

    // Step B · 翻转 stub 为 OK · 让 RelayJob 这次能成功
    calendarStub.setMode(StubMode.OK);
    calendarStub.resetInvocations();

    CalendarOutboxRelayJob relay = new CalendarOutboxRelayJob(
        outboxRepo, calendarClient, jsonMapper, txManager, new SimpleMeterRegistry());
    int dispatched = relay.execute();
    assertThat(dispatched).as("relay dispatched 1 row").isEqualTo(1);
    assertThat(calendarStub.invocationCount()).as("relay invoked Feign once").isEqualTo(1);

    Integer dispatchedCount = jdbc.queryForObject(
        "SELECT count(*) FROM review_plan_outbox "
            + "WHERE event_type='calendar_event_batch_create' "
            + "AND status='dispatched' "
            + "AND dispatched_at IS NOT NULL "
            + "AND plan_id IN (SELECT id FROM review_plan WHERE wrong_item_id=?)",
        Integer.class,
        C07_ITEM_RELAY);
    assertThat(dispatchedCount).as("row marked DISPATCHED").isEqualTo(1);
  }

  // ======================================================================
  // Test config · TogglableCalendarStub (覆盖 FeignAndJpaConfig.FeignDisabled 默认 stub)
  // ======================================================================
  enum StubMode { OK, FAIL }

  static class TogglableCalendarStub implements CalendarFeignClient {
    private volatile StubMode mode = StubMode.OK;
    private final java.util.concurrent.atomic.AtomicInteger invocations =
        new java.util.concurrent.atomic.AtomicInteger();
    private volatile int lastBatchSize = 0;

    void setMode(StubMode mode) { this.mode = mode; }
    void reset() { this.mode = StubMode.OK; invocations.set(0); lastBatchSize = 0; }
    void resetInvocations() { invocations.set(0); }
    int invocationCount() { return invocations.get(); }
    int lastBatchSize() { return lastBatchSize; }

    @Override
    public List<Map<String, Object>> getNodes(java.time.LocalDate date) {
      return Collections.emptyList();
    }

    @Override
    public CalendarSubscribeResp subscribe(String eid) {
      return new CalendarSubscribeResp(null, eid, "SCHEDULED", null);
    }

    @Override
    public List<Map<String, Object>> batchCreateEvents(List<CalendarEventCreateReq> reqs) {
      invocations.incrementAndGet();
      lastBatchSize = reqs == null ? 0 : reqs.size();
      if (mode == StubMode.FAIL) {
        throw new CalendarBatchCreateFallback("stub-503");
      }
      return Collections.emptyList();
    }
  }

  @TestConfiguration
  static class C07TestConfig {
    @Bean
    TogglableCalendarStub togglableCalendarStub() { return new TogglableCalendarStub(); }

    /** 同名 override {@code FeignAndJpaConfig.FeignDisabled#calendarFeignClientStub}. */
    @Bean(name = "calendarFeignClientStub")
    @Primary
    CalendarFeignClient calendarFeignClientStub(TogglableCalendarStub stub) { return stub; }
  }
}
