package com.longfeng.anonymousservice.config;

import io.minio.MinioClient;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * SC-12-T04 · MinIO client bean for the anonymous-service guest-capture flow.
 *
 * <p>Mirrors {@code file-service}' {@code MinioConfig} structure but the bean
 * is explicitly named {@code anonMinioClient} so future merges with file-service
 * into one JVM cannot collide on bean name resolution. Downstream services
 * inject via {@code @Qualifier("anonMinioClient")}.
 *
 * <p>The endpoint / credentials come from {@link AnonStorageProperties}
 * (prefix {@code anon.storage}); for the sandbox dev environment they default
 * to {@code http://localhost:9000} + {@code minioadmin}.
 */
@Configuration
public class AnonMinioConfig {

    @Bean(name = "anonMinioClient")
    public MinioClient anonMinioClient(AnonStorageProperties props) {
        return MinioClient.builder()
                .endpoint(props.getEndpoint())
                .credentials(props.getAccessKey(), props.getSecretKey())
                .build();
    }
}
