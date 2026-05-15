package com.longfeng.fileservice;

import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * S6 IT backbone · sandbox containers (PHASE-A aligned):
 *
 * <ul>
 *   <li>PostgreSQL localhost:15432/wrongbook (user=longfeng, password=longfeng_dev)
 *   <li>MinIO localhost:9000 (user=minio, password=minio12345)
 *   <li>Redis localhost:16379
 * </ul>
 */
public abstract class IntegrationTestBase {

    protected static final String DB_URL = "jdbc:postgresql://127.0.0.1:15432/wrongbook";
    protected static final String DB_USER = "longfeng";
    protected static final String DB_PASSWORD = "longfeng_dev";
    protected static final String MINIO_ENDPOINT = "http://127.0.0.1:9000";
    protected static final String MINIO_USER = "minioadmin";
    protected static final String MINIO_PASSWORD = "minioadmin";

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", () -> DB_URL);
        r.add("spring.datasource.username", () -> DB_USER);
        r.add("spring.datasource.password", () -> DB_PASSWORD);
        r.add("spring.flyway.enabled", () -> "false");
        r.add("spring.jpa.hibernate.ddl-auto", () -> "update");
        r.add("spring.cache.type", () -> "none");
        r.add("spring.data.redis.host", () -> "127.0.0.1");
        r.add("spring.data.redis.port", () -> "16379");

        r.add("file-service.storage.provider", () -> "minio");
        r.add("file-service.storage.endpoint", () -> MINIO_ENDPOINT);
        r.add("file-service.storage.bucket", () -> "s6-it-bucket");
        r.add("file-service.storage.access-key", () -> MINIO_USER);
        r.add("file-service.storage.secret-key", () -> MINIO_PASSWORD);
        r.add("file-service.storage.presign-ttl-seconds", () -> "900");
        r.add("file-service.storage.max-upload-size", () -> "10485760");

        // PresignController @Value defaults
        r.add("app.storage.presign-ttl-min", () -> "15");
        r.add("app.storage.minio.bucket", () -> "s6-it-bucket");
    }
}
