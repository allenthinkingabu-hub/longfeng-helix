package com.longfeng.reviewplan;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * S5 IT backbone · 复用 S3 同款 pgvector/pg16 @ 127.0.0.1:15432（由 ops/scripts/it-stack-up.sh 预起）.
 *
 * <p>为避免 Boot 拉 Nacos/Feign/Sentinel · IT 关掉 feign.sentinel.enabled + spring.cloud.*.enabled.
 *
 * <p>SC-01-C05: 因 IT 共享 DB 与多个模块的 flyway 历史脏态冲突，直接关闭 Flyway 自启；
 * 由本类 static block 应用必要的 schema patch（V1.0.065 outbox event_type CHECK 扩展）.
 */
public abstract class IntegrationTestBase {

  protected static final String DB_URL = "jdbc:postgresql://127.0.0.1:15436/wrongbook";
  protected static final String DB_USER = "longfeng";
  protected static final String DB_PASSWORD = "longfeng_dev";

  static {
    // SC-01-C05 · 因 flyway 已禁用，直接 ALTER review_plan_outbox.event_type CHECK 扩展（V1.0.065 等价）
    try (Connection conn = DriverManager.getConnection(DB_URL, DB_USER, DB_PASSWORD);
        Statement st = conn.createStatement()) {
      st.execute("ALTER TABLE review_plan_outbox "
          + "DROP CONSTRAINT IF EXISTS review_plan_outbox_event_type_check");
      st.execute("ALTER TABLE review_plan_outbox "
          + "ADD CONSTRAINT review_plan_outbox_event_type_check "
          + "CHECK (event_type IN ('due','completed','mastered','opened','graded',"
          + "'calendar_event_batch_create'))");
    } catch (Exception e) {
      // 容错：DB 不可达或表已不一致时，让后续 Boot 流程自然报错（避免在 static 阶段 swallow）.
      System.err.println(
          "IntegrationTestBase static schema patch skipped (will surface later): "
              + e.getMessage());
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
    // SC-01-C05 · 兼容已有 IT DB 中表/对象先于 flyway_schema_history 存在的脏态（其他模块先跑 flyway 或共享 DB）
    r.add("spring.flyway.out-of-order", () -> "true");
    r.add("spring.flyway.validate-on-migrate", () -> "false");
    r.add("spring.flyway.baseline-on-migrate", () -> "true");
    r.add("spring.flyway.baseline-version", () -> "1");
    // SC-01-C05 · review-plan-service 本地 4 个迁移在共享 DB 中可能已被等价对象占位 → 跳过执行避免 'relation already exists'
    r.add("spring.flyway.ignore-migration-patterns", () -> "*:missing,*:future,*:ignored");
    r.add("spring.flyway.enabled", () -> "true");
    r.add("review.mq.enabled", () -> "false");
    r.add("review.feign.enabled", () -> "false");
    r.add("feign.sentinel.enabled", () -> "false");
    r.add("spring.cache.type", () -> "none"); // IT 关 @Cacheable · 避免跨 test 污染
    r.add("spring.cloud.nacos.discovery.enabled", () -> "false");
    r.add("spring.cloud.nacos.config.enabled", () -> "false");
    r.add("spring.cloud.discovery.enabled", () -> "false");
  }
}
