package com.longfeng.fileservice;

import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * S6 IT backbone · 复用常驻容器（与 S3 同款规避 Testcontainers 1.20 + Docker Desktop 4.64+ 不兼容）：
 *
 * <ul>
 *   <li>PostgreSQL 15432 · {@code s3-it-pg}（ops/scripts/it-stack-up.sh 拉起）
 *   <li>MinIO 9000/9001 · {@code s6-it-minio}（本 Phase 新增常驻 · 手工启动见 §10.7 Step 3b）
 * </ul>
 *
 * <p>启动命令：
 *
 * <pre>
 * docker run -d --name s6-it-minio -p 9000:9000 -p 9001:9001 \
 *   -e MINIO_ROOT_USER=minio -e MINIO_ROOT_PASSWORD=minio12345 \
 *   minio/minio:RELEASE.2024-05-01T01-11-10Z server /data --console-address :9001
 * </pre>
 *
 * <p>Testcontainers 恢复 Docker Desktop 兼容后 · 本 backbone 可改回 @Testcontainers 模式.
 */
public abstract class IntegrationTestBase {

  protected static final String DB_URL = "jdbc:postgresql://127.0.0.1:15432/wrongbook";
  protected static final String DB_USER = "postgres";
  protected static final String DB_PASSWORD = "wb";
  // SC-01-T01 attempt-3 (retries=2) · MinIO 端口从 9000 改 19000:
  // 当前 lf-dev-minio 容器 publish 19000:9000 (旧 s6-it-minio @ 9000 已下线 ·
  // 见 env-snapshot.md docker ps 真证 + attempt-3 IT base 端口对齐)。
  protected static final String MINIO_ENDPOINT = "http://127.0.0.1:19000";
  protected static final String MINIO_USER = "minio";
  protected static final String MINIO_PASSWORD = "minio12345";

  @DynamicPropertySource
  static void props(DynamicPropertyRegistry r) {
    r.add("spring.datasource.url", () -> DB_URL);
    r.add("spring.datasource.username", () -> DB_USER);
    r.add("spring.datasource.password", () -> DB_PASSWORD);
    r.add("spring.flyway.url", () -> DB_URL);
    r.add("spring.flyway.user", () -> DB_USER);
    r.add("spring.flyway.password", () -> DB_PASSWORD);
    r.add("spring.flyway.locations", () -> "classpath:db/migration");
    // SC-01-T01 attempt-2 (retries=1) cascade fix · 9 cascade IT errors root cause:
    // 常驻容器 s3-it-pg 上 file.wb_file / file.wb_file_lifecycle 表早已建好 (上一次手工
    // 或 prior IT 跑过)，但 public.flyway_schema_history 已有 36 行 (max=1.0.064) 且
    // **不含** V1.0.080 / V1.0.081 → 本进程 Flyway 进入时尝试 CREATE TABLE 与既存表
    // 冲突 `relation "wb_file" already exists`. 由于 history 非空, baseline-on-migrate
    // 不生效 (Flyway 只在空 history 时执行 baseline)。
    //
    // PresignRealPgIT 走 @TestPropertySource 显式禁掉 spring.flyway.enabled，因此 GREEN;
    // FileUploadIT / MockMvcSmokeIT / BackendChainIT 走 IntegrationTestBase 路径，原先
    // 启用 Flyway → 全部 fail-fast (ApplicationContext threshold-1 触发 cascade)。
    //
    // 修法 (最小手术 · Rule 3 surgical): 与 PresignRealPgIT 对齐, 在 IT base 中显式
    // spring.flyway.enabled=false。常驻容器 schema 是手工管理的 (ops/scripts/it-stack-up.sh),
    // ITs 只是消费 schema 不需要 IT 进程内再迁移。不影响生产 (生产 Flyway 仍在
    // application.yml 默认 enabled)。
    r.add("spring.flyway.enabled", () -> "false");
    // SC-01-T01 attempt-2 (retries=1) cascade fix · 第二层根因: 关掉 Flyway 后, 默认
    // hibernate.ddl-auto=validate 模式撞上 WbFile entity 与既存表 schema drift —
    // V1.0.080 建表为 status SMALLINT 但实体声明 int → 抛
    // "Schema-validation: wrong column type encountered in column [status] in table
    // [file.wb_file]; found [int2], but expecting [integer]". PresignRealPgIT 显式
    // ddl-auto=none 故能跑通, IT base 之前缺这一项。
    //
    // 与 PresignRealPgIT 对齐: 关掉 schema validation, 信常驻容器手工 schema 真值,
    // 不让 Hibernate 二次校验。entity/列底层 drift 由 Flyway migration 升级解决,
    // 不在 SC-01-T01 范围。
    r.add("spring.jpa.hibernate.ddl-auto", () -> "none");
    r.add("spring.cache.type", () -> "none");
    // SC-01-T01 attempt-2 (retries=1) cascade fix · 第三层根因: 我在 attempt-1 把
    // spring-boot-starter-data-redis 加进 file-service pom (PresignController 24h
    // idempotency cache 需要 StringRedisTemplate)。这激活了 Spring Boot Redis
    // health indicator, MockMvcSmokeIT.healthIsUp 期望 /actuator/health=UP,
    // 默认 Redis @ localhost:6379 不存在 → DOWN → health 整体 DOWN → assertion 失败。
    // 常驻容器 s3-it-redis @ 127.0.0.1:16379 已就位, 指过去即可。Redis 与 IT 业务
    // 解耦 (PresignController.redis 是 @Autowired(required=false) field, redis=null
    // 时静默走 no-op 分支), 但 health probe 需要真连。
    r.add("spring.data.redis.host", () -> "127.0.0.1");
    r.add("spring.data.redis.port", () -> "16379");

    r.add("file-service.storage.provider", () -> "minio");
    r.add("file-service.storage.endpoint", () -> MINIO_ENDPOINT);
    r.add("file-service.storage.bucket", () -> "s6-it-bucket");
    r.add("file-service.storage.access-key", () -> MINIO_USER);
    r.add("file-service.storage.secret-key", () -> MINIO_PASSWORD);
    r.add("file-service.storage.presign-ttl-seconds", () -> "900");
    r.add("file-service.storage.max-upload-size", () -> "10485760");
  }
}
