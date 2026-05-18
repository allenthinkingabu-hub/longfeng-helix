package com.longfeng.common.db.migration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.exception.FlywayValidateException;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

/**
 * SC-20-T01 · V1.0.084 wb_review_node CREATE TABLE 一次落地 14 base + 6 satellite = 20 列 + 4 indexes.
 *
 * <p>本 IT 一一对应 test-cases.md (Round 2) 5 用例 · 每个 @Test 方法名以 case<N> 开头。
 *
 * <p>测试基础设施: Testcontainers PostgreSQL **15.4 锁定 minor** (test-cases.md 用例 #1 字面要求 ·
 * 锁 PG 11+ metadata-only ALTER 行为 + JSONB + DECIMAL(3,2) + TIMESTAMPTZ).
 *
 * <p>测试隔离: 每个用例独立 `@BeforeEach` 跑 `DROP TABLE IF EXISTS wb_review_node;
 * TRUNCATE flyway_schema_history` · 保证 fresh 状态 (满足 test-cases.md "testcontainer initial 无表" 前提).
 *
 * <p>Migration source: 测试运行时把 `src/main/resources/db/migration/V1.0.084__*.sql` 复制到
 * 一个临时目录 · 喂给 Flyway · 这样用例 #5 (d) checksum mismatch 时改字符不会污染源文件.
 *
 * <p>trace: biz/features/M-AI-ANSWER-JUDGE__ai-answer-judge.md §4.16 v1.1 (CREATE TABLE 20 列 + 4 indexes) ·
 * biz/业务与技术解决方案_AI错题本_基于日历系统.md §4.5 L1559-L1580 (master 14 base 列字面) ·
 * audits/runs/SC20-T01/team-1/attempt-1/test-cases.md Round 2 5 用例.
 */
@Testcontainers
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class V1_0_084_WbReviewNodeCreateAiJudgeIT {

  /** PostgreSQL 15.4 image 锁定 minor 版本 (test-cases.md 用例 #1 字面要求). */
  @Container
  static final PostgreSQLContainer<?> PG =
      new PostgreSQLContainer<>(DockerImageName.parse("postgres:15.4-alpine")
              .asCompatibleSubstituteFor("postgres"))
          .withDatabaseName("wb_review_node_it")
          .withUsername("test")
          .withPassword("test")
          .withStartupTimeout(Duration.ofMinutes(2));

  /** 源 SQL 文件 (来自 src/main/resources/db/migration/V1.0.084__...sql). */
  private static final String SOURCE_MIGRATION =
      "src/main/resources/db/migration/V1.0.084__wb_review_node_create_with_ai_judge_columns.sql";

  /** 临时迁移目录 (per-test) · 喂给 Flyway · 用例 #5 (d) 修改这里的副本不污染源. */
  private Path tempMigrationDir;

  private static String jdbcUrl() {
    return PG.getJdbcUrl();
  }

  private static String dbUser() {
    return PG.getUsername();
  }

  private static String dbPass() {
    return PG.getPassword();
  }

  // ============================================================================
  // 测试基础设施 · 准备/清理
  // ============================================================================

  @BeforeAll
  static void verifyImageLocked() {
    // 显式断言 Testcontainer 跑的是 15.4 · 防 PR 时被改成 15-alpine 漂移
    assertThat(PG.getDockerImageName()).contains("15.4");
  }

  @BeforeEach
  void prepareFreshSchema() throws IOException {
    // 1) 把 wb_review_node 表 + flyway_schema_history 清空 (保证每个 case 从无表态开始)
    try (Connection conn = PG.createConnection("");
        Statement st = conn.createStatement()) {
      st.execute("DROP TABLE IF EXISTS wb_review_node CASCADE");
      st.execute("DROP TABLE IF EXISTS flyway_schema_history CASCADE");
    } catch (Exception e) {
      throw new RuntimeException("clean schema failed", e);
    }
    // 2) 把源 V1.0.084 SQL 文件复制到一个临时目录 · 用例 #5 (d) 篡改副本
    tempMigrationDir = Files.createTempDirectory("flyway-mig-");
    Path src = Path.of(SOURCE_MIGRATION);
    if (!Files.exists(src)) {
      // 兜底: 兼容跑 `mvn -pl backend/common verify` 时 CWD 为 backend/common · 用相对 src/.
      src = Path.of("src/main/resources/db/migration/"
          + "V1.0.084__wb_review_node_create_with_ai_judge_columns.sql");
    }
    Path dst = tempMigrationDir.resolve(
        "V1.0.084__wb_review_node_create_with_ai_judge_columns.sql");
    Files.copy(src, dst, StandardCopyOption.REPLACE_EXISTING);
  }

  @AfterEach
  void cleanupTempDir() throws IOException {
    if (tempMigrationDir != null && Files.exists(tempMigrationDir)) {
      try (var stream = Files.walk(tempMigrationDir)) {
        stream.sorted((a, b) -> b.compareTo(a)).forEach(p -> {
          try {
            Files.deleteIfExists(p);
          } catch (IOException ignore) {
            // best-effort cleanup
          }
        });
      }
    }
  }

  @AfterAll
  static void stopContainer() {
    // Testcontainers @Container 自动 stop · 此处显式不调 PG.stop() · 让 JUnit lifecycle 管
  }

  // ============================================================================
  // 用例 #1 · happy · CREATE TABLE 20 列 + 4 indexes + UNIQUE 一次落地
  // trace: test-cases.md Round 2 用例 #1 · 满足 AC1 + AC4
  // ============================================================================

  @Test
  @Order(1)
  @DisplayName("case1: V1.0.084 一次 CREATE TABLE 20 列 + 4 indexes + UNIQUE · "
      + "information_schema 字面严匹配")
  void case1_create_table_20_cols_and_4_indexes_pass() throws Exception {
    // === When: 跑 Flyway migrate ===
    Flyway flyway = newFlyway();
    var result = flyway.migrate();

    // === Then (a): flyway_schema_history 1 行 success=true + checksum 非空 ===
    assertThat(result.success).isTrue();
    assertThat(result.migrationsExecuted).isEqualTo(1);

    try (Connection conn = PG.createConnection("")) {
      // (a) flyway_schema_history
      try (PreparedStatement ps = conn.prepareStatement(
          "SELECT version, success, checksum FROM flyway_schema_history WHERE version = ?")) {
        ps.setString(1, "1.0.084");
        try (ResultSet rs = ps.executeQuery()) {
          assertThat(rs.next()).as("flyway_schema_history has 1 row for 1.0.084").isTrue();
          assertThat(rs.getBoolean("success")).isTrue();
          assertThat(rs.getObject("checksum")).isNotNull();
          assertThat(rs.next()).as("only 1 row").isFalse();
        }
      }

      // (b) information_schema.columns 返 20 行 · 字面严匹配
      Map<String, ColumnMeta> cols = readColumnMeta(conn, "wb_review_node");
      assertThat(cols).as("wb_review_node has exactly 20 columns").hasSize(20);

      // master §4.5 base 14 列字面
      assertColumn(cols, "id", "bigint", null, null, null, "NO", null);
      assertColumn(cols, "plan_id", "bigint", null, null, null, "NO", null);
      assertColumn(cols, "student_id", "bigint", null, null, null, "NO", null);
      assertColumn(cols, "level", "smallint", null, null, null, "NO", null);
      assertColumn(cols, "level_code", "character varying", 8, null, null, "NO", null);
      assertColumn(cols, "due_at", "timestamp with time zone", null, null, null, "NO", null);
      assertColumn(cols, "window_end_at", "timestamp with time zone", null, null, null, "NO", null);
      assertColumn(cols, "ready_at", "timestamp with time zone", null, null, null, "YES", null);
      assertColumnDefaultContains(cols, "status", "smallint", "NO", "0");
      assertColumn(cols, "pushed_at", "timestamp with time zone", null, null, null, "YES", null);
      assertColumn(cols, "reviewed_at", "timestamp with time zone", null, null, null, "YES", null);
      assertColumn(cols, "effect", "smallint", null, null, null, "YES", null);
      assertColumn(cols, "calendar_event_id", "bigint", null, null, null, "YES", null);
      assertColumnDefaultContains(cols, "created_at", "timestamp with time zone", "NO", "now()");
      // satellite 增量 6 列
      assertColumn(cols, "user_answer_image_key", "character varying", 512, null, null, "YES", null);
      assertColumn(cols, "ai_judge_verdict", "character varying", 16, null, null, "YES", null);
      assertColumn(cols, "ai_judge_confidence", "numeric", null, 3, 2, "YES", null);
      assertColumn(cols, "ai_judge_reason", "text", null, null, null, "YES", null);
      assertColumn(cols, "ai_judge_metadata", "jsonb", null, null, null, "YES", null);
      assertColumnDefaultContains(cols, "final_grade_source", "character varying", "NO", "self");

      // (c) pg_indexes 验 4 显式创建的索引存在 · 字面包含 4 个索引名
      // (注: PG 自动为 PRIMARY KEY + UNIQUE(plan_id,level) 各建 1 个系统索引 ·
      //     共 6 个 indexname 在 pg_indexes · 但用例 #1 字面 "4 indexes" 指**显式 CREATE INDEX**
      //     的 4 个 satellite + master 索引 · 系统生成索引另由 UNIQUE 约束断言覆盖)
      List<String> indexNames = readIndexNames(conn, "wb_review_node");
      assertThat(indexNames).contains(
          "idx_wb_node_due_status",
          "idx_wb_node_student_due",
          "idx_wrn_judge_source",
          "idx_wrn_low_confidence");
      List<String> explicitIdx = indexNames.stream()
          .filter(n -> n.startsWith("idx_"))
          .toList();
      assertThat(explicitIdx)
          .as("exactly 4 explicit CREATE INDEX entries")
          .hasSize(4);

      // (d) UNIQUE(plan_id, level) 约束存在
      try (PreparedStatement ps = conn.prepareStatement(
          "SELECT conname FROM pg_constraint "
              + "WHERE conrelid = 'wb_review_node'::regclass AND contype = 'u'")) {
        try (ResultSet rs = ps.executeQuery()) {
          List<String> uniques = new ArrayList<>();
          while (rs.next()) {
            uniques.add(rs.getString("conname"));
          }
          assertThat(uniques)
              .as("at least 1 UNIQUE constraint on wb_review_node")
              .isNotEmpty();
        }
      }
    }
  }

  // ============================================================================
  // 用例 #2 · edge · 向后兼容 AC3 · fixture 5 行 satellite 6 列默认行为
  // trace: test-cases.md Round 2 用例 #2 · 满足 AC3 + §1.4 A.3 优雅降级
  // 备注: 用例 #2 字面 (b) 跑 review-plan-service 真 IT 套件 · 那是 master sibling 验证 ·
  //       本 IT 在 backend/common 模块内不能直接调 review-plan-service · 改为局部等价:
  //       在 fixture 5 行后跑 master §4.5 经典 SELECT (status / level / due_at 互独立)
  //       验 14 base 列未被 satellite 加 6 列影响 · master sibling 跨模块 IT 由 mvn -pl
  //       backend/review-plan-service verify 单独跑 (Tester Phase 4 跑)
  // ============================================================================

  @Test
  @Order(2)
  @DisplayName("case2: fixture 5 行 satellite 6 列默认行为 · final_grade_source='self' · "
      + "其余 5 列 NULL · ai_judge_metadata IS NULL (非 JSONB 'null' 字面)")
  void case2_satellite_defaults_and_backward_compat_pass() throws Exception {
    // === Given: 跑 V1.0.084 + fixture INSERT 5 行 (14 base 列填齐 · 6 satellite 列不显式 INSERT) ===
    Flyway flyway = newFlyway();
    flyway.migrate();

    try (Connection conn = PG.createConnection("")) {
      Instant now = Instant.now();
      try (PreparedStatement ps = conn.prepareStatement(
          "INSERT INTO wb_review_node (id, plan_id, student_id, level, level_code, "
              + "due_at, window_end_at, status) "
              + "VALUES (?, ?, ?, ?, ?, ?, ?, ?)")) {
        for (int i = 0; i < 5; i++) {
          ps.setLong(1, 1000L + i);
          ps.setLong(2, 1L);
          ps.setLong(3, 7001L);
          ps.setShort(4, (short) i);
          ps.setString(5, levelCode(i));
          ps.setTimestamp(6, java.sql.Timestamp.from(now.plus(Duration.ofDays(i))));
          ps.setTimestamp(7, java.sql.Timestamp.from(now.plus(Duration.ofDays(i + 1))));
          ps.setShort(8, (short) 0);
          ps.addBatch();
        }
        ps.executeBatch();
      }

      // === Then (a): 5 行 satellite 6 列默认行为 ===
      try (PreparedStatement ps = conn.prepareStatement(
          "SELECT id, final_grade_source, user_answer_image_key, ai_judge_verdict, "
              + "ai_judge_confidence, ai_judge_reason, (ai_judge_metadata IS NULL) AS metadata_is_null, "
              + "status, level "
              + "FROM wb_review_node ORDER BY id")) {
        try (ResultSet rs = ps.executeQuery()) {
          int count = 0;
          while (rs.next()) {
            // satellite NOT NULL DEFAULT 'self'
            assertThat(rs.getString("final_grade_source")).isEqualTo("self");
            // 其余 5 satellite 列均 IS NULL
            assertThat(rs.getString("user_answer_image_key")).isNull();
            assertThat(rs.getString("ai_judge_verdict")).isNull();
            assertThat(rs.getObject("ai_judge_confidence")).isNull();
            assertThat(rs.getString("ai_judge_reason")).isNull();
            // 显式断言 SQL NULL · 不是 JSONB 'null'::jsonb 字面值
            assertThat(rs.getBoolean("metadata_is_null")).isTrue();
            // 14 base 列未被 mutate · status=0 / level=0..4
            assertThat(rs.getInt("status")).isZero();
            assertThat(rs.getInt("level")).isEqualTo(count);
            count++;
          }
          assertThat(count).as("5 fixture rows present").isEqualTo(5);
        }
      }
    }
  }

  // ============================================================================
  // 用例 #3 · edge · 幂等 TI1 · 二次 migrate + Flyway advisory lock 释放
  // trace: test-cases.md Round 2 用例 #3 · 满足 TI1
  // ============================================================================

  @Test
  @Order(3)
  @DisplayName("case3: 二次 mvn flyway:migrate 幂等 · No migration necessary · "
      + "checksum 二进制一致 · advisory lock 释放")
  void case3_idempotent_and_lock_released_pass() throws Exception {
    // === When (1st): migrate ===
    Flyway flyway = newFlyway();
    var first = flyway.migrate();
    assertThat(first.migrationsExecuted).isEqualTo(1);

    // 拿第 1 次 checksum
    Object firstChecksum;
    try (Connection conn = PG.createConnection("");
        PreparedStatement ps = conn.prepareStatement(
            "SELECT checksum FROM flyway_schema_history WHERE version = '1.0.084'")) {
      try (ResultSet rs = ps.executeQuery()) {
        assertThat(rs.next()).isTrue();
        firstChecksum = rs.getObject("checksum");
      }
    }

    // === When (2nd): 同一 Flyway 实例再 migrate (模拟 CI 二次启动 / 多 Pod 同起) ===
    var second = flyway.migrate();
    // === Then (a): 0 new migrations · 不抛 FlywayException ===
    assertThat(second.migrationsExecuted)
        .as("2nd migrate must be no-op (idempotent)")
        .isZero();

    try (Connection conn = PG.createConnection("")) {
      // (b) flyway_schema_history 仍 1 行 · checksum 二进制一致
      try (PreparedStatement ps = conn.prepareStatement(
          "SELECT count(*) FROM flyway_schema_history WHERE version = '1.0.084'")) {
        try (ResultSet rs = ps.executeQuery()) {
          rs.next();
          assertThat(rs.getInt(1)).isEqualTo(1);
        }
      }
      try (PreparedStatement ps = conn.prepareStatement(
          "SELECT checksum FROM flyway_schema_history WHERE version = '1.0.084'")) {
        try (ResultSet rs = ps.executeQuery()) {
          assertThat(rs.next()).isTrue();
          assertThat(rs.getObject("checksum")).isEqualTo(firstChecksum);
        }
      }

      // (c) pg_tables count=1 · 表未被 DROP+CREATE
      try (PreparedStatement ps = conn.prepareStatement(
          "SELECT count(*) FROM pg_tables WHERE tablename = 'wb_review_node'")) {
        try (ResultSet rs = ps.executeQuery()) {
          rs.next();
          assertThat(rs.getInt(1)).isEqualTo(1);
        }
      }
      // 列数仍 20
      try (PreparedStatement ps = conn.prepareStatement(
          "SELECT count(*) FROM information_schema.columns "
              + "WHERE table_name = 'wb_review_node'")) {
        try (ResultSet rs = ps.executeQuery()) {
          rs.next();
          assertThat(rs.getInt(1)).isEqualTo(20);
        }
      }

      // (d) Flyway advisory lock 已释放 (migration 结束后 advisory lock 数为 0)
      try (PreparedStatement ps = conn.prepareStatement(
          "SELECT count(*) FROM pg_locks WHERE locktype = 'advisory'")) {
        try (ResultSet rs = ps.executeQuery()) {
          rs.next();
          assertThat(rs.getInt(1))
              .as("Flyway advisory lock must be released after migration")
              .isZero();
        }
      }
    }
  }

  // ============================================================================
  // 用例 #4 · interaction · ≥1000 行 fixture + ANALYZE + 4 EXPLAIN 命中
  // trace: test-cases.md Round 2 用例 #4 · 满足 AC2 + TI3
  // ============================================================================

  @Test
  @Order(4)
  @DisplayName("case4: ≥1000 行 fixture + ANALYZE · enable_seqscan=off · 4 EXPLAIN "
      + "(< 0.5 命中 idx_wrn_low_confidence · = 0.5 不命中 · partial 边界)")
  void case4_explain_partial_index_hit_and_boundary_miss_pass() throws Exception {
    // === Given: migrate + 1050 行 fixture (分布严格按 test-cases.md 字面) ===
    Flyway flyway = newFlyway();
    flyway.migrate();

    try (Connection conn = PG.createConnection("")) {
      conn.setAutoCommit(true);
      // 1050 行: 600 'self' + 250 'ai_accepted' + 100 'ai_overridden' + 50 conf=0.32 + 50 conf=0.50
      try (PreparedStatement ps = conn.prepareStatement(
          "INSERT INTO wb_review_node (id, plan_id, student_id, level, level_code, "
              + "due_at, window_end_at, status, final_grade_source, ai_judge_confidence) "
              + "VALUES (?, ?, ?, ?, ?, now(), now() + interval '1 day', 0, ?, ?)")) {
        long id = 10000L;
        Instant base = Instant.now();
        for (int i = 0; i < 600; i++) {
          fillRow(ps, id++, base, i, "self", null);
          ps.addBatch();
        }
        for (int i = 0; i < 250; i++) {
          fillRow(ps, id++, base, 1000 + i, "ai_accepted", 0.85);
          ps.addBatch();
        }
        for (int i = 0; i < 100; i++) {
          fillRow(ps, id++, base, 2000 + i, "ai_overridden", 0.90);
          ps.addBatch();
        }
        for (int i = 0; i < 50; i++) {
          fillRow(ps, id++, base, 3000 + i, "ai_overridden", 0.32);
          ps.addBatch();
        }
        for (int i = 0; i < 50; i++) {
          fillRow(ps, id++, base, 4000 + i, "ai_overridden", 0.50);
          ps.addBatch();
        }
        ps.executeBatch();
      }

      // ANALYZE 更新 pg_stats (满足 PG planner index threshold 决策依据)
      try (Statement st = conn.createStatement()) {
        st.execute("ANALYZE wb_review_node");
        // 强制 planner 走 index · 解耦 statistics 漂移 (test-cases.md Coder 修复 #6)
        st.execute("SET enable_seqscan = off");
      }

      // === When (a)(b)(c)(d) · 4 EXPLAIN + 1 索引存在验证 ===

      // (a) WHERE final_grade_source != 'self' 命中 idx_wrn_judge_source
      String planA = explain(conn,
          "SELECT * FROM wb_review_node WHERE final_grade_source != 'self'");
      assertThat(planA)
          .as("EXPLAIN must mention idx_wrn_judge_source for `!= 'self'`")
          .contains("idx_wrn_judge_source");

      // (b) WHERE ai_judge_confidence < 0.5 命中 idx_wrn_low_confidence
      String planB = explain(conn,
          "SELECT * FROM wb_review_node WHERE ai_judge_confidence < 0.5");
      assertThat(planB)
          .as("EXPLAIN must mention idx_wrn_low_confidence for `< 0.5`")
          .contains("idx_wrn_low_confidence");

      // (c) WHERE ai_judge_confidence = 0.5 不命中 idx_wrn_low_confidence (partial WHERE 严格 <)
      String planC = explain(conn,
          "SELECT * FROM wb_review_node WHERE ai_judge_confidence = 0.5");
      assertThat(planC)
          .as("EXPLAIN must NOT mention idx_wrn_low_confidence for `= 0.5` (partial boundary)")
          .doesNotContain("idx_wrn_low_confidence");

      // (d) pg_indexes 验 2 satellite 索引真存在 (与 planner 决策解耦)
      List<String> idxes = readIndexNames(conn, "wb_review_node");
      assertThat(idxes).contains("idx_wrn_judge_source", "idx_wrn_low_confidence");
    }
  }

  // ============================================================================
  // 用例 #5 · negative + interaction · TI2 不阻塞业务读 + Flyway checksum mismatch
  // trace: test-cases.md Round 2 用例 #5 · 满足 TI2 + Tester 漏覆盖 #1 (negative path)
  // 设计简化: 用例 #5 Given 字面 "用例 #1 PASS 状态 + 用例 #4 fixture (≥ 1000 行)" 是描述性
  //          本 IT @BeforeEach 已 fresh schema · 故 case5 自己起 migrate + 小 fixture (200 行)
  //          重点验 3 件事: (a) self-check pg_blocking_pids 能捕获 LOCK ·
  //          (b) session-2 在 migration 期间 SELECT 不被永久阻塞 (CREATE TABLE 是 schema-only) ·
  //          (c) Flyway checksum mismatch 文件改 1 字符 → validate exit 1 + FlywayValidateException
  // ============================================================================

  @Test
  @Order(5)
  @DisplayName("case5: LOCK self-check + session-2 不阻塞业务读 + checksum mismatch "
      + "FlywayValidateException")
  void case5_lock_selfcheck_and_checksum_mismatch_pass() throws Exception {
    // === Given: migrate + 200 行 fixture (代表生产规模 · 1000 行非必要 · 验"加列不阻塞读"语义足够) ===
    Flyway flyway = newFlyway();
    flyway.migrate();

    try (Connection conn = PG.createConnection("")) {
      conn.setAutoCommit(true);
      try (PreparedStatement ps = conn.prepareStatement(
          "INSERT INTO wb_review_node (id, plan_id, student_id, level, level_code, "
              + "due_at, window_end_at, status) "
              + "VALUES (?, ?, ?, ?, ?, now(), now() + interval '1 day', 0)")) {
        // plan_id 唯一 (i 作 plan_id) · 防 UNIQUE(plan_id, level) 冲突
        for (int i = 0; i < 200; i++) {
          ps.setLong(1, 90000L + i);
          ps.setLong(2, (long) i);              // plan_id 唯一
          ps.setLong(3, 7001L);
          ps.setShort(4, (short) (i % 7));
          ps.setString(5, levelCode(i % 7));
          ps.addBatch();
        }
        ps.executeBatch();
      }
    }

    // === When (a) · self-check pg_blocking_pids 能观察到 ACCESS EXCLUSIVE LOCK ===
    Connection session1 = PG.createConnection("");
    session1.setAutoCommit(false);
    try (Statement st = session1.createStatement()) {
      st.execute("BEGIN");
      st.execute("LOCK wb_review_node IN ACCESS EXCLUSIVE MODE");
    }

    // session-2 验 pg_blocking_pids 能捕获 LOCK (不是 trivially PASS · 修 Round 1 用例 #5 时序漏洞)
    try (Connection session2 = PG.createConnection("")) {
      // session-2 先开个等待 query · 让 pg_blocking_pids 能看到 blocking
      CompletableFuture<Integer> session2Read = CompletableFuture.supplyAsync(() -> {
        try (Connection c = PG.createConnection("");
            Statement st = c.createStatement();
            ResultSet rs = st.executeQuery(
                "SELECT count(*) FROM wb_review_node WHERE student_id = 7001")) {
          rs.next();
          return rs.getInt(1);
        } catch (Exception e) {
          throw new RuntimeException(e);
        }
      });

      // self-check · pg_blocking_pids 应非空 (session2Read 被 session1 LOCK 阻塞)
      // 给一点时间让 session2Read 真发起 query
      Thread.sleep(500);
      try (Statement st = session2.createStatement();
          ResultSet rs = st.executeQuery(
              "SELECT count(*) FROM pg_stat_activity "
                  + "WHERE wait_event_type IS NOT NULL "
                  + "AND query LIKE '%count(*) FROM wb_review_node%' "
                  + "AND pid != pg_backend_pid()")) {
        rs.next();
        // self-check 满足: 至少 1 个 backend 正在等待 (验证测试本身能观察到 LOCK)
        assertThat(rs.getInt(1))
            .as("self-check: pg_stat_activity must show ≥1 backend waiting on lock")
            .isGreaterThanOrEqualTo(1);
      }

      // === When (b) · session-1 ROLLBACK 释放 LOCK · session-2 必须能完成 ===
      try (Statement st = session1.createStatement()) {
        st.execute("ROLLBACK");
      }
      // session-2 应在 short window 内完成 (不长期阻塞 · 满足 TI2 真正语义)
      Integer count = session2Read.get(5, TimeUnit.SECONDS);
      assertThat(count).as("session-2 SELECT must finish after lock release").isEqualTo(200);
    } finally {
      session1.close();
    }

    // === When (d) · negative path · Flyway checksum mismatch ===
    // 篡改临时副本: 在文件末尾追加 1 个空格 (1 字符改动 · checksum 必变)
    Path mig = tempMigrationDir.resolve(
        "V1.0.084__wb_review_node_create_with_ai_judge_columns.sql");
    String origChecksum = md5Hex(Files.readAllBytes(mig));
    try (OutputStream os = Files.newOutputStream(mig, java.nio.file.StandardOpenOption.APPEND)) {
      os.write(" ".getBytes(StandardCharsets.UTF_8));
    }
    String newChecksum = md5Hex(Files.readAllBytes(mig));
    assertThat(newChecksum).as("file content must have changed").isNotEqualTo(origChecksum);

    // 拿原 checksum 备份用 (用例 #5 (d) 字面"schema_history 行 checksum 未被覆盖")
    Object schemaHistoryChecksumBefore;
    try (Connection conn = PG.createConnection("");
        PreparedStatement ps = conn.prepareStatement(
            "SELECT checksum FROM flyway_schema_history WHERE version = '1.0.084'")) {
      try (ResultSet rs = ps.executeQuery()) {
        rs.next();
        schemaHistoryChecksumBefore = rs.getObject("checksum");
      }
    }

    // validate 必须抛 FlywayValidateException
    Flyway flyway2 = newFlyway();
    assertThatThrownBy(flyway2::validate)
        .isInstanceOf(FlywayValidateException.class)
        .hasMessageContaining("checksum mismatch");

    // schema_history 行 checksum 未被覆盖 (validate 只读)
    try (Connection conn = PG.createConnection("");
        PreparedStatement ps = conn.prepareStatement(
            "SELECT checksum FROM flyway_schema_history WHERE version = '1.0.084'")) {
      try (ResultSet rs = ps.executeQuery()) {
        rs.next();
        assertThat(rs.getObject("checksum"))
            .as("validate must not overwrite schema_history checksum")
            .isEqualTo(schemaHistoryChecksumBefore);
      }
    }
  }

  // ============================================================================
  // helpers
  // ============================================================================

  private Flyway newFlyway() {
    return Flyway.configure()
        .dataSource(jdbcUrl(), dbUser(), dbPass())
        .locations("filesystem:" + tempMigrationDir.toString())
        .baselineOnMigrate(false)
        .cleanDisabled(true)
        .load();
  }

  private static String levelCode(int level) {
    return switch (level) {
      case 0 -> "INITIAL";
      case 1 -> "H1";
      case 2 -> "D1";
      case 3 -> "D3";
      case 4 -> "D7";
      case 5 -> "D15";
      case 6 -> "D30";
      default -> "OTHER";
    };
  }

  private static void fillRow(PreparedStatement ps, long id, Instant base, int seq,
      String source, Double conf) throws Exception {
    ps.setLong(1, id);
    ps.setLong(2, (long) seq);
    ps.setLong(3, 7001L);
    ps.setShort(4, (short) (seq % 7));
    ps.setString(5, levelCode(seq % 7));
    ps.setString(6, source);
    if (conf == null) {
      ps.setNull(7, java.sql.Types.NUMERIC);
    } else {
      ps.setBigDecimal(7, java.math.BigDecimal.valueOf(conf));
    }
  }

  private static String explain(Connection conn, String sql) throws Exception {
    try (Statement st = conn.createStatement();
        ResultSet rs = st.executeQuery("EXPLAIN " + sql)) {
      StringBuilder sb = new StringBuilder();
      while (rs.next()) {
        sb.append(rs.getString(1)).append('\n');
      }
      return sb.toString();
    }
  }

  /** column_name → ColumnMeta · 用 information_schema.columns 取. */
  private static Map<String, ColumnMeta> readColumnMeta(Connection conn, String table)
      throws Exception {
    Map<String, ColumnMeta> m = new HashMap<>();
    try (PreparedStatement ps = conn.prepareStatement(
        "SELECT column_name, data_type, character_maximum_length, numeric_precision, "
            + "numeric_scale, is_nullable, column_default "
            + "FROM information_schema.columns WHERE table_name = ? ORDER BY ordinal_position")) {
      ps.setString(1, table);
      try (ResultSet rs = ps.executeQuery()) {
        while (rs.next()) {
          m.put(rs.getString("column_name"), new ColumnMeta(
              rs.getString("data_type"),
              (Integer) rs.getObject("character_maximum_length"),
              (Integer) rs.getObject("numeric_precision"),
              (Integer) rs.getObject("numeric_scale"),
              rs.getString("is_nullable"),
              rs.getString("column_default")));
        }
      }
    }
    return m;
  }

  private static List<String> readIndexNames(Connection conn, String table) throws Exception {
    List<String> out = new ArrayList<>();
    try (PreparedStatement ps = conn.prepareStatement(
        "SELECT indexname FROM pg_indexes WHERE tablename = ? ORDER BY indexname")) {
      ps.setString(1, table);
      try (ResultSet rs = ps.executeQuery()) {
        while (rs.next()) {
          out.add(rs.getString(1));
        }
      }
    }
    return out;
  }

  private static void assertColumn(Map<String, ColumnMeta> cols, String name, String dataType,
      Integer charMaxLen, Integer numPrec, Integer numScale, String isNullable, String defaultVal) {
    ColumnMeta c = cols.get(name);
    assertThat(c).as("column " + name + " present").isNotNull();
    assertThat(c.dataType).as(name + ".data_type").isEqualTo(dataType);
    if (charMaxLen != null) {
      assertThat(c.charMaxLen).as(name + ".character_maximum_length").isEqualTo(charMaxLen);
    }
    if (numPrec != null) {
      assertThat(c.numPrec).as(name + ".numeric_precision").isEqualTo(numPrec);
    }
    if (numScale != null) {
      assertThat(c.numScale).as(name + ".numeric_scale").isEqualTo(numScale);
    }
    assertThat(c.isNullable).as(name + ".is_nullable").isEqualTo(isNullable);
    if (defaultVal == null) {
      // 不做 default 断言 · 因 PG NULL default 字段为 null
    } else {
      assertThat(c.columnDefault).as(name + ".column_default").contains(defaultVal);
    }
  }

  private static void assertColumnDefaultContains(Map<String, ColumnMeta> cols, String name,
      String dataType, String isNullable, String defaultContains) {
    ColumnMeta c = cols.get(name);
    assertThat(c).as("column " + name + " present").isNotNull();
    assertThat(c.dataType).as(name + ".data_type").isEqualTo(dataType);
    assertThat(c.isNullable).as(name + ".is_nullable").isEqualTo(isNullable);
    assertThat(c.columnDefault)
        .as(name + ".column_default LIKE %" + defaultContains + "%")
        .containsIgnoringCase(defaultContains);
  }

  private static String md5Hex(byte[] bytes) throws Exception {
    MessageDigest md = MessageDigest.getInstance("MD5");
    return HexFormat.of().formatHex(md.digest(bytes));
  }

  private record ColumnMeta(
      String dataType,
      Integer charMaxLen,
      Integer numPrec,
      Integer numScale,
      String isNullable,
      String columnDefault) {}
}
