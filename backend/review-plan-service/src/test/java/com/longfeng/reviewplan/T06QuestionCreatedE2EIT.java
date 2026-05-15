package com.longfeng.reviewplan;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.longfeng.reviewplan.consumer.QuestionCreatedConsumer;
import com.longfeng.reviewplan.consumer.QuestionCreatedEvent;
import com.longfeng.reviewplan.entity.ReviewPlan;
import com.longfeng.reviewplan.feign.CalendarBatchCreateFallback;
import com.longfeng.reviewplan.feign.CalendarFeignClient;
import com.longfeng.reviewplan.feign.dto.CalendarEventCreateReq;
import com.longfeng.reviewplan.feign.dto.CalendarSubscribeResp;
import com.longfeng.reviewplan.job.CalendarOutboxRelayJob;
import com.longfeng.reviewplan.service.ReviewPlanService;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
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
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.PlatformTransactionManager;

/**
 * SC-01-T06 E2E IT · question.created MQ → review-plan 生成 plan+7 nodes → calendar-core 落 7 events.
 *
 * <p>trace: biz/业务与技术解决方案_AI错题本_基于日历系统.md §2B.2 步 10
 *        + audits/SC-01-PHASE-0/A05-review-plan.md §1.4 / §2.2
 *
 * <p>覆盖 AC1-AC6 + TI1-TI5:
 * <ul>
 *   <li>AC1: question.created payload 结构 (snake_case JsonAlias 容错)
 *   <li>AC2: Consumer → createSevenNodes → 7 review_plan 行 (node_index 0..6)
 *   <li>AC3: NODE_OFFSETS [2h,1d,2d,4d,7d,14d,30d] 写入 next_due_at
 *   <li>AC4: calendarBatchCreate.dispatch → 7 calendar_event (STUDY)
 *   <li>AC5: calendar 503 → outbox 兜底 → relay 重试 → 最终 7 事件落地
 *   <li>AC6: 幂等重放 → existsByWrongItemId 拦截 · duplicate counter 增
 *   <li>TI1: 7 nodes node_index 严格 0..6 无重复无缺失
 *   <li>TI2: NODE_OFFSETS 与 spec 100% 对齐
 *   <li>TI3: 重放 → success=0 / duplicate=1
 *   <li>TI4: calendar 失败不回滚 plan
 *   <li>TI5: outbox 重试耗尽 → outbox row pending (relay 后续扫)
 * </ul>
 *
 * <p>sandbox: team-2 PG @ 127.0.0.1:15433/wrongbook · 不依赖 RocketMQ broker ·
 * 直接构造 Consumer 实例调 onMessage 模拟 MQ 消费 · TogglableCalendarStub 模拟 Feign.
 */
@SpringBootTest(
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = "spring.main.allow-bean-definition-overriding=true")
@Import(T06QuestionCreatedE2EIT.T06TestConfig.class)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class T06QuestionCreatedE2EIT {

  // team-2 sandbox
  private static final String DB_URL = "jdbc:postgresql://127.0.0.1:15433/wrongbook";
  private static final String DB_USER = "longfeng";
  private static final String DB_PASSWORD = "longfeng_dev";

  // test data IDs (高位避免与其他 IT 冲突)
  private static final long T06_STUDENT = 9000600L;
  private static final long T06_ITEM_HAPPY = 9000060001L;
  private static final long T06_ITEM_503 = 9000060002L;
  private static final long T06_ITEM_IDEM = 9000060003L;

  private static final Instant BASE = Instant.parse("2026-05-15T08:00:00Z");

  /** 艾宾浩斯 7 节点偏移 spec §SC-01.10 + s5-review-plan.md §A1. */
  private static final Duration[] EXPECTED_OFFSETS = {
      Duration.ofHours(2),
      Duration.ofDays(1),
      Duration.ofDays(2),
      Duration.ofDays(4),
      Duration.ofDays(7),
      Duration.ofDays(14),
      Duration.ofDays(30),
  };

  static {
    try (var conn = java.sql.DriverManager.getConnection(DB_URL, DB_USER, DB_PASSWORD);
        var st = conn.createStatement()) {
      st.execute("ALTER TABLE review_plan_outbox "
          + "DROP CONSTRAINT IF EXISTS review_plan_outbox_event_type_check");
      st.execute("ALTER TABLE review_plan_outbox "
          + "ADD CONSTRAINT review_plan_outbox_event_type_check "
          + "CHECK (event_type IN ('due','completed','mastered','opened','graded',"
          + "'calendar_event_batch_create'))");
    } catch (Exception e) {
      System.err.println("T06 static schema patch skipped: " + e.getMessage());
    }
  }

  @DynamicPropertySource
  static void props(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", () -> DB_URL);
    r.add("spring.datasource.username", () -> DB_USER);
    r.add("spring.datasource.password", () -> DB_PASSWORD);
    r.add("spring.flyway.url", () -> DB_URL);
    r.add("spring.flyway.user", () -> DB_USER);
    r.add("spring.flyway.password", () -> DB_PASSWORD);
    r.add("spring.flyway.locations", () -> "classpath:db/migration");
    r.add("spring.flyway.out-of-order", () -> "true");
    r.add("spring.flyway.validate-on-migrate", () -> "false");
    r.add("spring.flyway.baseline-on-migrate", () -> "true");
    r.add("spring.flyway.baseline-version", () -> "1");
    r.add("spring.flyway.ignore-migration-patterns", () -> "*:missing,*:future,*:ignored");
    r.add("spring.flyway.enabled", () -> "true");
    r.add("review.mq.enabled", () -> "false");
    r.add("review.feign.enabled", () -> "false");
    r.add("feign.sentinel.enabled", () -> "false");
    r.add("spring.cache.type", () -> "none");
    r.add("spring.cloud.nacos.discovery.enabled", () -> "false");
    r.add("spring.cloud.nacos.config.enabled", () -> "false");
    r.add("spring.cloud.discovery.enabled", () -> "false");
  }

  @Autowired private ReviewPlanService planService;
  @Autowired private DataSource dataSource;
  @Autowired private T06TogglableCalendarStub calendarStub;
  @Autowired private com.longfeng.reviewplan.repo.ReviewPlanOutboxRepository outboxRepo;
  @Autowired private CalendarFeignClient calendarClient;
  @Autowired private PlatformTransactionManager txManager;
  @Autowired private ObjectMapper jsonMapper;

  private JdbcTemplate jdbc;
  private SimpleMeterRegistry meterRegistry;
  private QuestionCreatedConsumer consumer;

  @BeforeEach
  void setUp() {
    jdbc = new JdbcTemplate(dataSource);
    calendarStub.reset();
    meterRegistry = new SimpleMeterRegistry();
    consumer = new QuestionCreatedConsumer(planService, meterRegistry);

    long[] items = {T06_ITEM_HAPPY, T06_ITEM_503, T06_ITEM_IDEM};
    for (long itemId : items) {
      jdbc.update("DELETE FROM review_outcome WHERE plan_id IN "
          + "(SELECT id FROM review_plan WHERE wrong_item_id = ?)", itemId);
      jdbc.update("DELETE FROM review_plan_outbox WHERE plan_id IN "
          + "(SELECT id FROM review_plan WHERE wrong_item_id = ?)", itemId);
      jdbc.update("DELETE FROM review_plan WHERE wrong_item_id = ?", itemId);
      jdbc.update("DELETE FROM wrong_item WHERE id = ?", itemId);
    }

    jdbc.update(
        "INSERT INTO user_account (id, username, role, status, timezone) "
            + "VALUES (?, ?, 'STUDENT', 1, 'Asia/Shanghai') ON CONFLICT (id) DO NOTHING",
        T06_STUDENT, "t06-student");

    for (long itemId : items) {
      jdbc.update(
          "INSERT INTO wrong_item (id, student_id, subject, source_type, status, mastery, version) "
              + "VALUES (?, ?, 'math', 1, 0, 0, 0)",
          itemId, T06_STUDENT);
    }
  }

  // ==================================================================
  // AC1 · payload 结构 + snake_case JsonAlias 容错
  // ==================================================================
  @Test
  @DisplayName("AC1 · QuestionCreatedEvent snake_case JsonAlias 反序列化")
  void ac1_payloadSnakeCaseAlias() throws Exception {
    String json = "{\"item_id\":123,\"user_id\":456,\"subject\":\"math\","
        + "\"topic\":\"algebra\",\"action\":\"created\","
        + "\"occurred_at\":\"2026-05-15T08:00:00Z\"}";
    QuestionCreatedEvent evt = jsonMapper.readValue(json, QuestionCreatedEvent.class);
    assertThat(evt.getItemId()).isEqualTo(123L);
    assertThat(evt.getUserId()).isEqualTo(456L);
    assertThat(evt.getSubject()).isEqualTo("math");
    assertThat(evt.getOccurredAt()).isEqualTo("2026-05-15T08:00:00Z");
  }

  // ==================================================================
  // AC2 + AC3 + TI1 + TI2 · Consumer → 7 rows · offsets correct
  // ==================================================================
  @Test
  @DisplayName("AC2+AC3+TI1+TI2 · consumer.onMessage → 7 plan rows · offsets match spec")
  void ac2_ac3_ti1_ti2_sevenNodesCreated() {
    calendarStub.setMode(StubMode.OK);

    QuestionCreatedEvent evt = makeEvent(T06_ITEM_HAPPY, T06_STUDENT, BASE);
    consumer.onMessage(evt);

    // AC2: 7 rows in DB
    List<Map<String, Object>> rows = jdbc.queryForList(
        "SELECT node_index, strategy_code, ease_factor, status, next_due_at, start_at "
            + "FROM review_plan WHERE wrong_item_id = ? ORDER BY node_index",
        T06_ITEM_HAPPY);
    assertThat(rows).hasSize(7);

    // TI1: node_index 严格 0..6 无重复无缺失
    List<Integer> indexes = rows.stream()
        .map(r -> ((Number) r.get("node_index")).intValue())
        .toList();
    assertThat(indexes).containsExactly(0, 1, 2, 3, 4, 5, 6);

    for (int i = 0; i < 7; i++) {
      Map<String, Object> row = rows.get(i);
      // AC2: strategyCode=EBBINGHAUS_SM2
      assertThat(row.get("strategy_code")).isEqualTo("EBBINGHAUS_SM2");
      // AC2: ease_factor=2.5
      assertThat(((BigDecimal) row.get("ease_factor")).compareTo(new BigDecimal("2.500")))
          .as("ease_factor for node %d", i).isZero();
      // AC2: status=ACTIVE(0)
      assertThat(((Number) row.get("status")).shortValue()).isEqualTo(ReviewPlan.STATUS_ACTIVE);

      // AC3 + TI2: next_due_at = BASE + EXPECTED_OFFSETS[i]
      Instant expectedDue = BASE.plus(EXPECTED_OFFSETS[i]);
      Instant actualDue = ((java.sql.Timestamp) row.get("next_due_at")).toInstant();
      assertThat(actualDue).as("next_due_at for node %d", i).isEqualTo(expectedDue);
    }

    // success counter
    Counter success = meterRegistry.find("review.plan.consumer")
        .tag("result", "success").counter();
    assertThat(success).isNotNull();
    assertThat(success.count()).isEqualTo(1.0);
  }

  // ==================================================================
  // AC4 · calendar dispatch · 7 events STUDY
  // ==================================================================
  @Test
  @DisplayName("AC4 · createSevenNodes → Feign batchCreate 1 invocation · 7 reqs · STUDY")
  void ac4_calendarDispatch() {
    calendarStub.setMode(StubMode.OK);

    consumer.onMessage(makeEvent(T06_ITEM_HAPPY, T06_STUDENT, BASE));

    assertThat(calendarStub.invocationCount()).isEqualTo(1);
    assertThat(calendarStub.lastBatchSize()).isEqualTo(7);

    // verify request details
    List<CalendarEventCreateReq> lastBatch = calendarStub.lastBatch();
    assertThat(lastBatch).hasSize(7);
    for (int i = 0; i < 7; i++) {
      CalendarEventCreateReq req = lastBatch.get(i);
      assertThat(req.getRelationType()).isEqualTo("STUDY");
      assertThat(req.getRelationId()).startsWith("question:" + T06_ITEM_HAPPY + ":node:");
      assertThat(req.getState()).isEqualTo("SCHEDULED");
      assertThat(req.getTitle()).isEqualTo("复习节点 T" + i);
    }
  }

  // ==================================================================
  // AC5 + TI4 + TI5 · calendar 503 → plan 不回滚 + outbox 兜底 + relay 重试
  // ==================================================================
  @Test
  @DisplayName("AC5+TI4+TI5 · Feign 503 → plan 7 行不回滚 · outbox 1 行 · relay 成功")
  void ac5_ti4_ti5_calendarFailureOutboxRelay() {
    calendarStub.setMode(StubMode.FAIL);

    consumer.onMessage(makeEvent(T06_ITEM_503, T06_STUDENT, BASE));

    // AC5 · @Retryable(maxAttempts=3) 验证：stub 应被调用 3 次后 fallback 到 outbox
    assertThat(calendarStub.invocationCount())
        .as("AC5 · Feign batchCreateEvents retried 3 times before outbox fallback")
        .isEqualTo(3);

    // TI4: plan 7 行仍在 (calendar 失败不回滚 plan)
    int planCount = jdbc.queryForObject(
        "SELECT count(*) FROM review_plan WHERE wrong_item_id = ?",
        Integer.class, T06_ITEM_503);
    assertThat(planCount).as("TI4 · calendar fail does not rollback plan").isEqualTo(7);

    // TI5: outbox 1 行 pending
    int outboxCount = jdbc.queryForObject(
        "SELECT count(*) FROM review_plan_outbox "
            + "WHERE event_type='calendar_event_batch_create' AND status='pending' "
            + "AND plan_id IN (SELECT id FROM review_plan WHERE wrong_item_id=?)",
        Integer.class, T06_ITEM_503);
    assertThat(outboxCount).as("TI5 · outbox row written after retries").isEqualTo(1);

    // AC5: relay job picks up → dispatched
    calendarStub.setMode(StubMode.OK);
    calendarStub.resetInvocations();

    CalendarOutboxRelayJob relay = new CalendarOutboxRelayJob(
        outboxRepo, calendarClient, jsonMapper, txManager, new SimpleMeterRegistry());
    int dispatched = relay.execute();
    assertThat(dispatched).as("relay dispatched 1 row").isGreaterThanOrEqualTo(1);

    int dispatchedCount = jdbc.queryForObject(
        "SELECT count(*) FROM review_plan_outbox "
            + "WHERE event_type='calendar_event_batch_create' AND status='dispatched' "
            + "AND plan_id IN (SELECT id FROM review_plan WHERE wrong_item_id=?)",
        Integer.class, T06_ITEM_503);
    assertThat(dispatchedCount).as("AC5 · outbox dispatched after relay").isEqualTo(1);
  }

  // ==================================================================
  // AC6 + TI3 · 幂等重放 → duplicate counter
  // ==================================================================
  @Test
  @DisplayName("AC6+TI3 · 同 wrong_item_id 重放 → existsByWrongItemId 拦截 · duplicate counter")
  void ac6_ti3_idempotentReplay() {
    calendarStub.setMode(StubMode.OK);

    // 第 1 次：成功
    consumer.onMessage(makeEvent(T06_ITEM_IDEM, T06_STUDENT, BASE));
    int count1 = jdbc.queryForObject(
        "SELECT count(*) FROM review_plan WHERE wrong_item_id = ?",
        Integer.class, T06_ITEM_IDEM);
    assertThat(count1).isEqualTo(7);

    // 第 2 次：重放 · 幂等跳过
    consumer.onMessage(makeEvent(T06_ITEM_IDEM, T06_STUDENT, BASE));
    int count2 = jdbc.queryForObject(
        "SELECT count(*) FROM review_plan WHERE wrong_item_id = ?",
        Integer.class, T06_ITEM_IDEM);
    assertThat(count2).as("AC6 · no duplicate rows").isEqualTo(7);

    // TI3: success=1, duplicate=1
    Counter success = meterRegistry.find("review.plan.consumer")
        .tag("result", "success").counter();
    Counter duplicate = meterRegistry.find("review.plan.consumer")
        .tag("result", "duplicate").counter();
    assertThat(success).isNotNull();
    assertThat(success.count()).isEqualTo(1.0);
    assertThat(duplicate).isNotNull();
    assertThat(duplicate.count()).isEqualTo(1.0);
  }

  // ==================================================================
  // helper
  // ==================================================================
  private static QuestionCreatedEvent makeEvent(long itemId, long userId, Instant occurredAt) {
    QuestionCreatedEvent e = new QuestionCreatedEvent();
    e.setItemId(itemId);
    e.setUserId(userId);
    e.setSubject("math");
    e.setTopic("algebra");
    e.setAction("created");
    e.setOccurredAt(occurredAt.toString());
    return e;
  }

  // ==================================================================
  // stub + config
  // ==================================================================
  enum StubMode { OK, FAIL }

  static class T06TogglableCalendarStub implements CalendarFeignClient {
    private volatile StubMode mode = StubMode.OK;
    private final AtomicInteger invocations = new AtomicInteger();
    private volatile int lastBatchSize = 0;
    private volatile List<CalendarEventCreateReq> lastBatch = List.of();

    void setMode(StubMode m) { mode = m; }
    void reset() { mode = StubMode.OK; invocations.set(0); lastBatchSize = 0; lastBatch = List.of(); }
    void resetInvocations() { invocations.set(0); }
    int invocationCount() { return invocations.get(); }
    int lastBatchSize() { return lastBatchSize; }
    List<CalendarEventCreateReq> lastBatch() { return lastBatch; }

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
      lastBatch = reqs == null ? List.of() : new ArrayList<>(reqs);
      if (mode == StubMode.FAIL) {
        throw new CalendarBatchCreateFallback("stub-503");
      }
      return Collections.emptyList();
    }
  }

  @TestConfiguration
  static class T06TestConfig {
    @Bean
    T06TogglableCalendarStub t06TogglableCalendarStub() { return new T06TogglableCalendarStub(); }

    @Bean(name = "calendarFeignClientStub")
    @Primary
    CalendarFeignClient calendarFeignClientStub(T06TogglableCalendarStub stub) { return stub; }
  }
}
